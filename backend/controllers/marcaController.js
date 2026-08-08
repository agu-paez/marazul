import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Marca, Proveedor, Producto } from "../models/index.js";
import PDFDocument from "pdfkit";
import logger from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.resolve(__dirname, "../../pollos_hermanos/public/logo-marazul.jpeg");

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

    const productosDesvinculados = await Producto.update(
      { marcaId: null },
      { where: { marcaId: req.params.id } }
    );

    await marca.destroy();
    res.json({ message: "Marca eliminada", productosDesvinculados: productosDesvinculados[0] });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar marca", error: error.message });
  }
};

export const generarPDFMarcasProductos = async (req, res) => {
  try {
    const descuento = Number(req.query.descuento || 0);
    if (!Number.isFinite(descuento) || descuento < 0 || descuento >= 100) {
      return res.status(400).json({ message: "El descuento debe estar entre 0% y 99%" });
    }

    const marcas = (await Marca.findAll({
      include: [
        { 
          model: Producto,
          where: { activo: true },
          required: false,
          attributes: ["id", "nombre", "descripcion", "precio", "stock", "unidad", "kg_por_caja"]
        }
      ],
      where: { activo: true },
      order: [["nombre", "ASC"]],
    })).filter((m) => (m.Productos || []).length > 0);

    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${descuento > 0 ? "lista-clientes-nuevos" : "lista-precios"}.pdf"`
    );
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const startX = 50;
    const tableWidth = pageWidth - 100;
    const headerH = 60;
    const contentTop = 88;
    const limitY = pageHeight - 95;

    const NAVY_DARK = "#0d1b33";
    const NAVY = "#14284b";
    const ACCENT = "#c9a227";
    const TEXT = "#1f2937";
    const MUTED = "#64748b";
    const ROW_ALT = "#f6f8fb";
    const BORDER = "#e3e8ef";
    const TABLE_HEAD_BG = "#e9eef5";
    const MARCA_BAND_BG = "#d9f2e6";
    const MARCA_TEXT = "#087f5b";
    const logoOk = fs.existsSync(LOGO_PATH);

    const colWidths = [200, 65, 115, 115];
    const headers = ["Producto", "Kg/Caja", "Precio/Kg", "Precio Caja"];
    const colAlign = (i) => (i === 1 ? "center" : i === 2 || i === 3 ? "right" : "left");

    const drawHeader = () => {
      doc.rect(0, 0, pageWidth, headerH).fill(NAVY_DARK);
      if (logoOk) {
        doc.image(LOGO_PATH, 40, 10, { width: 44, height: 44 });
      }
      doc.fillColor(ACCENT).fontSize(20).font("Helvetica-Bold")
        .text("MAR AZUL", 96, 14, { lineBreak: false });
      doc.fillColor("#9fb0c9").fontSize(8).font("Helvetica")
        .text("Sistema de Gestion de Repartos", 96, 39, { lineBreak: false });
      doc.rect(0, headerH, pageWidth, 3).fill(ACCENT);
      doc.fillColor(NAVY).fontSize(11).font("Helvetica-Bold")
         .text(
           "Lista de precios",
           startX,
           72,
           { align: "left" }
         );
    };

    const drawFooter = () => {
      doc.fontSize(7).font("Helvetica").fillColor("#94a3b8")
        .text(
          "Documento generado automaticamente por el Sistema de Gestion Mar Azul",
          pageWidth / 2,
          pageHeight - 60,
          { align: "center" }
        );
    };

    const drawTableHead = (top) => {
      doc.rect(startX, top, tableWidth, 20).fill(TABLE_HEAD_BG);
      doc.rect(startX, top + 19, tableWidth, 1).fill(BORDER);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(NAVY);
      let hx = startX;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], hx + 10, top + 5, { width: colWidths[i] - 20, align: colAlign(i) });
        hx += colWidths[i];
      }
    };

    const newPage = () => {
      doc.addPage();
      drawHeader();
      drawFooter();
      doc.y = contentTop;
    };

    drawHeader();
    drawFooter();
    doc.y = contentTop;

    if (marcas.length === 0) {
      doc.fontSize(12).font("Helvetica").fillColor(TEXT)
        .text("No hay marcas con productos registrados", { align: "center" });
      doc.end();
      return;
    }

    const rowHeight = 26;
    const marcaBandH = 22;
    const marcaGap = 4;
    const tableHeadGap = 4;
    const marcaSpacing = 8;

    const fmtNumero = (valor) => {
      if (valor === null || valor === undefined || valor === "") return "-";
      const n = Number(valor);
      return Number.isFinite(n) ? n.toFixed(2) : "-";
    };
    const fmtPrecio = (valor) => {
      if (valor === null || valor === undefined || valor === "") return "-";
      const n = Number(valor);
      return Number.isFinite(n) ? `$${n.toFixed(2)}` : "-";
    };

    const precioConDescuento = (producto) => Number(producto.precio) * (1 - descuento / 100);
    const precioPorKg = (producto) => {
      const precio = precioConDescuento(producto);
      const kg = Number(producto.kg_por_caja);
      if (Number.isFinite(precio) && precio > 0 && Number.isFinite(kg) && kg > 0) {
        return precio / kg;
      }
      return null;
    };

    const precioCaja = (producto) => {
      const kg = Number(producto.kg_por_caja);
      const pkg = precioPorKg(producto);
      if (pkg !== null && Number.isFinite(kg) && kg > 0) {
        return pkg * kg;
      }
      return null;
    };

    const drawMarcaBand = (nombre, top) => {
      doc.rect(startX, top, tableWidth, marcaBandH).fill(MARCA_BAND_BG);
      doc.rect(startX, top, tableWidth, marcaBandH).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.fontSize(10).font("Helvetica-Bold").fillColor(MARCA_TEXT)
        .text(`Marca: ${String(nombre || "Sin nombre")}`, startX + 10, top + marcaBandH / 2 - 5, { width: tableWidth - 20, align: "left" });
    };

    for (const marca of marcas) {
      const productos = marca.Productos || [];
      const bloqueH = marcaBandH + marcaGap + 20 + tableHeadGap + productos.length * rowHeight + marcaSpacing;
      if (doc.y + bloqueH > limitY && bloqueH <= limitY - contentTop) {
        newPage();
      }

      let rowY = doc.y;

      if (rowY + marcaBandH + marcaGap + 20 + tableHeadGap + rowHeight + 6 > limitY) {
        newPage();
        rowY = contentTop;
      }

      drawMarcaBand(String(marca.nombre || "Sin nombre"), rowY);
      rowY += marcaBandH + marcaGap;

      drawTableHead(rowY);
      rowY += 20 + tableHeadGap;

      productos.forEach((producto, idx) => {
        if (rowY + rowHeight + 6 > limitY) {
          newPage();
          rowY = contentTop;
          drawTableHead(rowY);
          rowY += 20 + tableHeadGap;
        }

        const bgColor = idx % 2 === 0 ? ROW_ALT : "#ffffff";
        doc.rect(startX, rowY, tableWidth, rowHeight).fill(bgColor);
        doc.rect(startX, rowY, tableWidth, rowHeight).strokeColor(BORDER).lineWidth(0.5).stroke();

        const pkg = precioPorKg(producto);
        const pcaja = precioCaja(producto);
        const cells = [
          String(producto.nombre || "Sin nombre"),
          fmtNumero(producto.kg_por_caja),
          fmtPrecio(pkg),
          fmtPrecio(pcaja),
        ];

        doc.fontSize(9).font("Helvetica").fillColor(TEXT);
        let cx = startX;
        for (let j = 0; j < cells.length; j++) {
          doc.text(cells[j], cx + 10, rowY + 8, { width: colWidths[j] - 20, align: colAlign(j) });
          cx += colWidths[j];
        }

        rowY += rowHeight;
      });

      doc.y = rowY + marcaSpacing;
    }

    doc.end();
  } catch (error) {
    logger.error("Error al generar PDF", {
      error: error.message,
      parent: error.parent?.message,
      original: error.original?.message,
      sql: error.sql,
      stack: error.stack,
    });
    if (!res.headersSent) {
      res.status(500).json({ message: "Error al generar PDF", error: error.message });
    } else {
      res.destroy(error);
    }
  }
};
