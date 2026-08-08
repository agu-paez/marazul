import { useState } from "react";
import { cierreCajaAPI } from "../api";

const fechaLocal = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const primerDiaMes = () => fechaLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;

export default function IngresosEgresosPage() {
  const [fechas, setFechas] = useState({ desde: primerDiaMes(), hasta: fechaLocal() });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const consultar = async (event) => {
    event.preventDefault();
    if (!fechas.desde || !fechas.hasta) return;
    setLoading(true);
    try {
      const response = await cierreCajaAPI.getIngresosEgresos(fechas);
      setData(response.data);
    } catch (error) {
      alert(error.response?.data?.message || "No se pudo obtener el resumen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="estadisticas-financieras">
      <div className="page-header">
        <div>
          <h2>Estadísticas de Ingreso / Egreso</h2>
          <p className="text-muted">Resumen de cierres de caja, gastos y pagos a empleados.</p>
        </div>
      </div>

      <form className="form-card financial-filter" onSubmit={consultar}>
        <div className="form-group">
          <label>Desde</label>
          <input type="date" value={fechas.desde} onChange={(e) => setFechas({ ...fechas, desde: e.target.value })} required />
        </div>
        <div className="form-group">
          <label>Hasta</label>
          <input type="date" value={fechas.hasta} onChange={(e) => setFechas({ ...fechas, hasta: e.target.value })} required />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Calculando..." : "Consultar"}</button>
      </form>

      {!data ? <p className="empty">Seleccioná un rango de fechas para consultar.</p> : (
        <>
          <div className="financial-summary-grid">
            <div className="stat-card stat-ventas"><h3>{dinero(data.resumen.ingresos)}</h3><p>Ingresos / Ventas</p></div>
            <div className="stat-card stat-cancelado"><h3>{dinero(data.resumen.egresos)}</h3><p>Egresos Totales</p></div>
            <div className={`stat-card ${data.resumen.resultado >= 0 ? "stat-entregado" : "stat-pendiente"}`}><h3>{dinero(data.resumen.resultado)}</h3><p>{data.resumen.resultado >= 0 ? "Ganancia" : "Pérdida"}</p></div>
          </div>

          <div className="form-card financial-totals">
            <h3>Detalle de Egresos</h3>
            <div className="cierre-item"><span>Combustible:</span><strong>{dinero(data.resumen.combustible)}</strong></div>
            <div className="cierre-item"><span>Otros gastos:</span><strong>{dinero(data.resumen.otros)}</strong></div>
            <div className="cierre-item"><span>Costo de mercadería vendida:</span><strong>{dinero(data.resumen.costo_mercaderia)}</strong></div>
            <div className="cierre-item"><span>Mercaderías compradas a proveedores:</span><strong>{dinero(data.resumen.compras_proveedores)}</strong></div>
            <div className="cierre-item"><span>Pagos a empleados:</span><strong>{dinero(data.resumen.pagos_empleados)}</strong></div>
            <div className="cierre-separator"></div>
            <div className="cierre-item cierre-total"><span>Resultado:</span><strong className={data.resumen.resultado >= 0 ? "monto-ventas" : "monto-regreso"}>{dinero(data.resumen.resultado)}</strong></div>
          </div>

          <div className="form-card">
            <h3>Cierres incluidos ({data.cierres})</h3>
            {data.detalle.length === 0 ? <p className="empty">No hay cierres en este período.</p> : (
              <div className="table-container">
                <table>
                  <thead><tr><th>Fecha</th><th>Ingresos</th><th>Combustible</th><th>Otros</th><th>Costo mercadería</th><th>Compras proveedores</th><th>Pagos empleados</th><th>Egresos</th><th>Ganancia/Pérdida</th><th>Descripción</th></tr></thead>
                  <tbody>{data.detalle.map((dia) => <tr key={dia.fecha}>
                    <td><strong>{dia.fecha}</strong></td>
                    <td>{dinero(dia.ingresos)}</td>
                    <td>{dinero(dia.combustible)}</td>
                    <td>{dinero(dia.otros)}</td>
                    <td>{dinero(dia.costo_mercaderia)}</td>
                    <td>{dinero(dia.compras_proveedores)}</td>
                    <td>{dinero(dia.pagos_empleados_total)}</td>
                    <td>{dinero(dia.egresos)}</td>
                    <td className={dia.resultado >= 0 ? "monto-ventas" : "monto-regreso"}><strong>{dinero(dia.resultado)}</strong></td>
                    <td>{dia.descripcion_otros || "-"}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
          </div>

          <div className="form-card">
            <h3>Pagos a empleados incluidos</h3>
            {data.detalle.flatMap((dia) => dia.pagos_empleados.map((pago) => ({ ...pago, fecha: dia.fecha }))).length === 0 ? <p className="empty">No hay pagos a empleados en este período.</p> : (
              <div className="table-container">
                <table><thead><tr><th>Fecha</th><th>Empleado</th><th>Rol</th><th>Monto</th></tr></thead><tbody>
                  {data.detalle.flatMap((dia) => dia.pagos_empleados.map((pago) => ({ ...pago, fecha: dia.fecha }))).map((pago, index) => <tr key={`${pago.fecha}-${pago.userId}-${index}`}><td>{pago.fecha}</td><td>{pago.nombre}</td><td>{pago.rol}</td><td><strong>{dinero(pago.monto)}</strong></td></tr>)}
                </tbody></table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
