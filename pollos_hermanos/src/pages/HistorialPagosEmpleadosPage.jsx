import { useEffect, useState } from "react";
import { cierreCajaAPI } from "../api";
import { generarPagosEmpleadosPDF } from "../utils/generarPDF";

export default function HistorialPagosEmpleadosPage() {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registroAbierto, setRegistroAbierto] = useState(null);

  useEffect(() => {
    cierreCajaAPI.getHistorialPagosEmpleados().then((response) => setRegistros(response.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Cargando...</div>;
  return (
    <div className="history-panel">
      <div className="history-panel-header">
        <div><h3>Historial de Pagos a Empleados</h3><p className="subtitle">Pagos guardados al realizar cada cierre de caja.</p></div>
      </div>
      {registros.length === 0 ? <p className="empty">No hay pagos de empleados registrados en cierres.</p> : (
        <div className="history-cards">
          {registros.map((registro) => {
            const total = (registro.pagos || []).reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
            const abierto = registroAbierto === registro.id;
            return <div className="history-card" key={registro.id}>
              <div className="history-card-header history-card-toggle" onClick={() => setRegistroAbierto(abierto ? null : registro.id)}>
                <div><strong>{abierto ? "▼" : "▶"} Pago semanal · {registro.fecha}</strong><span>{registro.usuario_cierre || "-"}</span></div>
                <strong>${total.toFixed(2)}</strong>
              </div>
              {abierto && <>
                <div className="history-card-list">{(registro.pagos || []).map((pago) => <div className="history-card-row" key={pago.userId}><span>{pago.nombre} <small>{pago.rol}</small></span><strong>${Number(pago.monto || 0).toFixed(2)}</strong></div>)}</div>
                <button className="btn btn-sm btn-primary" onClick={() => generarPagosEmpleadosPDF(registro)}>Generar PDF</button>
              </>}
            </div>;
          })}
        </div>
      )}
    </div>
  );
}
