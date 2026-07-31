import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path ? "nav-link active" : "nav-link";

  const isAdmin = user?.role === "admin";
  const isRepartidor = user?.role === "repartidor";

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <img src="/logo-marazul.jpeg" alt="Mar Azul" className="nav-logo" />
        <span>Mar Azul</span>
      </div>
      <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
        <span className={`hamburger-line ${menuOpen ? "open" : ""}`}></span>
        <span className={`hamburger-line ${menuOpen ? "open" : ""}`}></span>
        <span className={`hamburger-line ${menuOpen ? "open" : ""}`}></span>
      </button>
      <div className={`nav-links ${menuOpen ? "nav-links-open" : ""}`}>
        {isRepartidor ? (
          <>
            <Link to="/" className={isActive("/")}>Dashboard</Link>
            <Link to="/salida/nueva" className={isActive("/salida/nueva")}>Registro Salidas</Link>
            <Link to="/ventas" className={isActive("/ventas")}>Ventas</Link>
            <Link to="/historial" className={isActive("/historial")}>Historial</Link>
          </>
        ) : (
          <>
            <Link to="/" className={isActive("/")}>Dashboard</Link>
            <Link to="/salida/nueva" className={isActive("/salida/nueva")}>Registro Salidas</Link>
            <Link to="/ventas" className={isActive("/ventas")}>Ventas</Link>
            <Link to="/clientes" className={isActive("/clientes")}>Clientes</Link>
            <Link to="/historial" className={isActive("/historial")}>Historial</Link>
            <Link to="/proveedores" className={isActive("/proveedores")}>Proveedores</Link>
            <Link to="/productos" className={isActive("/productos")}>Productos</Link>
            {isAdmin && (
              <Link to="/usuarios" className={isActive("/usuarios")}>Usuarios</Link>
            )}
          </>
        )}
        <div className="nav-links-footer">
          <span className="user-info-mobile">{user?.nombre} <span className="role-badge">{user?.role}</span></span>
          <button className="btn btn-sm btn-logout btn-logout-mobile" onClick={handleLogout}>Salir</button>
        </div>
      </div>
      <div className="nav-user">
        <span className="user-info">
          {user?.nombre} <span className="role-badge">{user?.role}</span>
        </span>
        <button className="btn btn-sm btn-logout" onClick={handleLogout}>
          Salir
        </button>
      </div>
    </nav>
  );
}
