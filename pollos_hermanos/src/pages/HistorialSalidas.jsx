import { useState, useEffect, useMemo } from "react";
import { salidasAPI } from "../api";
import { generarResumenEntregaPDF } from "../utils/generarPDF";

const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100];

const formatoCantidad = (unidades) => String(Math.round((Number(unidades) || 0) * 100) / 100);

export default function HistorialSalidas() {
  const [salidas, setSalidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ buscar: "", fecha: "", estado: "" });
  const [detalle, setDetalle] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [conteos, setConteos] = useState({});
  const [conteoModalId, setConteoModalId] = useState(null);
  const [conteoBilletes, setConteoBilletes] = useState({});

  useEffect(() => {
    loadSalidas();
  }, []);

  const loadSalidas = async () => {
    try {
      const res = await salidasAPI.getAll();
      setSalidas(res.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta salida? El stock se restaurará.")) return;
    try {
      await salidasAPI.delete(id);
      loadSalidas();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const cargarDetalle = async (id) => {
    try {
      const [salidaRes, ventasRes] = await Promise.all([
        salidasAPI.getById(id),
        salidasAPI.getVentas(id),
      ]);
      const vendidos = {};
      for (const venta of ventasRes.data) {
        for (const item of venta.VentaItems || []) {
          const unidades = Number(item.cantidad) || 0;
          vendidos[item.productoId] = Math.round(((vendidos[item.productoId] || 0) + unidades) * 100) / 100;
        }
      }
      const items = (salidaRes.data.SalidaCamionItems || []).map((item) => ({
        ...item,
        vendido: vendidos[item.productoId] || 0,
        cargadoUnidades: Number(item.cantidad) || 0,
        devueltoUnidades: Number(item.cantidad_devuelta) || 0,
        faltante: Math.max(0, (Number(item.cantidad) || 0) - (Number(item.cantidad_devuelta) || 0) - (vendidos[item.productoId] || 0)),
      }));
      return { salida: salidaRes.data, ventas: ventasRes.data, items, sobrantes: items.filter((item) => item.faltante > 0) };
    } catch (error) {
      alert("Error al obtener detalle: " + (error.response?.data?.message || error.message));
      return null;
    }
  };

  const handleVerDetalle = async (id) => {
    setLoadingDetalle(true);
    setDetalle(await cargarDetalle(id));
    setLoadingDetalle(false);
  };

  const handleDownloadResumen = async (id) => {
    const data = await cargarDetalle(id);
    if (data) generarResumenEntregaPDF({ ...data.salida, sobrantes: data.sobrantes }, data.ventas, conteos[id]);
  };

  const abrirConteo = (id) => {
    setConteoBilletes(conteos[id]?.billetes || {});
    setConteoModalId(id);
  };

  const guardarConteo = () => {
    setConteos({ ...conteos, [conteoModalId]: { billetes: conteoBilletes } });
    setConteoModalId(null);
  };

  const totalConteo = useMemo(
    () =>
      Object.entries(conteoBilletes).reduce(
        (suma, [valor, cant]) => suma + Number(valor) * (Number(cant) || 0),
        0
      ),
    [conteoBilletes]
  );

  const salidasFiltradas = useMemo(() => {
    return salidas.filter((s) => {
      if (filtros.buscar) {
        const q = filtros.buscar.toLowerCase();
        const camion = (s.camion || "").toLowerCase();
        const repartidor = (s.repartidor_asignado?.nombre || "").toLowerCase();
        if (!camion.includes(q) && !repartidor.includes(q)) return false;
      }
      if (filtros.fecha && s.fecha !== filtros.fecha) return false;
      if (filtros.estado && s.estado !== filtros.estado) return false;
      return true;
    });
  }, [salidas, filtros]);

  const estadoColors = {
    pendiente: "#f59e0b",
    en_camino: "#3b82f6",
    entregado: "#10b981",
    cancelado: "#ef4444",
    sobrante: "#dc2626",
  };
  const estadoLabels = { pendiente: "Pendiente", en_camino: "En Camino", entregado: "Entregado", cancelado: "Cancelado", sobrante: "Sobrante" };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div>
      <h2>Historial de Salidas de Camión</h2>

      {detalle && (
        <div className="modal-overlay" onClick={() => setDetalle(null)}>
          <div className="modal-card modal-wide salida-detail-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Detalle del camión {detalle.salida.camion}</h3>
            <p className="subtitle">{detalle.salida.fecha} · Zona: {detalle.salida.destino || "-"}</p>
            {detalle.salida.estado === "sobrante" && detalle.sobrantes.length > 0 && (
              <div className="sobrante-alert">
                <strong>Faltó devolver mercadería</strong>
                <span>Productos pendientes:</span>
                {detalle.sobrantes.map((item) => <span key={item.id}>• {item.Producto?.nombre || "Producto"}: {formatoCantidad(item.faltante)}</span>)}
              </div>
            )}
            <div className="table-container">
              <table>
                <thead><tr><th>Producto</th><th>Llevó</th><th>Vendió</th><th>Devolvió</th><th>Faltó devolver</th></tr></thead>
                <tbody>{detalle.items.map((item) => <tr key={item.id}>
                  <td>{item.Producto?.nombre || "-"}</td>
                  <td>{formatoCantidad(item.cargadoUnidades)}</td>
                  <td>{formatoCantidad(item.vendido)}</td>
                  <td>{formatoCantidad(item.devueltoUnidades)}</td>
                  <td className={item.faltante > 0 ? "monto-regreso" : ""}><strong>{formatoCantidad(item.faltante)}</strong></td>
                </tr>)}</tbody>
              </table>
            </div>
            {(detalle.ventas || []).length > 0 && (
              <div className="table-container" style={{ marginTop: "1rem" }}>
                <table>
                  <thead><tr><th>Comprobante</th><th>Cliente</th><th>Total</th></tr></thead>
                  <tbody>{detalle.ventas.map((venta) => (
                    <tr key={venta.id}>
                      <td>{venta.numero_comprobante || `#${venta.id}`}</td>
                      <td>{venta.cliente?.nombre || "-"}</td>
                      <td>$ {Number(venta.total || 0).toFixed(2)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {detalle.salida.notas && (
              <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "8px", whiteSpace: "pre-line" }}>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "600", marginBottom: "0.25rem" }}>Observaciones</div>
                {detalle.salida.estado === "cancelado"
                  ? <div><strong style={{ color: "var(--danger)" }}>ENVIO CANCELADO</strong><div>{detalle.salida.notas.replace(/^ENVIO CANCELADO\s*\n?/i, "")}</div></div>
                  : detalle.salida.notas}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDetalle(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={() => generarResumenEntregaPDF({ ...detalle.salida, sobrantes: detalle.sobrantes }, detalle.ventas, conteos[detalle.salida.id])}>Generar PDF</button>
            </div>
          </div>
        </div>
      )}

      {conteoModalId !== null && (
        <div className="modal-overlay" onClick={() => setConteoModalId(null)}>
          <div className="modal-card conteo-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Conteo de Billetes</h3>
            <p className="subtitle">Calculadora de efectivo para corroborar con las ventas en efectivo de la salida</p>
            {DENOMINACIONES.map((den) => (
              <div key={den} className="conteo-row">
                <span className="conteo-den">$ {den}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={conteoBilletes[den] ?? ""}
                  onChange={(e) =>
                    setConteoBilletes({
                      ...conteoBilletes,
                      [den]: e.target.value === "" ? "" : Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    })
                  }
                  placeholder="0"
                />
                <span className="conteo-sub">$ {(den * (Number(conteoBilletes[den]) || 0)).toLocaleString("es-UY")}</span>
              </div>
            ))}
            <div className="conteo-total">
              <span>Total contado</span>
              <strong>$ {totalConteo.toLocaleString("es-UY")}</strong>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConteoBilletes({})}>Limpiar</button>
              <button className="btn btn-cancel" onClick={() => setConteoModalId(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={guardarConteo}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      <div className="form-card filtros-card">
        <div className="filtros-grid">
          <div className="form-group">
            <label>Camion / Repartidor</label>
            <div className="search-with-clear">
              <input
                name="buscar"
                value={filtros.buscar}
                onChange={(e) => setFiltros({ ...filtros, buscar: e.target.value })}
                placeholder="Buscar por camion o repartidor..."
              />
              {filtros.buscar && (
                <button type="button" className="search-clear" onClick={() => setFiltros({ ...filtros, buscar: "" })} aria-label="Borrar búsqueda">
                  X
                </button>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Fecha</label>
            <input
              type="date"
              value={filtros.fecha}
              onChange={(e) => setFiltros({ ...filtros, fecha: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Estado</label>
            <select
              value={filtros.estado}
              onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_camino">En Camino</option>
              <option value="entregado">Entregado</option>
              <option value="cancelado">Cancelado</option>
              <option value="sobrante">Sobrante</option>
            </select>
          </div>
        </div>
      </div>

      {salidasFiltradas.length === 0 ? (
        <p className="empty">No hay salidas que coincidan con los filtros</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Camión</th>
                <th>Repartidor</th>
                <th>Creado por</th>
                <th>Estado</th>
                <th>Acciones</th>
                <th>Mercadería</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {salidasFiltradas.map((s) => (
                <tr key={s.id}>
                  <td>{s.fecha}</td>
                  <td><strong>{s.camion}</strong></td>
                  <td>{s.repartidor_asignado?.nombre || "-"}</td>
                  <td>{s.creado_por?.nombre || "-"}</td>
                  <td>
                    <span
                      className="estado-badge"
                      style={{ backgroundColor: estadoColors[s.estado] }}
                    >
                        {estadoLabels[s.estado] || s.estado}
                    </span>
                  </td>
                  <td>
                    {s.estado === "pendiente" && (
                      <button
                        className="btn btn-sm btn-cancel"
                        onClick={() => handleDelete(s.id)}
                      >
                        Eliminar
                      </button>
                    )}
                    <button className="btn btn-sm btn-secondary" onClick={() => handleVerDetalle(s.id)} disabled={loadingDetalle}>
                      Detalle
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => abrirConteo(s.id)}>
                      Conteo{conteos[s.id] ? " ✓" : ""}
                    </button>
                    <button className="btn btn-sm btn-primary" onClick={() => handleDownloadResumen(s.id)} disabled={loadingDetalle}>
                      PDF
                    </button>
                  </td>
                  <td>
                    <div className="badge-grid">
                      {s.SalidaCamionItems?.map((item) => (
                        <span key={item.id} className="badge">
                          {item.cantidad}x {item.Producto?.nombre}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ whiteSpace: "pre-line", minWidth: "120px" }}>
                    {s.estado === "cancelado" && s.notas ? (
                      <>
                        <span style={{ fontWeight: "bold", color: "var(--danger)" }}>ENVIO CANCELADO</span>
                        <div>{s.notas.replace(/^ENVIO CANCELADO\s*\n?/i, "")}</div>
                      </>
                    ) : s.notas || "-"}
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
