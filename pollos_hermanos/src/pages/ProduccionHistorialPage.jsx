import { useEffect, useState } from "react";
import { produccionAPI } from "../api";
import { descargarPDFBlob } from "../utils/generarPDF";

export default function ProduccionHistorialPage() {
  const [semanas, setSemanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState("");

  useEffect(() => {
    produccionAPI.getHistorial()
      .then((res) => setSemanas(res.data.semanas || []))
      .catch((error) => console.error("Error al cargar historial de producción:", error))
      .finally(() => setLoading(false));
  }, []);

  const descargarPDF = async (semana) => {
    setDescargando(semana);
    try {
      const response = await produccionAPI.descargarHistorialPDF(semana);
      descargarPDFBlob(response.data, `produccion-${semana}.pdf`);
    } catch (error) {
      alert(error.response?.data?.message || "No se pudo generar el PDF");
    } finally {
      setDescargando("");
    }
  };

  if (loading) return <div className="loading">Cargando historial...</div>;

  return (
    <div className="produccion-page">
      <div className="page-header produccion-history-header">
        <div>
          <h2>Historial de Producción</h2>
          <p className="text-muted">Cada PDF incluye los tres cuadros de la semana.</p>
        </div>
      </div>

      {semanas.length === 0 ? (
        <div className="produccion-card empty">Todavía no hay semanas registradas.</div>
      ) : (
        <div className="produccion-history-grid">
          {semanas.map(({ semana, etiqueta, registros, promedioDiario, promedioSemanal }) => (
            <article className="produccion-history-card" key={semana}>
              <div>
                <h3>{etiqueta}</h3>
                <p>{registros.length} registros · {promedioDiario.length} días cargados</p>
                <small>{promedioSemanal.length ? "Promedio semanal disponible" : "Sin promedio semanal"}</small>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => descargarPDF(semana)}
                disabled={descargando === semana}
              >
                {descargando === semana ? "Generando..." : "Descargar PDF"}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
