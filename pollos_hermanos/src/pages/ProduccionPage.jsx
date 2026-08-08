import { useState, useEffect } from "react";
import { produccionAPI } from "../api";

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
      const res = await produccionAPI.getEstadisticas();
      setData(res.data);
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
                value={form[key]}
                onChange={(e) => onChange(key, e.target.value)}
                required={required}
              />
            </div>
          ))}
        </div>
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar Registro"}
        </button>
      </form>

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
