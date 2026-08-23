import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { ventasAPI, clientesAPI, bancosAPI, proveedoresAPI, productosAPI } from "../api";
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
  const [montosPagoBorrador, setMontosPagoBorrador] = useState({});
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [ventaProductosEditando, setVentaProductosEditando] = useState(null);
  const [ventaModificacionDetalle, setVentaModificacionDetalle] = useState(null);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [itemsEditados, setItemsEditados] = useState([]);
  const [guardandoProductos, setGuardandoProductos] = useState(false);
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
    productosAPI.getAll().then((res) => setProductosDisponibles(res.data)).catch(console.error);
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

  const precioCatalogoProducto = (producto, unidadVenta) => {
    const esCajaProd = String(producto?.unidad || "").toLowerCase() === "caja";
    const factor = esCajaProd && Number(producto.unidades_por_caja) > 0 ? Number(producto.unidades_por_caja) : 1;
    return unidadVenta === "caja" ? Number(producto.precio) : Number(producto.precio) / factor;
  };

  const abrirEditarProductos = (venta) => {
    setVentaProductosEditando(venta);
    setItemsEditados((venta.VentaItems || []).map((item) => ({
      productoId: item.productoId,
      cantidad: String(item.cantidad),
      precio_unitario: String(item.precio_unitario),
      unidad_venta: item.unidad_venta || "unidad",
      nombre: item.Producto?.nombre || "Producto",
    })));
  };

  const agregarProductoEditado = () => {
    const producto = productosDisponibles.find((item) => !itemsEditados.some((actual) => actual.productoId === item.id));
    if (!producto) return;
    setItemsEditados((prev) => [...prev, {
      productoId: producto.id,
      cantidad: "1",
      precio_unitario: String(precioCatalogoProducto(producto, "unidad")),
      unidad_venta: "unidad",
      nombre: producto.nombre,
    }]);
  };

  const guardarProductos = async (e) => {
    e.preventDefault();
    if (!itemsEditados.length) return;
    setGuardandoProductos(true);
    try {
      await ventasAPI.modificarProductos(ventaProductosEditando.id, {
        items: itemsEditados.map(({ productoId, cantidad, unidad_venta }) => ({
          productoId,
          cantidad: Number(cantidad),
          unidad_venta,
        })),
      });
      setVentaProductosEditando(null);
      await loadVentas();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    } finally {
      setGuardandoProductos(false);
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
    setMontosPagoBorrador({});
  };

  const guardarPago = async (e) => {
    e.preventDefault();
    const totalEsperado = (Number(ventaPagoEditando.total) || 0) + (Number(ventaPagoEditando.monto_deuda_pagado) || 0);
    const pagosConfirmados = pagosEditados.map((pago, index) => ({
      ...pago,
      monto: montosPagoBorrador[index] ?? pago.monto,
    }));
    const totalPagosConfirmados = pagosConfirmados.reduce((sum, pago) => sum + (Number(pago.monto) || 0), 0);
    const diferencia = totalPagosConfirmados - totalEsperado;
    if (Math.abs(diferencia) > 0.01) {
      const mensaje = diferencia > 0
        ? `La suma de los pagos ($${totalPagosConfirmados.toFixed(2)}) excede el total esperado ($${totalEsperado.toFixed(2)}).\n\nEl exceso ($${diferencia.toFixed(2)}) se acreditará como saldo a favor del cliente.\n\n¿Continuar?`
        : `La suma de los pagos ($${totalPagosConfirmados.toFixed(2)}) es menor al total esperado ($${totalEsperado.toFixed(2)}).\n\nEl faltante ($${Math.abs(diferencia).toFixed(2)}) se registrará en cuenta corriente como saldo pendiente del cliente.\n\n¿Continuar?`;
      if (!window.confirm(mensaje)) return;
    }
    setGuardandoPago(true);
    try {
      await ventasAPI.modificarPago(ventaPagoEditando.id, {
        pagos: pagosConfirmados.map((pago) => ({ medio_pago: pago.medio_pago, monto: Number(pago.monto) || 0, nombre_cuenta: pago.nombre_cuenta, banco: pago.banco, proveedorId: pago.proveedorId || null, alias: pago.alias || "", fecha_hora: pago.fecha_hora || "" })),
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
  const totalEsperadoPago = (Number(ventaPagoEditando?.total) || 0) + (Number(ventaPagoEditando?.monto_deuda_pagado) || 0);
  const formatearModificacion = (venta, tipo) => {
    const detalleKey = tipo === "pagos" ? "pago_modificacion_detalle" : "productos_modificacion_detalle";
    const detalle = venta[detalleKey];
    if (!detalle) return "Sin modificaciones";
    try {
      const datos = typeof detalle === "string" ? JSON.parse(detalle) : detalle;
      const mostrar = tipo === "pagos"
        ? (item) => `${item.medio_pago}: $${Number(item.monto).toFixed(2)}`
        : (item) => `${item.cantidad} ${item.unidad_venta || "unidad"} ${item.nombre}`;
      return `${datos.anteriores?.map(mostrar).join(", ")} -> ${datos.nuevos?.map(mostrar).join(", ")}`;
    } catch {
      return "Detalle no disponible";
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
                  <th>Detalle</th>
                 <th>Saldo nuestro</th>
                 <th>Saldo cliente</th>
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
                        <button className="btn btn-sm btn-secondary" onClick={() => abrirEditarProductos(v)}>
                          Modificar factura
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
                   <td>{[v.pago_modificado_por?.nombre, v.productos_modificado_por?.nombre].filter(Boolean).join(" / ") || "-"}</td>
                   <td>
                     <button
                       type="button"
                       className="btn btn-sm btn-secondary"
                       onClick={() => setVentaModificacionDetalle(v)}
                     >
                       Detalle
                     </button>
                   </td>
                   <td className="monto-regreso">${Number(v.cliente?.saldo_pendiente || 0).toFixed(2)}</td>
                   <td style={{ color: "#2563eb" }}>${Number(v.cliente?.saldo_favor || 0).toFixed(2)}</td>
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
      {ventaModificacionDetalle && (
        <div className="modal-overlay" onClick={() => setVentaModificacionDetalle(null)}>
          <div className="modal-card modal-wide historial-pago-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Modificaciones de {ventaModificacionDetalle.numero_comprobante}</h3>
            <h4>Pagos</h4>
            <p>
              <strong>{ventaModificacionDetalle.pago_modificado_por?.nombre || "Sin modificaciones"}</strong>
              {ventaModificacionDetalle.pago_modificado_en && ` - ${new Date(ventaModificacionDetalle.pago_modificado_en).toLocaleString("es-AR")}`}
            </p>
            {ventaModificacionDetalle.pago_modificado_por && <p>{formatearModificacion(ventaModificacionDetalle, "pagos")}</p>}
            <h4>Productos</h4>
            <p>
              <strong>{ventaModificacionDetalle.productos_modificado_por?.nombre || "Sin modificaciones"}</strong>
              {ventaModificacionDetalle.productos_modificado_en && ` - ${new Date(ventaModificacionDetalle.productos_modificado_en).toLocaleString("es-AR")}`}
            </p>
            {ventaModificacionDetalle.productos_modificado_por && <p>{formatearModificacion(ventaModificacionDetalle, "productos")}</p>}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setVentaModificacionDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
      {ventaProductosEditando && (
        <div className="modal-overlay" onClick={() => setVentaProductosEditando(null)}>
          <div className="modal-card modal-wide historial-pago-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Modificar factura {ventaProductosEditando.numero_comprobante}</h3>
            <p className="subtitle">Solo se pueden modificar productos y cantidades. Los precios se mantienen como fueron vendidos.</p>
            <form onSubmit={guardarProductos}>
              {itemsEditados.map((item, index) => (
                <div className="item-row" key={`${item.productoId}-${index}`}>
                  <select
                    value={item.productoId}
                    onChange={(e) => {
                      const producto = productosDisponibles.find((actual) => actual.id === Number(e.target.value));
                      setItemsEditados((prev) => prev.map((actual, i) => i === index ? { ...actual, productoId: producto.id, nombre: producto.nombre, precio_unitario: String(precioCatalogoProducto(producto, actual.unidad_venta)) } : actual));
                    }}
                    required
                  >
                    {productosDisponibles.map((producto) => <option key={producto.id} value={producto.id}>{producto.nombre}</option>)}
                  </select>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={Number(item.cantidad) ? item.cantidad : ""}
                    onChange={(e) => setItemsEditados((prev) => prev.map((actual, i) => i === index ? { ...actual, cantidad: e.target.value } : actual))}
                    required
                    aria-label={`Cantidad de ${item.nombre}`}
                  />
                  <span className="badge" title="Precio de venta original (no modificable)">
                    ${Number(item.precio_unitario || 0).toFixed(2)}
                  </span>
                  {itemsEditados.length > 1 && <button type="button" className="btn btn-sm btn-cancel" onClick={() => setItemsEditados((prev) => prev.filter((_, i) => i !== index))}>X</button>}
                </div>
              ))}
              <button type="button" className="btn btn-secondary" onClick={agregarProductoEditado}>+ Agregar producto</button>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { const venta = ventaProductosEditando; setVentaProductosEditando(null); abrirEditarPago(venta); }}>
                  Modificar pagos
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setVentaProductosEditando(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardandoProductos}>{guardandoProductos ? "Guardando..." : "Guardar factura"}</button>
              </div>
            </form>
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
                     value={montosPagoBorrador[index] ?? (Number(pago.monto) ? pago.monto : "")}
                     onChange={(e) => setMontosPagoBorrador((prev) => ({ ...prev, [index]: e.target.value }))}
                     onBlur={(e) => {
                       setPagosEditados((prev) => prev.map((item, i) => i === index ? { ...item, monto: e.currentTarget.value } : item));
                       setMontosPagoBorrador((prev) => {
                         const next = { ...prev };
                         delete next[index];
                         return next;
                       });
                     }}
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
                <span>Falta para el total esperado:</span>
                <strong>${Math.max(0, totalEsperadoPago - totalPagosEditados).toFixed(2)}</strong>
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
