import { useState, useEffect } from "react";
import { productosAPI, proveedoresAPI, marcasAPI } from "../api";

export default function ProductosPage() {
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showAjuste, setShowAjuste] = useState(false);
  const [porcentaje, setPorcentaje] = useState("");
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    precio: "",
    stock: "",
    unidad: "pieza",
    marcaId: "",
    codigo_barras: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [prodRes, provRes, marcasRes] = await Promise.all([
        productosAPI.getAll(),
        proveedoresAPI.getAll(),
        marcasAPI.getAll(),
      ]);
      setProductos(prodRes.data);
      setProveedores(provRes.data);
      setMarcas(marcasRes.data);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        precio: parseFloat(form.precio),
        stock: parseInt(form.stock) || 0,
        marcaId: form.marcaId ? parseInt(form.marcaId) : null,
        codigo_barras: form.codigo_barras.trim() || null,
      };
      if (editing) {
        await productosAPI.update(editing.id, data);
      } else {
        await productosAPI.create(data);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ nombre: "", descripcion: "", precio: "", stock: "", unidad: "pieza", marcaId: "", codigo_barras: "" });
      loadData();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const handleEdit = (producto) => {
    setEditing(producto);
    setForm({
      nombre: producto.nombre,
      descripcion: producto.descripcion || "",
      precio: producto.precio,
      stock: producto.stock,
      unidad: producto.unidad || "pieza",
      marcaId: producto.Marca?.id || "",
      codigo_barras: producto.codigo_barras || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await productosAPI.delete(id);
      loadData();
    } catch (error) {
      alert("Error al eliminar");
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Productos</h2>
          <div className="productos-header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setShowAjuste(true)}
          >
            Aumentos
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowForm(!showForm);
              setEditing(null);
              setForm({ nombre: "", descripcion: "", precio: "", stock: "", unidad: "pieza", marcaId: "", codigo_barras: "" });
            }}
          >
            {showForm ? "Cancelar" : "+ Nuevo Producto"}
          </button>
        </div>
      </div>

      {showAjuste && (
        <div className="modal-overlay" onClick={() => setShowAjuste(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Ajuste de Precios</h3>
            <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem" }}>
              Ingrese un porcentaje para aumentar o disminuir el precio de todos los productos activos.
              Use valores negativos para disminuir (ej: -10).
            </p>
            <div className="form-group">
              <label>Porcentaje (%)</label>
              <input
                type="number"
                step="0.1"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                placeholder="Ej: 10 para +10%, -10 para -10%"
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowAjuste(false); setPorcentaje(""); }}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={porcentaje === "" || isNaN(parseFloat(porcentaje))}
                onClick={async () => {
                  try {
                    await productosAPI.actualizarPrecios({ porcentaje: parseFloat(porcentaje) });
                    setShowAjuste(false);
                    setPorcentaje("");
                    loadData();
                  } catch (error) {
                    alert("Error: " + (error.response?.data?.message || error.message));
                  }
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="form-card">
          <h3>{editing ? "Editar Producto" : "Nuevo Producto"}</h3>
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
              <label>Marca</label>
              <select
                value={form.marcaId}
                onChange={(e) => setForm({ ...form, marcaId: e.target.value })}
              >
                <option value="">Sin marca</option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre} ({m.Proveedor?.nombre || "Sin proveedor"})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <input
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Código de Barras</label>
            <input
              value={form.codigo_barras}
              onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })}
              placeholder="Ingrese el código de barras"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Precio ($) *</label>
              <input
                type="number"
                step="0.01"
                value={form.precio}
                onChange={(e) => setForm({ ...form, precio: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Stock</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Unidad</label>
              <select value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}>
                <option value="pieza">Pieza</option>
                <option value="kilogramo">Kilogramo</option>
                <option value="litro">Litro</option>
                <option value="caja">Caja</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            {editing ? "Actualizar" : "Crear"}
          </button>
        </form>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Código Barras</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Unidad</th>
              <th>Marca</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.nombre}</strong></td>
                <td>{p.descripcion || "-"}</td>
                <td>{p.codigo_barras || "-"}</td>
                <td>${p.precio}</td>
                <td>{p.stock}</td>
                <td>{p.unidad}</td>
                <td>{p.Marca?.nombre || "-"}</td>
                <td>
                  <button className="btn btn-sm btn-camino" onClick={() => handleEdit(p)}>
                    Editar
                  </button>
                  <button className="btn btn-sm btn-cancel" onClick={() => handleDelete(p.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
