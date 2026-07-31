import { useState, useEffect } from "react";
import { proveedoresAPI, marcasAPI } from "../api";

export default function ProveedoresPage() {
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
  });
  const [saldosModal, setSaldosModal] = useState(null);
  const [saldosForm, setSaldosForm] = useState({ mercaderias_compradas: 0, dinero_ventas: 0 });

  useEffect(() => {
    loadProveedores();
  }, []);

  const loadProveedores = async () => {
    try {
      const res = await proveedoresAPI.getAll();
      setProveedores(res.data);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await proveedoresAPI.update(editing.id, form);
      } else {
        await proveedoresAPI.create(form);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ nombre: "", telefono: "", direccion: "", email: "", alias: "", tipo_producto: "" });
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
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este proveedor?")) return;
    try {
      await proveedoresAPI.delete(id);
      loadProveedores();
    } catch (error) {
      alert("Error al eliminar");
    }
  };

  const openSaldosModal = (proveedor) => {
    setSaldosModal(proveedor);
    setSaldosForm({
      mercaderias_compradas: proveedor.mercaderias_compradas || 0,
      dinero_ventas: proveedor.dinero_ventas || 0,
    });
  };

  const saveSaldos = async () => {
    if (!saldosModal) return;
    try {
      await proveedoresAPI.update(saldosModal.id, saldosForm);
      setSaldosModal(null);
      loadProveedores();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const descargarPDF = async () => {
    try {
      const response = await marcasAPI.descargarPDF();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "marcas_productos.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert("Error al descargar PDF: " + (error.response?.data?.message || error.message));
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Proveedores</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-secondary" onClick={descargarPDF}>
            Descargar PDF
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowForm(!showForm);
              setEditing(null);
              setForm({ nombre: "", telefono: "", direccion: "", email: "", alias: "", tipo_producto: "" });
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
          <button type="submit" className="btn btn-primary">
            {editing ? "Actualizar" : "Crear"}
          </button>
        </form>
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
                <span style={{ position: "absolute", left: "10px", top: "8px", fontWeight: "bold", color: "var(--danger)", zIndex: 1 }}>-</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={Math.abs(saldosForm.mercaderias_compradas)}
                  onChange={(e) => setSaldosForm({ ...saldosForm, mercaderias_compradas: -(parseFloat(e.target.value) || 0) })}
                  style={{ paddingLeft: "1.5rem" }}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Dinero por Ventas</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={saldosForm.dinero_ventas}
                onChange={(e) => setSaldosForm({ ...saldosForm, dinero_ventas: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label>Diferencias</label>
              <div style={{
                padding: "0.6rem 0.75rem", borderRadius: "6px",
                border: "1px solid var(--border)",
                fontWeight: "bold", fontSize: "1.1rem",
                color: (saldosForm.dinero_ventas + saldosForm.mercaderias_compradas) >= 0 ? "var(--success)" : "var(--danger)"
              }}>
                ${(saldosForm.dinero_ventas + saldosForm.mercaderias_compradas).toFixed(2)}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSaldosModal(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={saveSaldos}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Alias</th>
              <th>Diferencias</th>
              <th>Teléfono</th>
              <th>Dirección</th>
              <th>Email</th>
              <th>Tipo Producto</th>
              <th>Productos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map((p) => {
              const diferencia = (p.dinero_ventas || 0) + (p.mercaderias_compradas || 0);
              return (
                <tr key={p.id}>
                  <td><strong>{p.nombre}</strong></td>
                  <td>{p.alias || "-"}</td>
                  <td>
                    <strong style={{ color: diferencia >= 0 ? "var(--success)" : "var(--danger)" }}>
                      ${diferencia.toFixed(2)}
                    </strong>
                  </td>
                  <td>{p.telefono || "-"}</td>
                  <td>{p.direccion || "-"}</td>
                  <td>{p.email || "-"}</td>
                  <td>{p.tipo_producto || "-"}</td>
                  <td>{p.Productos?.length || 0}</td>
                  <td>
                    <button className="btn btn-sm btn-camino" onClick={() => handleEdit(p)}>
                      Editar
                    </button>
                    <button className="btn btn-sm btn-primary" onClick={() => openSaldosModal(p)}>
                      Saldos y Dif
                    </button>
                    <button className="btn btn-sm btn-cancel" onClick={() => handleDelete(p.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
