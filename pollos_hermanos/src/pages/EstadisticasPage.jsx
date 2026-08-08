import { useState } from "react";
import ProduccionPage from "./ProduccionPage";
import IngresosEgresosPage from "./IngresosEgresosPage";

export default function EstadisticasPage() {
  const [activeTab, setActiveTab] = useState("produccion");

  return (
    <div>
      <div className="tabs-container statistics-tabs">
        <button className={`tab-btn ${activeTab === "produccion" ? "active" : ""}`} onClick={() => setActiveTab("produccion")}>Estadísticas de Producción</button>
        <button className={`tab-btn ${activeTab === "finanzas" ? "active" : ""}`} onClick={() => setActiveTab("finanzas")}>Ingreso / Egreso</button>
      </div>
      {activeTab === "produccion" ? <ProduccionPage /> : <IngresosEgresosPage />}
    </div>
  );
}
