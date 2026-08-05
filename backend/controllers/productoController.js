import { Producto, Marca, Proveedor } from "../models/index.js";
import { Op, literal } from "sequelize";

export const getAllProductos = async (req, res) => {
  try {
    const productos = await Producto.findAll({
      include: [{ 
        model: Marca, 
        attributes: ["id", "nombre"],
        include: [{ model: Proveedor, attributes: ["id", "nombre"] }]
      }],
      where: { activo: true },
    });
    res.json(productos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener productos", error: error.message });
  }
};

export const getLowStock = async (req, res) => {
  try {
    const productos = await Producto.findAll({
      include: [{ 
        model: Marca, 
        attributes: ["id", "nombre"],
        include: [{ model: Proveedor, attributes: ["id", "nombre"] }]
      }],
      where: {
        activo: true,
        stock: { [Op.lte]: literal("stock_minimo") },
      },
    });
    res.json(productos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener productos con bajo stock", error: error.message });
  }
};

export const createProducto = async (req, res) => {
  try {
    const { nombre, descripcion, precio, stock, unidad, marcaId, codigo_barras, kg_por_caja } = req.body;

    if (!nombre || nombre.trim() === "" || !Number.isFinite(Number(precio))) {
      return res.status(400).json({ message: "Nombre y precio son requeridos" });
    }

    const marca = marcaId ? await Marca.findByPk(marcaId) : null;
    if (marcaId && !marca) {
      return res.status(400).json({ message: "La marca seleccionada no existe" });
    }

    const producto = await Producto.create({
      nombre: nombre.trim(),
      descripcion,
      precio: Number(precio),
      stock: Number.isFinite(Number(stock)) ? Number(stock) : 0,
      unidad,
      marcaId: marca ? marca.id : null,
      codigo_barras: codigo_barras?.trim() || null,
      kg_por_caja: Number.isFinite(Number(kg_por_caja)) ? Number(kg_por_caja) : null,
    });

    res.status(201).json({ message: "Producto creado", producto });
  } catch (error) {
    res.status(500).json({ message: "Error al crear producto", error: error.message });
  }
};

export const updateProducto = async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const data = { ...req.body };
    if (data.marcaId !== undefined) {
      const marca = data.marcaId ? await Marca.findByPk(data.marcaId) : null;
      if (data.marcaId && !marca) {
        return res.status(400).json({ message: "La marca seleccionada no existe" });
      }
      data.marcaId = marca ? marca.id : null;
    }
    if (data.codigo_barras !== undefined) {
      data.codigo_barras = data.codigo_barras?.trim() || null;
    }

    await producto.update(data);
    res.json({ message: "Producto actualizado", producto });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar producto", error: error.message });
  }
};

export const actualizarPreciosPorcentaje = async (req, res) => {
  try {
    const { porcentaje, marcaId } = req.body;

    if (porcentaje === undefined || porcentaje === null || isNaN(porcentaje)) {
      return res.status(400).json({ message: "Debe enviar un porcentaje válido" });
    }

    const where = { activo: true };
    if (marcaId !== undefined && marcaId !== null && marcaId !== "") {
      const marca = await Marca.findByPk(marcaId);
      if (!marca) {
        return res.status(400).json({ message: "La marca seleccionada no existe" });
      }
      where.marcaId = marca.id;
    }

    const factor = 1 + porcentaje / 100;
    const productos = await Producto.findAll({ where });
    let actualizados = 0;

    for (const producto of productos) {
      const nuevoPrecio = Math.round(producto.precio * factor * 100) / 100;
      if (nuevoPrecio > 0) {
        await producto.update({ precio: nuevoPrecio });
        actualizados++;
      }
    }

    res.json({ message: `Precios actualizados: ${actualizados} productos`, cantidad: actualizados });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar precios", error: error.message });
  }
};

export const deleteProducto = async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    await producto.update({ activo: false });
    res.json({ message: "Producto desactivado" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar producto", error: error.message });
  }
};
