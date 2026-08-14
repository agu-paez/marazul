import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { ventasAPI, clientesAPI } from "../api";
import {
  generarComprobantePDF,
  generarHistorialDeudasPDF,
  generarDeudaVentaPDF,
} from "../utils/generarPDF";

export default function HistorialVentasPage() {
  const { user } = useAuth();
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clienteDetalle, setClienteDetalle] = useState(null);
  const [clienteDetalleLoading, setClienteDetalleLoading] = useState(false);
  const [clienteDetalleError, setClienteDetalleError] = useState("");
  const [filtros, setFiltros] = useState({
    fecha: "",
    buscar: "",
    numero_comprobante: "",
    tipo_venta: "",
    usuarioId: "",
  });

  useEffect(() => {
    loadVentas();
  }, []);

  const loadVentas = async (params = {}) => {
    setLoading(true);
    try {
      const res = await ventasAPI.getAll(params);
      setVentas(res.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltro = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  const buscar = () => {
    const params = {};
    Object.entries(filtros).forEach(([key, val]) => {
      if (val) params[key] = val;
    });
    loadVentas(params);
  };

  const limpiarFiltros = () => {
    setFiltros({ fecha: "", buscar: "", numero_comprobante: "", tipo_venta: "", usuarioId: "" });
    loadVentas();
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta venta? El stock se restaurara.")) return;
    try {
      await ventasAPI.delete(id);
      loadVentas();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const abrirDetalleCliente = async (venta) => {
    const cliente = venta.cliente;
    if (!cliente?.id) return;
    setClienteDetalle({ cliente, venta });
    setClienteDetalleError("");
    setClienteDetalleLoading(true);
    try {
      const res = await clientesAPI.getHistorialCC(cliente.id);
      setClienteDetalle({ ...res.data, venta });
    } catch (error) {
      setClienteDetalleError(error.response?.data?.message || "No se pudo cargar el historial del cliente");
    } finally {
      setClienteDetalleLoading(false);
    }
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div>
      <h2>Historial de Ventas</h2>

      <div className="form-card filtros-card">
        <div className="filtros-grid">
          <div className="form-group">
            <label>Fecha</label>
            <input type="date" name="fecha" value={filtros.fecha} onChange={handleFiltro} />
          </div>
          <div className="form-group">
              <label>Cliente / Camion / Repartidor</label>
            <div className="search-with-clear">
                <input name="buscar" value={filtros.buscar} onChange={handleFiltro} placeholder="Buscar por cliente, camion o repartidor..." />
              {filtros.buscar && (
                <button type="button" className="search-clear" onClick={() => setFiltros({ ...filtros, buscar: "" })} aria-label="Borrar búsqueda">
                  X
                </button>
              )}
            </div>
          </div>
          <div className="form-group" style={{ display: "none" }}>
            <label>Nro Comprobante</label>
            <input name="numero_comprobante" value={filtros.numero_comprobante} onChange={handleFiltro} placeholder="VTA-..." />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select name="tipo_venta" value={filtros.tipo_venta} onChange={handleFiltro}>
              <option value="">Todos</option>
              <option value="local">Local</option>
              <option value="reparto">Reparto</option>
            </select>
          </div>
          <div className="form-group filtros-btns">
            <button className="btn btn-primary" onClick={buscar}>Buscar</button>
            <button className="btn btn-secondary" onClick={limpiarFiltros}>Limpiar</button>
          </div>
        </div>
      </div>

      {ventas.length === 0 ? (
        <p className="empty">No hay ventas registradas</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Camion</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Acciones</th>
                <th>Mercaderías</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id}>
                  <td>{v.fecha}</td>
                  <td>
                    <span className={`badge badge-${v.tipo_venta}`}>
                      {v.tipo_venta === "local" ? "Local" : "Reparto"}
                    </span>
                  </td>
                  <td>{v.salida_camion?.camion || "-"}</td>
                   <td>
                     {v.cliente?.id ? (
                       <button
                         type="button"
                         className="btn btn-sm cliente-historial-btn"
                         onClick={() => abrirDetalleCliente(v)}
                         title={`Ver deudas de ${v.cliente.nombre}`}
                       >
                         {v.cliente.nombre}
                       </button>
                     ) : (v.cliente_nombre || "-")}
                   </td>
                  <td>{v.vendedor?.nombre || "-"}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => generarComprobantePDF(v)}
                      >
                        PDF
                      </button>
                      {(user?.role === "admin") && (
                        <button
                          className="btn btn-sm btn-cancel"
                          onClick={() => handleDelete(v.id)}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="badge-grid">
                      {v.VentaItems?.map((item) => (
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
      {clienteDetalle && (
        <div className="modal-overlay" onClick={() => setClienteDetalle(null)}>
          <div className="modal-card modal-wide cliente-historial-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cliente-historial-header">
              <div>
                <span className="modal-eyebrow">Cuenta corriente</span>
                <h3>{clienteDetalle.cliente?.nombre}</h3>
              </div>
              <button type="button" className="modal-close" onClick={() => setClienteDetalle(null)} aria-label="Cerrar">X</button>
            </div>
            {clienteDetalleLoading ? (
              <div className="loading">Cargando movimientos...</div>
            ) : clienteDetalleError ? (
              <p className="error-msg">{clienteDetalleError}</p>
            ) : (
              <>
                <div className="cc-resumen cliente-historial-resumen">
                  <div className="cc-item"><span>Deuda actual</span><strong className="monto-salida">${Number(clienteDetalle.saldo_pendiente || 0).toFixed(2)}</strong></div>
                  <div className="cc-item"><span>Saldo a favor</span><strong className="monto-regreso">${Number(clienteDetalle.saldo_favor || 0).toFixed(2)}</strong></div>
                  <div className="cc-item"><span>Credito disponible</span><strong>${Number(clienteDetalle.credito_disponible || 0).toFixed(2)}</strong></div>
                </div>
                <p className="cliente-historial-ayuda">Selecciona el comprobante que deseas descargar.</p>
                <div className="cliente-historial-actions">
                  <button className="btn btn-primary" onClick={() => generarHistorialDeudasPDF(clienteDetalle)}>Historial de deudas</button>
                  <button className="btn btn-cierre-pdf" onClick={() => generarDeudaVentaPDF(clienteDetalle.venta, clienteDetalle)}>Deuda de esta venta</button>
                </div>
              </>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setClienteDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
