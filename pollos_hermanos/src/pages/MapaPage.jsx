import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { dispositivosAPI } from "../api";
import { useAuth } from "../context/AuthContext";

const COLORES = ["#e11d48", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

const CENTRO_DEFAULT = [-34.6037, -58.3816];
const TIEMPO_INTERVALO = 15000;
const OFFLINE_MS = 2 * 60 * 1000;

const crearIcono = (color, inicial) =>
  L.divIcon({
    className: "mapa-ubicacion-marker",
    html: `<div class="mapa-pin" style="background:${color}"><span>${inicial}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
  });

function AjustarVista({ ubicaciones }) {
  const map = useMap();
  const ajustado = useRef(false);
  const puntos = useMemo(
    () => ubicaciones
      .filter((u) => u.latitud != null && u.longitud != null)
      .map((u) => [Number(u.latitud), Number(u.longitud)]),
    [ubicaciones]
  );

  useEffect(() => {
    if (ajustado.current || !puntos.length) return;
    ajustado.current = true;
    map.fitBounds(L.latLngBounds(puntos), { padding: [50, 50], maxZoom: 15 });
  }, [puntos, map]);

  return null;
}

function formatearHora(fecha) {
  if (!fecha) return "-";
  return new Date(fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatearFechaHora(fecha) {
  if (!fecha) return "-";
  const d = new Date(fecha);
  return `${d.toLocaleDateString("es-AR")} ${formatearHora(fecha)}`;
}

export default function MapaPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [dispositivos, setDispositivos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // Gestión (solo admin)
  const [modo, setModo] = useState(null);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "" });
  const [nuevoToken, setNuevoToken] = useState("");

  const cargar = useCallback(async () => {
    try {
      const res = await dispositivosAPI.getAll({ _: Date.now() });
      setDispositivos(res.data);
      setError("");
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, TIEMPO_INTERVALO);
    return () => clearInterval(id);
  }, [cargar]);

  const calcularEstado = useCallback((d) => {
    const ultima = d.ultima_conexion ? new Date(d.ultima_conexion).getTime() : 0;
    if (!d.activo) return { texto: "Inactivo", clase: "mapa-estado-inactivo" };
    if (!ultima) return { texto: "Sin señal", clase: "mapa-estado-offline" };
    if (Date.now() - ultima > OFFLINE_MS) {
      return { texto: "Sin señal", clase: "mapa-estado-offline" };
    }
    return { texto: "En línea", clase: "mapa-estado-enlinea" };
  }, []);

  const conUbicacion = useMemo(
    () => dispositivos.filter((d) => d.latitud != null && d.longitud != null),
    [dispositivos]
  );

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ nombre: "", descripcion: "" });
    setModo("form");
  };

  const abrirEdicion = (d) => {
    setEditando(d);
    setForm({ nombre: d.nombre, descripcion: d.descripcion || "" });
    setModo("form");
  };

  const guardar = async (e) => {
    e.preventDefault();
    try {
      if (editando) {
        await dispositivosAPI.update(editando.id, form);
      } else {
        const res = await dispositivosAPI.create(form);
        setNuevoToken(res.data.dispositivo.token);
      }
      setModo(editando ? null : "token");
      setEditando(null);
      cargar();
    } catch (err) {
      alert("Error: " + (err.response?.data?.message || err.message));
    }
  };

  const regenerarToken = async (d) => {
    if (!confirm(`¿Generar un nuevo token para "${d.nombre}"?\nLa app de esa tablet dejará de enviar señal hasta que cargues el token nuevo.`)) return;
    try {
      const res = await dispositivosAPI.regenerarToken(d.id);
      setNuevoToken(res.data.dispositivo.token);
      cargar();
    } catch (err) {
      alert("Error: " + (err.response?.data?.message || err.message));
    }
  };

  const cambiarActivo = async (d) => {
    try {
      await dispositivosAPI.update(d.id, { activo: !d.activo });
      cargar();
    } catch (err) {
      alert("Error: " + (err.response?.data?.message || err.message));
    }
  };

  const eliminar = async (d) => {
    if (!confirm(`¿Eliminar la tablet "${d.nombre}"?`)) return;
    try {
      await dispositivosAPI.delete(d.id);
      cargar();
    } catch (err) {
      alert("Error: " + (err.response?.data?.message || err.message));
    }
  };

  if (cargando) return <div className="loading">Cargando mapa...</div>;

  return (
    <div className="mapa-page">
      <div className="page-header">
        <h2>Mapa de Tablets</h2>
        {isAdmin && (
          <button className="btn btn-primary" onClick={abrirNuevo}>+ Registrar Tablet</button>
        )}
      </div>

      {error && <div className="mapa-error">{error}</div>}

      <div className="mapa-grid">
        <div className="mapa-contenedor">
          <MapContainer
            center={CENTRO_DEFAULT}
            zoom={6}
            className="mapa-leaflet"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {conUbicacion.map((d, i) => {
              const color = COLORES[i % COLORES.length];
              return (
                <Marker
                  key={d.id}
                  position={[Number(d.latitud), Number(d.longitud)]}
                  icon={crearIcono(color, d.nombre.charAt(0).toUpperCase())}
                >
                  <Popup>
                    <strong>{d.nombre}</strong>
                    {d.descripcion && <div>{d.descripcion}</div>}
                    <div>Última señal: {formatearFechaHora(d.ultima_conexion)}</div>
                    {d.velocidad != null && <div>Velocidad: {(Number(d.velocidad) * 3.6).toFixed(1)} km/h</div>}
                    {d.bateria != null && <div>Batería: {d.bateria}%</div>}
                  </Popup>
                </Marker>
              );
            })}
            <AjustarVista ubicaciones={conUbicacion} />
          </MapContainer>
        </div>

        <div className="mapa-panel">
          <h3>Tablets registradas ({dispositivos.length})</h3>
          {!dispositivos.length && <p className="mapa-sin-datos">Aún no hay tablets registradas.</p>}
          <div className="mapa-lista">
            {dispositivos.map((d, i) => {
              const estado = calcularEstado(d);
              const color = COLORES[i % COLORES.length];
              return (
                <div key={d.id} className={`mapa-tarjeta ${!d.activo ? "mapa-tarjeta-inactiva" : ""}`}>
                  <div className="mapa-tarjeta-cabeza">
                    <span className="mapa-pin mapa-pin-chico" style={{ background: color }}>
                      {d.nombre.charAt(0).toUpperCase()}
                    </span>
                    <div className="mapa-tarjeta-nombre">
                      <strong>{d.nombre}</strong>
                      {d.descripcion && <span className="mapa-tarjeta-desc">{d.descripcion}</span>}
                    </div>
                    <span className={`mapa-estado ${estado.clase}`}>{estado.texto}</span>
                  </div>
                  <div className="mapa-tarjeta-datos">
                    <span>Señal: {formatearHora(d.ultima_conexion)}</span>
                    {d.bateria != null && <span>Batería: {d.bateria}%</span>}
                    {d.velocidad != null && <span>{(Number(d.velocidad) * 3.6).toFixed(0)} km/h</span>}
                    {d.precision != null && <span>±{Math.round(Number(d.precision))} m</span>}
                  </div>
                  {isAdmin && (
                    <div className="mapa-tarjeta-acciones">
                      <button className="btn btn-sm btn-secondary" onClick={() => abrirEdicion(d)}>Editar</button>
                      <button className="btn btn-sm" onClick={() => regenerarToken(d)}>Nuevo token</button>
                      <button
                        className="btn btn-sm"
                        style={{ background: d.activo ? "#f59e0b" : "#10b981", color: "white" }}
                        onClick={() => cambiarActivo(d)}
                      >
                        {d.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button className="btn btn-sm btn-cancel" onClick={() => eliminar(d)}>Eliminar</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {(modo === "form") && (
        <div className="modal-overlay" onClick={isAdmin ? () => { setModo(null); setNuevoToken(""); } : undefined}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{editando ? "Editar Tablet" : "Registrar Nueva Tablet"}</h3>
            <form onSubmit={guardar}>
              <div className="form-group">
                <label>Nombre *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Tablet Camión 1"
                  required
                />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <input
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Ej: Patente ABC-123, repartidor Santiago"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModo(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editando ? "Guardar" : "Crear"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modo === "token" && nuevoToken && (
        <div className="modal-overlay" onClick={() => { setModo(null); setNuevoToken(""); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Token de la tablet</h3>
            <p>Copiá este token y cargalo en la app Android de la tablet.</p>
            <div className="mapa-token">
              <code>{nuevoToken}</code>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => navigator.clipboard.writeText(nuevoToken)}
              >
                Copiar
              </button>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => { setModo(null); setNuevoToken(""); }}>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}