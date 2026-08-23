import { Producto, Marca, Proveedor } from "../models/index.js";
import { Op, literal } from "sequelize";

const getActiveMarcaIds = async () => {
  const marcas = await Marca.findAll({
    attributes: ["id"],
    include: [{ model: Proveedor, attributes: [], where: { activo: true } }],
  });
  return marcas.map((marca) => marca.id);
};

export const getAllProductos = async (req, res) => {
  try {
    const activeMarcaIds = await getActiveMarcaIds();
    const productos = await Producto.findAll({
      include: [{ 
        model: Marca,
        attributes: ["id", "nombre"],
        required: false,
        include: [{ model: Proveedor, attributes: ["id", "nombre"], where: { activo: true } }]
      }],
      where: {
        activo: true,
        [Op.or]: [{ marcaId: null }, { marcaId: { [Op.in]: activeMarcaIds } }],
      },
    });
    res.json(productos);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener productos", error: error.message });
  }
};

export const getLowStock = async (req, res) => {
  try {
    const activeMarcaIds = await getActiveMarcaIds();
    const productos = await Producto.findAll({
      include: [{ 
        model: Marca, 
        attributes: ["id", "nombre"],
        include: [{ model: Proveedor, attributes: ["id", "nombre"], where: { activo: true } }]
      }],
      where: {
        activo: true,
        [Op.or]: [{ marcaId: null }, { marcaId: { [Op.in]: activeMarcaIds } }],
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
    const { nombre, descripcion, precio, descuento, descuento_mayorista, costo, stock, unidad, marcaId, codigo_barras, kg_por_caja, excluir_de_lista_pdf, permitir_modificar_precio } = req.body;

    if (!nombre || nombre.trim() === "" || !Number.isFinite(Number(precio)) || !Number.isFinite(Number(costo)) || Number(costo) < 0) {
      return res.status(400).json({ message: "Nombre, precio y costo valido son requeridos" });
    }

    const marca = marcaId ? await Marca.findByPk(marcaId) : null;
    if (marcaId && !marca) {
      return res.status(400).json({ message: "La marca seleccionada no existe" });
    }

    const producto = await Producto.create({
      nombre: nombre.trim(),
      descripcion,
      precio: Number(precio),
      descuento: Number.isFinite(Number(descuento)) && Number(descuento) >= 0 && Number(descuento) < 100 ? Number(descuento) : 0,
      descuento_mayorista: Number.isFinite(Number(descuento_mayorista)) && Number(descuento_mayorista) >= 0 && Number(descuento_mayorista) < 100 ? Number(descuento_mayorista) : 0,
      costo: Number(costo),
      stock: Number.isFinite(Number(stock)) ? Number(stock) : 0,
      unidad,
      marcaId: marca ? marca.id : null,
      codigo_barras: codigo_barras?.trim() || null,
      kg_por_caja: Number.isFinite(Number(kg_por_caja)) ? Number(kg_por_caja) : null,
      excluir_de_lista_pdf: Boolean(excluir_de_lista_pdf),
      permitir_modificar_precio: Boolean(permitir_modificar_precio),
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
    if (data.costo !== undefined && (!Number.isFinite(Number(data.costo)) || Number(data.costo) < 0)) {
      return res.status(400).json({ message: "El costo no es valido" });
    }
    if (data.descuento !== undefined && (!Number.isFinite(Number(data.descuento)) || Number(data.descuento) < 0 || Number(data.descuento) >= 100)) {
      return res.status(400).json({ message: "El descuento debe estar entre 0% y 99%" });
    }
    if (data.descuento_mayorista !== undefined && (!Number.isFinite(Number(data.descuento_mayorista)) || Number(data.descuento_mayorista) < 0 || Number(data.descuento_mayorista) >= 100)) {
      return res.status(400).json({ message: "El descuento mayorista debe estar entre 0% y 99%" });
    }
    delete data.unidades_por_caja;
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

    if (porcentaje === undefined || porcentaje === null || isNaN(porcentaje) || Number(porcentaje) <= -100) {
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
      const totalCentavos = Math.round(Number(producto.precio) * factor * 100);
      const pesos = Math.floor(totalCentavos / 100);
      const centavos = totalCentavos % 100;
      const nuevoPrecio = centavos === 5
        ? pesos + 0.05
        : centavos > 50
        ? pesos + 1
        : centavos < 50
        ? pesos
        : pesos + 0.5;
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

export const actualizarDescuentos = async (req, res) => {
  try {
    const { descuento, marcaId, tipo = "producto" } = req.body;
    const campo = tipo === "mayorista" ? "descuento_mayorista" : "descuento";
    const porcentaje = Number(descuento);
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje >= 100) {
      return res.status(400).json({ message: "El descuento debe estar entre 0% y 99%" });
    }
    const where = { activo: true };
    if (marcaId !== undefined && marcaId !== null && marcaId !== "") where.marcaId = Number(marcaId);
    const [actualizados] = await Producto.update({ [campo]: porcentaje }, { where });
    res.json({ message: `Descuento configurado en ${actualizados} productos`, cantidad: actualizados });
  } catch (error) {
    res.status(500).json({ message: "Error al configurar descuentos", error: error.message });
  }
};

export const descontarStock = async (req, res) => {
  try {
    const { cantidad, motivo } = req.body;
    const cantidadDescontar = Number(cantidad);

    if (!Number.isInteger(cantidadDescontar) || cantidadDescontar <= 0) {
      return res.status(400).json({ message: "La cantidad a descontar debe ser un entero mayor a cero" });
    }
    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ message: "Debe indicar el motivo del descuento" });
    }

    const producto = await Producto.findByPk(req.params.id);
    if (!producto || !producto.activo) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    if (cantidadDescontar > producto.stock) {
      return res.status(400).json({
        message: `No se pueden descontar ${cantidadDescontar} unidades: el stock disponible es ${producto.stock}`,
      });
    }

    await producto.update({ stock: producto.stock - cantidadDescontar });
    res.json({
      message: `Se descontaron ${cantidadDescontar} unidades por ${motivo.trim()}`,
      producto,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al descontar stock", error: error.message });
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
