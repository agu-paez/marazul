import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { ventasAPI } from "../api";
import { generarComprobantePDF } from "../utils/generarPDF";

export default function HistorialVentasPage() {
  const { user } = useAuth();
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const medioPagoLabels = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    tarjeta: "Tarjeta",
    cuenta_corriente: "Cuenta Corriente",
    otro: "Otro",
    dividido: "Dividido",
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
                  <td>{v.cliente?.nombre || v.cliente_nombre}</td>
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
    </div>
  );
}
