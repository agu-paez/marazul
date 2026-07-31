import { Marca, Proveedor, Producto } from "../models/index.js";
import PDFDocument from "pdfkit";

export const getMarcas = async (req, res) => {
  try {
    const marcas = await Marca.findAll({
      include: [{ model: Proveedor, attributes: ["id", "nombre"] }],
      order: [["nombre", "ASC"]],
    });
    res.json(marcas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener marcas", error: error.message });
  }
};

export const getMarcasByProveedor = async (req, res) => {
  try {
    const marcas = await Marca.findAll({
      where: { proveedorId: req.params.proveedorId },
      include: [{ model: Producto }],
      order: [["nombre", "ASC"]],
    });
    res.json(marcas);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener marcas", error: error.message });
  }
};

export const getMarcaById = async (req, res) => {
  try {
    const marca = await Marca.findByPk(req.params.id, {
      include: [
        { model: Proveedor, attributes: ["id", "nombre"] },
        { model: Producto },
      ],
    });
    if (!marca) {
      return res.status(404).json({ message: "Marca no encontrada" });
    }
    res.json(marca);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener marca", error: error.message });
  }
};

export const createMarca = async (req, res) => {
  try {
    const { nombre, descripcion, proveedorId } = req.body;

    if (!nombre || !proveedorId) {
      return res.status(400).json({ message: "Nombre y proveedor son requeridos" });
    }

    const proveedor = await Proveedor.findByPk(proveedorId);
    if (!proveedor) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }

    const marca = await Marca.create({
      nombre,
      descripcion,
      proveedorId,
    });

    const marcaCompleta = await Marca.findByPk(marca.id, {
      include: [{ model: Proveedor, attributes: ["id", "nombre"] }],
    });

    res.status(201).json({ message: "Marca creada", marca: marcaCompleta });
  } catch (error) {
    res.status(500).json({ message: "Error al crear marca", error: error.message });
  }
};

export const updateMarca = async (req, res) => {
  try {
    const marca = await Marca.findByPk(req.params.id);
    if (!marca) {
      return res.status(404).json({ message: "Marca no encontrada" });
    }

    const { nombre, descripcion, proveedorId, activo } = req.body;
    
    if (proveedorId) {
      const proveedor = await Proveedor.findByPk(proveedorId);
      if (!proveedor) {
        return res.status(404).json({ message: "Proveedor no encontrado" });
      }
    }

    await marca.update({
      nombre: nombre || marca.nombre,
      descripcion: descripcion !== undefined ? descripcion : marca.descripcion,
      proveedorId: proveedorId || marca.proveedorId,
      activo: activo !== undefined ? activo : marca.activo,
    });

    const marcaActualizada = await Marca.findByPk(marca.id, {
      include: [{ model: Proveedor, attributes: ["id", "nombre"] }],
    });

    res.json({ message: "Marca actualizada", marca: marcaActualizada });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar marca", error: error.message });
  }
};

export const deleteMarca = async (req, res) => {
  try {
    const marca = await Marca.findByPk(req.params.id);
    if (!marca) {
      return res.status(404).json({ message: "Marca no encontrada" });
    }

    const productos = await Producto.findAll({ where: { marcaId: req.params.id } });
    if (productos.length > 0) {
      return res.status(400).json({ 
        message: "No se puede eliminar la marca porque tiene productos asociados" 
      });
    }

    await marca.destroy();
    res.json({ message: "Marca eliminada" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar marca", error: error.message });
  }
};

export const generarPDFMarcasProductos = async (req, res) => {
  try {
    const marcas = await Marca.findAll({
      include: [
        { 
          model: Proveedor, 
          attributes: ["id", "nombre"] 
        },
        { 
          model: Producto,
          where: { activo: true },
          required: false,
          attributes: ["id", "nombre", "descripcion", "precio", "stock", "unidad"]
        }
      ],
      where: { activo: true },
      order: [["nombre", "ASC"]],
    });

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="marcas_productos.pdf"');
    doc.pipe(res);

    doc.fontSize(20).font("Helvetica-Bold").text("Marcas y Productos", { align: "center" });
    doc.moveDown(1.5);

    if (marcas.length === 0) {
      doc.fontSize(12).text("No hay marcas registradas", { align: "center" });
      doc.end();
      return;
    }

    marcas.forEach((marca) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      doc.fontSize(14).font("Helvetica-Bold").fillColor("#2563eb")
        .text(marca.nombre.toUpperCase(), { underline: true });
      doc.moveDown(0.3);
      
      if (marca.Proveedor) {
        doc.fontSize(10).font("Helvetica").fillColor("#666")
          .text(`Proveedor: ${marca.Proveedor.nombre}`);
        doc.moveDown(0.5);
      }

      if (marca.Productos && marca.Productos.length > 0) {
        const tableTop = doc.y;
        const colWidths = { nombre: 200, descripcion: 150, precio: 80, stock: 70, unidad: 80 };
        const startX = 50;
        
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#fff");
        doc.rect(startX, tableTop, 580, 20).fill("#3b82f6");
        
        let x = startX;
        doc.fillColor("#fff")
          .text("Producto", x + 5, tableTop + 5, { width: colWidths.nombre - 10, align: "left" });
        x += colWidths.nombre;
        doc.text("Descripción", x + 5, tableTop + 5, { width: colWidths.descripcion - 10, align: "left" });
        x += colWidths.descripcion;
        doc.text("Precio", x + 5, tableTop + 5, { width: colWidths.precio - 10, align: "right" });
        x += colWidths.precio;
        doc.text("Stock", x + 5, tableTop + 5, { width: colWidths.stock - 10, align: "right" });
        x += colWidths.stock;
        doc.text("Unidad", x + 5, tableTop + 5, { width: colWidths.unidad - 10, align: "center" });

        doc.font("Helvetica").fillColor("#000");
        let rowY = tableTop + 20;

        marca.Productos.forEach((producto) => {
          if (doc.y > 750) {
            doc.addPage();
            rowY = doc.y;
          }

          const rowHeight = 25;
          const bgColor = marca.Productos.indexOf(producto) % 2 === 0 ? "#f9fafb" : "#ffffff";
          doc.rect(startX, rowY, 580, rowHeight).fill(bgColor);

          x = startX;
          doc.fillColor("#000")
            .text(producto.nombre, x + 5, rowY + 7, { width: colWidths.nombre - 10, align: "left" });
          x += colWidths.nombre;
          doc.text(producto.descripcion || "-", x + 5, rowY + 7, { width: colWidths.descripcion - 10, align: "left" });
          x += colWidths.descripcion;
          doc.text(`$${parseFloat(producto.precio).toFixed(2)}`, x + 5, rowY + 7, { width: colWidths.precio - 10, align: "right" });
          x += colWidths.precio;
          doc.text(producto.stock.toString(), x + 5, rowY + 7, { width: colWidths.stock - 10, align: "right" });
          x += colWidths.stock;
          doc.text(producto.unidad, x + 5, rowY + 7, { width: colWidths.unidad - 10, align: "center" });

          rowY += rowHeight;
        });

        doc.y = rowY + 10;
      } else {
        doc.fontSize(10).font("Helvetica-Oblique").fillColor("#999")
          .text("Sin productos registrados");
        doc.moveDown(0.5);
      }

      doc.moveDown(1);
    });

    doc.end();
  } catch (error) {
    console.error("Error al generar PDF:", error);
    res.status(500).json({ message: "Error al generar PDF", error: error.message });
  }
};
