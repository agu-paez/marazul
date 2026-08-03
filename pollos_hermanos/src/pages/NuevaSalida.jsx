import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { salidasAPI, productosAPI, usuariosAPI } from "../api";

export default function NuevaSalida() {
  const { user } = useAuth();
  const [productos, setProductos] = useState([]);
  const [success, setSuccess] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [cantidades, setCantidades] = useState({});
  const [repartidores, setRepartidores] = useState([]);
  const [repartidorSeleccionado, setRepartidorSeleccionado] = useState("");
  const [form, setForm] = useState({
    camion: "",
    destino: "",
    notas: "",
  });
  const [loading, setLoading] = useState(false);

  const isRepartidor = user?.role === "repartidor";

  const cargarProductos = () => {
    productosAPI.getAll().then((res) => {
      setProductos(res.data);
      const init = {};
      res.data.forEach((p) => { init[p.id] = 0; });
      setCantidades(init);
    }).catch(console.error);
  };

  useEffect(() => {
    cargarProductos();

    if (!isRepartidor) {
      usuariosAPI.getRepartidores().then((res) => {
        setRepartidores(res.data);
      }).catch(console.error);
    }
  }, [isRepartidor]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const toggleCantidad = (productoId, delta) => {
    setCantidades((prev) => {
      const actual = prev[productoId] || 0;
      const nueva = Math.max(0, actual + delta);
      return { ...prev, [productoId]: nueva };
    });
  };

  const productosFiltrados = productos.filter((p) => {
    const termino = busqueda.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(termino) ||
      (p.codigo_barras && p.codigo_barras.toLowerCase().includes(termino))
    );
  });

  const productosSeleccionados = productos.filter((p) => (cantidades[p.id] || 0) > 0);

  const calcularTotal = () => {
    return productosSeleccionados.reduce((sum, p) => {
      return sum + p.precio * (cantidades[p.id] || 0);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (productosSeleccionados.length === 0) {
      alert("Debe seleccionar al menos un producto");
      return;
    }
    setLoading(true);
    try {
      const data = {
        camion: form.camion,
        destino: form.destino,
        notas: form.notas,
        asignadoRepartidorId: isRepartidor ? user.id : (repartidorSeleccionado || user.id),
        items: productosSeleccionados.map((p) => ({
          productoId: p.id,
          cantidad: cantidades[p.id],
        })),
      };
      await salidasAPI.create(data);
      setSuccess(true);
      setForm({ camion: "", destino: "", notas: "" });
      setRepartidorSeleccionado("");
      setCantidades((prev) => {
        const reset = {};
        Object.keys(prev).forEach((k) => { reset[k] = 0; });
        return reset;
      });
      setBusqueda("");
      cargarProductos();
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const totalCalculado = calcularTotal();

  return (
    <div>
      <h2>Registro de Salidas</h2>

      {success && <div className="success-msg">Salida registrada exitosamente!</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-card">
          <div className="form-row">
            <div className="form-group">
              <label>Camion (Placa/Numero) *</label>
              <input
                name="camion"
                value={form.camion}
                onChange={handleChange}
                placeholder="Ej: ABC-123"
                required
              />
            </div>
            <div className="form-group">
              <label>Zonas</label>
              <select
                name="destino"
                value={form.destino}
                onChange={handleChange}
                required
              >
                <option value="" disabled hidden>Seleccionar zona...</option>
                {Array.from({ length: 7 }, (_, i) => (
                  <option key={i + 1} value={`Zona ${i + 1}`}>Zona {i + 1}</option>
                ))}
                <option value="Zona Carlos Paz">Zona Carlos Paz</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notas</label>
            <input
              name="notas"
              value={form.notas}
              onChange={handleChange}
              placeholder="Observaciones"
            />
          </div>

          {!isRepartidor && !repartidorSeleccionado && (
            <div style={{
              background: "#fff3cd",
              border: "1px solid #ffc107",
              borderRadius: "6px",
              padding: "0.75rem 1rem",
              marginBottom: "0.75rem",
              color: "#856404",
              fontWeight: "600",
              fontSize: "0.9rem",
            }}>
              ⚠ Debe seleccionar un repartidor antes de registrar la salida.
            </div>
          )}

          {!isRepartidor && (
            <div className="form-group">
              <label>Repartidor Asignado *</label>
              <select
                value={repartidorSeleccionado}
                onChange={(e) => setRepartidorSeleccionado(e.target.value)}
                required={!isRepartidor}
              >
                <option value="">Seleccionar repartidor...</option>
                {repartidores.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="form-card">
          <h3>Mercaderia del Camion</h3>

          <div className="producto-search">
            <div className="search-with-clear">
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar producto..."
              />
              {busqueda && (
                <button type="button" className="search-clear" onClick={() => setBusqueda("")} aria-label="Borrar búsqueda">
                  X
                </button>
              )}
            </div>
          </div>

          {productosFiltrados.length === 0 ? (
            <p className="empty">No se encontraron productos</p>
          ) : (
            <div className="producto-grid">
              {productosFiltrados.map((p) => {
                const qty = cantidades[p.id] || 0;
                const seleccionado = qty > 0;
                return (
                  <div
                    key={p.id}
                    className={`producto-card ${seleccionado ? "selected" : ""}`}
                  >
                    <div className="producto-card-name">{p.nombre}</div>
                    <div className="producto-card-price">${p.precio}</div>
                    <div className={`producto-card-stock ${p.stock <= (p.stock_minimo || 10) ? "bajo" : ""}`}>
                      Stock: {p.stock}
                    </div>
                    <div className="producto-card-qty">
                      <button
                        type="button"
                        onClick={() => toggleCantidad(p.id, -1)}
                        disabled={qty === 0}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={p.stock}
                        value={qty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setCantidades((prev) => ({
                            ...prev,
                            [p.id]: Math.min(Math.max(0, val), p.stock),
                          }));
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleCantidad(p.id, 1)}
                        disabled={qty >= p.stock}
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

        <div className="form-card resumen-card">
          {productosSeleccionados.length > 0 && (
            <div style={{ marginBottom: "0.5rem" }}>
              {productosSeleccionados.map((p) => (
                <div key={p.id} className="resumen-row">
                  <span>{cantidades[p.id]}x {p.nombre}</span>
                  <strong>${(p.precio * cantidades[p.id]).toFixed(2)}</strong>
                </div>
              ))}
              <div className="cierre-separator"></div>
            </div>
          )}
          <div className="resumen-row">
            <span>Monto de Salida:</span>
            <strong className="monto-salida">${totalCalculado.toFixed(2)}</strong>
          </div>
          <div className="resumen-row resumen-total">
            <span>Total:</span>
            <strong>${totalCalculado.toFixed(2)}</strong>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={loading || productosSeleccionados.length === 0 || (!isRepartidor && !repartidorSeleccionado)}
        >
          {loading ? "Registrando..." : "Registrar Salida"}
        </button>
      </form>
    </div>
  );
}
