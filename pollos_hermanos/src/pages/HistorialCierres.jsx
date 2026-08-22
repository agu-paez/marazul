import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { cierreCajaAPI } from "../api";
import { generarResumenPagosPorProveedorPDF, generarTransferenciaIndividualPDF, generarCierreCajaPDF } from "../utils/generarPDF";

const getFechaLocal = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export default function HistorialCierres() {
  const { user } = useAuth();
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cierreExpandido, setCierreExpandido] = useState(null);
  const [transferencias, setTransferencias] = useState([]);
  const [loadingTransf, setLoadingTransf] = useState(false);
  const [proveedorExpandido, setProveedorExpandido] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const today = getFechaLocal();
  const esAdmin = user?.role === "admin";
  const esAdminOrOperador = user?.role === "admin" || user?.role === "operador";

  useEffect(() => {
    loadCierres();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadCierres = async () => {
    try {
      const res = await cierreCajaAPI.getHistorial();
      setCierres(res.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAbrir = async (c) => {
    if (!window.confirm(`¿Abrir la caja del día ${c.fecha}?\nEsto eliminará el cierre y permitirá cerrar el día nuevamente.`)) return;
    try {
      await cierreCajaAPI.abrir(c.fecha);
      alert("Caja abierta correctamente");
      loadCierres();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const handleEliminar = async (c) => {
    if (!window.confirm(`¿Eliminar el cierre del día ${c.fecha}?\nEsta acción no se puede deshacer.`)) return;
    try {
      await cierreCajaAPI.eliminar(c.fecha);
      alert("Cierre eliminado correctamente");
      loadCierres();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const handleExpandir = async (cierre) => {
    if (cierreExpandido === cierre.id) {
      setCierreExpandido(null);
      setTransferencias([]);
      setProveedorExpandido(null);
      return;
    }
    setCierreExpandido(cierre.id);
    setProveedorExpandido(null);
    setLoadingTransf(true);
    try {
      const res = await cierreCajaAPI.getPagosHoy(cierre.fecha);
      setTransferencias(res.data);
    } catch (error) {
      console.error("Error:", error);
      setTransferencias([]);
    } finally {
      setLoadingTransf(false);
    }
  };

  const handleProveedorExpandir = (proveedorId) => {
    if (proveedorExpandido === proveedorId) {
      setProveedorExpandido(null);
    } else {
      setProveedorExpandido(proveedorId);
    }
  };

  const handleCierrePDF = async (cierre) => {
    try {
      const res = await cierreCajaAPI.getPagosHoy(cierre.fecha);
      await generarResumenPagosPorProveedorPDF(res.data, cierre.fecha);
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const handleCierreCompletoPDF = async (cierre) => {
    try {
      const res = await cierreCajaAPI.getDetalleCierre(cierre.fecha);
      await generarCierreCajaPDF(res.data);
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const handleTransferenciaPDF = (pago, fecha) => {
    generarTransferenciaIndividualPDF(pago, fecha);
  };

  const handleEliminarCierre = async (cierre) => {
    const confirmado = window.confirm(`¿Eliminar el cierre de caja del ${cierre.fecha}? Podrás realizar otro cierre para ese día.`);
    if (!confirmado) return;

    try {
      await cierreCajaAPI.eliminar(cierre.id);
      setCierres((actuales) => actuales.filter((item) => item.id !== cierre.id));
      if (cierreExpandido === cierre.id) {
        setCierreExpandido(null);
        setTransferencias([]);
      }
    } catch (error) {
      alert(error.response?.data?.message || "No se pudo eliminar el cierre");
    }
  };

  const handleProveedorPDF = (proveedor, fecha) => {
    const pagosProveedor = transferencias.filter((t) =>
      (t.proveedor?.id || "sin-proveedor") === (proveedor.id || "sin-proveedor")
    );
    generarResumenPagosPorProveedorPDF(pagosProveedor, fecha);
  };

  const agruparPorProveedor = (pagos) => {
    const grupos = {};
    for (const pago of pagos.filter((item) => item.proveedor?.id)) {
      const key = pago.proveedor.id;
      if (!grupos[key]) {
        grupos[key] = {
          proveedor: pago.proveedor,
          pagos: [],
        };
      }
      grupos[key].pagos.push(pago);
    }
    return Object.values(grupos);
  };

  const gruposProveedor = agruparPorProveedor(transferencias);

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div>
      <h2 style={{ fontSize: isMobile ? "1.25rem" : "1.5rem" }}>Historial de Cierres de Caja</h2>

      {cierres.length === 0 ? (
        <p className="empty">No hay cierres de caja registrados</p>
      ) : isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {cierres.map((c) => (
            <div key={c.id} style={{
              background: "var(--bg-card)",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              overflow: "hidden"
            }}>
              <div 
                style={{ 
                  padding: "1rem", 
                  cursor: "pointer",
                  background: cierreExpandido === c.id ? "var(--bg-secondary)" : "transparent"
                }}
                onClick={() => handleExpandir(c)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{
                        display: "inline-block",
                        transition: "transform 0.2s",
                        transform: cierreExpandido === c.id ? "rotate(90deg)" : "rotate(0deg)",
                        fontSize: "0.7rem",
                        color: "var(--primary)"
                      }}>
                        &#9654;
                      </span>
                      <strong style={{ fontSize: "1rem" }}>{c.fecha}</strong>
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{c.hora}</span>
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                      {c.usuario_cierre} • {c.salidas_count} salidas
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="monto-ventas" style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
                      ${c.total_ventas}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      Netas: ${c.ventas_netas}
                    </div>
                  </div>
                </div>
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "1fr 1fr", 
                  gap: "0.5rem",
                  fontSize: "0.8rem",
                  marginTop: "0.5rem"
                }}>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>Enviada: </span>
                    <strong className="monto-salida">${c.mercaderia_enviada}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>Devuelta: </span>
                    <strong className="monto-regreso">${c.mercaderia_devuelta}</strong>
                  </div>
                </div>
                {user?.role === "admin" && (
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ flex: 1, fontSize: "0.75rem" }}
                      onClick={() => handleCierreCompletoPDF(c)}
                    >
                      Cierre PDF
                    </button>
                    <button
                      className="btn btn-sm btn-cierre-pdf"
                      style={{ flex: 1, fontSize: "0.75rem" }}
                      onClick={() => handleCierrePDF(c)}
                    >
                      Por Proveedor
                    </button>
                    <button
                      className="btn btn-sm btn-cancel"
                      style={{ flex: 1, fontSize: "0.75rem" }}
                      onClick={() => handleEliminarCierre(c)}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
                {((c.fecha === today && esAdminOrOperador) || (c.fecha !== today && esAdmin)) && (
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }} onClick={(e) => e.stopPropagation()}>
                    {c.fecha === today && esAdminOrOperador && (
                      <button
                        className="btn btn-sm btn-abrir"
                        style={{ flex: 1, fontSize: "0.75rem" }}
                        onClick={() => handleAbrir(c)}
                      >
                        Abrir
                      </button>
                    )}
                    {c.fecha !== today && esAdmin && (
                      <button
                        className="btn btn-sm btn-cancel"
                        style={{ flex: 1, fontSize: "0.75rem" }}
                        onClick={() => handleEliminar(c)}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                )}
              </div>
              {cierreExpandido === c.id && (
                <div style={{ 
                  padding: "1rem", 
                  borderTop: "1px solid var(--border)",
                  background: "var(--bg-secondary)"
                }}>
                  <h4 style={{ margin: "0 0 0.75rem", color: "var(--primary)", fontSize: "0.95rem" }}>
                    Transferencias
                  </h4>
                  {loadingTransf ? (
                    <p className="empty" style={{ fontSize: "0.85rem" }}>Cargando...</p>
                  ) : gruposProveedor.length === 0 ? (
                    <p className="empty" style={{ fontSize: "0.85rem" }}>Sin transferencias</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {gruposProveedor.map((grupo, idx) => (
                        <div key={idx} style={{
                          background: "var(--bg-card)",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          overflow: "hidden"
                        }}>
                          <div 
                            style={{ 
                              padding: "0.75rem",
                              cursor: "pointer",
                              background: proveedorExpandido === (grupo.proveedor.id || "sin-proveedor") ? "var(--bg-secondary)" : "transparent"
                            }}
                            onClick={() => handleProveedorExpandir(grupo.proveedor.id || "sin-proveedor")}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: 1, minWidth: 0 }}>
                                <span style={{
                                  display: "inline-block",
                                  transition: "transform 0.2s",
                                  transform: proveedorExpandido === (grupo.proveedor.id || "sin-proveedor") ? "rotate(90deg)" : "rotate(0deg)",
                                  fontSize: "0.65rem",
                                  color: "var(--text-secondary)",
                                  flexShrink: 0
                                }}>
                                  &#9654;
                                </span>
                                <div style={{ minWidth: 0, overflow: "hidden" }}>
                                  <div style={{ 
                                    fontWeight: "bold", 
                                    color: "var(--primary)", 
                                    fontSize: "0.85rem",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis"
                                  }}>
                                    {grupo.proveedor.nombre}
                                  </div>
                                  {grupo.proveedor.alias && (
                                    <div style={{ 
                                      color: "var(--text-secondary)", 
                                      fontSize: "0.7rem",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis"
                                    }}>
                                      {grupo.proveedor.alias}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                                <div style={{ textAlign: "right" }}>
                                  <div className="monto-ventas" style={{ fontSize: "0.9rem", fontWeight: "bold" }}>
                                    ${grupo.pagos.reduce((s, p) => s + (p.monto || 0), 0).toFixed(2)}
                                  </div>
                                  <div style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>
                                    {grupo.pagos.length} transf.
                                  </div>
                                </div>
                                {user?.role === "admin" && (
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleProveedorPDF(grupo.proveedor, c.fecha);
                                    }}
                                  >
                                    PDF
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          {proveedorExpandido === (grupo.proveedor.id || "sin-proveedor") && (
                            <div style={{ 
                              padding: "0.5rem 0.75rem 0.75rem",
                              borderTop: "1px solid var(--border)"
                            }}>
                              {grupo.pagos.map((p, i) => (
                                <div key={i} style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "0.5rem 0",
                                  borderBottom: i < grupo.pagos.length - 1 ? "1px solid var(--border)" : "none",
                                  gap: "0.5rem"
                                }}>
                                  <div style={{ fontSize: "0.75rem", flex: 1, minWidth: 0 }}>
                                    <div style={{ 
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis"
                                    }}>
                                      {p.nombre_cuenta}
                                    </div>
                                    <div style={{ 
                                      color: "var(--text-secondary)", 
                                      fontSize: "0.65rem",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis"
                                    }}>
                                      {(p.fecha_hora || "").replace("T", " ").substring(11, 16)} • {p.banco}
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                                    <strong className="monto-ventas" style={{ fontSize: "0.85rem" }}>
                                      ${(p.monto || 0).toFixed(2)}
                                    </strong>
                                    {user?.role === "admin" && (
                                      <button
                                        className="btn btn-sm btn-secondary"
                                        style={{ padding: "3px 6px", fontSize: "0.65rem" }}
                                        onClick={() => handleTransferenciaPDF(p, c.fecha)}
                                      >
                                        PDF
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Salidas</th>
                <th>Mercaderia Enviada</th>
                <th>Mercaderia Devuelta</th>
                <th>Ventas Netas</th>
                <th>Total Ventas</th>
                <th>Usuario</th>
                {esAdminOrOperador && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {cierres.map((c) => (
                <>
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => handleExpandir(c)}>
                    <td style={{ width: "30px", textAlign: "center" }}>
                      <span style={{
                        display: "inline-block",
                        transition: "transform 0.2s",
                        transform: cierreExpandido === c.id ? "rotate(90deg)" : "rotate(0deg)",
                        fontSize: "0.8rem",
                        color: "var(--primary)"
                      }}>
                        &#9654;
                      </span>
                    </td>
                    <td><strong>{c.fecha}</strong></td>
                    <td>{c.hora}</td>
                    <td>{c.salidas_count}</td>
                    <td className="monto-salida">${c.mercaderia_enviada}</td>
                    <td className="monto-regreso">${c.mercaderia_devuelta}</td>
                    <td className="monto-ventas"><strong>${c.ventas_netas}</strong></td>
                    <td><strong>${c.total_ventas}</strong></td>
                    <td>{c.usuario_cierre}</td>
                    {esAdminOrOperador && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                          {esAdmin && (
                            <>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleCierreCompletoPDF(c)}
                                title="Generar PDF completo del cierre"
                              >
                                Cierre PDF
                              </button>
                              <button
                                className="btn btn-sm btn-cierre-pdf"
                                onClick={() => handleCierrePDF(c)}
                                title="Generar PDFs por proveedor"
                              >
                                Por Proveedor
                              </button>
                            </>
                          )}
                          {c.fecha === today && (
                            <button
                              className="btn btn-sm btn-abrir"
                              onClick={() => handleAbrir(c)}
                              title="Abrir la caja de hoy para poder cerrarla nuevamente"
                            >
                              Abrir
                            </button>
                          )}
                          {c.fecha !== today && esAdmin && (
                            <button
                              className="btn btn-sm btn-cancel"
                              onClick={() => handleEliminar(c)}
                              title="Eliminar este cierre del historial"
                            >
                              Eliminar
                            </button>
                         )}
                        </div>
                      </td>
                    )}
                  </tr>
                  {cierreExpandido === c.id && (
                    <tr key={`${c.id}-detail`}>
                      <td colSpan={esAdminOrOperador ? 10 : 9} style={{ padding: "0", background: "var(--bg-card)" }}>
                        <div style={{ padding: "1rem 1.5rem" }}>
                          <h4 style={{ margin: "0 0 0.75rem", color: "var(--primary)" }}>
                            Transferencias del Cierre - {c.fecha}
                          </h4>
                          {loadingTransf ? (
                            <p className="empty">Cargando transferencias...</p>
                          ) : gruposProveedor.length === 0 ? (
                            <p className="empty">No hay transferencias registradas para este cierre</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                              {gruposProveedor.map((grupo, idx) => (
                                <div key={idx} style={{
                                  background: "var(--bg-secondary)",
                                  borderRadius: "8px",
                                  border: "1px solid var(--border)",
                                  overflow: "hidden"
                                }}>
                                  <div 
                                    style={{ 
                                      display: "flex", 
                                      justifyContent: "space-between", 
                                      alignItems: "center", 
                                      padding: "0.75rem 1rem",
                                      cursor: "pointer",
                                      background: proveedorExpandido === (grupo.proveedor.id || "sin-proveedor") ? "var(--bg-card)" : "transparent"
                                    }}
                                    onClick={() => handleProveedorExpandir(grupo.proveedor.id || "sin-proveedor")}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                      <span style={{
                                        display: "inline-block",
                                        transition: "transform 0.2s",
                                        transform: proveedorExpandido === (grupo.proveedor.id || "sin-proveedor") ? "rotate(90deg)" : "rotate(0deg)",
                                        fontSize: "0.7rem",
                                        color: "var(--text-secondary)"
                                      }}>
                                        &#9654;
                                      </span>
                                      <strong style={{ color: "var(--primary)", fontSize: "0.95rem" }}>
                                        {grupo.proveedor.nombre}
                                      </strong>
                                      {grupo.proveedor.alias && (
                                        <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                                          ({grupo.proveedor.alias})
                                        </span>
                                      )}
                                      <span style={{ 
                                        marginLeft: "0.5rem", 
                                        color: "var(--text-secondary)", 
                                        fontSize: "0.75rem",
                                        background: "var(--bg-card)",
                                        padding: "2px 8px",
                                        borderRadius: "10px"
                                      }}>
                                        {grupo.pagos.length} transf.
                                      </span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                      <strong className="monto-ventas" style={{ fontSize: "0.95rem" }}>
                                        ${grupo.pagos.reduce((s, p) => s + (p.monto || 0), 0).toFixed(2)}
                                      </strong>
                                      {user?.role === "admin" && (
                                        <button
                                          className="btn btn-sm btn-secondary"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleProveedorPDF(grupo.proveedor, c.fecha);
                                          }}
                                        >
                                          PDF
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {proveedorExpandido === (grupo.proveedor.id || "sin-proveedor") && (
                                    <div style={{ 
                                      padding: "0.5rem 1rem 0.75rem",
                                      borderTop: "1px solid var(--border)"
                                    }}>
                                      {grupo.pagos.map((p, i) => (
                                        <div key={i} style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          padding: "0.4rem 0",
                                          borderBottom: i < grupo.pagos.length - 1 ? "1px solid var(--border)" : "none"
                                        }}>
                                          <div style={{ fontSize: "0.8rem" }}>
                                            <span style={{ color: "var(--text-secondary)" }}>{(p.fecha_hora || "").replace("T", " ").substring(11, 16)}</span>
                                            <span style={{ margin: "0 0.5rem" }}>•</span>
                                            <span>{p.nombre_cuenta}</span>
                                            <span style={{ margin: "0 0.5rem", color: "var(--text-secondary)" }}>•</span>
                                            <span style={{ color: "var(--text-secondary)" }}>{p.banco}</span>
                                          </div>
                                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <strong className="monto-ventas" style={{ fontSize: "0.85rem" }}>
                                              ${(p.monto || 0).toFixed(2)}
                                            </strong>
                                            {user?.role === "admin" && (
                                              <button
                                                className="btn btn-sm btn-secondary"
                                                style={{ padding: "2px 8px", fontSize: "0.7rem" }}
                                                onClick={() => handleTransferenciaPDF(p, c.fecha)}
                                              >
                                                PDF
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
