import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { ventasAPI, clientesAPI, bancosAPI, proveedoresAPI } from "../api";
import BancoAutocomplete from "../components/BancoAutocomplete";
import {
  generarComprobantePDF,
  generarHistorialDeudasPDF,
  generarDeudaVentaPDF,
} from "../utils/generarPDF";

export default function HistorialVentasPage() {
  const { user } = useAuth();
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clienteDetalle, setClienteDetalle] = useState(null);
  const [clienteDetalleLoading, setClienteDetalleLoading] = useState(false);
  const [clienteDetalleError, setClienteDetalleError] = useState("");
  const [ventaPagoEditando, setVentaPagoEditando] = useState(null);
  const [pagosEditados, setPagosEditados] = useState([]);
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [bancos, setBancos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [filtros, setFiltros] = useState({
    fecha: "",
    buscar: "",
    numero_comprobante: "",
    tipo_venta: "",
    usuarioId: "",
  });

  useEffect(() => {
    loadVentas();
    bancosAPI.getAll().then((res) => setBancos(res.data.map((banco) => banco.nombre))).catch(console.error);
    proveedoresAPI.getAll().then((res) => setProveedores(res.data)).catch(console.error);
  }, []);

  const loadVentas = async (params = {}) => {
    setLoading(true);
    try {
      const res = await ventasAPI.getAll(params);
      setVentas(res.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltro = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  const buscar = () => {
    const params = {};
    Object.entries(filtros).forEach(([key, val]) => {
      if (val) params[key] = val;
    });
    loadVentas(params);
  };

  const limpiarFiltros = () => {
    setFiltros({ fecha: "", buscar: "", numero_comprobante: "", tipo_venta: "", usuarioId: "" });
    loadVentas();
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta venta? El stock se restaurara.")) return;
    try {
      await ventasAPI.delete(id);
      loadVentas();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const abrirEditarPago = (venta) => {
    const parseDatos = (valor) => {
      if (Array.isArray(valor)) return valor;
      try {
        const datos = typeof valor === "string" ? JSON.parse(valor) : valor;
        return Array.isArray(datos) ? datos : [];
      } catch {
        return [];
      }
    };
    const datosPorMedio = {
      transferencia: parseDatos(venta.datos_transferencia),
      tarjeta: parseDatos(venta.datos_tarjeta),
      otro: parseDatos(venta.datos_otro),
    };
    const indices = { transferencia: 0, tarjeta: 0, otro: 0 };
    const pagos = venta.VentaPagos?.length
      ? venta.VentaPagos.map((pago) => {
        const detalle = datosPorMedio[pago.medio_pago]?.[indices[pago.medio_pago]++] || {};
        return { medio_pago: pago.medio_pago, monto: String(pago.monto), nombre_cuenta: detalle.nombre_cuenta || "", banco: detalle.banco || "", proveedorId: detalle.proveedorId || "", alias: detalle.alias || "", fecha_hora: detalle.fecha_hora || "" };
      })
      : [{ medio_pago: venta.medio_pago, monto: String(venta.total), nombre_cuenta: "", banco: "", proveedorId: "", alias: "", fecha_hora: "" }];
    setVentaPagoEditando(venta);
    setPagosEditados(pagos);
  };

  const guardarPago = async (e) => {
    e.preventDefault();
    const totalEsperado = (Number(ventaPagoEditando.total) || 0) + (Number(ventaPagoEditando.monto_deuda_pagado) || 0);
    const diferencia = totalPagosEditados - totalEsperado;
    if (Math.abs(diferencia) > 0.01) {
      const mensaje = diferencia > 0
        ? `La suma de los pagos ($${totalPagosEditados.toFixed(2)}) excede el total esperado ($${totalEsperado.toFixed(2)}).\n\nEl exceso ($${diferencia.toFixed(2)}) se acreditará como saldo a favor del cliente.\n\n¿Continuar?`
        : `La suma de los pagos ($${totalPagosEditados.toFixed(2)}) es menor al total esperado ($${totalEsperado.toFixed(2)}).\n\nFaltan $${Math.abs(diferencia).toFixed(2)}.\n\n¿Continuar?`;
      if (!window.confirm(mensaje)) return;
    }
    setGuardandoPago(true);
    try {
      await ventasAPI.modificarPago(ventaPagoEditando.id, {
        pagos: pagosEditados.map((pago) => ({ medio_pago: pago.medio_pago, monto: Number(pago.monto) || 0, nombre_cuenta: pago.nombre_cuenta, banco: pago.banco, proveedorId: pago.proveedorId || null, alias: pago.alias || "", fecha_hora: pago.fecha_hora || "" })),
      });
      setVentaPagoEditando(null);
      await loadVentas();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    } finally {
      setGuardandoPago(false);
    }
  };

  const totalPagosEditados = pagosEditados.reduce((sum, pago) => sum + (Number(pago.monto) || 0), 0);
  const detalleModificacion = (venta) => {
    if (!venta.pago_modificacion_detalle) return "-";
    try {
      const detalle = typeof venta.pago_modificacion_detalle === "string" ? JSON.parse(venta.pago_modificacion_detalle) : venta.pago_modificacion_detalle;
      const mostrarPago = (pago) => `${pago.medio_pago}: $${Number(pago.monto).toFixed(2)}${pago.nombre_cuenta ? ` (${pago.nombre_cuenta}${pago.banco ? `, ${pago.banco}` : ""}${pago.alias ? `, alias ${pago.alias}` : ""})` : ""}`;
      return `${detalle.anteriores?.map(mostrarPago).join(", ")} → ${detalle.nuevos?.map(mostrarPago).join(", ")}`;
    } catch {
      return "Ver detalle no disponible";
    }
  };

  const abrirDetalleCliente = async (venta) => {
    const cliente = venta.cliente;
    if (!cliente?.id) return;
    setClienteDetalle({ cliente, venta });
    setClienteDetalleError("");
    setClienteDetalleLoading(true);
    try {
      const res = await clientesAPI.getHistorialCC(cliente.id);
      setClienteDetalle({ ...res.data, venta });
    } catch (error) {
      setClienteDetalleError(error.response?.data?.message || "No se pudo cargar el historial del cliente");
    } finally {
      setClienteDetalleLoading(false);
    }
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div>
      <h2>Historial de Ventas</h2>

      <div className="form-card filtros-card">
        <div className="filtros-grid">
          <div className="form-group">
            <label>Fecha</label>
            <input type="date" name="fecha" value={filtros.fecha} onChange={handleFiltro} />
          </div>
          <div className="form-group">
              <label>Cliente / Camion / Repartidor</label>
            <div className="search-with-clear">
                <input name="buscar" value={filtros.buscar} onChange={handleFiltro} placeholder="Buscar por cliente, camion o repartidor..." />
              {filtros.buscar && (
                <button type="button" className="search-clear" onClick={() => setFiltros({ ...filtros, buscar: "" })} aria-label="Borrar búsqueda">
                  X
                </button>
              )}
            </div>
          </div>
          <div className="form-group" style={{ display: "none" }}>
            <label>Nro Comprobante</label>
            <input name="numero_comprobante" value={filtros.numero_comprobante} onChange={handleFiltro} placeholder="VTA-..." />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select name="tipo_venta" value={filtros.tipo_venta} onChange={handleFiltro}>
              <option value="">Todos</option>
              <option value="local">Local</option>
              <option value="reparto">Reparto</option>
            </select>
          </div>
          <div className="form-group filtros-btns">
            <button className="btn btn-primary" onClick={buscar}>Buscar</button>
            <button className="btn btn-secondary" onClick={limpiarFiltros}>Limpiar</button>
          </div>
        </div>
      </div>

      {ventas.length === 0 ? (
        <p className="empty">No hay ventas registradas</p>
      ) : (
        <div className="table-container historial-ventas-container">
          <table className="historial-ventas-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Camion</th>
                <th>Cliente</th>
                 <th>Vendedor</th>
                 <th>Acciones</th>
                 <th>Modificado por</th>
                 <th>Qué modificó</th>
                <th>Mercaderías</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id}>
                  <td>{v.fecha}</td>
                  <td>
                    <span className={`badge badge-${v.tipo_venta}`}>
                      {v.tipo_venta === "local" ? "Local" : "Reparto"}
                    </span>
                  </td>
                  <td>{v.salida_camion?.camion || "-"}</td>
                   <td>
                     {v.cliente?.id ? (
                       <button
                         type="button"
                         className="btn btn-sm cliente-historial-btn"
                         onClick={() => abrirDetalleCliente(v)}
                         title={`Ver deudas de ${v.cliente.nombre}`}
                       >
                         {v.cliente.nombre}
                       </button>
                     ) : (v.cliente_nombre || "-")}
                   </td>
                  <td>{v.vendedor?.nombre || "-"}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => generarComprobantePDF(v)}
                      >
                        PDF
                      </button>
                      {(user?.role === "admin" || v.usuarioId === user?.id) && (
                        <button className="btn btn-sm btn-secondary" onClick={() => abrirEditarPago(v)}>
                          Modificar pago
                        </button>
                      )}
                      {(user?.role === "admin") && (
                        <button
                          className="btn btn-sm btn-cancel"
                          onClick={() => handleDelete(v.id)}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                  <td>{v.pago_modificado_por?.nombre || "-"}{v.pago_modificado_en && <small><br />{new Date(v.pago_modificado_en).toLocaleString("es-AR")}</small>}</td>
                  <td>{detalleModificacion(v)}</td>
                  <td>
                    <div className="badge-grid">
                      {v.VentaItems?.map((item) => (
                        <span key={item.id} className="badge">
                           {item.cantidad}{["kg", "kilogramo"].includes(String(item.Producto?.unidad || "").toLowerCase()) ? " kg" : ""} {item.Producto?.nombre}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {clienteDetalle && (
        <div className="modal-overlay" onClick={() => setClienteDetalle(null)}>
          <div className="modal-card modal-wide cliente-historial-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cliente-historial-header">
              <div>
                <span className="modal-eyebrow">Cuenta corriente</span>
                <h3>{clienteDetalle.cliente?.nombre}</h3>
              </div>
              <button type="button" className="modal-close" onClick={() => setClienteDetalle(null)} aria-label="Cerrar">X</button>
            </div>
            {clienteDetalleLoading ? (
              <div className="loading">Cargando movimientos...</div>
            ) : clienteDetalleError ? (
              <p className="error-msg">{clienteDetalleError}</p>
            ) : (
              <>
                <div className="cc-resumen cliente-historial-resumen">
                  <div className="cc-item"><span>Deuda actual</span><strong className="monto-salida">${Number(clienteDetalle.saldo_pendiente || 0).toFixed(2)}</strong></div>
                  <div className="cc-item"><span>Saldo a favor</span><strong className="monto-regreso">${Number(clienteDetalle.saldo_favor || 0).toFixed(2)}</strong></div>
                </div>
                <p className="cliente-historial-ayuda">Selecciona el comprobante que deseas descargar.</p>
                <div className="cliente-historial-actions">
                  <button className="btn btn-primary" onClick={() => generarHistorialDeudasPDF(clienteDetalle)}>Historial de deudas</button>
                  <button className="btn btn-cierre-pdf" onClick={() => generarDeudaVentaPDF(clienteDetalle.venta, clienteDetalle)}>Deuda de esta venta</button>
                </div>
              </>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setClienteDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
      {ventaPagoEditando && (
        <div className="modal-overlay" onClick={() => setVentaPagoEditando(null)}>
          <div className="modal-card historial-pago-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Modificar pago de {ventaPagoEditando.numero_comprobante}</h3>
            <p className="subtitle">Total esperado: ${((Number(ventaPagoEditando.total) || 0) + (Number(ventaPagoEditando.monto_deuda_pagado) || 0)).toFixed(2)}</p>
            <form onSubmit={guardarPago}>
              {pagosEditados.map((pago, index) => (
                <div key={index} style={{ marginBottom: "0.75rem" }}>
                <div className="item-row">
                  <select
                    value={pago.medio_pago}
                    onChange={(e) => setPagosEditados((prev) => prev.map((item, i) => i === index ? { ...item, medio_pago: e.target.value } : item))}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Débito</option>
                    <option value="cuenta_corriente">Cuenta Corriente</option>
                    <option value="otro">Otro</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pago.monto}
                    onChange={(e) => setPagosEditados((prev) => prev.map((item, i) => i === index ? { ...item, monto: e.target.value } : item))}
                    required
                  />
                  {pagosEditados.length > 1 && (
                    <button type="button" className="btn btn-sm btn-cancel" onClick={() => setPagosEditados((prev) => prev.filter((_, i) => i !== index))}>X</button>
                  )}
                </div>
                {[
                  "transferencia",
                  "tarjeta",
                  "otro",
                ].includes(pago.medio_pago) && (
                  <div className="item-row" style={{ marginTop: "0.35rem" }}>
                    <select value={pago.proveedorId || ""} onChange={(e) => {
                      const proveedor = proveedores.find((item) => String(item.id) === e.target.value);
                      setPagosEditados((prev) => prev.map((item, i) => i === index ? { ...item, proveedorId: e.target.value, alias: proveedor?.alias || "" } : item));
                    }} required>
                      <option value="">Seleccionar proveedor destino...</option>
                      {proveedores.map((proveedor) => <option key={proveedor.id} value={proveedor.id}>{proveedor.nombre} - Alias: {proveedor.alias || "Sin alias"}</option>)}
                    </select>
                    <input placeholder="Nombre de la cuenta" value={pago.nombre_cuenta || ""} onChange={(e) => setPagosEditados((prev) => prev.map((item, i) => i === index ? { ...item, nombre_cuenta: e.target.value } : item))} required />
                  </div>
                )}
                {["transferencia", "tarjeta", "otro"].includes(pago.medio_pago) && (
                  <BancoAutocomplete
                    value={pago.banco || ""}
                    onChange={(valor) => setPagosEditados((prev) => prev.map((item, i) => i === index ? { ...item, banco: valor } : item))}
                    bancos={bancos}
                    onAddBanco={(valor) => {
                      bancosAPI.create({ nombre: valor }).then(() => setBancos((prev) => prev.includes(valor) ? prev : [...prev, valor])).catch(console.error);
                    }}
                    placeholder="Seleccionar banco"
                  />
                )}
                </div>
              ))}
              <button type="button" className="btn btn-secondary" onClick={() => setPagosEditados((prev) => [...prev, { medio_pago: "efectivo", monto: "0", nombre_cuenta: "", banco: "", proveedorId: "", alias: "", fecha_hora: "" }])}>+ Agregar medio</button>
              <div className="resumen-row" style={{ marginTop: "1rem" }}>
                <span>Total ingresado:</span>
                <strong>${totalPagosEditados.toFixed(2)}</strong>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setVentaPagoEditando(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardandoPago}>Guardar pago</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
