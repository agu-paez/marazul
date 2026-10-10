import { useState, useEffect, useMemo } from "react";
import { ventasLocalAPI } from "../api";
import {
  descargarHistorialVentasLocalPDF,
  hayPdfVentasLocalPendiente,
  marcarPdfVentasLocalPendiente,
  limpiarPdfVentasLocalPendiente,
} from "../utils/ventasLocalPDF";

const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100];

const monto = (valor) => `$ ${(Number(valor) || 0).toFixed(2)}`;

export default function HistorialVentasLocal() {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ buscar: "", desde: "", hasta: "", estado: "" });
  const [conteos, setConteos] = useState({});
  const [conteoModalFecha, setConteoModalFecha] = useState(null);
  const [conteoBilletes, setConteoBilletes] = useState({});
  const [gastosConteo, setGastosConteo] = useState({ combustible: "", otros: "" });
  const [guardandoConteo, setGuardandoConteo] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(null);

  const cargarHistorial = async () => {
    try {
      const params = {};
      if (filtros.buscar.trim()) params.buscar = filtros.buscar.trim();
      if (filtros.desde) params.desde = filtros.desde;
      if (filtros.hasta) params.hasta = filtros.hasta;
      const res = await ventasLocalAPI.getHistorial(params);
      setRegistros(res.data);
      const conteosGuardados = {};
      for (const registro of res.data) {
        if (registro.conteo_billetes) {
          conteosGuardados[registro.fecha] = {
            billetes: registro.conteo_billetes,
            gastos_combustible: Number(registro.gastos_combustible) || 0,
            gastos_otros: Number(registro.gastos_otros) || 0,
          };
        }
      }
      setConteos(conteosGuardados);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarHistorial();
  }, [filtros.desde, filtros.hasta]);

  const handlePDF = async (fecha) => {
    setGenerandoPDF(fecha);
    try {
      await descargarHistorialVentasLocalPDF(fecha);
      limpiarPdfVentasLocalPendiente(fecha);
    } catch (error) {
      const data = error.response?.data;
      const detalle = [data?.message, data?.error].filter(Boolean).join(" — ");
      alert("Error al generar el PDF: " + (detalle || error.message));
    } finally {
      setGenerandoPDF(null);
    }
  };

  const abrirConteo = (registro) => {
    const conteo = conteos[registro.fecha];
    setConteoBilletes(conteo?.billetes || {});
    setGastosConteo({
      combustible: conteo?.gastos_combustible ?? "",
      otros: conteo?.gastos_otros ?? "",
    });
    setConteoModalFecha(registro.fecha);
  };

  const guardarConteo = async () => {
    const combustible = Number(gastosConteo.combustible || 0);
    const otros = Number(gastosConteo.otros || 0);
    if (!Number.isFinite(combustible) || combustible < 0 || !Number.isFinite(otros) || otros < 0) {
      alert("Los gastos deben ser números mayores o iguales a cero");
      return;
    }
    setGuardandoConteo(true);
    try {
      await ventasLocalAPI.guardarConteo(conteoModalFecha, {
        billetes: conteoBilletes,
        gastos_combustible: combustible,
        gastos_otros: otros,
      });
      setConteos({
        ...conteos,
        [conteoModalFecha]: { billetes: conteoBilletes, gastos_combustible: combustible, gastos_otros: otros },
      });
      // Si ya se habia bajado el PDF de ese dia, ahora quedo desactualizado.
      marcarPdfVentasLocalPendiente(conteoModalFecha);
      setConteoModalFecha(null);
    } catch (error) {
      alert("Error al guardar conteo: " + (error.response?.data?.message || error.message));
    } finally {
      setGuardandoConteo(false);
    }
  };

  const totalConteo = useMemo(
    () =>
      Object.entries(conteoBilletes).reduce(
        (suma, [valor, cant]) => suma + Number(valor) * (Number(cant) || 0),
        0
      ),
    [conteoBilletes]
  );

  const registrosFiltrados = useMemo(() => {
    const term = filtros.buscar.trim().toLowerCase();
    return registros.filter((registro) => {
      if (filtros.estado === "cerrado" && !registro.cerrado) return false;
      if (filtros.estado === "abierto" && registro.cerrado) return false;
      if (!term) return true;
      return [registro.fecha, registro.usuario_cierre, ...(registro.vendedores || [])]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(term));
    });
  }, [registros, filtros]);

  const totalFiltrado = useMemo(
    () => registrosFiltrados.reduce((suma, registro) => suma + (Number(registro.total_ventas) || 0), 0),
    [registrosFiltrados]
  );

  if (loading) return <div className="loading">Cargando...</div>;

  const fechasPendientes = registrosFiltrados
    .filter((registro) => hayPdfVentasLocalPendiente(registro.fecha))
    .map((registro) => registro.fecha);

  return (
    <div>
      <h2>Historial de Ventas por Local</h2>

      {fechasPendientes.length > 0 && (
        <div className="form-card" style={{
          border: "1px solid #f0ad4e",
          background: "var(--bg-secondary)",
          marginBottom: "1rem",
          fontSize: "0.85rem"
        }}>
          Falta descargar el PDF de: {fechasPendientes.slice(0, 8).join(", ")}
          {fechasPendientes.length > 8 ? ` y ${fechasPendientes.length - 8} día(s) más` : ""}.
          El PDF no se genera solo: usá el botón PDF de cada fila.
        </div>
      )}

      {conteoModalFecha !== null && (
        <div className="modal-overlay" onClick={() => setConteoModalFecha(null)}>
          <div className="modal-card conteo-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Conteo de Billetes</h3>
            <p className="subtitle">
              Calculadora de efectivo para corroborar con las ventas en efectivo del dia {conteoModalFecha}
            </p>
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
                <span className="conteo-sub">
                  $ {(den * (Number(conteoBilletes[den]) || 0)).toLocaleString("es-UY")}
                </span>
              </div>
            ))}
            <div className="conteo-total">
              <span>Total contado</span>
              <strong>$ {totalConteo.toLocaleString("es-UY")}</strong>
            </div>
            <div className="form-row conteo-gastos">
              <div className="form-group">
                <label>Gastos de combustible</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={gastosConteo.combustible}
                  onChange={(e) => setGastosConteo({ ...gastosConteo, combustible: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Otros gastos</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={gastosConteo.otros}
                  onChange={(e) => setGastosConteo({ ...gastosConteo, otros: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConteoBilletes({})}>
                Limpiar
              </button>
              <button className="btn btn-cancel" onClick={() => setConteoModalFecha(null)}>
                Cerrar
              </button>
              <button className="btn btn-primary" onClick={guardarConteo} disabled={guardandoConteo}>
                {guardandoConteo ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="form-card filtros-card">
        <div className="filtros-grid">
          <div className="form-group">
            <label>Cliente / Vendedor</label>
            <div className="search-with-clear">
              <input
                name="buscar"
                value={filtros.buscar}
                onChange={(e) => setFiltros({ ...filtros, buscar: e.target.value })}
                placeholder="Buscar por cliente, vendedor o fecha..."
              />
              {filtros.buscar && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setFiltros({ ...filtros, buscar: "" })}
                  aria-label="Borrar búsqueda"
                >
                  X
                </button>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Desde</label>
            <input
              type="date"
              value={filtros.desde}
              onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Hasta</label>
            <input
              type="date"
              value={filtros.hasta}
              onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Caja</label>
            <select
              value={filtros.estado}
              onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="cerrado">Cerrada</option>
              <option value="abierto">Abierta</option>
            </select>
          </div>
        </div>
      </div>

      {registrosFiltrados.length === 0 ? (
        <p className="empty">No hay ventas por local que coincidan con los filtros</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Ventas</th>
                <th>Total</th>
                <th>Efectivo</th>
                <th>Transferencias</th>
                <th>Vendedores</th>
                <th>Caja</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {registrosFiltrados.map((registro) => (
                <tr key={registro.fecha}>
                  <td><strong>{registro.fecha}</strong></td>
                  <td>{registro.ventas_count}</td>
                  <td className="monto-ventas"><strong>{monto(registro.total_ventas)}</strong></td>
                  <td>{monto(registro.efectivo)}</td>
                  <td>
                    {monto(registro.transferencia)}
                    {registro.cantidad_transferencias > 0 && (
                      <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                        {registro.cantidad_transferencias} transf.
                      </div>
                    )}
                  </td>
                  <td>
                    {registro.vendedores?.length ? registro.vendedores.join(", ") : "-"}
                    {registro.notas?.length > 0 && (
                      <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                        {registro.notas.length} con observaciones
                      </div>
                    )}
                  </td>
                  <td>
                    {registro.cerrado ? (
                      <span className="estado-badge" style={{ backgroundColor: "#10b981" }}>
                        Cerrada {registro.hora_cierre ? `· ${registro.hora_cierre}` : ""}
                      </span>
                    ) : (
                      <span className="estado-badge" style={{ backgroundColor: "#f59e0b" }}>
                        Abierta
                      </span>
                    )}
                    {registro.cerrado && registro.usuario_cierre && (
                      <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                        por {registro.usuario_cierre}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => abrirConteo(registro)}>
                        Conteo{conteos[registro.fecha] ? " ✓" : ""}
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handlePDF(registro.fecha)}
                        disabled={generandoPDF === registro.fecha}
                      >
                        {generandoPDF === registro.fecha ? "Generando..." : "PDF"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {registrosFiltrados.length > 0 && (
              <tfoot>
                <tr>
                  <td><strong>Total</strong></td>
                  <td><strong>{registrosFiltrados.reduce((s, r) => s + r.ventas_count, 0)}</strong></td>
                  <td className="monto-ventas"><strong>{monto(totalFiltrado)}</strong></td>
                  <td>{monto(registrosFiltrados.reduce((s, r) => s + (Number(r.efectivo) || 0), 0))}</td>
                  <td>{monto(registrosFiltrados.reduce((s, r) => s + (Number(r.transferencia) || 0), 0))}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}