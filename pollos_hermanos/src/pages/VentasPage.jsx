import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { productosAPI, ventasAPI, clientesAPI, salidasAPI, bancosAPI, proveedoresAPI } from "../api";
import BancoAutocomplete from "../components/BancoAutocomplete";
import ClienteAutocomplete from "../components/ClienteAutocomplete";

const fechaHoraLocalInput = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

export default function VentasPage() {
  const { user } = useAuth();
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [success, setSuccess] = useState(false);
  const [ultimaVenta, setUltimaVenta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarSoloSeleccionados, setMostrarSoloSeleccionados] = useState(false);
  const [cantidades, setCantidades] = useState({});
  const [form, setForm] = useState({
    tipo_venta: user?.role === "repartidor" ? "reparto" : "local",
    clienteId: "",
    medio_pago: "efectivo",
    notas: "",
  });
  const [pagoDividido] = useState(true);
  const [pagos, setPagos] = useState([
    { medio_pago: "efectivo", monto: 0 },
  ]);
  const [borradorMonto, setBorradorMonto] = useState({});
  const [montosEditando, setMontosEditando] = useState({});
  const [pagarDeuda, setPagarDeuda] = useState(false);
  const [clienteNombreIngresado, setClienteNombreIngresado] = useState("");
  const [camionesActivos, setCamionesActivos] = useState([]);
  const [camionSeleccionado, setCamionSeleccionado] = useState("");
  const [stockCamion, setStockCamion] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [datosTransferencia, setDatosTransferencia] = useState([]);
  const [datosTarjeta, setDatosTarjeta] = useState([]);
  const [bancos, setBancos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [preciosPersonalizados, setPreciosPersonalizados] = useState({});
  const [descuentosAplicados, setDescuentosAplicados] = useState({});
  const [productoPrecioEditando, setProductoPrecioEditando] = useState(null);
  const [precioEditando, setPrecioEditando] = useState("");

  useEffect(() => {
    productosAPI.getAll().then((res) => {
      setProductos(res.data);
       const init = {};
       res.data.forEach((p) => { init[p.id] = 0; });
       setCantidades(init);
    }).catch(console.error);
    clientesAPI.getAll().then((res) => setClientes(res.data)).catch(console.error);
    bancosAPI.getAll().then((res) => setBancos(res.data.map((b) => b.nombre))).catch(console.error);
    proveedoresAPI.getAll().then((res) => setProveedores(res.data)).catch(console.error);
    if (form.tipo_venta === "reparto") {
      salidasAPI.getCamionesActivos().then((res) => {
        setCamionesActivos(res.data);
        if (res.data.length > 0 && !camionSeleccionado) {
          const enCamino = res.data.find((c) => c.estado === "en_camino");
          const primero = enCamino || res.data[0];
          setCamionSeleccionado(String(primero.id));
        }
      }).catch(console.error);
    }
  }, [form.tipo_venta]);

  useEffect(() => {
    if (camionSeleccionado && form.tipo_venta === "reparto") {
      setStockLoading(true);
      salidasAPI.getStockCamion(camionSeleccionado).then((res) => {
        setStockCamion(res.data.items);
        const init = {};
         res.data.items.forEach((item) => { init[item.productoId] = 0; });
         setCantidades(init);
      }).catch(console.error).finally(() => setStockLoading(false));
    } else {
      setStockCamion([]);
    }
  }, [camionSeleccionado, form.tipo_venta]);

  useEffect(() => {
    if (form.tipo_venta !== "reparto" || !camionSeleccionado) return;
    const camion = camionesActivos.find((item) => item.id === parseInt(camionSeleccionado));
    if (form.clienteId && camion && !clientes.some((cliente) => cliente.id === parseInt(form.clienteId) && cliente.zona === camion.destino)) {
      setForm((prev) => ({ ...prev, clienteId: "" }));
      setClienteNombreIngresado("");
    }
  }, [camionSeleccionado, camionesActivos, clientes, form.tipo_venta]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (name === "tipo_venta") {
      setCamionSeleccionado("");
      setStockCamion([]);
      if (value === "reparto") {
        salidasAPI.getCamionesActivos().then((res) => {
          setCamionesActivos(res.data);
          if (res.data.length > 0) {
            const enCamino = res.data.find((c) => c.estado === "en_camino");
            const primero = enCamino || res.data[0];
            setCamionSeleccionado(String(primero.id));
          }
        }).catch(console.error);
      }
    }
  };

  const toggleCantidad = (productoId, delta) => {
    const producto = productosBase.find((p) => p.id === productoId);
    const esKg = ["kg", "kilogramo"].includes(String(producto?.unidad || "").toLowerCase());
    setCantidades((prev) => {
      const actual = prev[productoId] || 0;
      const nueva = Math.max(0, actual + (esKg ? delta * 0.5 : delta));
      return { ...prev, [productoId]: nueva };
    });
  };

  const getStockMax = (productoId) => {
    const p = productosBase.find((bp) => bp.id === productoId);
    if (!p) return 0;
    return Number(p.stock);
  };

  const handlePagoChange = (index, e) => {
    const newPagos = [...pagos];
    newPagos[index][e.target.name] = e.target.value;
    setPagos(newPagos);
    if (e.target.name === "medio_pago") {
      newPagos[index].monto = 0;
       const now = fechaHoraLocalInput();
      const newDatosT = [...datosTransferencia];
      const newDatosJ = [...datosTarjeta];
      if (e.target.value === "transferencia") {
         newDatosT[index] = { nombre_cuenta: "", fecha_hora: now, banco: "", monto: "0", proveedorId: "" };
      } else {
        newDatosT[index] = null;
      }
      if (e.target.value === "tarjeta") {
         newDatosJ[index] = { nombre_cuenta: "", fecha_hora: now, banco: "", monto: "0", proveedorId: "" };
      } else {
        newDatosJ[index] = null;
      }
      setDatosTransferencia(newDatosT);
      setDatosTarjeta(newDatosJ);
      setMontosEditando((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      setBorradorMonto((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const handleMontoInput = (index, value) => {
    setBorradorMonto((prev) => ({ ...prev, [index]: value }));
  };

  const confirmarMontoPago = (index, value) => {
    const newPagos = [...pagos];
    newPagos[index] = { ...newPagos[index], monto: value };
    setPagos(newPagos);

    if (newPagos[index].medio_pago === "transferencia" && datosTransferencia[index]) {
      const newDatos = [...datosTransferencia];
      newDatos[index] = { ...newDatos[index], monto: value };
      setDatosTransferencia(newDatos);
    } else if (newPagos[index].medio_pago === "tarjeta" && datosTarjeta[index]) {
      const newDatos = [...datosTarjeta];
      newDatos[index] = { ...newDatos[index], monto: value };
      setDatosTarjeta(newDatos);
    }

    setMontosEditando((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const addPago = () => {
    const totalIngresado = pagos.reduce((sum, pago, index) => sum + (parseFloat(montosEditando[index] ?? pago.monto) || 0), 0);
    const montoRestante = Math.max(0, totalConDeuda - totalIngresado);
    setPagos([...pagos, { medio_pago: "efectivo", monto: montoRestante.toFixed(2) }]);
    setDatosTransferencia([...datosTransferencia, null]);
    setDatosTarjeta([...datosTarjeta, null]);
  };

  const removePago = (index) => {
    if (pagos.length > 1) {
      setPagos(pagos.filter((_, i) => i !== index));
      setDatosTransferencia(datosTransferencia.filter((_, i) => i !== index));
      setDatosTarjeta(datosTarjeta.filter((_, i) => i !== index));
      setMontosEditando((prev) => {
        const next = {};
        Object.entries(prev).forEach(([key, value]) => {
          if (Number(key) < index) next[key] = value;
          if (Number(key) > index) next[Number(key) - 1] = value;
        });
        return next;
      });
      setBorradorMonto((prev) => {
        const next = {};
        Object.entries(prev).forEach(([key, value]) => {
          if (Number(key) < index) next[key] = value;
          if (Number(key) > index) next[Number(key) - 1] = value;
        });
        return next;
      });
    }
  };

  const esReparto = form.tipo_venta === "reparto";
  const esRepartidor = user?.role === "repartidor";

  const esTransferencia = pagos.some((p) => p.medio_pago === "transferencia");

  const esTarjeta = pagos.some((p) => p.medio_pago === "tarjeta");

  const transferenciaIndices = pagos.reduce((acc, p, i) => (p.medio_pago === "transferencia" ? [...acc, i] : acc), []);

  const tarjetaIndices = pagos.reduce((acc, p, i) => (p.medio_pago === "tarjeta" ? [...acc, i] : acc), []);

  const isDatosBancariosCompleto = (datos) => {
    return datos && datos.nombre_cuenta.trim() && datos.fecha_hora && datos.banco.trim() && datos.monto;
  };

  const handleDatoBancarioRapido = (tipo, index, campo, valor) => {
    const setDatos = tipo === "transferencia" ? setDatosTransferencia : setDatosTarjeta;
    const datos = tipo === "transferencia" ? datosTransferencia : datosTarjeta;
    const newDatos = [...datos];
    newDatos[index] = { ...newDatos[index], [campo]: valor };
    if (newDatos[index].nombre_cuenta && newDatos[index].banco && !newDatos[index].fecha_hora) {
       newDatos[index] = { ...newDatos[index], fecha_hora: fechaHoraLocalInput() };
    }
    if (pagos[index]) {
      const montoActual = montosEditando[index] !== undefined && montosEditando[index] !== ""
        ? montosEditando[index]
        : pagos[index].monto;
      newDatos[index] = { ...newDatos[index], monto: String(montoActual || 0) };
    } else {
      newDatos[index] = { ...newDatos[index], monto: String(subtotal || 0) };
    }
    setDatos(newDatos);
  };

  const handleProveedorChange = (tipo, index, value) => {
    const setDatos = tipo === "transferencia" ? setDatosTransferencia : setDatosTarjeta;
    const datos = tipo === "transferencia" ? datosTransferencia : datosTarjeta;
    const newDatos = [...datos];
    newDatos[index] = { ...newDatos[index], proveedorId: value };
    setDatos(newDatos);
  };
  const productosBase = esReparto
    ? stockCamion.map((sc) => ({
        id: sc.productoId,
        nombre: sc.nombre,
         precio: sc.precio,
         descuento: sc.descuento,
         unidad: sc.unidad,
         unidades_por_caja: sc.unidades_por_caja,
        stock: sc.disponible,
        cargado: sc.cargado,
        devuelto: sc.devuelto,
      }))
    : productos;

  const productosFiltrados = productosBase.filter((p) => {
    const termino = busqueda.toLowerCase();
    const coincideBusqueda = (
      p.nombre.toLowerCase().includes(termino) ||
      (p.codigo_barras && p.codigo_barras.toLowerCase().includes(termino))
    );
    return coincideBusqueda && (!mostrarSoloSeleccionados || (cantidades[p.id] || 0) > 0);
  });

  const productosSeleccionados = productosBase.filter((p) => (cantidades[p.id] || 0) > 0);

  const esProductoKg = (producto) => ["kg", "kilogramo"].includes(String(producto?.unidad || "").toLowerCase());
  const getPrecioVenta = (producto) => {
    if (preciosPersonalizados[producto.id] !== undefined) return preciosPersonalizados[producto.id];
    if (descuentosAplicados[producto.id]) {
      return Math.round(Number(producto.precio) * (1 - Number(producto.descuento || 0) / 100) * 100) / 100;
    }
    return Number(producto.precio);
  };

  const toggleDescuentoProducto = (producto) => {
    if (Number(producto.descuento || 0) <= 0) return;
    setDescuentosAplicados((prev) => ({ ...prev, [producto.id]: !prev[producto.id] }));
    setPreciosPersonalizados((prev) => {
      const nuevos = { ...prev };
      delete nuevos[producto.id];
      return nuevos;
    });
  };
  const getCantidadUnidades = (producto) => {
    return Number(cantidades[producto.id] || 0);
  };

  const abrirEdicionPrecio = (producto) => {
    setProductoPrecioEditando(producto);
    setPrecioEditando(String(getPrecioVenta(producto)));
  };

  const guardarPrecioPersonalizado = () => {
    const precio = Number(precioEditando);
    if (!Number.isFinite(precio) || precio <= 0) {
      alert("Ingrese un precio unitario válido");
      return;
    }
    setPreciosPersonalizados((prev) => ({ ...prev, [productoPrecioEditando.id]: precio }));
    setProductoPrecioEditando(null);
  };


  const calcularSubtotal = () => {
    return productosSeleccionados.reduce((sum, p) => {
      return sum + getPrecioVenta(p) * (cantidades[p.id] || 0);
    }, 0);
  };

  const clienteSeleccionado = clientes.find((c) => c.id === parseInt(form.clienteId));
  const camionSeleccionadoData = camionesActivos.find((camion) => camion.id === parseInt(camionSeleccionado));
  const clientesDisponibles = useMemo(() => {
    if (esReparto && camionSeleccionadoData) {
      return clientes.filter((cliente) => cliente.zona === camionSeleccionadoData.destino);
    }
    return esReparto ? [] : clientes;
  }, [esReparto, clientes, camionSeleccionadoData]);
  const subtotal = calcularSubtotal();
  const deudaAnterior = clienteSeleccionado ? parseFloat(clienteSeleccionado.saldo_pendiente) || 0 : 0;
  const tieneDeuda = deudaAnterior > 0;
  const montoDeuda = pagarDeuda && tieneDeuda ? deudaAnterior : 0;
  const totalConDeuda = subtotal + montoDeuda;

  const getPagoMonto = (index) => parseFloat(montosEditando[index] ?? pagos[index]?.monto) || 0;

  const totalPagosDivididos = pagoDividido
    ? pagos.reduce((sum, _, index) => sum + getPagoMonto(index), 0)
    : 0;

  const sumaPagosValida = !pagoDividido || totalPagosDivididos >= totalConDeuda - 0.01;
  const sobrantePagos = pagoDividido ? Math.max(0, totalPagosDivididos - totalConDeuda) : 0;

  const tieneCCDividido = pagos.some((p) => p.medio_pago === "cuenta_corriente");

  const montoCC = pagos.reduce(
    (sum, p, index) => (p.medio_pago === "cuenta_corriente" ? sum + getPagoMonto(index) : sum),
    0
  );

  const pagosPorMedio = pagos.reduce((acc, p, index) => {
    if (p.medio_pago === "cuenta_corriente") return acc;
    acc[p.medio_pago] = (acc[p.medio_pago] || 0) + getPagoMonto(index);
    return acc;
  }, {});

  const totalAcumulado = deudaAnterior + montoCC;
  const totalMediosNoCC = totalPagosDivididos - montoCC;
  const montoRestantePago = Math.max(0, totalConDeuda - totalPagosDivididos);

  const handleClienteChange = (clienteId, nombre) => {
    setForm((prev) => ({ ...prev, clienteId }));
    setClienteNombreIngresado(nombre || "");
    setPagarDeuda(false);
  };

  const handleAddCliente = async (nombre) => {
    try {
      const zonaCliente = esReparto ? camionSeleccionadoData?.destino : null;
      if (esReparto && !zonaCliente) {
        alert("Debe seleccionar un camion antes de crear el cliente");
        return;
      }
      const response = await clientesAPI.create({ nombre, zona: zonaCliente });
      setClientes((prev) => [...prev, response.data.cliente]);
      setForm((prev) => ({ ...prev, clienteId: String(response.data.cliente.id) }));
      setClienteNombreIngresado(response.data.cliente.nombre);
    } catch (error) {
      alert("Error al crear cliente: " + (error.response?.data?.message || error.message));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (productosSeleccionados.length === 0) {
      alert("Debe seleccionar al menos un producto");
      return;
    }
    if (esReparto && !camionSeleccionado) {
      alert("Debe seleccionar un camion para venta por reparto");
      return;
    }
    if (pagoDividido && !sumaPagosValida) {
      alert(`La suma de los pagos ($${totalPagosDivididos.toFixed(2)}) es menor al total ($${totalConDeuda.toFixed(2)})`);
      return;
    }
    if (sobrantePagos > 0.01 && !confirm(`Hay un sobrante de $${sobrantePagos.toFixed(2)}. Se registrara como saldo a favor del cliente. ¿Deseas continuar?`)) {
      return;
    }
    for (let i = 0; i < transferenciaIndices.length; i++) {
      if (!datosTransferencia[transferenciaIndices[i]]?.proveedorId) {
        alert(`Debe seleccionar una cuenta de proveedor para la Transferencia ${i + 1}`);
        return;
      }
    }
    for (let i = 0; i < tarjetaIndices.length; i++) {
      if (!datosTarjeta[tarjetaIndices[i]]?.proveedorId) {
        alert(`Debe seleccionar una cuenta de proveedor para la Tarjeta ${i + 1}`);
        return;
      }
    }
    for (let i = 0; i < transferenciaIndices.length; i++) {
      if (!isDatosBancariosCompleto(datosTransferencia[transferenciaIndices[i]])) {
        alert(`Debe completar todos los campos del formulario de Transferencia ${i + 1}`);
        return;
      }
    }
    for (let i = 0; i < tarjetaIndices.length; i++) {
      if (!isDatosBancariosCompleto(datosTarjeta[tarjetaIndices[i]])) {
        alert(`Debe completar todos los campos del formulario de Tarjeta ${i + 1}`);
        return;
      }
    }
    setLoading(true);
    try {
      let clienteId = parseInt(form.clienteId);
      if (!clienteId) {
        const nombreNuevo = clienteNombreIngresado.trim();
        if (!nombreNuevo) {
          alert("Debe seleccionar o escribir un cliente");
          return;
        }
        const zonaCliente = esReparto ? camionSeleccionadoData?.destino : null;
        if (esReparto && !zonaCliente) {
          alert("Debe seleccionar un camion antes de crear el cliente");
          return;
        }
        const clienteRes = await clientesAPI.create({ nombre: nombreNuevo, zona: zonaCliente });
        clienteId = clienteRes.data.cliente.id;
        setClientes((prev) => [...prev, clienteRes.data.cliente]);
      }
      const data = {
        tipo_venta: form.tipo_venta,
        clienteId,
        medio_pago: form.medio_pago,
        notas: form.notas,
        items: productosSeleccionados.map((p) => ({
           productoId: p.id,
           cantidad: cantidades[p.id],
           precio_unitario: getPrecioVenta(p),
           cantidad_unidades: getCantidadUnidades(p),
        })),
      };
      if (esReparto && camionSeleccionado) {
        data.salidaCamionId = parseInt(camionSeleccionado);
      }
      if (pagarDeuda && tieneDeuda) {
        data.pagar_deuda = true;
        data.monto_deuda = deudaAnterior;
      }
      data.pagos = pagos.map((p, index) => ({
        medio_pago: p.medio_pago,
        monto: getPagoMonto(index),
      }));
      if (esTransferencia) {
        data.datos_transferencia = datosTransferencia
          .filter((d) => isDatosBancariosCompleto(d))
          .map((d) => ({
            nombre_cuenta: d.nombre_cuenta,
            fecha_hora: d.fecha_hora,
             banco: d.banco,
             monto: parseFloat(d.monto) || 0,
             proveedorId: d.proveedorId ? parseInt(d.proveedorId) : null,
          }));
      }
      if (esTarjeta) {
        data.datos_tarjeta = datosTarjeta
          .filter((d) => isDatosBancariosCompleto(d))
          .map((d) => ({
            nombre_cuenta: d.nombre_cuenta,
            fecha_hora: d.fecha_hora,
             banco: d.banco,
             monto: parseFloat(d.monto) || 0,
             proveedorId: d.proveedorId ? parseInt(d.proveedorId) : null,
          }));
      }
      const res = await ventasAPI.create(data);
      const ventaGuardada = res.data.venta;
      setUltimaVenta(ventaGuardada);
      setSuccess(true);

      setForm({
        tipo_venta: esRepartidor ? "reparto" : "local",
        clienteId: "",
        medio_pago: "efectivo",
        notas: "",
      });
      setClienteNombreIngresado("");
      setPagos([{ medio_pago: "efectivo", monto: 0 }]);
      setDatosTransferencia([]);
      setDatosTarjeta([]);
      setPagarDeuda(false);
      setPreciosPersonalizados({});
      setDescuentosAplicados({});
      setProductoPrecioEditando(null);
      setCamionSeleccionado("");
      setStockCamion([]);
      setBusqueda("");
      setMostrarSoloSeleccionados(false);

      if (esRepartidor) {
        const camionesRes = await salidasAPI.getCamionesActivos();
        setCamionesActivos(camionesRes.data);
        if (camionesRes.data.length > 0) {
          const enCamino = camionesRes.data.find((c) => c.estado === "en_camino");
          const primero = enCamino || camionesRes.data[0];
          setCamionSeleccionado(String(primero.id));
        }
      }

      const [productosRes, clientesRes] = await Promise.all([
        productosAPI.getAll(),
        clientesAPI.getAll(),
      ]);
      setProductos(productosRes.data);
      setClientes(clientesRes.data);
       const reset = {};
       productosRes.data.forEach((p) => { reset[p.id] = 0; });
       setCantidades(reset);

      setTimeout(() => setSuccess(false), 5000);
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message) + (error.response?.data?.error ? `\nDetalle: ${error.response.data.error}` : ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Nueva Venta</h2>

      {success && ultimaVenta && (
        <div className="success-msg">
          Venta {ultimaVenta.numero_comprobante} registrada. PDF descargado.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-card">
          <h3>Productos</h3>

          {esReparto && !camionSeleccionado && (
            <p className="empty" style={{ marginBottom: "1rem" }}>
              Seleccione un camion para ver y seleccionar productos
            </p>
          )}

          {esReparto && camionSeleccionado && stockLoading && (
            <p className="empty" style={{ marginBottom: "1rem" }}>
              Cargando stock del camion...
            </p>
          )}

            <div className="producto-search">
              <div className="search-with-clear">
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar producto..."
                disabled={esReparto && !camionSeleccionado}
              />
              {busqueda && (
                <button type="button" className="search-clear" onClick={() => setBusqueda("")} aria-label="Borrar búsqueda">
                  X
                </button>
                )}
              </div>
              <button
                type="button"
                className={`btn btn-sm ${mostrarSoloSeleccionados ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setMostrarSoloSeleccionados((prev) => !prev)}
                style={{ marginTop: "0.5rem" }}
              >
                {mostrarSoloSeleccionados ? "Mostrar todos los productos" : "Ocultar no seleccionados"}
              </button>
            </div>

          {productosFiltrados.length === 0 ? (
            <p className="empty">{esReparto && !camionSeleccionado ? "Seleccione un camion primero" : "No se encontraron productos"}</p>
          ) : (
            <div className="producto-grid">
              {productosFiltrados.map((p) => {
                 const qty = cantidades[p.id] || 0;
                 const seleccionado = qty > 0;
                 const esKg = ["kg", "kilogramo"].includes(String(p.unidad || "").toLowerCase());
                 return (
                  <div
                    key={p.id}
                    className={`producto-card ${seleccionado ? "selected" : ""}`}
                  >
                     <div className="producto-card-name">{p.nombre}</div>
                     <div className="producto-card-price">
                        ${getPrecioVenta(p).toFixed(2)} {esKg ? "/ kg" : ""}
                    </div>
                    <div className={`producto-card-stock ${p.stock <= (p.stock_minimo || 10) ? "bajo" : ""}`}>
                      Stock: {p.stock}
                      {esReparto && p.devuelto > 0 && (
                        <span style={{ color: "#e74c3c", fontSize: "0.75rem", marginLeft: "0.25rem" }}>
                          (devuelto: {p.devuelto})
                        </span>
                      )}
                    </div>
                    {Number(p.descuento || 0) > 0 && (
                      <label style={{ display: "block", margin: "0.35rem 0", fontSize: "0.8rem" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(descuentosAplicados[p.id])}
                          onChange={() => toggleDescuentoProducto(p)}
                        />{" "}
                        Aplicar descuento ({Number(p.descuento)}%)
                      </label>
                    )}
                    <div className="producto-card-qty">
                      <button
                        type="button"
                        onClick={() => toggleCantidad(p.id, -1)}
                        disabled={qty === 0 || (esReparto && !camionSeleccionado)}
                      >
                        -
                      </button>
                      <input
                        type="number"
                         value={qty}
                         step={esKg ? "0.01" : "1"}
                         aria-label={`Cantidad de ${p.nombre}${esKg ? " en kilogramos" : ""}`}
                        min="0"
                         max={getStockMax(p.id)}
                        onChange={(e) => {
                           const val = esKg ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0;
                            const clamped = Math.max(0, Math.min(val, Number(getStockMax(p.id))));
                          setCantidades((prev) => ({ ...prev, [p.id]: clamped }));
                        }}
                        disabled={esReparto && !camionSeleccionado}
                      />
                      <button
                        type="button"
                        onClick={() => toggleCantidad(p.id, 1)}
                        disabled={qty >= getStockMax(p.id) || (esReparto && !camionSeleccionado)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="form-card">
          <h3>Datos de la Venta</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Tipo de Venta *</label>
              <select name="tipo_venta" value={form.tipo_venta} onChange={handleChange} required disabled={esRepartidor}>
                <option value="local">Venta Mayorista</option>
                <option value="reparto">Venta por Reparto</option>
              </select>
            </div>
            {esReparto && (
              <div className="form-group">
                <label>Camion *</label>
                <div className="camiones-grid">
                  {camionesActivos.map((c) => {
                    const activo = c.estado === "en_camino";
                    const estadoLabel = c.estado === "en_camino" ? "En camino" : c.estado === "entregado" ? "Entregado" : "Sobrante";
                    return (
                      <div
                        key={c.id}
                        className={`camion-card ${parseInt(camionSeleccionado) === c.id ? "selected" : ""} ${activo ? "camion-pendiente" : ""}`}
                        onClick={() => setCamionSeleccionado(String(c.id))}
                      >
                        <div className="camion-card-nombre">{c.camion}</div>
                        <div className="camion-card-repartidor">{c.repartidor_asignado?.nombre || "Sin repartidor"}</div>
                        <div className={`camion-card-estado camion-estado-${c.estado}`}>{estadoLabel}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="form-group">
              <label>Clientes *</label>
              <ClienteAutocomplete
                value={form.clienteId}
                clientes={clientesDisponibles}
                onChange={handleClienteChange}
                onAddCliente={handleAddCliente}
                disabled={esReparto && !camionSeleccionadoData}
                placeholder={esReparto && !camionSeleccionadoData ? "Seleccione un camion primero" : "Buscar cliente por nombre..."}
              />
            </div>
          </div>

          {tieneDeuda && (
            <div className="form-card" style={{ marginTop: "0.5rem", borderLeft: "3px solid #e74c3c" }}>
              <div className="resumen-row">
                <span style={{ fontWeight: "bold", color: "#e74c3c" }}>
                  Deuda pendiente en cuenta corriente:
                </span>
                <strong className="monto-regreso">${deudaAnterior.toFixed(2)}</strong>
              </div>
              <div className="form-group" style={{ marginTop: "0.5rem" }}>
                <label style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={pagarDeuda}
                    onChange={(e) => setPagarDeuda(e.target.checked)}
                    style={{ marginRight: "0.5rem" }}
                  />
                  Agregar pago de deuda al total a pagar
                </label>
              </div>
              {pagarDeuda && (
                <div className="resumen-row" style={{ marginTop: "0.25rem" }}>
                  <span>Monto de deuda a pagar:</span>
                  <strong className="monto-regreso">${deudaAnterior.toFixed(2)}</strong>
                </div>
              )}
            </div>
          )}
          {clienteSeleccionado && deudaAnterior < 0 && (
            <div className="form-card" style={{ marginTop: "0.5rem", borderLeft: "3px solid #10b981" }}>
              <div className="resumen-row">
                <span style={{ fontWeight: "bold", color: "#10b981" }}>
                  Saldo a favor en cuenta corriente:
                </span>
                <strong style={{ color: "#10b981", fontWeight: "bold" }}>${Math.abs(deudaAnterior).toFixed(2)}</strong>
              </div>
            </div>
          )}

          <div className="form-card" style={{ marginTop: "0.5rem", borderTop: "3px solid #3498db" }}>
            <h3>Metodo de Pago</h3>
            <p className="subtitle">Formato de pago dividido: combine varios medios de pago; el importe restante se completa automaticamente.</p>
            <div>
              {pagos.map((pago, index) => {
                const esTrans = pago.medio_pago === "transferencia";
                const esTarj = pago.medio_pago === "tarjeta";
                return (
                <div key={index} style={{ marginBottom: "0.75rem" }}>
                  <div className="item-row" style={{ alignItems: "flex-end" }}>
                    <div style={{ flex: 2, minWidth: 0 }}>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "bold", color: "#5a6c7d", marginBottom: "0.25rem" }}>Medio</label>
                      <select
                        name="medio_pago"
                        value={pago.medio_pago}
                        onChange={(e) => handlePagoChange(index, e)}
                        required
                        style={{ width: "100%" }}
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="cuenta_corriente">Cuenta Corriente</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div style={{ flex: 1.4, minWidth: 0 }}>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "bold", color: "#5a6c7d", marginBottom: "0.25rem" }}>Importe</label>
                      <input
                        type="number"
                        name="monto"
                        value={borradorMonto[index] ?? (montosEditando[index] ?? pago.monto)}
                        onChange={(e) => handleMontoInput(index, e.target.value)}
                        onBlur={(e) => {
                          confirmarMontoPago(index, e.currentTarget.value);
                          setBorradorMonto((prev) => {
                            const next = { ...prev };
                            delete next[index];
                            return next;
                          });
                        }}
                        min="0"
                        step="0.01"
                        placeholder="Monto"
                        required
                        style={{ width: "100%" }}
                      />
                    </div>
                    {pagos.length > 1 && (
                      <button type="button" className="btn btn-sm btn-cancel" onClick={() => removePago(index)} title="Quitar medio">X</button>
                    )}
                  </div>
                  {esTrans && (
                    <div className="pago-detalle-row" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.4rem", padding: "0.4rem", background: "#f0f7ff", borderRadius: "6px", borderLeft: "3px solid #3498db" }}>
                      <select
                         value={datosTransferencia[index]?.proveedorId || ""}
                         onChange={(e) => handleProveedorChange("transferencia", index, e.target.value)}
                         required
                        style={{ width: "100%", padding: "4px 8px", fontSize: "0.85rem" }}
                      >
                        <option value="">Seleccionar proveedor destino...</option>
                        {proveedores.map((p) => (
                           <option key={p.id} value={p.id}>
                             {p.nombre} - Alias a transferir: {p.alias || "Sin alias"}
                           </option>
                        ))}
                      </select>
                      <input
                        value={datosTransferencia[index]?.nombre_cuenta || ""}
                        onChange={(e) => handleDatoBancarioRapido("transferencia", index, "nombre_cuenta", e.target.value)}
                        placeholder="Nombre de la cuenta"
                        style={{ width: "100%", padding: "4px 8px", fontSize: "0.85rem" }}
                      />
                      <BancoAutocomplete
                        value={datosTransferencia[index]?.banco || ""}
                        onChange={(val) => handleDatoBancarioRapido("transferencia", index, "banco", val)}
                        bancos={bancos}
                        onAddBanco={(v) => {
                          if (!bancos.includes(v)) {
                            bancosAPI.create({ nombre: v }).then(() => {
                              setBancos(prev => [...prev, v]);
                            }).catch(console.error);
                          }
                        }}
                        exclude={[
                          ...datosTransferencia.filter((_, idx) => idx !== index).filter(Boolean).map(d => d.banco).filter(Boolean),
                          ...datosTarjeta.filter(Boolean).map(d => d.banco).filter(Boolean),
                        ]}
                      />
                    </div>
                  )}
                  {esTarj && (
                    <div className="pago-detalle-row" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.4rem", padding: "0.4rem", background: "#f5f0ff", borderRadius: "6px", borderLeft: "3px solid #9b59b6" }}>
                      <select
                         value={datosTarjeta[index]?.proveedorId || ""}
                         onChange={(e) => handleProveedorChange("tarjeta", index, e.target.value)}
                         required
                        style={{ width: "100%", padding: "4px 8px", fontSize: "0.85rem" }}
                      >
                        <option value="">Seleccionar proveedor destino...</option>
                        {proveedores.map((p) => (
                           <option key={p.id} value={p.id}>
                             {p.nombre} - Alias a transferir: {p.alias || "Sin alias"}
                           </option>
                        ))}
                      </select>
                      <input
                        value={datosTarjeta[index]?.nombre_cuenta || ""}
                        onChange={(e) => handleDatoBancarioRapido("tarjeta", index, "nombre_cuenta", e.target.value)}
                        placeholder="Nombre de la cuenta"
                        style={{ width: "100%", padding: "4px 8px", fontSize: "0.85rem" }}
                      />
                      <BancoAutocomplete
                        value={datosTarjeta[index]?.banco || ""}
                        onChange={(val) => handleDatoBancarioRapido("tarjeta", index, "banco", val)}
                        bancos={bancos}
                        onAddBanco={(v) => {
                          if (!bancos.includes(v)) {
                            bancosAPI.create({ nombre: v }).then(() => {
                              setBancos(prev => [...prev, v]);
                            }).catch(console.error);
                          }
                        }}
                        exclude={[
                          ...datosTransferencia.filter(Boolean).map(d => d.banco).filter(Boolean),
                          ...datosTarjeta.filter((_, idx) => idx !== index).filter(Boolean).map(d => d.banco).filter(Boolean),
                        ]}
                      />
                    </div>
                  )}
                </div>
                );
              })}
              <button type="button" className="btn btn-secondary" onClick={addPago}>+ Agregar Medio de Pago</button>
              {Object.keys(pagosPorMedio).length > 0 && (
                <div style={{ marginTop: "0.5rem" }}>
                  {Object.entries(pagosPorMedio).map(([medio, monto]) => (
                    <div key={medio} className="resumen-row">
                      <span style={{ textTransform: "capitalize" }}>{medio.replace(/_/g, " ")}</span>
                      <strong>${monto.toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              )}
              <div className="resumen-row" style={{ marginTop: "0.5rem" }}>
                <span>{totalPagosDivididos >= totalConDeuda ? "Sobrante:" : "Falta:"}</span>
                <strong className={sumaPagosValida ? "monto-regreso" : "monto-salida"}>
                  ${totalPagosDivididos >= totalConDeuda ? (totalPagosDivididos - totalConDeuda).toFixed(2) : Math.max(0, totalConDeuda - totalPagosDivididos).toFixed(2)}
                </strong>
              </div>
              {sumaPagosValida && totalPagosDivididos === totalConDeuda && (
                <div style={{ marginTop: "0.25rem", color: "#27ae60", fontWeight: "bold", fontSize: "0.9rem" }}>
                  ✓ Total completado
                </div>
              )}
              {totalPagosDivididos > totalConDeuda && (
                <div style={{ marginTop: "0.25rem", color: "#e67e22", fontWeight: "bold", fontSize: "0.9rem" }}>
                  Hay un sobrante de ${(totalPagosDivididos - totalConDeuda).toFixed(2)} — se registrara como saldo a favor del cliente
                </div>
              )}
              {!sumaPagosValida && totalPagosDivididos < totalConDeuda && (
                <div className="error-msg" style={{ marginTop: "0.25rem" }}>
                  Falta agregar ${Math.abs(totalConDeuda - totalPagosDivididos).toFixed(2)}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Observaciones</label>
            <input
              name="notas"
              value={form.notas}
              onChange={handleChange}
              placeholder="Observaciones"
            />
          </div>
        </div>

        <div className="form-card resumen-card">
          {productosSeleccionados.length > 0 && (
            <div style={{ marginBottom: "0.5rem" }}>
              {productosSeleccionados.map((p) => {
                const precio = getPrecioVenta(p);
                const esKg = esProductoKg(p);
                return (
                  <div key={p.id} className="resumen-row">
                     <span>
                       {cantidades[p.id]}{esKg ? " kg" : ""} {p.nombre}
                      {esKg && (
                        <button type="button" className="btn btn-sm btn-secondary" style={{ marginLeft: "0.5rem" }} onClick={() => abrirEdicionPrecio(p)}>
                          Modificar precio
                        </button>
                      )}
                    </span>
                    <strong>${(precio * cantidades[p.id]).toFixed(2)}</strong>
                  </div>
                );
              })}
              <div className="cierre-separator"></div>
            </div>
          )}


          {pagarDeuda && tieneDeuda && (
            <>
              <div className="resumen-row">
                <span>Subtotal productos:</span>
                <strong>${subtotal.toFixed(2)}</strong>
              </div>
              <div className="resumen-row">
                <span>Pago de deuda:</span>
                <strong className="monto-regreso">${deudaAnterior.toFixed(2)}</strong>
              </div>
              <div className="cierre-separator"></div>
            </>
          )}

          {tieneCCDividido && clienteSeleccionado && deudaAnterior > 0 && (
            <>
              <div className="resumen-row">
                <span>Deuda anterior:</span>
                <strong className="monto-regreso">${deudaAnterior.toFixed(2)}</strong>
              </div>
              <div className="resumen-row">
                <span>Monto CC esta venta:</span>
                <strong>${montoCC.toFixed(2)}</strong>
              </div>
              <div className="cierre-separator"></div>
            </>
          )}
          <div className="resumen-row">
            <span>Subtotal:</span>
            <strong>${subtotal.toFixed(2)}</strong>
          </div>
          {pagarDeuda && tieneDeuda && (
            <div className="resumen-row">
              <span>+ Deuda a pagar:</span>
              <strong className="monto-regreso">${deudaAnterior.toFixed(2)}</strong>
            </div>
          )}
           {pagoDividido && (
             <>
               <div className="resumen-row">
                 <span>Pagado en efectivo y otros medios:</span>
                 <strong>${totalMediosNoCC.toFixed(2)}</strong>
               </div>
               <div className="resumen-row">
                 <span>Cuenta corriente de esta venta:</span>
                 <strong className="monto-regreso">${montoCC.toFixed(2)}</strong>
               </div>
               <div className="resumen-row resumen-total">
                 <span>Total de la venta:</span>
                 <strong className="monto-ventas">${totalConDeuda.toFixed(2)}</strong>
               </div>
               {montoCC > 0 && (
                 <div className="resumen-row">
                   <span>Nuevo saldo en cuenta corriente:</span>
                   <strong className="monto-regreso">${totalAcumulado.toFixed(2)}</strong>
                 </div>
               )}
               {montoRestantePago > 0 && (
                 <div className="resumen-row">
                   <span>Importe restante por asignar:</span>
                   <strong className="monto-salida">${montoRestantePago.toFixed(2)}</strong>
                 </div>
               )}
             </>
           )}

         </div>

        {productoPrecioEditando && (
          <div className="modal-overlay" onClick={() => setProductoPrecioEditando(null)}>
             <div className="modal-card precio-venta-modal" onClick={(e) => e.stopPropagation()}>
               <div className="precio-venta-heading">
                 <span className="modal-eyebrow">Precio especial</span>
                 <h3>Modificar precio</h3>
                 <p>{productoPrecioEditando.nombre}</p>
               </div>
               <div className="form-group">
                <label htmlFor="precio-unitario-kg">Precio unitario por kilogramo</label>
                <input
                  id="precio-unitario-kg"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={precioEditando}
                  onChange={(e) => setPrecioEditando(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                   <button type="button" className="btn btn-secondary" onClick={() => setProductoPrecioEditando(null)}>Cancelar</button>
                   <button type="button" className="btn btn-primary precio-guardar-btn" onClick={guardarPrecioPersonalizado}>Guardar precio</button>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={loading || (pagoDividido && !sumaPagosValida) || productosSeleccionados.length === 0}
        >
          {loading ? "Procesando..." : "Finalizar Venta"}
        </button>
      </form>
    </div>
  );
}
