import { useState, useEffect } from "react";
import { gastosAPI } from "../api";

export default function GastosBoxes() {
  const [gastos, setGastos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [montoTransporte, setMontoTransporte] = useState("");
  const [montoOtro, setMontoOtro] = useState("");
  const [gastoPendiente, setGastoPendiente] = useState(null);
  const [descripcion, setDescripcion] = useState("");

  useEffect(() => {
    loadGastos();
  }, []);

  const loadGastos = async () => {
    try {
      const res = await gastosAPI.getAll();
      setGastos(res.data);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const crearGasto = async (tipo, monto, descripcionGasto = null) => {
    setGuardando(true);
    try {
      await gastosAPI.create({ tipo, monto, descripcion: descripcionGasto });
      setMontoTransporte("");
      setMontoOtro("");
      setDescripcion("");
      loadGastos();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardarTransporte = () => {
    if (!montoTransporte || parseFloat(montoTransporte) <= 0) {
      alert("Debe ingresar un monto valido");
      return;
    }
    crearGasto("transporte", montoTransporte);
  };

  const handleGuardarOtro = () => {
    if (!montoOtro || parseFloat(montoOtro) <= 0) {
      alert("Debe ingresar un monto valido");
      return;
    }
    setGastoPendiente(montoOtro);
  };

  const confirmarOtroGasto = () => {
    if (!gastoPendiente) return;
    if (!descripcion.trim()) {
      alert("Debe indicar de que es el gasto");
      return;
    }
    const monto = gastoPendiente;
    setGastoPendiente(null);
    crearGasto("otro", monto, descripcion);
  };

  const transporte = gastos.filter((g) => g.tipo === "transporte");
  const otros = gastos.filter((g) => g.tipo === "otro");
  const totalTransporte = transporte.reduce((s, g) => s + parseFloat(g.monto || 0), 0);
  const totalOtros = otros.reduce((s, g) => s + parseFloat(g.monto || 0), 0);

  const renderLista = (items) => {
    if (items.length === 0) return <p className="gastos-vacio">Sin gastos registrados hoy</p>;
    return (
      <ul className="gastos-lista">
        {items.map((g) => (
          <li key={g.id} className="gasto-item">
            <div className="gasto-item-info">
              <strong>${parseFloat(g.monto).toFixed(2)}</strong>
              {g.descripcion && <span className="gasto-item-descripcion">{g.descripcion}</span>}
              <span className="gasto-item-usuario">{g.creado_por?.nombre || "-"}</span>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="section">
      <div className="gastos-grid">
        <div className="form-card gastos-card">
          <h3>Gastos por Transporte</h3>
          <div className="gastos-total">
            <span>Total hoy:</span>
            <strong className="gastos-total-monto">${totalTransporte.toFixed(2)}</strong>
          </div>
          {renderLista(transporte)}
          <div className="gastos-agregar">
            <input
              type="number"
              min="0"
              step="0.01"
              value={montoTransporte}
              onChange={(e) => setMontoTransporte(e.target.value)}
              placeholder="Monto..."
              className="input-cantidad"
            />
            <button
              className="btn btn-sm btn-primary"
              disabled={guardando}
              onClick={handleGuardarTransporte}
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>

        <div className="form-card gastos-card">
          <h3>Otros Gastos</h3>
          <div className="gastos-total">
            <span>Total hoy:</span>
            <strong className="gastos-total-monto">${totalOtros.toFixed(2)}</strong>
          </div>
          {renderLista(otros)}
          <div className="gastos-agregar">
            <input
              type="number"
              min="0"
              step="0.01"
              value={montoOtro}
              onChange={(e) => setMontoOtro(e.target.value)}
              placeholder="Monto..."
              className="input-cantidad"
            />
            <button
              className="btn btn-sm btn-primary"
              disabled={guardando}
              onClick={handleGuardarOtro}
            >
              Guardar
            </button>
          </div>
        </div>
      </div>

      {gastoPendiente !== null && (
        <div className="modal-overlay" style={{ zIndex: 1001 }} onClick={() => { setGastoPendiente(null); setDescripcion(""); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Gasto por ${parseFloat(gastoPendiente).toFixed(2)}</h3>
            <p className="subtitle">Indique de que es este gasto</p>
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label>Motivo del gasto</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describa de que es el gasto..."
                rows={3}
                style={{ width: "100%", resize: "vertical" }}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => { setGastoPendiente(null); setDescripcion(""); }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={!descripcion.trim() || guardando}
                onClick={confirmarOtroGasto}
              >
                {guardando ? "Guardando..." : "Guardar Gasto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
