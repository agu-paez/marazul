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
  const [showDescuento, setShowDescuento] = useState(false);
  const [descuentoForm, setDescuentoForm] = useState({});
  const [descontando, setDescontando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
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
      const [res, prodRes] = await Promise.all([produccionAPI.getEstadisticas(), productosAPI.getAll()]);
      setData(res.data);
      setProductos(prodRes.data);
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
    if (form.cajones === "" || Number(form.cajones) < 0) {
      alert("El campo Cajones es obligatorio");
      return;
    }
    setGuardando(true);
    try {
      await produccionAPI.create(form);
      setForm({ fecha: fechaHoy(), cajones: "", alitas: "", pechugas: "", pata_muslo: "", menudos: "" });
      await loadData();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    } finally {
      setGuardando(false);
    }
  };

  const onChange = (campo, valor) => setForm({ ...form, [campo]: valor });

  const abrirDescuento = () => {
    setDescuentoForm({});
    setBusqueda("");
    setShowDescuento(true);
  };

  const onChangeDescuento = (id, valor) => setDescuentoForm((prev) => ({ ...prev, [id]: valor }));

  const aplicarDescuento = async () => {
    const items = Object.entries(descuentoForm)
      .filter(([, cantidad]) => Number(cantidad) > 0)
      .map(([productoId, cantidad]) => ({ productoId: parseInt(productoId, 10), cantidad: Number(cantidad) }));
    if (items.length === 0) {
      alert("Seleccione al menos un producto con cantidad mayor a 0");
      return;
    }
    setDescontando(true);
    try {
      await productosAPI.descontarStock({ items });
      setShowDescuento(false);
      await loadData();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    } finally {
      setDescontando(false);
    }
  };

  if (loading) return <div className="loading">Cargando...</div>;

  const termino = busqueda.trim().toLowerCase();
  const productosFiltrados = productos.filter((p) => {
    const coincideNombre = p.nombre?.toLowerCase().includes(termino);
    const coincideCodigo = p.codigo_barras ? p.codigo_barras.toLowerCase().includes(termino) : false;
    return termino === "" || coincideNombre || coincideCodigo;
  });

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
                value={form[key]}
                onChange={(e) => onChange(key, e.target.value)}
                required={required}
              />
            </div>
          ))}
        </div>
        <div className="produccion-form-actions">
          <button type="submit" className="btn btn-primary" disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar Registro"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={abrirDescuento}>
            Descontar Stock
          </button>
        </div>
      </form>

      {showDescuento && (
        <div className="modal-overlay" onClick={() => setShowDescuento(false)}>
          <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Descontar Stock</h3>
            <p className="subtitle">Selecciona las cantidades a descontar del stock general</p>

            <div className="form-group" style={{ marginBottom: "0.75rem" }}>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o codigo de barras..."
              />
            </div>

            <div className="table-container" style={{ maxHeight: "250px", overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Stock Actual</th>
                    <th>Cant. a Descontar</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="empty">No hay productos que coincidan</td>
                    </tr>
                  ) : (
                    productosFiltrados.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.nombre}</strong></td>
                        <td>{p.stock} {p.unidad}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={p.stock}
                            value={descuentoForm[p.id] ?? ""}
                            onChange={(e) => onChangeDescuento(p.id, e.target.value)}
                            className="input-cantidad"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowDescuento(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={aplicarDescuento} disabled={descontando}>
                {descontando ? "Descontando..." : "Descontar"}
              </button>
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
