import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import HistorialVentasPage from "./HistorialVentasPage";
import HistorialSalidas from "./HistorialSalidas";
import HistorialCierres from "./HistorialCierres";
import ProduccionHistorialPage from "./ProduccionHistorialPage";
import HistorialGastosPage from "./HistorialGastosPage";
import HistorialPagosEmpleadosPage from "./HistorialPagosEmpleadosPage";

export default function HistorialPage() {
  const { user } = useAuth();
  const isAdminOrOperador = user?.role === "admin" || user?.role === "operador";
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "ventas");

  const tabs = [
    { key: "ventas", label: "Historial de Ventas" },
  ];
  if (isAdminOrOperador) {
    tabs.push({ key: "salidas", label: "Historial de Salidas" });
    tabs.push({ key: "cierres", label: "Historial de Cierres de Caja" });
    tabs.push({ key: "gastos", label: "Historial de Gastos" });
    tabs.push({ key: "pagos-empleados", label: "Historial de Pagos" });
    tabs.push({ key: "promedios", label: "Historial de Promedios" });
  }

  return (
    <div>
      <h2>Historial</h2>

      <div className="tabs-container">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? "active" : ""}`}
            onClick={() => {
              setActiveTab(t.key);
              setSearchParams(t.key === "ventas" ? {} : { tab: t.key });
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === "ventas" && <HistorialVentasPage />}
        {activeTab === "salidas" && isAdminOrOperador && <HistorialSalidas />}
        {activeTab === "cierres" && isAdminOrOperador && <HistorialCierres />}
        {activeTab === "gastos" && isAdminOrOperador && <HistorialGastosPage />}
        {activeTab === "pagos-empleados" && isAdminOrOperador && <HistorialPagosEmpleadosPage />}
        {activeTab === "promedios" && isAdminOrOperador && <ProduccionHistorialPage />}
      </div>
    </div>
  );
}
