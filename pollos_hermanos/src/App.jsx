import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NuevaSalida = lazy(() => import("./pages/NuevaSalida"));
const MisSalidas = lazy(() => import("./pages/MisSalidas"));
const HistorialCierres = lazy(() => import("./pages/HistorialCierres"));
const VentasPage = lazy(() => import("./pages/VentasPage"));
const ClientesPage = lazy(() => import("./pages/ClientesPage"));
const HistorialPage = lazy(() => import("./pages/HistorialPage"));
const UsuariosPage = lazy(() => import("./pages/UsuariosPage"));
const ProveedoresPage = lazy(() => import("./pages/ProveedoresPage"));
const ProductosPage = lazy(() => import("./pages/ProductosPage"));
const EstadisticasPage = lazy(() => import("./pages/EstadisticasPage"));

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
    <Suspense fallback={<div className="loading">Cargando módulo...</div>}>
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

      <Route path="/historial-deudas" element={
        <PrivateRoute allowedRoles={["admin", "operador", "repartidor"]}>
          <Navigate to="/historial?tab=deudas" replace />
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
    </Suspense>
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
