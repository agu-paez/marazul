import { Descuento, Producto, ProductoDescuento, Marca } from "../models/index.js";

const porcentajeValido = (valor) => Number.isFinite(Number(valor)) && Number(valor) >= 0 && Number(valor) <= 99;

export const listarDescuentos = async (req, res) => {
  try {
    res.json(await Descuento.findAll({ where: { activo: true }, order: [["nombre", "ASC"]] }));
  } catch (error) {
    res.status(500).json({ message: "Error al obtener descuentos", error: error.message });
  }
};

export const crearDescuento = async (req, res) => {
  try {
    const nombre = String(req.body.nombre || "").trim();
    if (!nombre) return res.status(400).json({ message: "El nombre del descuento es requerido" });
    const existente = await Descuento.findOne({ where: { nombre } });
    if (existente) return res.status(409).json({ message: "Ya existe un descuento con ese nombre" });
    const descuento = await Descuento.create({ nombre });
    res.status(201).json({ message: "Descuento creado", descuento });
  } catch (error) {
    res.status(500).json({ message: "Error al crear descuento", error: error.message });
  }
};

export const aplicarDescuento = async (req, res) => {
  try {
    const descuento = await Descuento.findOne({ where: { id: req.params.id, activo: true } });
    if (!descuento) return res.status(404).json({ message: "Descuento no encontrado" });
    const porcentaje = Number(req.body.porcentaje);
    if (!porcentajeValido(porcentaje)) return res.status(400).json({ message: "El descuento debe estar entre 0% y 99%" });
    const where = { activo: true };
    if (req.body.marcaId !== undefined && req.body.marcaId !== null && req.body.marcaId !== "") {
      const marca = await Marca.findByPk(req.body.marcaId);
      if (!marca) return res.status(400).json({ message: "La marca seleccionada no existe" });
      where.marcaId = marca.id;
    }
    const productos = await Producto.findAll({ where, attributes: ["id"] });
    await Promise.all(productos.map((producto) => ProductoDescuento.upsert({ productoId: producto.id, descuentoId: descuento.id, porcentaje })));
    res.json({ message: `Descuento configurado en ${productos.length} productos`, cantidad: productos.length });
  } catch (error) {
    res.status(500).json({ message: "Error al configurar descuento", error: error.message });
  }
};
