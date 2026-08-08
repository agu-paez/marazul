import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { salidasAPI, ventasAPI } from "../api";


export default function MisSalidas() {
  const { user } = useAuth();
  const [salidas, setSalidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regresando, setRegresando] = useState(null);
  const [itemsRegreso, setItemsRegreso] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelandoId, setCancelandoId] = useState(null);

  useEffect(() => {
    loadSalidas();
  }, []);

  const loadSalidas = async () => {
    try {
      const res = await salidasAPI.getMisSalidas();
      setSalidas(res.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const [cancelMotivo, setCancelMotivo] = useState("");

  const updateEstado = async (id, estado, notas) => {
    try {
      await salidasAPI.updateStatus(id, { estado, notas });
      loadSalidas();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const openRegresoForm = async (salida) => {
    setRegresando(salida);
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
        return {
          productoId: item.productoId,
          nombre: item.Producto?.nombre,
          precio_unitario: parseFloat(item.precio_unitario),
          cantidad_enviada: item.cantidad,
          cantidad_vendida: vendido,
          max_devolver: maxDevolver,
          cantidad_regreso: 0,
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

  const confirmarRegreso = async () => {
    if (!regresando) return;
    setShowConfirm(true);
  };

  const ejecutarRegreso = async () => {
    setShowConfirm(false);
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
      loadSalidas();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const estadoColors = {
    pendiente: "#f59e0b",
    en_camino: "#3b82f6",
    entregado: "#10b981",
    cancelado: "#ef4444",
    sobrante: "#ef4444",
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div>
      <h2>Mis Salidas de Camion</h2>
      <p className="subtitle">Solo puedes cambiar el estado de tus salidas</p>

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
              Para confirmar el regreso primero debe registrar la mercaderia vendida como <strong>Venta por Reparto</strong> en la seccion de Ventas.
            </p>
            <p style={{ textAlign: "center", color: "var(--danger)", fontWeight: "500", marginBottom: "1.5rem" }}>
              Si no registro la venta por reparto, el regreso no podra completarse.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={ejecutarRegreso}>
                Confirmar Regreso
              </button>
            </div>
          </div>
        </div>
      )}

      {regresando && (
        <div className="modal-overlay" onClick={() => setRegresando(null)}>
          <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Registrar Regreso - {regresando.camion}</h3>
            <p className="subtitle">Selecciona los productos que regresaron y sus cantidades</p>

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
                      <td style={{ color: item.max_devolver === 0 ? "var(--success)" : "var(--warning)", fontWeight: "bold" }}>{item.max_devolver}</td>
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
              <button className="btn btn-entregado" onClick={confirmarRegreso}>
                Confirmar Regreso
              </button>
            </div>
          </div>
        </div>
      )}

      {salidas.length === 0 ? (
        <p className="empty">No tienes salidas asignadas</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Camion</th>
                <th>Estado</th>
                <th>Acciones</th>
                <th>Mercaderia</th>
                <th className="hide-col">Total</th>
                <th className="hide-col">Monto Salida</th>
                <th className="hide-col">Monto Regreso</th>
              </tr>
            </thead>
            <tbody>
              {salidas.map((s) => (
                <tr key={s.id}>
                  <td>{s.fecha}</td>
                  <td><strong>{s.camion}</strong></td>
                  <td>
                    <span
                      className="estado-badge"
                      style={{ backgroundColor: estadoColors[s.estado === "sobrante" ? "entregado" : s.estado] }}
                    >
                      {(s.estado === "sobrante" ? "entregado" : s.estado).replace("_", " ")}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      {s.estado === "en_camino" && (
                        <button
                          className="btn btn-sm btn-entregado"
                          onClick={() => openRegresoForm(s)}
                        >
                          Registrar Regreso
                        </button>
                      )}
                      {s.estado === "en_camino" && (
                        <button
                          className="btn btn-sm btn-cancel"
                          onClick={() => { setCancelandoId(s.id); setShowCancelConfirm(true); }}
                        >
                          Cancelar
                        </button>
                      )}
                      {s.estado === "pendiente" && (
                        <span style={{ fontSize: "0.8rem", color: "#888", fontStyle: "italic" }}>
                          Esperando autorización
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="badge-grid">
                      {s.SalidaCamionItems?.map((item) => (
                        <span key={item.id} className="badge">
                          {item.cantidad}x {item.Producto?.nombre}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="hide-col"><strong>${s.precio_total}</strong></td>
                  <td className="hide-col">{s.monto_salida ? <strong className="monto-salida">${s.monto_salida}</strong> : "-"}</td>
                  <td className="hide-col">{s.monto_regreso ? <strong className="monto-regreso">${s.monto_regreso}</strong> : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
