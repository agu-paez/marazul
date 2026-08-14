import { useEffect, useState } from "react";
import { clientesAPI } from "../api";
import { generarHistorialDeudasPDF } from "../utils/generarPDF";

export default function HistorialDeudasPage() {
  const [historiales, setHistoriales] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargarHistorial = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await clientesAPI.getHistorialDeudas();
      setHistoriales(res.data.clientes || []);
      setZonas(res.data.zonas || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "No se pudo cargar el historial de deudas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarHistorial();
  }, []);

  if (loading) return <div className="loading">Cargando historial de deudas...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Historial de Deudas</h2>
          {zonas.length > 0 && <p className="subtitle">Zonas asignadas: {zonas.join(", ")}</p>}
        </div>
        <button className="btn btn-secondary" onClick={cargarHistorial}>Actualizar</button>
      </div>

      {error && <p className="error-msg">{error}</p>}
      {!error && historiales.length === 0 ? (
        <p className="empty">No hay clientes disponibles para mostrar. Los clientes de un repartidor aparecen cuando tiene una salida asignada.</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Zona</th>
                <th>Deuda actual</th>
                <th>Saldo a favor</th>
                <th>Movimientos</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {historiales.map((historial) => (
                <tr key={historial.cliente.id}>
                  <td><strong>{historial.cliente.nombre}</strong></td>
                  <td>{historial.cliente.zona || "-"}</td>
                  <td className="monto-salida">${Number(historial.saldo_pendiente || 0).toFixed(2)}</td>
                  <td className="monto-regreso">${Number(historial.saldo_favor || 0).toFixed(2)}</td>
                  <td>{(historial.ventas?.length || 0) + (historial.pagos?.length || 0)}</td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => generarHistorialDeudasPDF(historial)}>
                      Descargar PDF
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
