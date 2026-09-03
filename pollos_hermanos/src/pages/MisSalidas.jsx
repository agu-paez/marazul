import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { salidasAPI, clientesAPI, cierreCajaAPI, bancosAPI, proveedoresAPI } from "../api";
import ClienteAutocomplete from "../components/ClienteAutocomplete";
import BancoAutocomplete from "../components/BancoAutocomplete";
import { generarHistorialDeudasPDF, generarPagoClientePDF } from "../utils/generarPDF";
import { getFechaLocal } from "../utils/fecha";

const redondearUnid = (n) => Math.round(n * 1000) / 1000;

const formatCant = (n) => {
  const num = Number(n) || 0;
  return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
};

const textoCantidad = (cant) => `${formatCant(cant)} unid.`;

export default function MisSalidas() {
  const { user } = useAuth();
  const isRepartidor = user?.role === "repartidor";
  const isOperador = user?.role === "operador";
  const [salidas, setSalidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regresando, setRegresando] = useState(null);
  const [itemsRegreso, setItemsRegreso] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelandoId, setCancelandoId] = useState(null);
  const [cancelarConRegreso, setCancelarConRegreso] = useState(false);
  const [resumenCaja, setResumenCaja] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [bancos, setBancos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [showPagoCliente, setShowPagoCliente] = useState(false);
  const [clientePago, setClientePago] = useState("");
  const [pagoCliente, setPagoCliente] = useState({ medio_pago: "efectivo", monto: "", nombre_cuenta: "", proveedorId: "", alias: "", banco: "", notas: "", fecha_pago: getFechaLocal() });
  const [clienteDetalle, setClienteDetalle] = useState(null);
  const [clienteDetalleLoading, setClienteDetalleLoading] = useState(false);
  const [clienteDetalleError, setClienteDetalleError] = useState("");

  useEffect(() => {
    loadSalidas();
    cargarResumenCaja();
  }, [isOperador]);

  const cargarResumenCaja = async () => {
    try {
      const res = await cierreCajaAPI.getResumenHoy();
      setResumenCaja(res.data);
    } catch (error) {
      console.error("Error al cargar el estado de caja:", error);
    }
  };

  const loadDatosPago = async () => {
    const resultados = await Promise.allSettled([
      clientesAPI.getAll(),
      cierreCajaAPI.getResumenHoy(),
      bancosAPI.getAll(),
      proveedoresAPI.getAll(),
    ]);
    const [clientesRes, resumenRes, bancosRes, proveedoresRes] = resultados;
    if (clientesRes.status === "fulfilled") setClientes(clientesRes.value.data);
    if (resumenRes.status === "fulfilled") setResumenCaja(resumenRes.value.data);
    if (bancosRes.status === "fulfilled") setBancos(bancosRes.value.data.map((banco) => banco.nombre));
    if (proveedoresRes.status === "fulfilled") setProveedores(proveedoresRes.value.data);
    resultados.filter((resultado) => resultado.status === "rejected").forEach((resultado) => console.error("Error al cargar datos de pagos:", resultado.reason));
  };

  const loadSalidas = async () => {
    try {
      const res = await (isOperador
        ? salidasAPI.getAll({ fecha: getFechaLocal() })
        : salidasAPI.getMisSalidas({ fecha: getFechaLocal() }));
      setSalidas(res.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const abrirPagoCliente = async () => {
    let caja = resumenCaja;
    if (!caja) {
      try {
        const res = await cierreCajaAPI.getResumenHoy();
        caja = res.data;
        setResumenCaja(caja);
      } catch {
        alert("No se pudo verificar el estado de la caja");
        return;
      }
    }
    if (caja.cerrado) {
      alert("No se pueden registrar pagos porque la caja está cerrada");
      return;
    }
    await loadDatosPago();
    setClientePago("");
    setPagoCliente({ medio_pago: "efectivo", monto: "", nombre_cuenta: "", proveedorId: "", banco: "", notas: "", fecha_pago: getFechaLocal() });
    setShowPagoCliente(true);
  };

  const registrarPagoCliente = async (event) => {
    event.preventDefault();
    const cliente = clientes.find((item) => String(item.id) === String(clientePago));
    const monto = parseFloat(pagoCliente.monto) || 0;
    if (!cliente) return alert("Debe seleccionar un cliente");
    if (monto <= 0) {
      return alert("El monto debe ser mayor a 0");
    }
    const proveedorPago = proveedores.find((proveedor) => String(proveedor.id) === String(pagoCliente.proveedorId));
    if (["transferencia", "tarjeta", "cheque", "ercheck"].includes(pagoCliente.medio_pago) && (!proveedorPago || !proveedorPago.alias || !pagoCliente.nombre_cuenta.trim() || !pagoCliente.banco)) {
      return alert("Debe seleccionar un alias de proveedor y completar la cuenta y banco");
    }

    const datosBancarios = ["transferencia", "tarjeta", "cheque", "ercheck"].includes(pagoCliente.medio_pago)
      ? {
          nombre_cuenta: pagoCliente.nombre_cuenta.trim(),
          titular: pagoCliente.nombre_cuenta.trim(),
          alias: proveedorPago?.alias || "",
          proveedorId: proveedorPago?.id || null,
          banco: pagoCliente.banco,
          fecha_hora: new Date().toISOString(),
          monto,
        }
      : null;

    try {
      await clientesAPI.registrarPagoCC(cliente.id, {
        pagos: [{
          medio_pago: pagoCliente.medio_pago,
          monto,
          notas: pagoCliente.notas || null,
          fecha_pago: pagoCliente.fecha_pago || null,
          datos_transferencia: pagoCliente.medio_pago === "transferencia" ? datosBancarios : null,
          datos_tarjeta: pagoCliente.medio_pago === "tarjeta" ? datosBancarios : null,
          datos_cheque: pagoCliente.medio_pago === "cheque" ? datosBancarios : null,
          datos_ercheck: pagoCliente.medio_pago === "ercheck" ? datosBancarios : null,
        }],
      });
      setShowPagoCliente(false);
      await loadDatosPago();
      setClienteDetalleError("");
      setClienteDetalleLoading(true);
      try {
        const historialRes = await clientesAPI.getHistorialCC(cliente.id);
        setClienteDetalle({ ...historialRes.data, pago: historialRes.data.pagos?.[0] || null });
      } catch (historialError) {
        setClienteDetalle({ cliente });
        setClienteDetalleError(historialError.response?.data?.message || "No se pudo cargar el historial del cliente");
      } finally {
        setClienteDetalleLoading(false);
      }
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const enviarSalida = async (id) => {
    try {
      await salidasAPI.updateStatus(id, { estado: "en_camino" });
      loadSalidas();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const agregarBanco = async (nombre) => {
    try {
      await bancosAPI.create({ nombre });
      setBancos((actuales) => actuales.includes(nombre) ? actuales : [...actuales, nombre]);
    } catch (error) {
      alert("Error al agregar banco: " + (error.response?.data?.message || error.message));
    }
  };

  const [cancelMotivo, setCancelMotivo] = useState("");

  const openRegresoForm = async (salida) => {
    setRegresando(salida);
    try {
      const res = await salidasAPI.getStockCamion(salida.id);
      const stockMap = {};
      for (const s of res.data.items) {
        stockMap[s.productoId] = s;
      }
      const items = (salida.SalidaCamionItems || []).map((item) => {
        const stock = stockMap[item.productoId];
        const enviadaU = Number(stock?.cargado) || 0;
        const vendidoU = Number(stock?.vendido) || 0;
        const maxDevolverU = Math.max(0, enviadaU - vendidoU);
        return {
          productoId: item.productoId,
          nombre: item.Producto?.nombre,
          precio_unidad: Number(stock?.precio_unidad) || 0,
          cantidad_enviada: redondearUnid(enviadaU),
          cantidad_vendida: redondearUnid(vendidoU),
          max_devolver: redondearUnid(maxDevolverU),
          cantidad_regreso: 0,
        };
      });
      setItemsRegreso(items);
    } catch (error) {
      alert("Error al obtener stock del camion: " + (error.response?.data?.message || error.message));
    }
  };

  const setCantidadRegreso = (index, unidades) => {
    const newItems = [...itemsRegreso];
    const item = newItems[index];
    const max = Math.max(0, Number(item.max_devolver) || 0);
    const v = Math.max(0, Number(unidades) || 0);
    item.cantidad_regreso = redondearUnid(Math.min(v, max));
    setItemsRegreso(newItems);
  };


  const calcularMontoRegreso = () => {
    return itemsRegreso.reduce((sum, item) => {
      return sum + (item.precio_unidad || 0) * (Number(item.cantidad_regreso) || 0);
    }, 0);
  };

  const confirmarRegreso = async () => {
    if (!regresando) return;
    if (cancelarConRegreso) {
      ejecutarCancelacion();
      return;
    }
    setShowConfirm(true);
  };

  const itemsParaEnviar = (soloConCantidad) =>
    itemsRegreso
      .filter((item) => !soloConCantidad || Number(item.cantidad_regreso) > 0)
      .map((item) => {
        const unidades = redondearUnid(Number(item.cantidad_regreso) || 0);
        return { productoId: item.productoId, cantidad: unidades };
      });

  const ejecutarCancelacion = async () => {
    if (!regresando) return;
    try {
      await salidasAPI.registrarRegreso(regresando.id, {
        items_regreso: itemsParaEnviar(false),
        cancelar: true,
        motivo: cancelMotivo,
      });
      setRegresando(null);
      setCancelarConRegreso(false);
      setCancelandoId(null);
      setCancelMotivo("");
      loadSalidas();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const ejecutarRegreso = async () => {
    setShowConfirm(false);
    try {
      await salidasAPI.registrarRegreso(regresando.id, {
        items_regreso: itemsParaEnviar(true),
      });
      if (isRepartidor) {
        let cantidadTransferencias = 0;
        try {
          const [ventasRes, transferenciasRes, pagosDeudaRes] = await Promise.all([
            salidasAPI.getVentas(regresando.id),
            salidasAPI.getTransferencias(regresando.id),
            salidasAPI.getPagosDeuda(regresando.id),
          ]);
          const ventas = ventasRes.data;
          const pagosDeuda = pagosDeudaRes.data;
          cantidadTransferencias = ventas.reduce((cantidad, venta) => {
            const pagos = venta.VentaPagos?.length
              ? venta.VentaPagos
              : [{ medio_pago: venta.medio_pago }];
            return cantidad + pagos.filter((pago) => String(pago.medio_pago).toLowerCase() === "transferencia").length;
          }, 0) + pagosDeuda.filter((pago) => pago.medio_pago === "transferencia").length + (Number(transferenciasRes.data.cantidad) || 0);
        } catch (error) {
          console.error("No se pudo contar las transferencias del regreso:", error);
        }
        alert(`Regreso finalizado. Transferencias realizadas: ${cantidadTransferencias}`);
      }
      setRegresando(null);
      loadSalidas();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const estadoColors = {
    pendiente: "#f59e0b",
    en_camino: "#3b82f6",
    entregado: "#10b981",
    cancelado: "#ef4444",
    sobrante: "#ef4444",
  };

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
      <h2>{isOperador ? "Salidas de Camion" : "Mis Salidas de Camion"}</h2>
        <button className="btn btn-primary" onClick={abrirPagoCliente} disabled={resumenCaja?.cerrado}>
          Registrar pago de cliente
        </button>
      </div>
      {resumenCaja?.cerrado && <p className="subtitle">La caja está cerrada. No se pueden registrar pagos.</p>}
      <p className="subtitle">{isOperador ? "Puedes enviar cualquier salida pendiente" : "Solo puedes cambiar el estado de tus salidas"}</p>

      {showPagoCliente && (
        <div className="modal-overlay" onClick={() => setShowPagoCliente(false)}>
          <form className="modal-card modal-responsive modal-scrollable" onSubmit={registrarPagoCliente} onClick={(event) => event.stopPropagation()}>
            <h3>Registrar pago de cliente</h3>
            <div className="form-group">
              <label>Cliente *</label>
              <ClienteAutocomplete
                value={clientePago}
                onChange={setClientePago}
                clientes={clientes.filter((cliente) => parseFloat(cliente.saldo_pendiente || 0) > 0)}
                onAddCliente={() => {}}
                placeholder="Buscar cliente con deuda"
              />
            </div>
            {clientePago && (
              <p className="subtitle">
                Deuda pendiente: ${(parseFloat(clientes.find((cliente) => String(cliente.id) === String(clientePago))?.saldo_pendiente) || 0).toFixed(2)}
                {" | Saldo a favor: $"}{(parseFloat(clientes.find((cliente) => String(cliente.id) === String(clientePago))?.saldo_favor) || 0).toFixed(2)}
              </p>
            )}
            <div className="form-group">
              <label>Monto *</label>
              <input type="number" min="0.01" step="0.01" value={pagoCliente.monto} onChange={(event) => setPagoCliente({ ...pagoCliente, monto: event.target.value })} required />
            </div>
            <div className="form-group">
              <label>Forma de pago *</label>
              <select value={pagoCliente.medio_pago} onChange={(event) => setPagoCliente({ ...pagoCliente, medio_pago: event.target.value })}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="cheque">Cheque</option>
                <option value="ercheck">ER Check</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            {["transferencia", "tarjeta", "cheque", "ercheck"].includes(pagoCliente.medio_pago) && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", alignItems: "end" }}>
                <div className="form-group">
                  <label>Cuenta / titular *</label>
                  <input value={pagoCliente.nombre_cuenta} onChange={(event) => setPagoCliente({ ...pagoCliente, nombre_cuenta: event.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Alias / proveedor *</label>
                  <select value={pagoCliente.proveedorId} onChange={(event) => setPagoCliente({ ...pagoCliente, proveedorId: event.target.value })} required>
                    <option value="">Seleccionar alias...</option>
                    {proveedores.filter((proveedor) => proveedor.alias?.trim()).map((proveedor) => (
                      <option key={proveedor.id} value={proveedor.id}>{proveedor.alias}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Banco *</label>
                  <BancoAutocomplete
                    value={pagoCliente.banco}
                    onChange={(banco) => setPagoCliente({ ...pagoCliente, banco })}
                    bancos={bancos}
                    onAddBanco={agregarBanco}
                    placeholder="Buscar o agregar banco"
                    inputStyle={{ minHeight: "42px" }}
                  />
                </div>
              </div>
            )}
            <div className="form-group">
              <label>Observaciones</label>
              <input value={pagoCliente.notas} onChange={(event) => setPagoCliente({ ...pagoCliente, notas: event.target.value })} />
            </div>
            <div className="form-group">
              <label>Fecha del pago *</label>
              <input
                type="date"
                value={pagoCliente.fecha_pago || getFechaLocal()}
                onChange={(event) => setPagoCliente({ ...pagoCliente, fecha_pago: event.target.value })}
                required
              />
            </div>
            <p className="subtitle">Fecha real de emision del pago/transferencia. La fecha de registro sera la de hoy ({getFechaLocal()}).</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPagoCliente(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Registrar pago</button>
            </div>
          </form>
        </div>
      )}

      {clienteDetalle && (
        <div className="modal-overlay" onClick={() => setClienteDetalle(null)}>
          <div className="modal-card modal-wide cliente-historial-modal" onClick={(event) => event.stopPropagation()}>
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
                <p className="cliente-historial-ayuda">El pago fue registrado correctamente. Puedes descargar el historial actualizado.</p>
                <div className="cliente-historial-actions">
                  <button className="btn btn-primary" onClick={() => generarHistorialDeudasPDF(clienteDetalle)}>Descargar historial de deudas</button>
                  {clienteDetalle.pago && <button className="btn btn-cierre-pdf" onClick={() => generarPagoClientePDF(clienteDetalle.pago, clienteDetalle)}>Comprobante del pago</button>}
                </div>
              </>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setClienteDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1001 }} onClick={() => { setShowCancelConfirm(false); setCancelMotivo(""); }}>
          <div className="modal-card modal-responsive" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)", display: "flex",
                alignItems: "center", justifyContent: "center", margin: "0 auto 1rem"
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <h3 style={{ color: "var(--danger)", marginBottom: "0.5rem" }}>Cancelar Envio</h3>
            </div>
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label>Motivo de cancelacion</label>
              <textarea
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Describa el motivo de la cancelacion..."
                rows={3}
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowCancelConfirm(false); setCancelMotivo(""); }}>
                Volver
              </button>
              <button
                className="btn btn-cancel"
                disabled={!cancelMotivo.trim()}
                onClick={() => {
                  const salidaCancelar = salidas.find((s) => s.id === cancelandoId);
                  setShowCancelConfirm(false);
                  setCancelarConRegreso(true);
                  openRegresoForm(salidaCancelar);
                }}
              >
                Confirmar Cancelacion
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1001 }} onClick={() => setShowConfirm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "rgba(245, 158, 11, 0.15)", display: "flex",
                alignItems: "center", justifyContent: "center", margin: "0 auto 1rem"
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 style={{ color: "var(--warning)", marginBottom: "0.5rem" }}>Aviso Importante</h3>
            </div>
            <p style={{ textAlign: "center", color: "var(--text)", lineHeight: "1.6", marginBottom: "0.5rem" }}>
              Para confirmar el regreso primero debe registrar la mercaderia vendida como <strong>Venta por Reparto</strong> en la seccion de Ventas.
            </p>
            <p style={{ textAlign: "center", color: "var(--danger)", fontWeight: "500", marginBottom: "1.5rem" }}>
              Si no registro la venta por reparto, el regreso no podra completarse.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={ejecutarRegreso}>
                Confirmar Regreso
              </button>
            </div>
          </div>
        </div>
      )}

      {regresando && (
        <div className="modal-overlay" onClick={() => { setRegresando(null); setCancelarConRegreso(false); }}>
          <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{cancelarConRegreso ? `Cancelar Envio - ${regresando.camion}` : `Registrar Regreso - ${regresando.camion}`}</h3>
            <p className="subtitle">{cancelarConRegreso ? "Marca la mercaderia que volvio al cancelar el envio" : "Selecciona los productos que regresaron y sus cantidades"}</p>

            <div className="table-container" style={{ maxHeight: "200px", overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Enviada</th>
                    {!isRepartidor && <th>Vendida</th>}
                    <th>A Devolver</th>
                  </tr>
                </thead>
                <tbody>
                   {itemsRegreso.map((item, index) => {
                    return (
                      <tr key={item.productoId}>
                        <td><strong>{item.nombre}</strong></td>
                          <td>{textoCantidad(item.cantidad_enviada)}</td>
                          {!isRepartidor && <td>{textoCantidad(item.cantidad_vendida)}</td>}
                        <td>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              max={item.max_devolver}
                              value={item.cantidad_regreso || ""}
                              onChange={(e) => setCantidadRegreso(index, e.target.value)}
                              className="input-cantidad"
                            />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="resumen-card" style={{ marginTop: "1rem" }}>
              <div className="resumen-row">
                <span>Monto de Regreso:</span>
                <strong style={{ color: "var(--danger)" }}>${calcularMontoRegreso().toFixed(2)}</strong>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setRegresando(null); setCancelarConRegreso(false); }}>
                Cancelar
              </button>
              <button className="btn btn-entregado" onClick={confirmarRegreso}>
                {cancelarConRegreso ? "Confirmar Cancelacion" : "Confirmar Regreso"}
              </button>
            </div>
          </div>
        </div>
      )}

      {salidas.length === 0 ? (
        <p className="empty">No tienes salidas asignadas</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Camion</th>
                <th>Estado</th>
                <th>Acciones</th>
                <th>Mercaderia</th>
                <th className="hide-col">Total</th>
                <th className="hide-col">Monto Salida</th>
                <th className="hide-col">Monto Regreso</th>
              </tr>
            </thead>
            <tbody>
              {salidas.map((s) => (
                <tr key={s.id}>
                  <td>{s.fecha}</td>
                  <td><strong>{s.camion}</strong></td>
                  <td>
                    <span
                      className="estado-badge"
                      style={{ backgroundColor: estadoColors[s.estado === "sobrante" ? "entregado" : s.estado] }}
                    >
                      {(s.estado === "sobrante" ? "entregado" : s.estado).replace("_", " ")}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      {isOperador && s.estado === "pendiente" && (
                        <button className="btn btn-sm btn-camino" onClick={() => enviarSalida(s.id)}>
                          Enviar
                        </button>
                      )}
                      {!isOperador && s.estado === "en_camino" && (
                        <button
                          className="btn btn-sm btn-entregado"
                          onClick={() => openRegresoForm(s)}
                        >
                          Registrar Regreso
                        </button>
                      )}
                      {!isOperador && s.estado === "en_camino" && (
                        <button
                          className="btn btn-sm btn-cancel"
                          onClick={() => { setCancelandoId(s.id); setShowCancelConfirm(true); }}
                        >
                          Cancelar
                        </button>
                      )}
                      {!isOperador && s.estado === "pendiente" && (
                        <span style={{ fontSize: "0.8rem", color: "#888", fontStyle: "italic" }}>
                          Esperando autorización
                        </span>
                      )}
                    </div>
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
                  <td className="hide-col"><strong>${Number(s.precio_total || 0).toFixed(2)}</strong></td>
                  <td className="hide-col">{s.monto_salida ? <strong className="monto-salida">${s.monto_salida}</strong> : "-"}</td>
                  <td className="hide-col">{s.monto_regreso ? <strong className="monto-regreso">${s.monto_regreso}</strong> : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
