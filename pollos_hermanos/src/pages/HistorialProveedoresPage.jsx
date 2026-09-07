import { useEffect, useState } from "react";
import { proveedoresAPI } from "../api";
import { generarHistorialProveedorPDF } from "../utils/generarPDF";

const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;

export default function HistorialProveedoresPage() {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ desde: "", hasta: "", proveedor: "" });
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ fecha: "", mercaderias_compradas: 0, dinero_ventas: 0, transferencias: 0 });
  const [guardando, setGuardando] = useState(false);

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

  const abrirEdicion = (movimiento) => {
    setEditando(movimiento);
    setForm({
      fecha: String(movimiento.fecha).slice(0, 10),
      mercaderias_compradas: Number(movimiento.mercaderias_compradas) || 0,
      dinero_ventas: Number(movimiento.dinero_ventas) || 0,
      transferencias: Number(movimiento.transferencias) || 0,
    });
  };

  const guardarEdicion = async () => {
    try {
      setGuardando(true);
      await proveedoresAPI.actualizarMovimiento(editando.id, {
        fecha: form.fecha,
        mercaderias_compradas: parseFloat(form.mercaderias_compradas) || 0,
        dinero_ventas: parseFloat(form.dinero_ventas) || 0,
        transferencias: parseFloat(form.transferencias) || 0,
      });
      setEditando(null);
      await cargarHistorial();
    } catch (error) {
      console.error("Error al actualizar movimiento:", error);
      alert("No se pudo actualizar el movimiento.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarMovimiento = async (movimiento) => {
    if (!confirm(`¿Eliminar el movimiento del ${movimiento.proveedor?.nombre || "proveedor"} registrado el ${movimiento.fecha}? Esta accion no se puede deshacer.`)) return;
    try {
      await proveedoresAPI.eliminarMovimiento(movimiento.id);
      await cargarHistorial();
    } catch (error) {
      console.error("Error al eliminar movimiento:", error);
      alert("No se pudo eliminar el movimiento.");
    }
  };

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
                <th>Acciones</th>
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
                      PDF
                    </button>
                    <button className="btn btn-sm btn-editar" onClick={() => abrirEdicion(movimiento)}>
                      Editar
                    </button>
                    <button className="btn btn-sm btn-cancel" onClick={() => eliminarMovimiento(movimiento)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <div className="modal-overlay" onClick={() => !guardando && setEditando(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <h3 style={{ marginBottom: "0.5rem" }}>Editar Movimiento</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                {editando.proveedor?.nombre || "Sin proveedor"} · {editando.fecha}
              </p>
            </div>
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Mercaderías compradas</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.mercaderias_compradas}
                onChange={(e) => setForm({ ...form, mercaderias_compradas: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label>Efectivo enviado</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.dinero_ventas}
                onChange={(e) => setForm({ ...form, dinero_ventas: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label>Transferencias</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.transferencias}
                onChange={(e) => setForm({ ...form, transferencias: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarEdicion} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}