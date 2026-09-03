import { useEffect, useState } from "react";
import { clientesAPI } from "../api";
import { dinero } from "../utils/numero";

export default function HistorialReintegrosPage() {
  const [reintegros, setReintegros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargarReintegros = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await clientesAPI.getHistorialReintegros();
      setReintegros(res.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "No se pudo cargar el historial de reintegros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarReintegros();
  }, []);

  if (loading) return <div className="loading">Cargando historial de reintegros...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Historial de Reintegros</h2>
        <button className="btn btn-secondary" onClick={cargarReintegros}>Actualizar</button>
      </div>
      {error && <p className="error-msg">{error}</p>}
      {!error && reintegros.length === 0 ? (
        <p className="empty">No hay reintegros registrados.</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Cliente</th><th>Zona</th><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Total</th><th>Registrado por</th></tr>
            </thead>
            <tbody>
              {reintegros.map((reintegro) => (
                <tr key={reintegro.id}>
                  <td>{reintegro.fecha} {reintegro.hora}</td>
                  <td><strong>{reintegro.Cliente?.nombre || "-"}</strong></td>
                  <td>{reintegro.Cliente?.zona || "-"}</td>
                  <td>{reintegro.producto_nombre}</td>
                  <td>{reintegro.cantidad}</td>
                  <td>{dinero(reintegro.precio)}</td>
                  <td className="monto-regreso">{dinero(reintegro.monto)}</td>
                  <td>{reintegro.registrado_por?.nombre || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
