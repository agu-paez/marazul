import { useState, useEffect } from "react";
import { produccionAPI, productosAPI } from "../api";

const fechaHoy = () => {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatearFecha = (fecha) => {
  if (!fecha) return "-";
  const [y, m, d] = String(fecha).split("-");
  return `${d}/${m}/${y}`;
};

const formatearNumero = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

const camposForm = [
  { key: "fecha", label: "Fecha", type: "date", required: true },
  { key: "cajones", label: "Cajones", type: "number", required: true },
  { key: "alitas", label: "Alitas", type: "number" },
  { key: "pechugas", label: "Pechugas", type: "number" },
  { key: "pata_muslo", label: "Pata Muslo", type: "number" },
  { key: "menudos", label: "Menudos", type: "number" },
];

export default function ProduccionPage() {
  const [data, setData] = useState({ registros: [], promedioDiario: [], promedioSemanal: [] });
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [productos, setProductos] = useState([]);
  const [mostrarCajones, setMostrarCajones] = useState(false);
  const [cajonesPorProducto, setCajonesPorProducto] = useState({});
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [form, setForm] = useState({
    fecha: fechaHoy(),
    cajones: "",
    alitas: "",
    pechugas: "",
    pata_muslo: "",
    menudos: "",
  });

  const loadData = async () => {
    try {
      const [produccionRes, productosRes] = await Promise.all([
        produccionAPI.getEstadisticas(),
        productosAPI.getAll(),
      ]);
      setData(produccionRes.data);
      setProductos(productosRes.data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fecha) {
      alert("Debe seleccionar una fecha");
      return;
    }
    if (totalCajones <= 0) {
      alert("El campo Cajones es obligatorio");
      return;
    }
    if (Object.keys(cajonesPorProducto).length === 0) {
      alert("Debe tocar Cargar cajones y seleccionar los productos");
      return;
    }
    setGuardando(true);
    try {
      await produccionAPI.create({
        ...form,
        productos_cajones: Object.entries(cajonesPorProducto).map(([productoId, cantidad]) => ({ productoId: Number(productoId), cantidad })),
      });
      setForm({ fecha: fechaHoy(), cajones: "", alitas: "", pechugas: "", pata_muslo: "", menudos: "" });
      setCajonesPorProducto({});
      await loadData();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    } finally {
      setGuardando(false);
    }
  };

  const onChange = (campo, valor) => setForm({ ...form, [campo]: valor });
  const totalCajones = Object.values(cajonesPorProducto).reduce((total, cantidad) => total + Number(cantidad || 0), 0);
  const abrirCargadorCajones = () => setMostrarCajones(true);
  const terminoProducto = busquedaProducto.trim().toLowerCase();
  const productosFiltrados = productos.filter((producto) => (
    !terminoProducto
    || producto.nombre.toLowerCase().includes(terminoProducto)
    || String(producto.codigo_barras || "").toLowerCase().includes(terminoProducto)
  ));

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="produccion-page">
      <div className="page-header">
        <div>
          <h2>Estadísticas de Producción</h2>
          <p className="text-muted">Semana actual</p>
        </div>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        <h3>Registrar Producción</h3>
        <div className="produccion-form-grid">
          {camposForm.map(({ key, label, type, required }) => (
            <div className="form-group" key={key}>
              <label>{label}{required ? " *" : ""}</label>
              <input
                type={type}
                min={type === "number" ? "0" : undefined}
                value={key === "cajones" ? totalCajones : form[key]}
                onChange={(e) => key !== "cajones" && onChange(key, e.target.value)}
                readOnly={key === "cajones"}
                required={required}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={abrirCargadorCajones}>
            Cargar cajones
          </button>
          <button type="submit" className="btn btn-primary" disabled={guardando || totalCajones === 0}>
            {guardando ? "Guardando..." : "Guardar Registro"}
          </button>
        </div>
      </form>

      {mostrarCajones && (
        <div className="modal-overlay" onClick={() => setMostrarCajones(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Cargar cajones</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Indique cuántos cajones carga de cada producto. Total: <strong>{totalCajones}</strong>
            </p>
            <div className="form-group">
              <label htmlFor="buscar-producto-cajones">Buscar producto</label>
              <input
                id="buscar-producto-cajones"
                type="search"
                value={busquedaProducto}
                onChange={(e) => setBusquedaProducto(e.target.value)}
                placeholder="Nombre o código de barras..."
              />
            </div>
            <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
              {productosFiltrados.map((producto) => (
                <div key={producto.id} className="cajones-producto-card">
                  <div className="cajones-producto-info">
                    <span className="producto-nombre">{producto.nombre}</span>
                    <span className="producto-stock">Stock disponible: {producto.stock}</span>
                  </div>
                  <input
                    className="cajones-input"
                    type="number"
                    min="0"
                    max={producto.stock}
                    step="1"
                    value={cajonesPorProducto[producto.id] || ""}
                    onChange={(e) => {
                      const cantidad = Math.max(0, Math.min(Number(e.target.value) || 0, producto.stock));
                      setCajonesPorProducto((actual) => {
                        const siguiente = { ...actual };
                        if (cantidad > 0) siguiente[producto.id] = cantidad;
                        else delete siguiente[producto.id];
                        return siguiente;
                      });
                    }}
                    style={{ width: "90px" }}
                    aria-label={`Cajones de ${producto.nombre}`}
                  />
                </div>
              ))}
              {productosFiltrados.length === 0 && <p className="empty">No se encontraron productos.</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setMostrarCajones(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={() => setMostrarCajones(false)} disabled={totalCajones === 0}>Aplicar ({totalCajones})</button>
            </div>
          </div>
        </div>
      )}

      <div className="produccion-grid">
        <div className="produccion-card">
          <h4>Registros</h4>
          {data.registros.length === 0 ? (
            <p className="empty">Sin datos</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cajones</th>
                    <th>Alitas</th>
                    <th>Pechugas</th>
                    <th>Pata Muslo</th>
                    <th>Menudos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.registros.map((r) => (
                    <tr key={r.id}>
                      <td>{formatearFecha(r.fecha)}</td>
                      <td>{r.cajones}</td>
                      <td>{r.alitas}</td>
                      <td>{r.pechugas}</td>
                      <td>{r.pata_muslo}</td>
                      <td>{r.menudos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="produccion-card">
          <h4>Promedio Diario</h4>
          {data.promedioDiario.length === 0 ? (
            <p className="empty">Sin datos</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Alitas</th>
                    <th>Pechugas</th>
                    <th>Pata Muslo</th>
                    <th>Menudos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.promedioDiario.map((d) => (
                    <tr key={d.fecha}>
                      <td>{formatearFecha(d.fecha)}</td>
                      <td>{formatearNumero(d.alitas)}</td>
                      <td>{formatearNumero(d.pechugas)}</td>
                      <td>{formatearNumero(d.pata_muslo)}</td>
                      <td>{formatearNumero(d.menudos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="produccion-card">
          <h4>Promedio Semanal</h4>
          {data.promedioSemanal.length === 0 ? (
            <p className="empty">Sin datos</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Semana</th>
                    <th>Alitas</th>
                    <th>Pechugas</th>
                    <th>Pata Muslo</th>
                    <th>Menudos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.promedioSemanal.map((s) => (
                    <tr key={s.semana}>
                      <td>{s.semana}</td>
                      <td>{formatearNumero(s.alitas)}</td>
                      <td>{formatearNumero(s.pechugas)}</td>
                      <td>{formatearNumero(s.pata_muslo)}</td>
                      <td>{formatearNumero(s.menudos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
