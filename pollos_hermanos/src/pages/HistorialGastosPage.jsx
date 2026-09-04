import { useEffect, useState } from "react";
import { cierreCajaAPI } from "../api";
import { generarGastosDiaPDF } from "../utils/generarPDF";
import { dinero } from "../utils/numero";

export default function HistorialGastosPage() {
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ desde: "", hasta: "", usuario: "" });

  useEffect(() => {
    cierreCajaAPI.getHistorialGastos().then((response) => setGastos(response.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Cargando...</div>;
  const gastosFiltrados = gastos.filter((gasto) => {
    const fecha = String(gasto.fecha).slice(0, 10);
    const usuario = String(gasto.usuario_cierre || "").toLowerCase();
    const usuarioBuscado = filtros.usuario.trim().toLowerCase();
    return (!filtros.desde || fecha >= filtros.desde)
      && (!filtros.hasta || fecha <= filtros.hasta)
      && (!usuarioBuscado || usuario.includes(usuarioBuscado));
  });

  return (
    <div className="history-panel">
      <div className="history-panel-header">
        <div><h3>Historial de Gastos</h3><p className="subtitle">Gastos guardados al realizar cada cierre de caja.</p></div>
      </div>
      <div className="form-card" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "end", marginBottom: "1rem" }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Desde</label>
          <input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Hasta</label>
          <input type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} />
        </div>
        <div className="form-group" style={{ margin: 0, flex: "1 1 180px" }}>
          <label>Usuario</label>
          <input placeholder="Buscar usuario" value={filtros.usuario} onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })} />
        </div>
        <button className="btn btn-secondary" onClick={() => setFiltros({ desde: "", hasta: "", usuario: "" })}>Limpiar</button>
      </div>
      {gastos.length === 0 ? <p className="empty">No hay gastos registrados en cierres.</p> : (
        gastosFiltrados.length === 0 ? <p className="empty">No hay gastos que coincidan con los filtros.</p> : (
        <div className="table-container">
          <table>
            <thead><tr><th>Fecha</th><th>Combustible</th><th>Otros</th><th>Total</th><th>Descripción</th><th>PDF</th></tr></thead>
            <tbody>{gastosFiltrados.map((gasto) => <tr key={gasto.id}>
              <td><strong>{gasto.fecha}</strong></td>
               <td>{dinero(gasto.gastos_combustible)}</td>
               <td>{dinero(gasto.gastos_otros)}</td>
               <td><strong>{dinero(gasto.total)}</strong></td>
              <td>{gasto.descripcion_otros_gastos || "-"}</td>
              <td><button className="btn btn-sm btn-primary" onClick={() => generarGastosDiaPDF(gasto)}>PDF</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        )
      )}
    </div>
  );
}
