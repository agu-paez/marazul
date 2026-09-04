import { useState, useEffect } from "react";
import { productosAPI, marcasAPI } from "../api";
import { useAuth } from "../context/AuthContext";
import { descargarPDFBlob } from "../utils/generarPDF";

export default function ProductosPage() {
  const { user } = useAuth();
  const [productos, setProductos] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showAjuste, setShowAjuste] = useState(false);
  const [modoAjuste, setModoAjuste] = useState("aumento");
  const [porcentaje, setPorcentaje] = useState("");
  const [ajusteMarcaId, setAjusteMarcaId] = useState("");
  const [tipoDescuento, setTipoDescuento] = useState("producto");
  const [showListaPrecios, setShowListaPrecios] = useState(false);
  const [tipoPrecio, setTipoPrecio] = useState("normal");
  const [busqueda, setBusqueda] = useState("");
  const [productoStock, setProductoStock] = useState(null);
  const [cantidadDescontar, setCantidadDescontar] = useState("");
  const [motivoDescuento, setMotivoDescuento] = useState("mal estado");
  const [descontandoStock, setDescontandoStock] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    precio: "",
    costo: "",
    stock: "",
    unidad: "pieza",
    marcaId: "",
    codigo_barras: "",
    kg_por_caja: "",
    excluir_de_lista_pdf: false,
    descuento: "",
    descuento_mayorista: "",
    descuento_nuevo: "",
    permitir_modificar_precio: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [prodRes, marcasRes] = await Promise.all([
        productosAPI.getAll(),
        marcasAPI.getAll(),
      ]);
      setProductos(prodRes.data);
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
        costo: parseFloat(form.costo),
        descuento: form.descuento === "" ? 0 : parseFloat(form.descuento),
        descuento_mayorista: form.descuento_mayorista === "" ? 0 : parseFloat(form.descuento_mayorista),
        descuento_nuevo: form.descuento_nuevo === "" ? 0 : parseFloat(form.descuento_nuevo),
        stock: parseInt(form.stock) || 0,
        marcaId: form.marcaId ? parseInt(form.marcaId) : null,
        codigo_barras: form.codigo_barras.trim() || null,
        kg_por_caja: form.kg_por_caja === "" ? null : parseFloat(form.kg_por_caja),
        excluir_de_lista_pdf: form.excluir_de_lista_pdf,
      };
      if (editing) {
        await productosAPI.update(editing.id, data);
      } else {
        await productosAPI.create(data);
      }
      setShowForm(false);
      setEditing(null);
       setForm({ nombre: "", precio: "", costo: "", stock: "", unidad: "pieza", marcaId: "", codigo_barras: "", kg_por_caja: "", excluir_de_lista_pdf: false, descuento: "", descuento_mayorista: "", descuento_nuevo: "", permitir_modificar_precio: false });
      loadData();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    }
  };

  const handleEdit = (producto) => {
    setEditing(producto);
    setForm({
      nombre: producto.nombre,
      precio: producto.precio,
      costo: producto.costo ?? "",
      stock: producto.stock,
      unidad: producto.unidad || "pieza",
      marcaId: producto.Marca?.id || "",
      codigo_barras: producto.codigo_barras || "",
      kg_por_caja: producto.kg_por_caja ?? "",
      excluir_de_lista_pdf: Boolean(producto.excluir_de_lista_pdf),
      descuento: producto.descuento ?? "",
      descuento_mayorista: producto.descuento_mayorista ?? "",
      descuento_nuevo: producto.descuento_nuevo ?? "",
      permitir_modificar_precio: Boolean(producto.permitir_modificar_precio),
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await productosAPI.delete(id);
      loadData();
    } catch {
      alert("Error al eliminar");
    }
  };

  const handleDescontarStock = async (e) => {
    e.preventDefault();
    const cantidad = Number(cantidadDescontar);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      alert("Ingrese una cantidad entera mayor a cero");
      return;
    }

    setDescontandoStock(true);
    try {
      await productosAPI.descontarStock(productoStock.id, { cantidad, motivo: motivoDescuento });
      setProductoStock(null);
      setCantidadDescontar("");
      setMotivoDescuento("mal estado");
      loadData();
    } catch (error) {
      alert("Error: " + (error.response?.data?.message || error.message));
    } finally {
      setDescontandoStock(false);
    }
  };

  const descargarPDF = async () => {
    const nombresArchivo = {
      normal: "lista-normal.pdf",
      descuento: "lista-descuento-minimo.pdf",
      mayorista: "lista-mayorista.pdf",
      lista2: "lista-2-clientes-nuevos.pdf",
    };
    try {
      const response = await marcasAPI.descargarPDF({ tipo: tipoPrecio });
      descargarPDFBlob(new Blob([response.data]), nombresArchivo[tipoPrecio]);
      setShowListaPrecios(false);
      setTipoPrecio("normal");
    } catch (error) {
      alert("Error al descargar PDF: " + (error.response?.data?.message || error.message));
    }
  };

  const terminoBusqueda = busqueda.trim().toLowerCase();
  const productosFiltrados = productos.filter((producto) => (
    !terminoBusqueda
    || producto.nombre.toLowerCase().includes(terminoBusqueda)
    || String(producto.codigo_barras || "").toLowerCase().includes(terminoBusqueda)
    || String(producto.Marca?.nombre || "").toLowerCase().includes(terminoBusqueda)
  ));

  return (
    <div className="productos-page">
      <div className="page-header">
        <h2>Productos</h2>
          <div className="productos-header-actions">
          {user?.role === "admin" && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => { setModoAjuste("aumento"); setShowAjuste(true); }}
              >
                Aumentos
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => { setModoAjuste("descuento"); setShowAjuste(true); }}
              >
                Configurar descuentos
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={() => setShowListaPrecios(true)}>
            Descargar lista de precios
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowForm(!showForm);
              setEditing(null);
                 setForm({ nombre: "", precio: "", costo: "", stock: "", unidad: "pieza", marcaId: "", codigo_barras: "", kg_por_caja: "", excluir_de_lista_pdf: false, descuento: "", descuento_mayorista: "", descuento_nuevo: "", permitir_modificar_precio: false });
            }}
          >
            {showForm ? "Cancelar" : "+ Nuevo Producto"}
          </button>
        </div>
      </div>

      {showAjuste && (
        <div className="modal-overlay" onClick={() => setShowAjuste(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{modoAjuste === "descuento" ? "Descuento de Precios" : "Ajuste de Precios"}</h3>
            <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem" }}>
              Ingrese el porcentaje que desea {modoAjuste === "descuento" ? "descontar" : "aumentar o disminuir"} en los productos activos.
            </p>
            {modoAjuste === "descuento" && (
              <div className="form-group">
                <label>Tipo de descuento</label>
                <select value={tipoDescuento} onChange={(e) => setTipoDescuento(e.target.value)}>
                   <option value="producto">Descuento mínimo (normal)</option>
                   <option value="mayorista">Descuento mayorista</option>
                   <option value="nuevo">Descuento lista 2 (clientes nuevos)</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Aplicar a marca</label>
              <select value={ajusteMarcaId} onChange={(e) => setAjusteMarcaId(e.target.value)}>
                <option value="">Todas las marcas</option>
                {marcas.map((marca) => (
                  <option key={marca.id} value={marca.id}>{marca.nombre}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Porcentaje (%)</label>
              <input
                type="number"
                step="0.1"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                placeholder={modoAjuste === "descuento" ? "Ej: 10 para -10%" : "Ej: 10 para +10%, -10 para -10%"}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowAjuste(false); setPorcentaje(""); setAjusteMarcaId(""); }}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={porcentaje === "" || isNaN(parseFloat(porcentaje))}
                onClick={async () => {
                  try {
                    if (modoAjuste === "descuento") {
                      await productosAPI.actualizarDescuentos({
                        descuento: parseFloat(porcentaje),
                        tipo: tipoDescuento,
                        marcaId: ajusteMarcaId ? parseInt(ajusteMarcaId) : null,
                      });
                    } else {
                      await productosAPI.actualizarPrecios({
                        porcentaje: parseFloat(porcentaje),
                        marcaId: ajusteMarcaId ? parseInt(ajusteMarcaId) : null,
                      });
                    }
                     setShowAjuste(false);
                     setPorcentaje("");
                     setAjusteMarcaId("");
                     setTipoDescuento("producto");
                     loadData();
                  } catch (error) {
                    alert("Error: " + (error.response?.data?.message || error.message));
                  }
                }}
              >
                 {modoAjuste === "descuento" ? "Aplicar descuento" : "Aplicar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showListaPrecios && (
        <div className="modal-overlay" onClick={() => setShowListaPrecios(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Descargar lista de precios</h3>
            <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1rem" }}>
              Elija qué precio desea mostrar en la lista para clientes.
            </p>
            <div className="form-group">
              <label>Tipo de precio</label>
              <select value={tipoPrecio} onChange={(e) => setTipoPrecio(e.target.value)}>
                 <option value="normal">Lista normal</option>
                 <option value="descuento">Descuento mínimo (normal)</option>
                 <option value="mayorista">Descuento mayorista</option>
                 <option value="lista2">Lista 2 (clientes nuevos)</option>
               </select>
             </div>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                 onClick={() => { setShowListaPrecios(false); setTipoPrecio("normal"); }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={descargarPDF}
              >
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      {productoStock && (
        <div className="modal-overlay" onClick={() => setProductoStock(null)}>
          <form className="modal-card" onSubmit={handleDescontarStock} onClick={(e) => e.stopPropagation()}>
            <h3>Descontar stock</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              {productoStock.nombre} | Stock actual: <strong>{productoStock.stock}</strong>
            </p>
            <div className="form-group">
              <label>Cantidad a descontar</label>
              <input
                type="number"
                min="1"
                max={productoStock.stock}
                step="1"
                value={cantidadDescontar}
                onChange={(e) => setCantidadDescontar(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Motivo</label>
              <select value={motivoDescuento} onChange={(e) => setMotivoDescuento(e.target.value)}>
                <option value="mal estado">Mal estado</option>
                <option value="faltante">No está / faltante</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setProductoStock(null)}>Cancelar</button>
              <button type="submit" className="btn btn-cancel" disabled={descontandoStock}>
                {descontandoStock ? "Descontando..." : "Descontar stock"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay product-modal-overlay" onClick={() => setShowForm(false)}>
        <form onSubmit={handleSubmit} className="form-card modal-card modal-wide product-form-modal" onClick={(e) => e.stopPropagation()}>
          <h3>{editing ? "Editar Producto" : "Nuevo Producto"}</h3>
          <div className="form-group pdf-list-option">
            <label>
              <input
                type="checkbox"
                checked={form.excluir_de_lista_pdf}
                onChange={(e) => setForm({ ...form, excluir_de_lista_pdf: e.target.checked })}
              />
              Quitar de la lista PDF
            </label>
             <small>Si se marca, este producto no aparecerá en la lista de precios PDF.</small>
           </div>
           <div className="form-group pdf-list-option">
             <label>
               <input
                 type="checkbox"
                 checked={form.permitir_modificar_precio}
                 onChange={(e) => setForm({ ...form, permitir_modificar_precio: e.target.checked })}
               />
               Permitir modificar precio en ventas
             </label>
             <small>Mostrará el botón para modificar el precio de este producto al vender.</small>
           </div>
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
                value={Number(form.precio) ? form.precio : ""}
                onChange={(e) => setForm({ ...form, precio: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Costo ($) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={Number(form.costo) ? form.costo : ""}
                onChange={(e) => setForm({ ...form, costo: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
               <label>Descuento mínimo (normal) (%)</label>
                 <input type="number" min="0" max="99" step="0.1" value={form.descuento === "" ? "" : form.descuento} onChange={(e) => setForm({ ...form, descuento: e.target.value })} />
            </div>
            <div className="form-group">
               <label>Descuento mayorista (%)</label>
                 <input type="number" min="0" max="99" step="0.1" value={form.descuento_mayorista === "" ? "" : form.descuento_mayorista} onChange={(e) => setForm({ ...form, descuento_mayorista: e.target.value })} />
             </div>
             <div className="form-group">
                  <label>Descuento lista 2 (clientes nuevos) (%)</label>
                 <input type="number" min="0" max="99" step="0.1" value={form.descuento_nuevo === "" ? "" : form.descuento_nuevo} onChange={(e) => setForm({ ...form, descuento_nuevo: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Stock</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.stock === "" ? "" : form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Unidad</label>
              <select value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}>
                 <option value="pieza">Pieza</option>
                 <option value="cajon">Cajón</option>
                 <option value="caja">Caja</option>
                 <option value="kilogramo">Kilogramo</option>
                <option value="litro">Litro</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Kg por Caja</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={Number(form.kg_por_caja) ? form.kg_por_caja : ""}
                onChange={(e) => setForm({ ...form, kg_por_caja: e.target.value })}
                placeholder="Ej: 15"
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editing ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
        </div>
      )}

      <div className="producto-search">
        <label htmlFor="buscar-producto">Buscar producto o marca</label>
        <div className="search-with-clear">
          <input
            id="buscar-producto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, marca o código de barras..."
            aria-label="Buscar producto por nombre, marca o código de barras"
          />
          {busqueda && (
            <button type="button" className="search-clear" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda">
              X
            </button>
          )}
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código Barras</th>
              <th>Precio</th>
              <th>Costo</th>
              <th>Stock</th>
              <th>Unidad</th>
              <th>Marca</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productosFiltrados.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.nombre}</strong></td>
                <td>{p.codigo_barras || "-"}</td>
                <td>${p.precio}</td>
                <td>${Number(p.costo || 0).toFixed(2)}</td>
                <td>{p.stock}</td>
                <td>{p.unidad}</td>
                <td>{p.Marca?.nombre || "-"}</td>
                <td>
                   <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "0.35rem" }}>
                   {user?.role === "admin" && <button className="btn btn-sm btn-secondary" onClick={() => setProductoStock(p)}>
                     Descontar stock
                   </button>}
                   <button className="btn btn-sm btn-camino" onClick={() => handleEdit(p)}>
                     Editar
                   </button>
                   <button className="btn btn-sm btn-cancel" onClick={() => handleDelete(p.id)}>
                     Eliminar
                   </button>
                   </div>
                 </td>
              </tr>
            ))}
          </tbody>
        </table>
        {productosFiltrados.length === 0 && (
          <p className="empty">No se encontraron productos con esa búsqueda.</p>
        )}
      </div>
    </div>
  );
}
