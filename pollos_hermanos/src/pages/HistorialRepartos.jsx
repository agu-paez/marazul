import { useState, useEffect } from "react";
import { repartosAPI } from "../api";

export default function HistorialRepartos() {
  const [repartos, setRepartos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRepartos();
  }, []);

  const loadRepartos = async () => {
    try {
      const res = await repartosAPI.getAll();
      setRepartos(res.data);
    } catch {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este reparto?")) return;
    try {
      await repartosAPI.delete(id);
      loadRepartos();
    } catch {
      alert("Error al eliminar");
    }
  };

  const estadoColors = {
    pendiente: "#f59e0b",
    en_camino: "#3b82f6",
    entregado: "#10b981",
    cancelado: "#ef4444",
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div>
      <h2>Historial de Repartos</h2>

      {repartos.length === 0 ? (
        <p className="empty">No hay repartos registrados</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Dirección</th>
                <th>Producto(s)</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Repartidor</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {repartos.map((r) => (
                <tr key={r.id}>
                  <td>{r.fecha}</td>
                  <td><strong>{r.cliente_nombre}</strong></td>
                  <td>{r.cliente_direccion || "-"}</td>
                  <td>
                    {r.RepartoItems?.map((item) => (
                      <span key={item.id} className="badge">
                        {item.cantidad}x {item.Producto?.nombre}
                      </span>
                    ))}
                  </td>
                  <td><strong>${r.precio_total}</strong></td>
                  <td>
                    <span
                      className="estado-badge"
                      style={{ backgroundColor: estadoColors[r.estado] }}
                    >
                      {r.estado}
                    </span>
                  </td>
                  <td>{r.repartidor || "-"}</td>
                  <td>
                    <button className="btn btn-sm btn-cancel" onClick={() => handleDelete(r.id)}>
                      Eliminar
                    </button>
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
