import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { salidasAPI, cierreCajaAPI, productosAPI, ventasAPI } from "../api";
import GastosBoxes from "../components/GastosBoxes";

const formatNumero = (valor) => {
  const n = parseFloat(valor);
  if (!Number.isFinite(n)) return "0";
  return parseFloat(n.toFixed(2)).toString();
};

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [stats, setStats] = useState(null);
  const [salidas, setSalidas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [stockBajo, setStockBajo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [camionActivo, setCamionActivo] = useState(null);
  const [regresando, setRegresando] = useState(null);
  const [editandoRegreso, setEditandoRegreso] = useState(false);
  const [itemsRegreso, setItemsRegreso] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelandoId, setCancelandoId] = useState(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [showStockBajo, setShowStockBajo] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const promises = [
        salidasAPI.getStats(),
        salidasAPI.getAll(),
        cierreCajaAPI.getResumenHoy(),
        productosAPI.getLowStock(),
      ];
      const [statsRes, salidasRes, resumenRes, stockRes] = await Promise.all(promises);
      setStats(statsRes.data);
      setSalidas(salidasRes.data);
      setResumen(resumenRes.data);
      setStockBajo(stockRes.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateEstado = async (id, estado, notas) => {
    try {
      await salidasAPI.updateStatus(id, { estado, notas });
      loadData();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const openRegresoForm = async (salida, editando = false) => {
    setRegresando(salida);
    setEditandoRegreso(editando);
    try {
      const res = await salidasAPI.getStockCamion(salida.id);
      const stockMap = {};
      for (const s of res.data.items) {
        stockMap[s.productoId] = s;
      }
      const items = (salida.SalidaCamionItems || []).map((item) => {
        const stock = stockMap[item.productoId];
        const vendido = stock ? stock.vendido : 0;
        const maxDevolver = item.cantidad - vendido;
        const devueltoPrevio = item.cantidad_devuelta ?? (stock ? stock.devuelto : 0);
        return {
          productoId: item.productoId,
          nombre: item.Producto?.nombre,
          precio_unitario: parseFloat(item.precio_unitario),
          cantidad_enviada: item.cantidad,
          cantidad_vendida: vendido,
          max_devolver: maxDevolver,
          cantidad_regreso: editando ? Math.min(devueltoPrevio, maxDevolver) : 0,
        };
      });
      setItemsRegreso(items);
    } catch (error) {
      alert("Error al obtener stock del camion: " + (error.response?.data?.message || error.message));
    }
  };

  const handleCantidadRegreso = (index, value) => {
    const newItems = [...itemsRegreso];
    const cant = parseInt(value) || 0;
    newItems[index].cantidad_regreso = Math.min(cant, newItems[index].max_devolver);
    setItemsRegreso(newItems);
  };

  const calcularMontoRegreso = () => {
    return itemsRegreso.reduce((sum, item) => {
      return sum + item.precio_unitario * item.cantidad_regreso;
    }, 0);
  };

  const confirmarEntregado = () => {
    setShowConfirm(true);
  };

  const ejecutarEntregado = async () => {
    setShowConfirm(false);
    if (!regresando) return;
    try {
      const items_para_enviar = itemsRegreso
        .filter((item) => item.cantidad_regreso > 0)
        .map((item) => ({
          productoId: item.productoId,
          cantidad: item.cantidad_regreso,
        }));

      const res = await salidasAPI.registrarRegreso(regresando.id, {
        items_regreso: items_para_enviar,
      });
      setRegresando(null);
      loadData();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const handleEntregadoClick = (id) => {
    const salida = salidas.find((s) => s.id === id);
    if (salida) openRegresoForm(salida);
  };

  const [cierreExitoso, setCierreExitoso] = useState(false);
  const [showPendientesCierre, setShowPendientesCierre] = useState(false);
  const [salidasPendientesCierre, setSalidasPendientesCierre] = useState([]);

  const handleCerrarCaja = async () => {
    const pendientes = salidas.filter((s) => s.estado === "pendiente");
    const enCamino = salidas.filter((s) => s.estado === "en_camino");

    if (pendientes.length > 0 || enCamino.length > 0) {
      setSalidasPendientesCierre([...pendientes, ...enCamino]);
      setShowPendientesCierre(true);
      return;
    }

    if (!confirm("¿Cerrar la caja del dia? No se podran hacer mas modificaciones.")) return;
    setCerrando(true);
    try {
      await cierreCajaAPI.cerrar();
      setCierreExitoso(true);
      setSalidas([]);
      setStats(null);
      setResumen(null);
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    } finally {
      setCerrando(false);
    }
  };

  const agruparPorCamion = (items) => {
    const grupos = {};
    (items || []).forEach((item) => {
      const camion = item.camion || "Sin camion";
      if (!grupos[camion]) grupos[camion] = [];
      grupos[camion].push(item);
    });
    return grupos;
  };

  const agruparPorSalida = (items) => {
    const grupos = {};
    (items || []).forEach((item) => {
      const id = item.salida_id || "desconocido";
      if (!grupos[id]) grupos[id] = { repartidor: item.repartidor, items: [] };
      grupos[id].items.push(item);
    });
    return grupos;
  };

  if (loading) return <div className="loading">Cargando...</div>;

  const estadoColors = {
    pendiente: "#f59e0b",
    en_camino: "#3b82f6",
    entregado: "#10b981",
    cancelado: "#ef4444",
    sobrante: "#ef4444",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        {stockBajo.length > 0 && (
          <button
            className="btn btn-sm btn-cancel"
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            onClick={() => setShowStockBajo(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Stock Bajo ({stockBajo.length})
          </button>
        )}
      </div>

      {showCancelConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1001 }} onClick={() => { setShowCancelConfirm(false); setCancelMotivo(""); }}>
          <div className="modal-card modal-responsive" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)", display: "flex",
                alignItems: "center", justifyContent: "center", margin: "0 auto 1rem"
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <h3 style={{ color: "var(--danger)", marginBottom: "0.5rem" }}>Cancelar Envio</h3>
            </div>
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label>Motivo de cancelacion</label>
              <textarea
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Describa el motivo de la cancelacion..."
                rows={3}
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowCancelConfirm(false); setCancelMotivo(""); }}>
                Volver
              </button>
              <button
                className="btn btn-cancel"
                disabled={!cancelMotivo.trim()}
                onClick={() => {
                  setShowCancelConfirm(false);
                  updateEstado(cancelandoId, "cancelado", cancelMotivo);
                  setCancelMotivo("");
                }}
              >
                Confirmar Cancelacion
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1001 }} onClick={() => setShowConfirm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "rgba(245, 158, 11, 0.15)", display: "flex",
                alignItems: "center", justifyContent: "center", margin: "0 auto 1rem"
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 style={{ color: "var(--warning)", marginBottom: "0.5rem" }}>Aviso Importante</h3>
            </div>
            <p style={{ textAlign: "center", color: "var(--text)", lineHeight: "1.6", marginBottom: "0.5rem" }}>
              {editandoRegreso ? (
                <>Para guardar los cambios, la mercaderia vendida debe estar registrada como <strong>Venta por Reparto</strong> en la seccion de Ventas.</>
              ) : (
                <>Para confirmar la entrega primero debe registrar la mercaderia vendida como <strong>Venta por Reparto</strong> en la seccion de Ventas.</>
              )}
            </p>
            <p style={{ textAlign: "center", color: "var(--danger)", fontWeight: "500", marginBottom: "1.5rem" }}>
              Si no registro la venta por reparto, la entrega no podra completarse.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={ejecutarEntregado}>
                {editandoRegreso ? "Guardar Cambios" : "Confirmar Entrega"}
              </button>
            </div>
          </div>
        </div>
      )}

      {regresando && (
        <div className="modal-overlay" onClick={() => setRegresando(null)}>
          <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{editandoRegreso ? "Editar Regreso" : "Registrar Entrega"} - {regresando.camion}</h3>
            <p className="subtitle">
              {editandoRegreso
                ? "Modifica las cantidades de la mercaderia devuelta"
                : "Selecciona los productos que regresaron y sus cantidades"}
            </p>

            <div className="table-container" style={{ maxHeight: "200px", overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Precio Unit.</th>
                    <th>Cargados</th>
                    <th>Vendidos</th>
                    <th>Max. Devolver</th>
                    <th>Regresan</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsRegreso.map((item, index) => (
                    <tr key={item.productoId}>
                      <td><strong>{item.nombre}</strong></td>
                      <td>${item.precio_unitario}</td>
                      <td>{item.cantidad_enviada}</td>
                      <td style={{ color: item.cantidad_vendida > 0 ? "var(--primary)" : "inherit", fontWeight: item.cantidad_vendida > 0 ? "bold" : "normal" }}>
                        {item.cantidad_vendida}
                      </td>
                      <td style={{ fontWeight: "bold" }}>{item.max_devolver}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={item.max_devolver}
                          value={item.cantidad_regreso}
                          onChange={(e) => handleCantidadRegreso(index, e.target.value)}
                          className="input-cantidad"
                        />
                      </td>
                      <td style={{ color: "var(--danger)", fontWeight: "bold" }}>
                        ${(item.precio_unitario * item.cantidad_regreso).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="resumen-card" style={{ marginTop: "1rem" }}>
              <div className="resumen-row">
                <span>Monto de Regreso:</span>
                <strong style={{ color: "var(--danger)" }}>${calcularMontoRegreso().toFixed(2)}</strong>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setRegresando(null)}>
                Cancelar
              </button>
              <button className="btn btn-entregado" onClick={confirmarEntregado}>
                {editandoRegreso ? "Guardar Cambios" : "Confirmar Entrega"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPendientesCierre && (
        <div className="modal-overlay" onClick={() => setShowPendientesCierre(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)", display: "flex",
                alignItems: "center", justifyContent: "center", margin: "0 auto 1rem"
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <h3 style={{ color: "var(--danger)", marginBottom: "0.5rem" }}>Envios sin Finalizar</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                No se puede cerrar la caja. Las siguientes salidas estan sin finalizar:
              </p>
            </div>
            <div className="table-container" style={{ maxHeight: "200px", overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Camion</th>
                    <th>Zona</th>
                    <th>Repartidor</th>
                  </tr>
                </thead>
                <tbody>
                  {salidasPendientesCierre.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <span className="estado-badge" style={{
                          backgroundColor: s.estado === "pendiente" ? "#f59e0b" : "#3b82f6",
                          fontSize: "0.7rem", padding: "2px 6px"
                        }}>
                          {s.estado === "pendiente" ? "Pendiente" : "En Camino"}
                        </span>
                      </td>
                      <td><strong>{s.camion}</strong></td>
                      <td>{s.destino || "-"}</td>
                      <td>{s.repartidor_asignado?.nombre || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary btn-full" onClick={() => setShowPendientesCierre(false)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {cierreExitoso && (
        <div className="section" style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
          <h3 style={{ color: "var(--success)", marginBottom: "0.5rem" }}>Caja Cerrada Exitosamente</h3>
          <p style={{ color: "var(--text-secondary)" }}>El dia ha sido cerrado. No se pueden realizar mas operaciones.</p>
        </div>
      )}

      {!cierreExitoso && stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>{stats.total}</h3>
            <p>Total Salidas</p>
          </div>
          <div className="stat-card stat-pendiente">
            <h3>{stats.pendientes}</h3>
            <p>Pendientes</p>
          </div>
          <div className="stat-card stat-camino">
            <h3>{stats.en_camino}</h3>
            <p>En Camino</p>
          </div>
          <div className="stat-card stat-entregado">
            <h3>{stats.entregados}</h3>
            <p>Entregados</p>
          </div>
          <div className="stat-card stat-ventas">
            <h3>${formatNumero(stats.total_ventas)}</h3>
            <p>Ventas del Dia</p>
          </div>
        </div>
      )}

      {showStockBajo && stockBajo.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowStockBajo(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)", display: "flex",
                alignItems: "center", justifyContent: "center", margin: "0 auto 1rem"
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 style={{ color: "var(--danger)", marginBottom: "0.5rem" }}>Stock Bajo</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Los siguientes productos tienen stock por debajo del minimo:</p>
            </div>
            <div className="table-container" style={{ maxHeight: "250px", overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Stock Actual</th>
                    <th>Stock Minimo</th>
                    <th>Proveedor</th>
                  </tr>
                </thead>
                <tbody>
                  {stockBajo.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.nombre}</strong></td>
                      <td><strong className="stock-bajo">{p.stock}</strong></td>
                      <td>{p.stock_minimo}</td>
                      <td>{p.Proveedor?.nombre || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary btn-full" onClick={() => setShowStockBajo(false)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <GastosBoxes />

      {resumen && (
        <div className="section">
          <h3>Cierre de Caja del Dia</h3>
          {resumen.cerrado && (
            <div className="cierre-cerrado-header" style={{ marginBottom: "0.5rem" }}>
              <span className="cierre-cerrado-badge">CERRADO</span>
            </div>
          )}

          <div className="form-card">
            <div className="cierre-2col">
              <div className="cierre-col">
                <div className="cierre-item"><span>Salidas:</span><strong>{resumen.salidas_count}</strong></div>
                <div className="cierre-item">
                  <span>Mercaderia Enviada:</span>
                  <strong className="monto-salida">${resumen.mercaderia_enviada}</strong>
                </div>

                {(() => {
                  const gruposEnviadas = agruparPorCamion(resumen.detalle_enviadas);
                  const gruposDevueltas = agruparPorCamion(resumen.detalle_devueltas);
                  const todosLosCamiones = [...new Set([
                    ...Object.keys(gruposEnviadas),
                    ...Object.keys(gruposDevueltas),
                  ])];
                  if (todosLosCamiones.length === 0) return null;
                  return (
                    <div className="cierre-camiones-lista">
                      <div className="cierre-separator"></div>
                      <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Salidas por Camion</h4>
                      {todosLosCamiones.map((camion) => (
                        <div key={camion} className="camion-item-row">
                          <span className="camion-item-nombre">{camion}</span>
                          <button
                            className={`btn btn-sm ${camionActivo === camion ? "btn-cancel" : "btn-secondary"}`}
                            onClick={() => setCamionActivo(camionActivo === camion ? null : camion)}
                          >
                            {camionActivo === camion ? "Cerrar" : "Detalle"}
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {camionActivo && (
                  <div className="cierre-detalle-expandido">
                    <div className="camion-seccion-2col">
                      <div className="camion-detalle-col">
                        <div className="camion-detalle-label monto-salida">Mercaderia Enviada</div>
                        {(() => {
                          const grupos = agruparPorSalida(agruparPorCamion(resumen.detalle_enviadas)[camionActivo]);
                          const claves = Object.keys(grupos);
                          if (claves.length === 0) return <p className="empty-mini">Sin mercaderia enviada</p>;
                          return (
                            <div className="detalle-scroll-container">
                              {claves.map((salidaId) => (
                                <div key={salidaId} className="camion-operacion-grupo">
                                  <div className="camion-operacion-header">Operacion #{salidaId} &mdash; {grupos[salidaId].repartidor}</div>
                                  <table>
                                    <thead>
                                      <tr>
                                        <th>Producto</th>
                                        <th>Cant.</th>
                                        <th>P. Unit.</th>
                                        <th>Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {grupos[salidaId].items.map((item, i) => (
                                        <tr key={i}>
                                          <td>{item.producto}</td>
                                          <td>{item.cantidad}</td>
                                          <td>${item.precio_unitario.toFixed(2)}</td>
                                          <td><strong className="monto-salida">${item.subtotal.toFixed(2)}</strong></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="camion-detalle-col">
                        <div className="camion-detalle-label monto-regreso">Mercaderia Devuelta</div>
                        {(() => {
                          const grupos = agruparPorSalida(agruparPorCamion(resumen.detalle_devueltas)[camionActivo]);
                          const claves = Object.keys(grupos);
                          if (claves.length === 0) return <p className="empty-mini">Sin mercaderia devuelta</p>;
                          return (
                            <div className="detalle-scroll-container">
                              {claves.map((salidaId) => (
                                <div key={salidaId} className="camion-operacion-grupo">
                                  <div className="camion-operacion-header">Operacion #{salidaId} &mdash; {grupos[salidaId].repartidor}</div>
                                  <table>
                                    <thead>
                                      <tr>
                                        <th>Producto</th>
                                        <th>Cant.</th>
                                        <th>P. Unit.</th>
                                        <th>Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {grupos[salidaId].items.map((item, i) => (
                                        <tr key={i}>
                                          <td>{item.producto}</td>
                                          <td>{item.cantidad}</td>
                                          <td>${item.precio_unitario.toFixed(2)}</td>
                                          <td><strong className="monto-regreso">${item.subtotal.toFixed(2)}</strong></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="cierre-col">
                <div className="cierre-block">
                  <h4>Ventas Mayoristas</h4>
                  <div className="cierre-item"><span>Ventas:</span><strong>{resumen.local_count}</strong></div>
                  <div className="cierre-item"><span>Total:</span><strong className="monto-ventas">${resumen.local_monto}</strong></div>
                </div>
                <div className="cierre-block">
                  <h4>Ventas por Reparto</h4>
                  <div className="cierre-item"><span>Ventas:</span><strong>{resumen.reparto_count}</strong></div>
                  <div className="cierre-item"><span>Total:</span><strong className="monto-ventas">${resumen.reparto_monto}</strong></div>
                </div>
                <div className="cierre-separator"></div>
                <div className="cierre-item cierre-total"><span>Total General:</span><strong>${resumen.total_general}</strong></div>
                {resumen.cerrado && (
                  <>
                    <div className="cierre-item"><span>Fecha:</span><strong>{resumen.fecha}</strong></div>
                    <div className="cierre-item"><span>Hora cierre:</span><strong>{resumen.cierre?.hora || "-"}</strong></div>
                    <div className="cierre-item"><span>Realizado por:</span><strong>{resumen.cierre?.usuario_cierre || "-"}</strong></div>
                  </>
                )}
              </div>
            </div>

            <div className="cierre-separator"></div>
            <div className="cierre-item">
              <span>Mercaderia Devuelta:</span>
              <strong className="monto-regreso">${resumen.mercaderia_devuelta}</strong>
            </div>

            {!resumen.cerrado && (
              <button
                className="btn btn-primary btn-full btn-cerrar-caja"
                onClick={handleCerrarCaja}
                disabled={cerrando}
              >
                {cerrando ? "Cerrando..." : "Cerrar Caja del Dia"}
              </button>
            )}
          </div>
        </div>
      )}

      {!cierreExitoso && (
        <div className="section">
          <h3>Salidas de Hoy ({salidas.length})</h3>
          {salidas.length === 0 ? (
            <p className="empty">No hay salidas registradas hoy</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Zona</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                    <th>Repartidor</th>
                    <th>Monto Salida</th>
                    <th>Monto Regreso</th>
                    <th>Total</th>
                    <th>Mercaderia</th>
                  </tr>
                </thead>
                <tbody>
                  {salidas.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.destino || "-"}</strong></td>
                      <td>
                        <span
                          className="estado-badge"
                          style={{ backgroundColor: estadoColors[s.estado] }}
                        >
                          {s.estado.replace("_", " ")}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          {s.estado === "pendiente" && (
                            <button
                              className="btn btn-sm btn-camino"
                              onClick={() => updateEstado(s.id, "en_camino")}
                            >
                              Enviar
                            </button>
                          )}
                          {s.estado === "en_camino" && (
                            <button
                              className="btn btn-sm btn-entregado"
                              onClick={() => handleEntregadoClick(s.id)}
                            >
                              Registrar Entrega
                            </button>
                          )}
                          {s.estado === "sobrante" && isAdmin && (
                            <button
                              className="btn btn-sm btn-warning"
                              onClick={() => openRegresoForm(s, true)}
                            >
                              Editar
                            </button>
                          )}
                          {s.estado !== "entregado" && s.estado !== "cancelado" && s.estado !== "sobrante" && (
                            <button
                              className="btn btn-sm btn-cancel"
                              onClick={() => { setCancelandoId(s.id); setShowCancelConfirm(true); }}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                      <td>{s.repartidor_asignado?.nombre || "-"}</td>
                      <td>{s.monto_salida ? <strong className="monto-salida">${s.monto_salida}</strong> : "-"}</td>
                      <td>{s.monto_regreso ? <strong className="monto-regreso">${s.monto_regreso}</strong> : "-"}</td>
                      <td><strong>${(parseFloat(s.monto_salida || 0) - parseFloat(s.monto_regreso || 0)).toFixed(2)}</strong></td>
                      <td>
                        <div className="badge-grid">
                          {s.SalidaCamionItems?.map((item) => (
                            <span key={item.id} className="badge">
                              {item.cantidad}x {item.Producto?.nombre}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
