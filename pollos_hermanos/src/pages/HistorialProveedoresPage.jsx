import { useEffect, useState } from "react";
import { proveedoresAPI } from "../api";
import { generarHistorialProveedorPDF } from "../utils/generarPDF";

const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;

export default function HistorialProveedoresPage() {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="historial-proveedores-page">
      <div className="page-header">
        <div>
          <h3>Historial de Proveedores</h3>
          <p className="subtitle">Movimientos registrados desde Saldos y Diferencias.</p>
        </div>
        <button className="btn btn-secondary" onClick={cargarHistorial}>Actualizar</button>
      </div>
      {movimientos.length === 0 ? (
        <p className="empty">No hay pagos o compras registrados.</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Mercadería</th>
                <th>Efectivo / ventas</th>
                <th>Transferencias</th>
                <th>Deuda anterior</th>
                <th>Deuda actual</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((movimiento) => (
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
