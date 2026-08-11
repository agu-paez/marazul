import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import NuevaSalida from "./pages/NuevaSalida";
import MisSalidas from "./pages/MisSalidas";
import HistorialCierres from "./pages/HistorialCierres";
import VentasPage from "./pages/VentasPage";
import HistorialVentasPage from "./pages/HistorialVentasPage";
import ClientesPage from "./pages/ClientesPage";
import HistorialPage from "./pages/HistorialPage";
import UsuariosPage from "./pages/UsuariosPage";
import ProveedoresPage from "./pages/ProveedoresPage";
import ProductosPage from "./pages/ProductosPage";
import EstadisticasPage from "./pages/EstadisticasPage";

function PrivateRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Cargando...</div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Cargando...</div>;
  return user ? <Navigate to="/" /> : children;
}

function AppRoutes() {
  const { user } = useAuth();
  const isRepartidor = user?.role === "repartidor";
  const isOperador = user?.role === "operador";
  const isAdmin = user?.role === "admin";

  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

      <Route path="/" element={
        <PrivateRoute>
          <div className="app">
            <Navbar />
            <main className="main-content">
              {isRepartidor || isOperador ? <MisSalidas /> : <Dashboard />}
            </main>
          </div>
        </PrivateRoute>
      } />

      <Route path="/salida/nueva" element={
        <PrivateRoute allowedRoles={["admin", "operador", "repartidor"]}>
          <div className="app">
            <Navbar />
            <main className="main-content"><NuevaSalida /></main>
          </div>
        </PrivateRoute>
      } />

      <Route path="/ventas" element={
        <PrivateRoute allowedRoles={["admin", "operador", "repartidor"]}>
          <div className="app">
            <Navbar />
            <main className="main-content"><VentasPage /></main>
          </div>
        </PrivateRoute>
      } />

      <Route path="/clientes" element={
        <PrivateRoute allowedRoles={["admin"]}>
          <div className="app">
            <Navbar />
            <main className="main-content"><ClientesPage /></main>
          </div>
        </PrivateRoute>
      } />

      <Route path="/historial" element={
        <PrivateRoute allowedRoles={["admin", "operador", "repartidor"]}>
          <div className="app">
            <Navbar />
            <main className="main-content"><HistorialPage /></main>
          </div>
        </PrivateRoute>
      } />

      <Route path="/historial-salidas" element={
        <PrivateRoute allowedRoles={["admin"]}>
          <div className="app">
            <Navbar />
            <main className="main-content"><HistorialPage /></main>
          </div>
        </PrivateRoute>
      } />

      <Route path="/historial-ventas" element={
        <PrivateRoute allowedRoles={["admin"]}>
          <div className="app">
            <Navbar />
            <main className="main-content"><HistorialPage /></main>
          </div>
        </PrivateRoute>
      } />

      <Route path="/historial-cierres" element={
        <PrivateRoute allowedRoles={["admin"]}>
          <div className="app">
            <Navbar />
            <main className="main-content"><HistorialCierres /></main>
          </div>
        </PrivateRoute>
      } />

      <Route path="/proveedores" element={
        <PrivateRoute allowedRoles={["admin"]}>
          <div className="app">
            <Navbar />
            <main className="main-content"><ProveedoresPage /></main>
          </div>
        </PrivateRoute>
      } />

      <Route path="/productos" element={
        <PrivateRoute allowedRoles={["admin"]}>
          <div className="app">
            <Navbar />
            <main className="main-content"><ProductosPage /></main>
          </div>
        </PrivateRoute>
      } />

      <Route path="/produccion" element={
        <PrivateRoute allowedRoles={["admin"]}>
          <div className="app">
            <Navbar />
            <main className="main-content"><EstadisticasPage /></main>
          </div>
        </PrivateRoute>
      } />

      <Route path="/produccion/historial" element={
        <PrivateRoute allowedRoles={["admin"]}>
          <Navigate to="/historial?tab=promedios" replace />
        </PrivateRoute>
      } />

      <Route path="/usuarios" element={
        <PrivateRoute>
          {isAdmin ? (
            <div className="app">
              <Navbar />
              <main className="main-content"><UsuariosPage /></main>
            </div>
          ) : (
            <Navigate to="/" />
          )}
        </PrivateRoute>
      } />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
