import { useEffect, useState } from "react";
import { cierreCajaAPI } from "../api";
import { generarGastosDiaPDF } from "../utils/generarPDF";

export default function HistorialGastosPage() {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cierreCajaAPI.getHistorialGastos().then((response) => setGastos(response.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Cargando...</div>;
  return (
    <div className="history-panel">
      <div className="history-panel-header">
        <div><h3>Historial de Gastos</h3><p className="subtitle">Gastos guardados al realizar cada cierre de caja.</p></div>
      </div>
      {gastos.length === 0 ? <p className="empty">No hay gastos registrados en cierres.</p> : (
        <div className="table-container">
          <table>
            <thead><tr><th>Fecha</th><th>Combustible</th><th>Otros</th><th>Total</th><th>Descripción</th><th>PDF</th></tr></thead>
            <tbody>{gastos.map((gasto) => <tr key={gasto.id}>
              <td><strong>{gasto.fecha}</strong></td>
              <td>${parseFloat(gasto.gastos_combustible || 0).toFixed(2)}</td>
              <td>${parseFloat(gasto.gastos_otros || 0).toFixed(2)}</td>
              <td><strong>${parseFloat(gasto.total || 0).toFixed(2)}</strong></td>
              <td>{gasto.descripcion_otros_gastos || "-"}</td>
              <td><button className="btn btn-sm btn-primary" onClick={() => generarGastosDiaPDF(gasto)}>PDF</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
