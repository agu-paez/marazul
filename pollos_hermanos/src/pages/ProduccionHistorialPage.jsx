import { useEffect, useState } from "react";
import { produccionAPI } from "../api";

export default function ProduccionHistorialPage() {
  const [meses, setMeses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState("");

  useEffect(() => {
    produccionAPI.getHistorial()
      .then((res) => setMeses(res.data.meses || []))
      .catch((error) => console.error("Error al cargar historial de producción:", error))
      .finally(() => setLoading(false));
  }, []);

  const descargarPDF = async (mes) => {
    setDescargando(mes);
    try {
      const response = await produccionAPI.descargarHistorialPDF(mes);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `produccion-${mes}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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
          <p className="text-muted">Cada PDF incluye los tres cuadros del mes.</p>
        </div>
      </div>

      {meses.length === 0 ? (
        <div className="produccion-card empty">Todavía no hay meses registrados.</div>
      ) : (
        <div className="produccion-history-grid">
          {meses.map(({ mes, etiqueta, registros, promedioDiario, promedioSemanal }) => (
            <article className="produccion-history-card" key={mes}>
              <div>
                <h3>{etiqueta}</h3>
                <p>{registros.length} registros · {promedioDiario.length} días cargados</p>
                <small>{promedioSemanal.length ? "Promedio semanal disponible" : "Sin promedio semanal"}</small>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => descargarPDF(mes)}
                disabled={descargando === mes}
              >
                {descargando === mes ? "Generando..." : "Descargar PDF"}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
