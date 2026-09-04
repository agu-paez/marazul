import { useState, useEffect } from "react";
import { proveedoresAPI, marcasAPI } from "../api";
import { useAuth } from "../context/AuthContext";

export default function ProveedoresPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [proveedores, setProveedores] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    telefono: "",
    direccion: "",
    email: "",
    alias: "",
    tipo_producto: "",
    marcaNombre: "",
  });
  const [marcasNuevas, setMarcasNuevas] = useState([]);
  const [saldosModal, setSaldosModal] = useState(null);
  const [marcaAEliminar, setMarcaAEliminar] = useState(null);
  const [saldosForm, setSaldosForm] = useState({ mercaderias_compradas: 0, dinero_ventas: 0 });

  useEffect(() => {
    loadProveedores();
  }, []);

  const loadProveedores = async () => {
    try {
      const res = await proveedoresAPI.getAll({ incluirInactivos: true });
      setProveedores(res.data);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let proveedorGuardado;
      if (editing) {
        const res = await proveedoresAPI.update(editing.id, form);
        proveedorGuardado = res.data.proveedor;
      } else {
        const res = await proveedoresAPI.create(form);
        proveedorGuardado = res.data.proveedor;
      }

      const marcasParaCrear = [...marcasNuevas, form.marcaNombre.trim()]
        .filter(Boolean)
        .filter((nombre, index, marcas) => marcas.indexOf(nombre) === index);
      for (const nombre of marcasParaCrear) {
        await marcasAPI.create({ nombre, proveedorId: proveedorGuardado.id });
      }
      setShowForm(false);
      setEditing(null);
      setForm({ nombre: "", telefono: "", direccion: "", email: "", alias: "", tipo_producto: "", marcaNombre: "" });
      setMarcasNuevas([]);
      loadProveedores();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const handleEdit = (proveedor) => {
    setEditing(proveedor);
    setForm({
      nombre: proveedor.nombre,
      telefono: proveedor.telefono || "",
      direccion: proveedor.direccion || "",
      email: proveedor.email || "",
      alias: proveedor.alias || "",
      tipo_producto: proveedor.tipo_producto || "",
      marcaNombre: "",
    });
    setMarcasNuevas([]);
    setShowForm(true);
  };

  const agregarMarca = () => {
    const nombre = form.marcaNombre.trim();
    if (!nombre || marcasNuevas.includes(nombre)) return;
    setMarcasNuevas([...marcasNuevas, nombre]);
    setForm({ ...form, marcaNombre: "" });
  };

  const eliminarMarca = async (marca) => {
    setMarcaAEliminar(marca);
  };

  const confirmarEliminarMarca = async () => {
    if (!marcaAEliminar) return;
    try {
      await marcasAPI.delete(marcaAEliminar.id);
      setEditing({ ...editing, Marcas: editing.Marcas.filter((item) => item.id !== marcaAEliminar.id) });
      setMarcaAEliminar(null);
      loadProveedores();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const handleToggleEstado = async (proveedor) => {
    const accion = proveedor.activo ? "desactivar" : "activar";
    if (!confirm(`¿Desea ${accion} este proveedor?`)) return;
    try {
      await proveedoresAPI.cambiarEstado(proveedor.id);
      loadProveedores();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar definitivamente este proveedor? Esta acción no se puede deshacer.")) return;
    try {
      await proveedoresAPI.delete(id);
      loadProveedores();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const openSaldosModal = (proveedor) => {
    setSaldosModal(proveedor);
    setSaldosForm({
      mercaderias_compradas: Math.abs(proveedor.mercaderias_compradas || 0),
      dinero_ventas: proveedor.dinero_ventas || 0,
    });
  };

  const saveSaldos = async () => {
    if (!saldosModal) return;
    try {
      await proveedoresAPI.registrarMovimiento(saldosModal.id, {
        mercaderias_compradas: Math.abs(parseFloat(saldosForm.mercaderias_compradas) || 0),
        dinero_ventas: parseFloat(saldosForm.dinero_ventas) || 0,
        transferencias_historial: parseFloat(saldosModal.transferencias_historial) || 0,
      });
      setSaldosModal(null);
      loadProveedores();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  return (
    <div className="proveedores-page">
      <div className="page-header">
        <h2>Proveedores</h2>
        <div className="proveedores-header-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowForm(!showForm);
               setEditing(null);
               setForm({ nombre: "", telefono: "", direccion: "", email: "", alias: "", tipo_producto: "", marcaNombre: "" });
               setMarcasNuevas([]);
            }}
          >
            {showForm ? "Cancelar" : "+ Nuevo Proveedor"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="form-card">
          <h3>{editing ? "Editar Proveedor" : "Nuevo Proveedor"}</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Nombre *</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Dirección</label>
            <input
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Alias de Transferencia</label>
              <input
                value={form.alias}
                onChange={(e) => setForm({ ...form, alias: e.target.value })}
                placeholder="Ej: marazul@mp"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Tipo de Producto</label>
              <input
                value={form.tipo_producto}
                onChange={(e) => setForm({ ...form, tipo_producto: e.target.value })}
                placeholder="Ej: pollos, bebidas"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Agregar marcas</label>
            <div className="proveedores-marcas-input">
              <input
                value={form.marcaNombre}
                onChange={(e) => setForm({ ...form, marcaNombre: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarMarca(); } }}
                placeholder="Nombre de la marca"
              />
              <button type="button" className="btn btn-secondary" onClick={agregarMarca}>+ Agregar</button>
            </div>
            {marcasNuevas.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
                {marcasNuevas.map((marca) => (
                  <span key={marca} style={{ padding: "0.3rem 0.55rem", borderRadius: "999px", background: "var(--bg-input)", border: "1px solid var(--border)" }}>
                    {marca}
                    <button type="button" onClick={() => setMarcasNuevas(marcasNuevas.filter((item) => item !== marca))} style={{ border: 0, background: "transparent", color: "var(--text-muted)", cursor: "pointer", marginLeft: "0.3rem" }}>X</button>
                  </span>
                ))}
              </div>
            )}
            {editing?.Marcas?.length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                <small style={{ display: "block", color: "var(--text-muted)", marginBottom: "0.35rem" }}>Marcas actuales:</small>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {editing.Marcas.map((marca) => (
                    <span key={marca.id} style={{ padding: "0.3rem 0.55rem", borderRadius: "999px", background: "var(--bg-input)", border: "1px solid var(--border)" }}>
                      {marca.nombre}
                      {isAdmin && (
                        <button type="button" onClick={() => eliminarMarca(marca)} style={{ border: 0, background: "transparent", color: "var(--danger)", cursor: "pointer", marginLeft: "0.3rem" }}>X</button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button type="submit" className="btn btn-primary">
            {editing ? "Actualizar" : "Crear"}
          </button>
        </form>
      )}

      {marcaAEliminar && (
        <div className="modal-overlay" onClick={() => setMarcaAEliminar(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Eliminar marca</h3>
            {marcaAEliminar.Productos?.length > 0 ? (
              <div style={{ color: "#991b1b", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "6px", padding: "0.85rem", marginBottom: "1rem" }}>
                <strong>Advertencia:</strong> la marca "{marcaAEliminar.nombre}" tiene {marcaAEliminar.Productos.length} producto(s) asociado(s).
                Al eliminarla, los productos se conservarán, pero quedarán sin marca.
              </div>
            ) : (
              <p style={{ marginBottom: "1rem" }}>¿Está seguro de eliminar la marca "{marcaAEliminar.nombre}"?</p>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setMarcaAEliminar(null)}>Cancelar</button>
              <button className="btn btn-cancel" onClick={confirmarEliminarMarca}>Eliminar marca</button>
            </div>
          </div>
        </div>
      )}

      {saldosModal && (
        <div className="modal-overlay" onClick={() => setSaldosModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "rgba(59, 130, 246, 0.15)", display: "flex",
                alignItems: "center", justifyContent: "center", margin: "0 auto 1rem"
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <h3 style={{ marginBottom: "0.5rem" }}>Saldos y Diferencias</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                {saldosModal.nombre}
              </p>
            </div>
            <div className="form-group">
              <label>Mercaderias Compradas</label>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={saldosForm.mercaderias_compradas || ""}
                  onChange={(e) => setSaldosForm({ ...saldosForm, mercaderias_compradas: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Dinero por Ventas</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={saldosForm.dinero_ventas || ""}
                onChange={(e) => setSaldosForm({ ...saldosForm, dinero_ventas: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label>Diferencias</label>
              <div style={{
                padding: "0.6rem 0.75rem", borderRadius: "6px",
                border: "1px solid var(--border)",
                fontWeight: "bold", fontSize: "1.1rem",
                 color: (saldosForm.dinero_ventas - saldosForm.mercaderias_compradas) >= 0 ? "var(--success)" : "var(--danger)"
               }}>
                ${(saldosForm.dinero_ventas - saldosForm.mercaderias_compradas + (saldosModal.diferencia_acumulada || 0) + (saldosModal.transferencias_historial || 0)).toFixed(2)}
              </div>
            </div>
            <div className="form-group">
              <label>Transferencias del historial</label>
              <div style={{ padding: "0.6rem 0.75rem", borderRadius: "6px", border: "1px solid var(--border)" }}>
                ${(saldosModal.transferencias_historial || 0).toFixed(2)}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSaldosModal(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={saveSaldos}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      <div className="table-container proveedores-table-container">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
               <th>Alias</th>
               <th>Marcas</th>
               <th>Diferencias</th>
              <th>Teléfono</th>
               <th>Tipo Producto</th>
               <th>Productos</th>
               <th>Acciones</th>
               <th>Dirección</th>
               <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map((p) => {
              const diferencia = (p.dinero_ventas || 0) - Math.abs(p.mercaderias_compradas || 0) + (p.diferencia_acumulada || 0) + (p.transferencias_historial || 0);
              return (
                <tr key={p.id} className={!p.activo ? "proveedor-inactivo" : ""}>
                  <td data-label="Nombre"><strong>{p.nombre}</strong></td>
                  <td data-label="Alias">{p.alias || "-"}</td>
                   <td data-label="Marcas">{p.activo ? (p.Marcas?.map((marca) => marca.nombre).join(", ") || "-") : "-"}</td>
                  <td data-label="Diferencias">
                    <strong style={{ color: diferencia >= 0 ? "var(--success)" : "var(--danger)" }}>
                      ${diferencia.toFixed(2)}
                    </strong>
                  </td>
                  <td data-label="Teléfono">{p.telefono || "-"}</td>
                  <td data-label="Tipo Producto">{p.tipo_producto || "-"}</td>
                    <td data-label="Productos">{p.activo ? (p.Marcas?.reduce((total, marca) => total + (marca.Productos?.length || 0), 0) || 0) : 0}</td>
                  <td data-label="Acciones" className="proveedores-actions">
                    <button className="btn btn-sm btn-camino" onClick={() => handleEdit(p)}>
                      Editar
                    </button>
                    <button className="btn btn-sm btn-primary" onClick={() => openSaldosModal(p)}>
                      Saldos y Dif
                    </button>
                     <button className="btn btn-sm btn-cancel" onClick={() => handleToggleEstado(p)}>
                       {p.activo ? "Desactivar" : "Activar"}
                     </button>
                     <button className="btn btn-sm btn-cancel" onClick={() => handleDelete(p.id)}>
                       Eliminar
                    </button>
                  </td>
                  <td data-label="Dirección">{p.direccion || "-"}</td>
                  <td data-label="Email">{p.email || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
