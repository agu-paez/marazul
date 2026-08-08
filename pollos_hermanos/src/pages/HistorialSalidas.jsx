import { useState, useEffect, useMemo } from "react";
import { salidasAPI, ventasAPI } from "../api";
import { generarResumenEntregaPDF } from "../utils/generarPDF";

export default function HistorialSalidas() {
  const [salidas, setSalidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ buscar: "", fecha: "", estado: "" });

  useEffect(() => {
    loadSalidas();
  }, []);

  const loadSalidas = async () => {
    try {
      const res = await salidasAPI.getAll();
      setSalidas(res.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta salida? El stock se restaurará.")) return;
    try {
      await salidasAPI.delete(id);
      loadSalidas();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDownloadResumen = async (id) => {
    try {
      const [salidaRes, ventasRes] = await Promise.all([
        salidasAPI.getById(id),
        ventasAPI.getAll({ salidaCamionId: id }),
      ]);
      generarResumenEntregaPDF(salidaRes.data, ventasRes.data);
    } catch (error) {
      alert("Error al generar resumen: " + (error.response?.data?.message || error.message));
    }
  };

  const salidasFiltradas = useMemo(() => {
    return salidas.filter((s) => {
      if (filtros.buscar) {
        const q = filtros.buscar.toLowerCase();
        const camion = (s.camion || "").toLowerCase();
        const repartidor = (s.repartidor_asignado?.nombre || "").toLowerCase();
        if (!camion.includes(q) && !repartidor.includes(q)) return false;
      }
      if (filtros.fecha && s.fecha !== filtros.fecha) return false;
      if (filtros.estado && s.estado !== filtros.estado) return false;
      return true;
    });
  }, [salidas, filtros]);

  const estadoColors = {
    pendiente: "#f59e0b",
    en_camino: "#3b82f6",
    entregado: "#10b981",
    cancelado: "#ef4444",
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div>
      <h2>Historial de Salidas de Camión</h2>

      <div className="form-card filtros-card">
        <div className="filtros-grid">
          <div className="form-group">
            <label>Camion / Repartidor</label>
            <div className="search-with-clear">
              <input
                name="buscar"
                value={filtros.buscar}
                onChange={(e) => setFiltros({ ...filtros, buscar: e.target.value })}
                placeholder="Buscar por camion o repartidor..."
              />
              {filtros.buscar && (
                <button type="button" className="search-clear" onClick={() => setFiltros({ ...filtros, buscar: "" })} aria-label="Borrar búsqueda">
                  X
                </button>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Fecha</label>
            <input
              type="date"
              value={filtros.fecha}
              onChange={(e) => setFiltros({ ...filtros, fecha: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Estado</label>
            <select
              value={filtros.estado}
              onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_camino">En Camino</option>
              <option value="entregado">Entregado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>
      </div>

      {salidasFiltradas.length === 0 ? (
        <p className="empty">No hay salidas que coincidan con los filtros</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Camión</th>
                <th>Repartidor</th>
                <th>Creado por</th>
                <th>Estado</th>
                <th>Acciones</th>
                <th>Mercadería</th>
              </tr>
            </thead>
            <tbody>
              {salidasFiltradas.map((s) => (
                <tr key={s.id}>
                  <td>{s.fecha}</td>
                  <td><strong>{s.camion}</strong></td>
                  <td>{s.repartidor_asignado?.nombre || "-"}</td>
                  <td>{s.creado_por?.nombre || "-"}</td>
                  <td>
                    <span
                      className="estado-badge"
                      style={{ backgroundColor: estadoColors[s.estado] }}
                    >
                      {s.estado.replace("_", " ")}
                    </span>
                  </td>
                  <td>
                    {s.estado === "pendiente" && (
                      <button
                        className="btn btn-sm btn-cancel"
                        onClick={() => handleDelete(s.id)}
                      >
                        Eliminar
                      </button>
                    )}
                    {s.estado === "entregado" && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleDownloadResumen(s.id)}
                      >
                        Resumen PDF
                      </button>
                    )}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
