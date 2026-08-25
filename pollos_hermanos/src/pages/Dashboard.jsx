import { useState, useEffect } from "react";
import { salidasAPI, cierreCajaAPI, productosAPI, gastosAPI, pagosEmpleadosAPI, usuariosAPI } from "../api";
import { useAuth } from "../context/AuthContext";
import { dinero } from "../utils/numero";

const getFechaLocal = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

const redondearUnid = (n) => Math.round(n * 1000) / 1000;

const formatCant = (n) => {
  const num = Number(n) || 0;
  return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
};

const textoCantidad = (cant) => `${formatCant(cant)} unid.`;

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const formatVentas = dinero;
  const [editandoRegreso, setEditandoRegreso] = useState(false);
  const [stats, setStats] = useState(null);
  const [salidas, setSalidas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [stockBajo, setStockBajo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [camionActivo, setCamionActivo] = useState(null);
  const [regresando, setRegresando] = useState(null);
  const [itemsRegreso, setItemsRegreso] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelandoId, setCancelandoId] = useState(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cancelarConRegreso, setCancelarConRegreso] = useState(false);
  const [showStockBajo, setShowStockBajo] = useState(false);
  const [gastos, setGastos] = useState({ combustible: "0.00", otros: "0.00", descripcion_otros: "" });
  const [showPagosEmpleados, setShowPagosEmpleados] = useState(false);
  const [empleados, setEmpleados] = useState([]);
  const [pagosForm, setPagosForm] = useState({});
  const [guardandoPagos, setGuardandoPagos] = useState(false);
  const [fechaConsulta, setFechaConsulta] = useState(() => localStorage.getItem("dashboardFecha") || getFechaLocal());
  const [ultimaFechaCierre, setUltimaFechaCierre] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (fecha = fechaConsulta) => {
    try {
      const historialRes = await cierreCajaAPI.getHistorial();
      const cierres = historialRes.data || [];
      const ultimoCierre = cierres
        .map((cierre) => String(cierre.fecha).slice(0, 10))
        .sort()
        .pop() || null;
      setUltimaFechaCierre(ultimoCierre);

      const promises = [
        salidasAPI.getStats(),
        salidasAPI.getAll(localStorage.getItem("dashboardFecha")
          ? { fecha: localStorage.getItem("dashboardFecha") }
          : ultimoCierre ? { desde: ultimoCierre } : {}),
        cierreCajaAPI.getResumenHoy(fecha),
        productosAPI.getLowStock(),
        gastosAPI.getHoy(),
      ];
      const resultados = await Promise.allSettled(promises);
      const [statsRes, salidasRes, resumenRes, stockRes, gastosRes] = resultados;
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
      if (salidasRes.status === "fulfilled") setSalidas(salidasRes.value.data);
      if (resumenRes.status === "fulfilled") setResumen(resumenRes.value.data);
      if (stockRes.status === "fulfilled") setStockBajo(stockRes.value.data);
      if (gastosRes.status === "fulfilled") setGastos(gastosRes.value.data);
      resultados.filter((resultado) => resultado.status === "rejected").forEach((resultado) => console.error("Error al cargar dashboard:", resultado.reason));
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const abrirPagosEmpleados = async () => {
    try {
      const [usuariosRes, pagosRes] = await Promise.all([usuariosAPI.getEmpleadosPago(), pagosEmpleadosAPI.getHoy()]);
      const montos = {};
      pagosRes.data.forEach((pago) => { montos[pago.userId] = pago.monto; });
      setEmpleados(usuariosRes.data);
      setPagosForm(montos);
      setShowPagosEmpleados(true);
    } catch (error) {
      alert("Error al cargar empleados: " + (error.response?.data?.message || error.message));
    }
  };

  const handleGuardarPagos = async (event) => {
    event.preventDefault();
    setGuardandoPagos(true);
    try {
      const pagos = empleados.map((empleado) => ({ userId: empleado.id, monto: Number(pagosForm[empleado.id] || 0) }));
      await pagosEmpleadosAPI.guardar(pagos);
      setShowPagosEmpleados(false);
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    } finally {
      setGuardandoPagos(false);
    }
  };

  const updateEstado = async (id, estado, notas) => {
    try {
      await salidasAPI.updateStatus(id, { estado, notas });
      setSalidas((prev) => prev.map((salida) => salida.id === id ? { ...salida, estado, notas: notas ?? salida.notas } : salida));
      loadData().catch(console.error);
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const handleReabrirSalida = async (id) => {
    if (!confirm("¿Abrir esta salida para volver a operarla? El camion volvera a estar en camino")) return;
    try {
      await salidasAPI.reabrir(id);
      setSalidas((prev) => prev.map((salida) => salida.id === id ? { ...salida, estado: "en_camino" } : salida));
      loadData().catch(console.error);
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const openRegresoForm = async (salida, esEdicion = false) => {
    setRegresando(salida);
    setEditandoRegreso(esEdicion);
    const stockMap = {};
    try {
      const res = await salidasAPI.getStockCamion(salida.id);
      for (const stock of res.data.items) {
        stockMap[stock.productoId] = stock;
      }
    } catch (error) {
      console.error("Error al obtener stock del camion:", error);
    }
    const items = (salida.SalidaCamionItems || []).map((item) => {
      const stock = stockMap[item.productoId];
      const enviadaU = Number(stock?.cargado) > 0 ? Number(stock.cargado) : Number(item.cantidad) || 0;
      const vendidaU = Number(stock?.vendido) || 0;
      const devueltasUnidades = Number(item.cantidad_devuelta) || 0;
      const maxDevolverU = Math.max(0, Number(stock ? enviadaU - vendidaU : enviadaU));
      return {
        productoId: item.productoId,
        nombre: item.Producto?.nombre,
        cantidad_enviada: redondearUnid(enviadaU),
        cantidad_vendida: redondearUnid(vendidaU),
        max_devolver: redondearUnid(maxDevolverU),
        cantidad_regreso: redondearUnid(Math.min(devueltasUnidades, maxDevolverU)),
      };
    });
    setItemsRegreso(items);
  };

  const setCantidadRegreso = (index, unidades) => {
    const newItems = [...itemsRegreso];
    const item = newItems[index];
    const max = Math.max(0, Number(item.max_devolver) || 0);
    const v = Math.max(0, Number(unidades) || 0);
    item.cantidad_regreso = redondearUnid(Math.min(v, max));
    setItemsRegreso(newItems);
  };

  const confirmarEntregado = () => {
    if (editandoRegreso) {
      ejecutarEntregado();
      return;
    }
    if (cancelarConRegreso) {
      ejecutarCancelacion();
      return;
    }
    setShowConfirm(true);
  };

  const itemsParaEnviar = () =>
    itemsRegreso.map((item) => {
      const unidades = redondearUnid(Number(item.cantidad_regreso) || 0);
      return { productoId: item.productoId, cantidad: unidades };
    });

  const ejecutarCancelacion = async () => {
    if (!regresando) return;
    try {
      await salidasAPI.registrarRegreso(regresando.id, {
        items_regreso: itemsParaEnviar(),
        cancelar: true,
        motivo: cancelMotivo,
      });
      setRegresando(null);
      setCancelarConRegreso(false);
       setCancelandoId(null);
       setCancelMotivo("");
       loadData().catch(console.error);
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const ejecutarEntregado = async () => {
    setShowConfirm(false);
    if (!regresando) return;
    try {
      await salidasAPI.registrarRegreso(regresando.id, {
        items_regreso: itemsParaEnviar(),
      });
       setRegresando(null);
       setEditandoRegreso(false);
       loadData().catch(console.error);
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

     if (!confirm(`¿Cerrar la caja del ${fechaConsulta}? No se podran hacer mas modificaciones.`)) return;
    setCerrando(true);
    try {
      await gastosAPI.guardar(gastos);
      await cierreCajaAPI.cerrar(fechaConsulta);
      localStorage.removeItem("dashboardFecha");
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
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "1rem", flexWrap: "wrap" }}>
         <h2 style={{ margin: 0 }}>Dashboard</h2>
         <label className="form-group" style={{ margin: 0 }}>
           <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Fecha a consultar</span>
           <input
             type="date"
             value={fechaConsulta}
             onChange={(event) => {
               setFechaConsulta(event.target.value);
               setCierreExitoso(false);
               loadData(event.target.value).catch(console.error);
             }}
           />
         </label>
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
                  const salidaCancelar = salidas.find((s) => s.id === cancelandoId);
                  setShowCancelConfirm(false);
                  if (salidaCancelar?.estado === "en_camino") {
                    setCancelarConRegreso(true);
                    openRegresoForm(salidaCancelar);
                  } else {
                    updateEstado(cancelandoId, "cancelado", cancelMotivo);
                    setCancelandoId(null);
                    setCancelMotivo("");
                  }
                }}
              >
                Confirmar Cancelacion
              </button>
            </div>
          </div>
        </div>
      )}

      {showPagosEmpleados && (
        <div className="modal-overlay" onClick={() => setShowPagosEmpleados(false)}>
          <div className="modal-card modal-wide employee-payment-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Pago a Empleados</h3>
            <p className="subtitle">Carga el monto pagado hoy a cada repartidor u operador.</p>
            <form onSubmit={handleGuardarPagos}>
              <div className="table-container employee-payment-table" style={{ maxHeight: "360px", overflowY: "auto" }}>
                <table>
                  <thead>
                    <tr><th>Empleado</th><th>Rol</th><th>Monto pagado</th></tr>
                  </thead>
                  <tbody>
                    {empleados.map((empleado) => (
                      <tr key={empleado.id}>
                        <td><strong>{empleado.nombre}</strong></td>
                        <td>{empleado.Role?.nombre || "-"}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={pagosForm[empleado.id] || ""}
                            onChange={(event) => setPagosForm({ ...pagosForm, [empleado.id]: event.target.value })}
                            placeholder="0.00"
                            style={{ maxWidth: "150px" }}
                          />
                        </td>
                      </tr>
                    ))}
                    {empleados.length === 0 && <tr><td colSpan="3" className="empty">No hay empleados activos para pagar</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPagosEmpleados(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardandoPagos}>
                  {guardandoPagos ? "Guardando..." : "Guardar pagos"}
                </button>
              </div>
            </form>
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
              Para confirmar la entrega primero debe registrar la mercaderia vendida como <strong>Venta por Reparto</strong> en la seccion de Ventas.
            </p>
            <p style={{ textAlign: "center", color: "var(--danger)", fontWeight: "500", marginBottom: "1.5rem" }}>
              Si no registro la venta por reparto, la entrega no podra completarse.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={ejecutarEntregado}>
                Confirmar Entrega
              </button>
            </div>
          </div>
        </div>
      )}

      {regresando && (
        <div className="modal-overlay" onClick={() => { setRegresando(null); setEditandoRegreso(false); setCancelarConRegreso(false); }}>
          <div className="modal-card modal-wide regreso-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editandoRegreso ? `Editar Regreso - ${regresando.camion}` : cancelarConRegreso ? `Cancelar Envio - ${regresando.camion}` : `Registrar Entrega - ${regresando.camion}`}</h3>
            <p className="subtitle">
              {editandoRegreso
                ? "Modifica las cantidades de mercaderia devuelta registradas"
                : cancelarConRegreso
                  ? "Marca la mercaderia que volvio al cancelar el envio"
                  : "Selecciona los productos que regresaron y sus cantidades"}
            </p>

            <div className="table-container regreso-table-container" style={{ maxHeight: "200px", overflowY: "auto" }}>
              <table className="regreso-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Enviada</th>
                    <th>Vendida</th>
                    <th>A Devolver</th>
                  </tr>
                </thead>
                <tbody>
                   {itemsRegreso.map((item, index) => {
                    return (
                      <tr key={item.productoId}>
                        <td data-label="Producto"><strong>{item.nombre}</strong></td>
                         <td data-label="Enviada">{textoCantidad(item.cantidad_enviada)}</td>
                         <td data-label="Vendida">{textoCantidad(item.cantidad_vendida)}</td>
                        <td data-label="A devolver">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              max={item.max_devolver}
                              value={item.cantidad_regreso || ""}
                              onChange={(e) => setCantidadRegreso(index, e.target.value)}
                              className="input-cantidad"
                            />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setRegresando(null); setEditandoRegreso(false); setCancelarConRegreso(false); }}>
                Cancelar
              </button>
              <button className="btn btn-entregado" onClick={confirmarEntregado}>
                {editandoRegreso ? "Guardar Cambios" : cancelarConRegreso ? "Confirmar Cancelacion" : "Confirmar Entrega"}
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
            <h3>{formatVentas(stats.total_ventas)}</h3>
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

      {!cierreExitoso && (
        <>
          <div className="dashboard-actions">
            <button className="btn btn-primary employee-payment-button" onClick={abrirPagosEmpleados} disabled={resumen?.cerrado}>
              Pago a empleados
            </button>
          </div>

            <div className="section daily-expenses-section">
            <div className="daily-expenses-header">
              <h3>Gastos del Dia</h3>
              {resumen?.cerrado && <span className="cierre-cerrado-badge">CERRADO</span>}
            </div>
            <p className="subtitle" style={{ marginTop: "0.35rem" }}>Se guardan automáticamente al realizar el cierre de caja.</p>
            <div className="form-card" style={{ marginTop: "1rem" }}>
              <div className="cierre-2col">
                <div className="form-group">
                  <label htmlFor="gasto-combustible">Gastos de combustible</label>
                  <input id="gasto-combustible" type="number" min="0" step="0.01" value={gastos.combustible || ""} onChange={(event) => setGastos({ ...gastos, combustible: event.target.value })} disabled={resumen?.cerrado} />
                </div>
                <div className="form-group">
                  <label htmlFor="gasto-otros">Otros gastos</label>
                  <input id="gasto-otros" type="number" min="0" step="0.01" value={Number(gastos.otros) ? gastos.otros : ""} onChange={(event) => setGastos({ ...gastos, otros: event.target.value })} disabled={resumen?.cerrado} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="descripcion-otros">Descripción de otros gastos</label>
                <textarea id="descripcion-otros" rows="2" value={gastos.descripcion_otros || ""} onChange={(event) => setGastos({ ...gastos, descripcion_otros: event.target.value })} placeholder="Detalle de los otros gastos..." disabled={resumen?.cerrado} />
              </div>
              <div className="cierre-item cierre-total">
                <span>Total gastos:</span>
                <strong>${(Number(gastos.combustible || 0) + Number(gastos.otros || 0)).toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </>
      )}

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
                                          <td>${Number(item.precio_unitario || 0).toFixed(2)}</td>
                                          <td><strong className="monto-salida">${Number(item.subtotal || 0).toFixed(2)}</strong></td>
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
                                          <td>${Number(item.precio_unitario || 0).toFixed(2)}</td>
                                          <td><strong className="monto-regreso">${Number(item.subtotal || 0).toFixed(2)}</strong></td>
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
        <>
          <div className="section">
            <h3>Repartos desde el último cierre ({salidas.length})</h3>
            {ultimaFechaCierre && (
              <p className="subtitle">Mostrando salidas posteriores al cierre del {ultimaFechaCierre}.</p>
            )}
            {salidas.length === 0 ? (
              <p className="empty">No hay salidas registradas hoy</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Camión</th>
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
                        <td><strong>{s.camion || "-"}</strong></td>
                        <td><strong>{s.destino || "-"}</strong></td>
                        <td><span className="estado-badge" style={{ backgroundColor: estadoColors[s.estado] }}>{s.estado.replace("_", " ")}</span></td>
                        <td>
                          <div className="action-buttons">
                            {s.estado === "pendiente" && <button className="btn btn-sm btn-camino" onClick={() => updateEstado(s.id, "en_camino")}>Enviar</button>}
                            {s.estado === "en_camino" && <button className="btn btn-sm btn-entregado" onClick={() => handleEntregadoClick(s.id)}>Registrar Entrega</button>}
                            {s.estado === "sobrante" && isAdmin && <button className="btn btn-sm btn-editar" onClick={() => openRegresoForm(s, true)}>Editar</button>}
                            {(s.estado === "entregado" || s.estado === "sobrante") && String(s.fecha || "").slice(0, 10) <= getFechaLocal() && isAdmin && (
                              <button className="btn btn-sm btn-camino" onClick={() => handleReabrirSalida(s.id)}>Abrir</button>
                            )}
                            {(s.estado === "pendiente" || s.estado === "en_camino") && <button className="btn btn-sm btn-cancel" onClick={() => { setCancelandoId(s.id); setShowCancelConfirm(true); }}>Cancelar</button>}
                          </div>
                        </td>
                        <td>{s.repartidor_asignado?.nombre || "-"}</td>
                        <td>{s.monto_salida ? <strong className="monto-salida">${s.monto_salida}</strong> : "-"}</td>
                        <td>{s.monto_regreso ? <strong className="monto-regreso">${s.monto_regreso}</strong> : "-"}</td>
                        <td><strong>${(parseFloat(s.monto_salida || 0) - parseFloat(s.monto_regreso || 0)).toFixed(2)}</strong></td>
                        <td><div className="badge-grid">{s.SalidaCamionItems?.map((item) => <span key={item.id} className="badge">{item.cantidad}x {item.Producto?.nombre}</span>)}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
