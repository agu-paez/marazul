import { Fragment, useEffect, useState } from "react";
import { clientesAPI } from "../api";
import { generarHistorialDeudasPDF, generarPagoClientePDF } from "../utils/generarPDF";

export default function HistorialDeudasPage() {
  const [historiales, setHistoriales] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [buscar, setBuscar] = useState("");
  const [clienteExpandido, setClienteExpandido] = useState(null);

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

  const historialesFiltrados = historiales.filter((historial) => {
    const termino = buscar.trim().toLowerCase();
    const nombre = String(historial.cliente.nombre || "").toLowerCase();
    const zona = String(historial.cliente.zona || "");
    return !termino || nombre.includes(termino) || zona.toLowerCase().includes(termino);
  });

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

      <div className="form-card historial-deudas-filtros">
        <div className="form-group">
          <label htmlFor="buscar-deudas">Buscar por nombre o zona</label>
          <input
            id="buscar-deudas"
            value={buscar}
            onChange={(event) => setBuscar(event.target.value)}
            placeholder="Ej.: Juan o Zona 1"
          />
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}
      {!error && historialesFiltrados.length === 0 ? (
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
              {historialesFiltrados.map((historial) => {
                const operacionesPago = (historial.pagos || []).filter((pago) => !String(pago.notas || "").toLowerCase().includes("incluido en venta"));
                const expandido = clienteExpandido === historial.cliente.id;
                return (
                  <Fragment key={historial.cliente.id}>
                <tr key={historial.cliente.id}>
                  <td>
                    <button type="button" className="cliente-deudas-link" onClick={() => setClienteExpandido(expandido ? null : historial.cliente.id)}>
                      {expandido ? "-" : "+"} {historial.cliente.nombre}
                    </button>
                  </td>
                  <td>{historial.cliente.zona || "-"}</td>
                  <td className="monto-salida">${Number(historial.saldo_pendiente || 0).toFixed(2)}</td>
                  <td className="monto-regreso">${Number(historial.saldo_favor || 0).toFixed(2)}</td>
                  <td>{(historial.ventas?.length || 0) + (historial.pagos?.length || 0)}</td>
                  <td>
                    <button className="btn btn-sm btn-primary" onClick={() => generarHistorialDeudasPDF(historial)}>
                      Descargar historial de deuda completo
                    </button>
                  </td>
                </tr>
                {expandido && (
                  <tr key={`${historial.cliente.id}-pagos`} className="cliente-deudas-detalle-row">
                    <td colSpan="6">
                      <div className="cliente-deudas-detalle">
                        <h4>Operaciones de Registrar pago de cliente</h4>
                        {operacionesPago.length === 0 ? (
                          <p className="empty">No hay pagos registrados desde este formulario.</p>
                        ) : (
                          <div className="table-container cliente-deudas-operaciones">
                            <table>
                              <thead><tr><th>Fecha</th><th>Medio</th><th>Monto</th><th>Observaciones</th><th>PDF</th></tr></thead>
                              <tbody>
                                {operacionesPago.map((pago) => (
                                  <tr key={pago.id}>
                                    <td>{pago.fecha} {pago.hora || ""}</td>
                                    <td>{pago.medio_pago}</td>
                                    <td className="monto-regreso">-${Number(pago.monto || 0).toFixed(2)}</td>
                                    <td>{pago.notas || "-"}</td>
                                    <td><button className="btn btn-sm btn-cierre-pdf" onClick={() => generarPagoClientePDF(pago, historial)}>PDF</button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
