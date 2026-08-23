import { useState, useEffect } from "react";
import { clientesAPI, bancosAPI, proveedoresAPI } from "../api";
import { useAuth } from "../context/AuthContext";
import { generarResumenZonasPDF } from "../utils/generarPDF";
import { dinero, parseNumero } from "../utils/numero";
import { getFechaLocal } from "../utils/fecha";

const zonas = [
  ...Array.from({ length: 6 }, (_, index) => `Zona ${index + 1}`),
  "Mayorista",
  "Zona Carlos Paz",
];

export default function ClientesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [historial, setHistorial] = useState(null);
  const [nombre, setNombre] = useState("");
  const [zona, setZona] = useState("");
  const [tipoDescuento, setTipoDescuento] = useState("producto");
  const [showPagoForm, setShowPagoForm] = useState(false);
  const [clientePago, setClientePago] = useState(null);
  const [pagosCC, setPagosCC] = useState([{ medio_pago: "efectivo", monto: 0 }]);
  const [bancos, setBancos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [fechaPagoCC, setFechaPagoCC] = useState(getFechaLocal());
  const [showDeudaModal, setShowDeudaModal] = useState(false);
  const [clienteDeuda, setClienteDeuda] = useState(null);
  const [montos, setMontos] = useState({ saldo_pendiente: "0", limite_credito: "30000" });
  const [orden, setOrden] = useState("todos");

  useEffect(() => {
    loadClientes();
    Promise.all([bancosAPI.getAll(), proveedoresAPI.getAll()])
      .then(([bancosRes, proveedoresRes]) => {
        setBancos(bancosRes.data.map((banco) => banco.nombre));
        setProveedores(proveedoresRes.data);
      })
      .catch((error) => console.error("Error al cargar datos bancarios:", error));
  }, []);

  const loadClientes = async () => {
    try {
      const res = await clientesAPI.getAll();
      setClientes(res.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editando) {
        await clientesAPI.update(editando.id, { nombre, zona, tipo_descuento: tipoDescuento });
        if (isAdmin) {
          await clientesAPI.updateMontos(editando.id, {
            saldo_pendiente: parseNumero(montos.saldo_pendiente),
            limite_credito: parseNumero(montos.limite_credito),
          });
        }
      } else {
        await clientesAPI.create({ nombre, zona, tipo_descuento: tipoDescuento });
      }
      setShowForm(false);
      setEditando(null);
      setNombre("");
      setZona("");
      setTipoDescuento("producto");
      loadClientes();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const openEdit = async (c) => {
    if (c.pendiente_revision && (user?.role === "admin" || user?.role === "operador")) {
      try {
        await clientesAPI.revisar(c.id);
        setClientes((prev) => prev.map((cl) => (cl.id === c.id ? { ...cl, pendiente_revision: false } : cl)));
      } catch (error) {
        alert("Error al marcar cliente como revisado: " + (error.response?.data?.message || error.message));
      }
    }
    setEditando(c);
    setNombre(c.nombre);
    setZona(c.zona || "");
    setTipoDescuento(c.tipo_descuento || "producto");
    setMontos({
      saldo_pendiente: String(c.saldo_pendiente ?? 0),
      limite_credito: String(c.limite_credito ?? 30000),
    });
    setShowForm(true);
  };

  const openCreate = () => {
    setEditando(null);
    setNombre("");
    setZona("");
    setTipoDescuento("producto");
    setShowForm(true);
  };

  const verHistorial = async (c) => {
    try {
      const res = await clientesAPI.getHistorialCC(c.id);
      setHistorial(res.data);
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const openPagoCC = (c) => {
    setClientePago(c);
    setPagosCC([{ medio_pago: "efectivo", monto: 0 }]);
    setFechaPagoCC(getFechaLocal());
    setShowPagoForm(true);
  };

  const handlePagoChange = (index, e) => {
    const newPagos = [...pagosCC];
    newPagos[index][e.target.name] = e.target.value;
    setPagosCC(newPagos);
  };

  const addPagoCC = () => {
    setPagosCC([...pagosCC, { medio_pago: "efectivo", monto: 0 }]);
  };

  const removePagoCC = (index) => {
    if (pagosCC.length > 1) {
      setPagosCC(pagosCC.filter((_, i) => i !== index));
    }
  };

  const totalPagosCC = pagosCC.reduce((sum, p) => sum + parseNumero(p.monto), 0);
  const deudaActual = clientePago ? parseNumero(clientePago.saldo_pendiente) : 0;
  const pagoValido = totalPagosCC > 0;

  const submitPagoCC = async (e) => {
    e.preventDefault();
    if (!pagoValido) {
      alert("El monto del pago no es valido");
      return;
    }
    const pagoBancarioInvalido = pagosCC.some((pago) => {
      if (!["transferencia", "tarjeta"].includes(pago.medio_pago)) return false;
      const proveedor = proveedores.find((item) => String(item.id) === String(pago.proveedorId));
      return !proveedor?.alias || !pago.nombre_cuenta?.trim() || !pago.banco;
    });
    if (pagoBancarioInvalido) {
      alert("Para transferencias o tarjetas debe seleccionar proveedor, cuenta/titular y banco");
      return;
    }
    try {
      const res = await clientesAPI.registrarPagoCC(clientePago.id, {
        pagos: pagosCC.map((p) => {
          const proveedor = proveedores.find((item) => String(item.id) === String(p.proveedorId));
          const esBancario = ["transferencia", "tarjeta"].includes(p.medio_pago);
          return {
            medio_pago: p.medio_pago,
            monto: parseNumero(p.monto),
            fecha_pago: fechaPagoCC || null,
            ...(esBancario ? {
              datos_transferencia: p.medio_pago === "transferencia" ? {
                nombre_cuenta: p.nombre_cuenta.trim(),
                titular: p.nombre_cuenta.trim(),
                alias: proveedor?.alias || "",
                proveedorId: proveedor?.id || null,
                banco: p.banco,
                fecha_hora: new Date().toISOString(),
                monto: parseNumero(p.monto),
              } : null,
              datos_tarjeta: p.medio_pago === "tarjeta" ? {
                nombre_cuenta: p.nombre_cuenta.trim(),
                titular: p.nombre_cuenta.trim(),
                alias: proveedor?.alias || "",
                proveedorId: proveedor?.id || null,
                banco: p.banco,
                fecha_hora: new Date().toISOString(),
                monto: parseNumero(p.monto),
              } : null,
            } : {}),
          };
        }),
      });
      alert(res.data.message);
      setShowPagoForm(false);
      setClientePago(null);
      loadClientes();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Desactivar este cliente?")) return;
    try {
      await clientesAPI.delete(id);
      loadClientes();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  if (loading) return <div className="loading">Cargando...</div>;

  const filtrados = clientes.filter((c) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.nombre || "").toLowerCase().includes(q) ||
      (c.zona || "").toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (orden === "deudores") return parseNumero(b.saldo_pendiente) - parseNumero(a.saldo_pendiente);
    if (orden === "favor") return parseNumero(b.saldo_favor) - parseNumero(a.saldo_favor);
    return 0;
  });

  return (
    <div>
      <div className="page-header">
        <h2>Clientes</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-secondary" onClick={() => generarResumenZonasPDF(clientes, zonas)}>Resumen por Zonas</button>
          <button className="btn btn-primary" onClick={openCreate}>+ Nuevo Cliente</button>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{editando ? "Editar Cliente" : "Nuevo Cliente"}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre del cliente *</label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre"
                  required
                />
              </div>
              <div className="form-group">
                <label>Zona de reparto *</label>
                <select value={zona} onChange={(e) => setZona(e.target.value)} required>
                  <option value="">Seleccionar zona...</option>
                  {zonas.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo de descuento</label>
                <select value={tipoDescuento} onChange={(e) => setTipoDescuento(e.target.value)}>
                  <option value="producto">Descuento de producto</option>
                  <option value="mayorista">Descuento mayorista</option>
                  <option value="nuevo">Descuento para cliente nuevo</option>
                </select>
              </div>
              {editando && (
                <>
                  <div className="form-group">
                    <label>Saldo pendiente</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={montos.saldo_pendiente}
                      onChange={(e) => setMontos({ ...montos, saldo_pendiente: e.target.value })}
                      disabled={!isAdmin}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Limite de credito</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={montos.limite_credito}
                      onChange={(e) => setMontos({ ...montos, limite_credito: e.target.value })}
                      disabled={!isAdmin}
                      required
                    />
                  </div>
                </>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editando ? "Guardar" : "Crear"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeudaModal && clienteDeuda && (
        <div className="modal-overlay" onClick={() => setShowDeudaModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)", display: "flex",
                alignItems: "center", justifyContent: "center", margin: "0 auto 1rem"
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22z"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h3 style={{ color: "var(--danger)", marginBottom: "0.3rem" }}>Deuda Pendiente</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>{clienteDeuda.nombre}</p>
              <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--danger)", marginTop: "0.5rem" }}>
                {dinero(clienteDeuda.saldo_pendiente)}
              </div>
            </div>
            <div className="modal-actions" style={{ flexDirection: "column", gap: "0.5rem" }}>
              <button
                className="btn btn-primary btn-full"
                onClick={async () => {
                  try {
                    await clientesAPI.registrarPagoCC(clienteDeuda.id, {
                      pagos: [{ medio_pago: "efectivo", monto: parseNumero(clienteDeuda.saldo_pendiente) }],
                    });
                    setShowDeudaModal(false);
                    loadClientes();
                  } catch (error) {
                    alert("Error: " + (error.response?.data?.message || error.message));
                  }
                }}
              >
                Pagar Total
              </button>
              <button
                className="btn btn-secondary btn-full"
                onClick={() => {
                  setShowDeudaModal(false);
                  openPagoCC(clienteDeuda);
                }}
              >
                Registrar Pago
              </button>
              <button className="btn btn-sm btn-cancel" onClick={() => setShowDeudaModal(false)} style={{ marginTop: "0.5rem" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {historial && (
        <div className="modal-overlay" onClick={() => setHistorial(null)}>
          <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Historial de {historial.cliente.nombre}</h3>
            <div className="cc-resumen">
              <div className="cc-item"><span>Saldo pendiente:</span><strong className="monto-salida">{dinero(historial.saldo_pendiente)}</strong></div>
              <div className="cc-item"><span>Saldo a favor:</span><strong className="monto-regreso">{dinero(historial.saldo_favor)}</strong></div>
            </div>

            <h4>Movimientos de Cuenta Corriente</h4>
            {historial.pagos && historial.pagos.length > 0 ? (
                <div className="table-container" style={{ maxHeight: "260px", overflowY: "auto", marginBottom: "1rem" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Medio de Pago</th>
                        <th>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.pagos.map((p) => (
                        <tr key={p.id}>
                          <td>{p.fecha}</td>
                          <td>{p.hora}</td>
                          <td>{p.medio_pago}</td>
                          <td className="monto-regreso">-{dinero(p.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            ) : (
              <p className="empty">No hay movimientos registrados</p>
            )}

            <h4>Todas las Compras</h4>
            {historial.ventas.length === 0 ? (
              <p className="empty">No hay compras registradas</p>
            ) : (
              <div className="table-container" style={{ maxHeight: "260px", overflowY: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Nro Comprobante</th>
                      <th>Medio de Pago</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.ventas.map((v) => (
                      <tr key={v.id}>
                        <td>{v.fecha} {v.hora}</td>
                        <td><strong>{v.numero_comprobante}</strong></td>
                        <td>{v.pago_dividido ? "Dividido" : v.medio_pago}</td>
                        <td>${v.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setHistorial(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showPagoForm && clientePago && (
        <div className="modal-overlay" onClick={() => setShowPagoForm(false)}>
          <div className="modal-card modal-scrollable pago-cc-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Registrar Pago - {clientePago.nombre}</h3>
            <div className="cc-resumen" style={{ marginBottom: "1rem" }}>
              <div className="cc-item">
                <span>Deuda actual:</span>
                <strong className="monto-salida">{dinero(deudaActual)}</strong>
              </div>
            </div>
            <form onSubmit={submitPagoCC}>
              <div className="form-group">
                <label>Fecha del pago *</label>
                <input
                  type="date"
                  value={fechaPagoCC}
                  onChange={(e) => setFechaPagoCC(e.target.value)}
                  required
                />
                <p className="subtitle">Fecha real de emision del pago/transferencia. La fecha de registro sera la de hoy ({getFechaLocal()}).</p>
              </div>
              {pagosCC.map((pago, index) => (
                <div key={index} className="item-row">
                  <select
                    name="medio_pago"
                    value={pago.medio_pago}
                    onChange={(e) => handlePagoChange(index, e)}
                    required
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="otro">Otro</option>
                  </select>
                  <input
                     type="text"
                     inputMode="decimal"
                    name="monto"
                    value={Number(pago.monto) ? pago.monto : ""}
                    onChange={(e) => handlePagoChange(index, e)}
                    min="0"
                    step="0.01"
                    placeholder="Monto"
                    required
                  />
                  {["transferencia", "tarjeta"].includes(pago.medio_pago) && (
                    <>
                      <select
                        name="proveedorId"
                        value={pago.proveedorId || ""}
                        onChange={(e) => handlePagoChange(index, e)}
                        required
                      >
                        <option value="">Proveedor...</option>
                        {proveedores.map((proveedor) => (
                          <option key={proveedor.id} value={proveedor.id}>
                            {proveedor.nombre}{proveedor.alias ? ` (${proveedor.alias})` : ""}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        name="nombre_cuenta"
                        value={pago.nombre_cuenta || ""}
                        onChange={(e) => handlePagoChange(index, e)}
                        placeholder="Cuenta / titular"
                        required
                      />
                      <select
                        name="banco"
                        value={pago.banco || ""}
                        onChange={(e) => handlePagoChange(index, e)}
                        required
                      >
                        <option value="">Banco...</option>
                        {bancos.map((banco) => <option key={banco} value={banco}>{banco}</option>)}
                      </select>
                    </>
                  )}
                  {pagosCC.length > 1 && (
                    <button type="button" className="btn btn-sm btn-cancel" onClick={() => removePagoCC(index)}>X</button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-secondary" onClick={addPagoCC} style={{ marginBottom: "0.5rem" }}>
                + Agregar Medio de Pago
              </button>
              <div className="resumen-row">
                <span>Total a pagar:</span>
                <strong className={pagoValido ? "monto-regreso" : "monto-salida"}>
                  {dinero(totalPagosCC)}
                </strong>
              </div>
              <div className="resumen-row">
                <span>Saldo restante:</span>
                <strong className={(deudaActual - totalPagosCC) < 0 ? "monto-regreso" : ""}>
                  {dinero(deudaActual - totalPagosCC)}
                  {(deudaActual - totalPagosCC) < 0 ? " (a favor)" : ""}
                </strong>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPagoForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!pagoValido}>
                  Registrar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {clientes.length === 0 ? (
        <p className="empty">No hay clientes registrados</p>
      ) : (
        <>
          <div style={{
            background: "var(--bg-card)",
            borderRadius: "12px",
            border: "1px solid var(--border)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
            marginBottom: "0.75rem",
          }}>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente por nombre o zona..."
              style={{
                width: "100%",
                padding: "0.8rem 1rem",
                background: "transparent",
                border: "none",
                color: "var(--text)",
                fontSize: "0.9rem",
                outline: "none",
              }}
            />
           </div>
           <div className="clientes-filtros">
             <label htmlFor="orden-clientes">Ordenar clientes</label>
             <select id="orden-clientes" value={orden} onChange={(e) => setOrden(e.target.value)}>
               <option value="todos">Todos los clientes</option>
               <option value="deudores">Más deudores primero</option>
               <option value="favor">Mayor saldo a favor primero</option>
             </select>
           </div>
          {filtrados.length === 0 ? (
            <p className="empty">No se encontraron clientes para "{busqueda}"</p>
          ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Zona</th>
                <th>Saldo Pendiente</th>
                <th>Saldo a Favor</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const saldo = parseNumero(c.saldo_pendiente);
                const saldoFavor = parseNumero(c.saldo_favor);
                return (
                  <tr key={c.id} className={c.pendiente_revision ? "cliente-pendiente-revision" : ""}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <strong>{c.nombre}</strong>
                        {c.pendiente_revision && <span className="badge badge-pendiente">Pendiente</span>}
                      </div>
                    </td>
                    <td>{c.zona || "Sin zona"}</td>
                    <td
                      className={saldo !== 0 ? "monto-salida" : ""}
                      style={{ cursor: saldo > 0 ? "pointer" : "default" }}
                      onClick={() => { if (saldo > 0) { setClienteDeuda(c); setShowDeudaModal(true); } }}
                      title={saldo < 0 ? "Saldo a favor" : ""}
                    >
                      {saldo > 0 ? <strong>{dinero(saldo)}</strong> : saldo < 0 ? <strong className="monto-regreso">A favor: {dinero(Math.abs(saldo))}</strong> : dinero(0)}
                    </td>
                    <td className={saldoFavor > 0 ? "monto-regreso" : ""}>{dinero(saldoFavor)}</td>
                    <td>
                      <div className="action-buttons">
                         <button className="btn btn-sm btn-primary" onClick={() => openEdit(c)}>Editar</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => verHistorial(c)}>Historial</button>
                        {saldo > 0 && (
                          <button className="btn btn-sm btn-primary" onClick={() => openPagoCC(c)}>Registrar Pago</button>
                        )}
                        <button className="btn btn-sm btn-cancel" onClick={() => handleDelete(c.id)}>Desactivar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
          )}
        </>
      )}
    </div>
  );
}
