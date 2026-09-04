import { useEffect, useState } from "react";
import { proveedoresAPI } from "../api";
import { generarHistorialProveedorPDF } from "../utils/generarPDF";

const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;

export default function HistorialProveedoresPage() {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ desde: "", hasta: "", proveedor: "" });

  const cargarHistorial = async () => {
    try {
      const res = await proveedoresAPI.getHistorial();
      setMovimientos(res.data);
    } catch (error) {
      console.error("Error al cargar historial de proveedores:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarHistorial();
  }, []);

  if (loading) return <div className="loading">Cargando...</div>;
  const movimientosFiltrados = movimientos.filter((movimiento) => {
    const fecha = String(movimiento.fecha).slice(0, 10);
    const proveedor = `${movimiento.proveedor?.nombre || "Sin proveedor"} ${movimiento.proveedor?.alias || ""}`.toLowerCase();
    const proveedorBuscado = filtros.proveedor.trim().toLowerCase();
    return (!filtros.desde || fecha >= filtros.desde)
      && (!filtros.hasta || fecha <= filtros.hasta)
      && (!proveedorBuscado || proveedor.includes(proveedorBuscado));
  });

  return (
    <div className="historial-proveedores-page">
      <div className="page-header">
        <div>
          <h3>Historial de Proveedores</h3>
          <p className="subtitle">Movimientos registrados desde Saldos y Diferencias.</p>
        </div>
        <button className="btn btn-secondary" onClick={cargarHistorial}>Actualizar</button>
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
          <label>Proveedor</label>
          <input placeholder="Buscar proveedor o alias" value={filtros.proveedor} onChange={(e) => setFiltros({ ...filtros, proveedor: e.target.value })} />
        </div>
        <button className="btn btn-secondary" onClick={() => setFiltros({ desde: "", hasta: "", proveedor: "" })}>Limpiar</button>
      </div>
      {movimientos.length === 0 ? (
        <p className="empty">No hay pagos o compras registrados.</p>
      ) : movimientosFiltrados.length === 0 ? (
        <p className="empty">No hay movimientos que coincidan con los filtros.</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Mercadería</th>
                <th>Efectivo enviado</th>
                <th>Transferencias</th>
                <th>Deuda anterior</th>
                <th>Deuda actual</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {movimientosFiltrados.map((movimiento) => (
                <tr key={movimiento.id}>
                  <td>{movimiento.fecha}</td>
                  <td><strong>{movimiento.proveedor?.nombre || "Sin proveedor"}</strong></td>
                  <td>{dinero(movimiento.mercaderias_compradas)}</td>
                  <td>{dinero(movimiento.dinero_ventas)}</td>
                  <td>{dinero(movimiento.transferencias)}</td>
                  <td>{dinero(movimiento.saldo_anterior)}</td>
                  <td>{dinero(movimiento.saldo_actual)}</td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => generarHistorialProveedorPDF(movimiento)}>
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
