import jsPDF from "jspdf";

const cargarLogo = () => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg"));
    };
    img.onerror = () => resolve(null);
    img.src = "/logo-marazul.jpeg";
  });
};

export const generarComprobantePDF = async (venta) => {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 15, mr = 15;
  const cw = pw - ml - mr;

  const medioLabel = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta", cuenta_corriente: "Cuenta Corriente", otro: "Otro" };

  const parseDatos = (datos) => {
    if (!datos) return [];
    if (typeof datos === "string") { try { return JSON.parse(datos); } catch { return []; } }
    if (Array.isArray(datos)) return datos;
    return [];
  };

  const buildPagos = () => {
    const rows = [];
    for (const d of parseDatos(venta.datos_transferencia)) {
      rows.push({ metodo: "Transferencia", banco: d.banco || "-", titular: d.nombre_cuenta || "-", monto: parseFloat(d.monto || 0) });
    }
    for (const d of parseDatos(venta.datos_tarjeta)) {
      rows.push({ metodo: "Tarjeta", banco: d.banco || "-", titular: d.nombre_cuenta || "-", monto: parseFloat(d.monto || 0) });
    }
    if (venta.pago_dividido && venta.VentaPagos) {
      for (const p of venta.VentaPagos) {
        if (p.medio_pago !== "transferencia" && p.medio_pago !== "tarjeta") {
          rows.push({ metodo: medioLabel[p.medio_pago] || p.medio_pago, banco: "-", titular: "-", monto: parseFloat(p.monto || 0) });
        }
      }
    } else if (venta.medio_pago !== "transferencia" && venta.medio_pago !== "tarjeta") {
      rows.push({ metodo: medioLabel[venta.medio_pago] || venta.medio_pago, banco: "-", titular: "-", monto: parseFloat(venta.total || 0) });
    }
    return rows;
  };

  const pagos = buildPagos();
  const items = venta.VentaItems || [];
  const hasDeuda = venta.monto_deuda_pagado && parseFloat(venta.monto_deuda_pagado) > 0;
  const saldoRestante = hasDeuda ? (venta.cliente?.saldo_pendiente ? parseFloat(venta.cliente.saldo_pendiente) : 0) : 0;

  const rowH = 7;
  const tableHeaderH = 8;
  const padH = 3;

  // ---- HEADER ----
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pw, 38, "F");
  
  const logo = await cargarLogo();
  if (logo) {
    doc.addImage(logo, "JPEG", ml, 4, 30, 30);
  }
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(217, 119, 6);
  doc.text("MAR AZUL", ml + 35, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Sistema de Gestion de Repartos", ml + 35, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(226, 232, 240);
  doc.text(venta.numero_comprobante, pw - mr, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 185, 195);
  doc.text(`${venta.fecha}  ${venta.hora}`, pw - mr, 22, { align: "right" });

  let y = 48;

  // ---- CLIENTE / VENTA BOX (dynamic height) ----
  const clienteLines = 2 + (venta.cliente_direccion ? 1 : 0) + (venta.cliente_telefono ? 1 : 0);
  const ventaBoxH = Math.max(28, 10 + clienteLines * 6);

  doc.setFillColor(248, 249, 252);
  doc.rect(ml, y - 4, cw, ventaBoxH, "F");
  doc.setDrawColor(220, 222, 228);
  doc.setLineWidth(0.3);
  doc.rect(ml, y - 4, cw, ventaBoxH, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 110);
  doc.text("CLIENTE", ml, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 60);
  doc.text(venta.cliente?.nombre || venta.cliente_nombre || "-", ml, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 130);
  let cy = y + 14;
  if (venta.cliente_direccion) { doc.text(`Dir: ${venta.cliente_direccion}`, ml, cy); cy += 5.5; }
  if (venta.cliente_telefono) { doc.text(`Tel: ${venta.cliente_telefono}`, ml, cy); cy += 5.5; }

  const colRight = pw / 2 + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 110);
  doc.text("VENTA", colRight, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 60);
  doc.text(venta.tipo_venta === "local" ? "Venta Mayorista" : "Venta por Reparto", colRight, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 130);
  let vy = y + 14;
  doc.text(`Vendedor: ${venta.vendedor?.nombre || "-"}`, colRight, vy); vy += 5.5;
  doc.text(`Pago: ${venta.pago_dividido ? "Dividido" : (medioLabel[venta.medio_pago] || venta.medio_pago)}`, colRight, vy);

  y += ventaBoxH + 4;

  // ---- NOTAS / OBSERVACIONES ----
  if (venta.notas) {
    const notaLines = doc.splitTextToSize(venta.notas, cw - 8);
    const notaBoxH = Math.max(18, 10 + notaLines.length * 5);
    doc.setFillColor(254, 249, 237);
    doc.rect(ml, y - 2, cw, notaBoxH, "F");
    doc.setDrawColor(240, 210, 140);
    doc.setLineWidth(0.3);
    doc.rect(ml, y - 2, cw, notaBoxH, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(180, 130, 20);
    doc.text("OBSERVACIONES", ml + 4, y + 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 80, 30);
    doc.text(notaLines, ml + 4, y + 10);
    y += notaBoxH + 4;
  }

  // ---- PAGOS TABLE ----
  if (pagos.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 110);
    doc.text("PAGOS", ml, y);
    y += 7;
    const pCols = [46, 44, cw - 46 - 44 - 38, 38];
    const pHead = ["Metodo", "Banco", "Titular", "Monto"];

    doc.setFillColor(230, 232, 240);
    doc.rect(ml, y, cw, tableHeaderH, "F");
    doc.setDrawColor(190, 192, 200);
    doc.setLineWidth(0.3);
    doc.rect(ml, y, cw, tableHeaderH, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(40, 40, 50);
    let hx = ml + padH;
    for (let i = 0; i < pHead.length; i++) {
      doc.text(pHead[i], hx, y + 5);
      if (i < pHead.length - 1) { doc.setDrawColor(190, 192, 200); doc.setLineWidth(0.15); doc.line(hx + pCols[i], y, hx + pCols[i], y + tableHeaderH); }
      hx += pCols[i];
    }
    y += tableHeaderH;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    for (let i = 0; i < pagos.length; i++) {
      const p = pagos[i];
      if (i % 2 === 1) { doc.setFillColor(248, 249, 250); doc.rect(ml, y, cw, rowH, "F"); }
      doc.setDrawColor(215, 217, 223);
      doc.setLineWidth(0.15);
      doc.line(ml, y, ml + cw, y);
      doc.setTextColor(50, 50, 60);
      let rx = ml + padH;
      const vals = [p.metodo, p.banco, p.titular, `$${p.monto.toFixed(2)}`];
      for (let j = 0; j < vals.length; j++) {
        doc.text(vals[j], rx, y + 4.5);
        if (j < vals.length - 1) { doc.setDrawColor(215, 217, 223); doc.setLineWidth(0.1); doc.line(rx + pCols[j], y, rx + pCols[j], y + rowH); }
        rx += pCols[j];
      }
      y += rowH;
    }
    doc.setDrawColor(210, 210, 215);
    doc.setLineWidth(0.3);
    doc.line(ml, y, ml + cw, y);
    y += 4;
  }

  // ---- PRODUCTOS TABLE ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 110);
  doc.text("PRODUCTOS", ml, y + 4);
  y += 11;
  const prodCols = [cw - 34 - 28 - 30, 34, 28, 30];
  const prodHead = ["Producto", "Cant.", "P.Unit.", "Subtotal"];

  doc.setFillColor(230, 232, 240);
  doc.rect(ml, y, cw, tableHeaderH, "F");
  doc.setDrawColor(190, 192, 200);
  doc.setLineWidth(0.3);
  doc.rect(ml, y, cw, tableHeaderH, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(40, 40, 50);
  let hx = ml + padH;
  for (let i = 0; i < prodHead.length; i++) {
    doc.text(prodHead[i], hx, y + 5);
    if (i < prodHead.length - 1) { doc.setDrawColor(190, 192, 200); doc.setLineWidth(0.15); doc.line(hx + prodCols[i], y, hx + prodCols[i], y + tableHeaderH); }
    hx += prodCols[i];
  }
  y += tableHeaderH;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const nombre = item.Producto?.nombre || "N/A";
    const cant = item.cantidad;
    const precio = parseFloat(item.precio_unitario);
    const sub = cant * precio;
    if (i % 2 === 1) { doc.setFillColor(248, 249, 250); doc.rect(ml, y, cw, rowH, "F"); }
    doc.setDrawColor(215, 217, 223);
    doc.setLineWidth(0.15);
    doc.line(ml, y, ml + cw, y);
    doc.setTextColor(50, 50, 60);
    let rx = ml + padH;
    doc.text(nombre, rx, y + 4.5); rx += prodCols[0];
    doc.text(String(cant), rx, y + 4.5); rx += prodCols[1];
    doc.text(`$${precio.toFixed(2)}`, rx, y + 4.5); rx += prodCols[2];
    doc.text(`$${sub.toFixed(2)}`, rx, y + 4.5); rx += prodCols[3];
    y += rowH;
  }
  doc.setDrawColor(210, 210, 215);
  doc.setLineWidth(0.3);
  doc.line(ml, y, ml + cw, y);

  // ---- TOTAL ----
  y += 6;
  doc.setFillColor(245, 246, 250);
  doc.rect(ml, y, cw, 14, "F");
  doc.setDrawColor(190, 192, 200);
  doc.setLineWidth(0.4);
  doc.rect(ml, y, cw, 14, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(26, 26, 46);
  doc.text("TOTAL", ml + 8, y + 9.5);
  doc.text(`$${parseFloat(venta.total).toFixed(2)}`, pw - mr - 8, y + 9.5, { align: "right" });
  y += 17;

  // ---- DEUDA ----
  if (hasDeuda) {
    doc.setFillColor(saldoRestante > 0 ? 255 : 240, saldoRestante > 0 ? 248 : 250, saldoRestante > 0 ? 240 : 240);
    doc.rect(ml, y, cw, 16, "F");
    doc.setDrawColor(saldoRestante > 0 ? 240 : 160, saldoRestante > 0 ? 190 : 210, saldoRestante > 0 ? 120 : 160);
    doc.setLineWidth(0.4);
    doc.rect(ml, y, cw, 16, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(saldoRestante > 0 ? 180 : 50, saldoRestante > 0 ? 130 : 140, saldoRestante > 0 ? 40 : 50);
    doc.text(saldoRestante > 0 ? "Pago de deuda incluido" : "Deuda saldada", ml + 8, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 85);
    doc.text(`$${parseFloat(venta.monto_deuda_pagado).toFixed(2)}`, ml + 8, y + 12);
    if (saldoRestante > 0) {
      doc.text(`Saldo pendiente: $${saldoRestante.toFixed(2)}`, pw - mr - 8, y + 6, { align: "right" });
    } else {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(50, 140, 50);
      doc.text("SALDADO", pw - mr - 8, y + 12, { align: "right" });
    }
    y += 19;
  }

  // ---- FIRMAS ----
  const minFirmaY = ph - 42;
  y = Math.max(y + 6, minFirmaY);

  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.2);
  doc.line(ml, y, pw - mr, y);
  y += 8;
  const firmaW = 70;
  const firmaGap = (cw - firmaW * 2) / 2;

  doc.setDrawColor(180, 180, 190);
  doc.setLineWidth(0.4);
  const f1x = ml + firmaGap;
  const f2x = pw - mr - firmaGap - firmaW;
  doc.line(f1x, y, f1x + firmaW, y);
  doc.line(f2x, y, f2x + firmaW, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 130);
  doc.text("Firma del cliente", f1x + firmaW / 2, y + 6, { align: "center" });
  doc.text("Firma del vendedor", f2x + firmaW / 2, y + 6, { align: "center" });

  // ---- FOOTER ----
  doc.setFontSize(6.5);
  doc.setTextColor(170, 170, 180);
  doc.text("Documento generado automaticamente por el Sistema de Gestion Mar Azul", pw / 2, ph - 10, { align: "center" });

  doc.save(`comprobante-${venta.numero_comprobante}.pdf`);
};

export const generarResumenPagosPDF = async (pagos, fecha) => {
  const doc = new jsPDF("landscape");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const ml = 18;
  const mr = 18;
  const tableWidth = pageWidth - ml - mr;
  const colWidths = [50, 55, 38, 50, tableWidth - 50 - 55 - 38 - 50];
  const headers = ["Fecha y Hora", "Titular", "Monto", "Banco", "Tipo"];
  const rowH = 7;
  const headerH = 9;
  const fontSize = 12;
  const headerFontSize = 12.5;

  const headerBarH = 32;
  const topMargin = headerBarH + 14;

  let y = topMargin;
  
  const logo = await cargarLogo();

  const drawPageHeader = () => {
    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, pageWidth, headerBarH, "F");
    
    if (logo) {
      doc.addImage(logo, "JPEG", ml, 2, 28, 28);
    }
    
    doc.setTextColor(217, 119, 6);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Mar Azul", pageWidth / 2, 14, { align: "center" });
    doc.setTextColor(226, 232, 240);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Tabla de Cobros - ${fecha}`, pageWidth / 2, 25, { align: "center" });
  };

  const drawTableHeader = (yPos) => {
    const x0 = ml;
    doc.setFillColor(230, 232, 240);
    doc.rect(x0, yPos, tableWidth, headerH, "F");
    doc.setDrawColor(190, 192, 200);
    doc.setLineWidth(0.4);
    doc.rect(x0, yPos, tableWidth, headerH, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(headerFontSize);
    doc.setTextColor(40, 40, 50);
    let x = x0 + 3;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x + 3, yPos + headerH / 2 + 1.2);
      if (i < headers.length - 1) {
        doc.setDrawColor(190, 192, 200);
        doc.setLineWidth(0.2);
        doc.line(x + colWidths[i], yPos, x + colWidths[i], yPos + headerH);
      }
      x += colWidths[i];
    }
  };

  const drawRow = (yPos, rowData, isEven, isLast) => {
    const x0 = ml;
    if (isEven) {
      doc.setFillColor(248, 249, 250);
      doc.rect(x0, yPos, tableWidth, rowH, "F");
    }
    doc.setDrawColor(210, 212, 218);
    doc.setLineWidth(0.2);
    doc.line(x0, yPos, x0 + tableWidth, yPos);
    if (isLast) {
      doc.line(x0, yPos + rowH, x0 + tableWidth, yPos + rowH);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(50, 50, 60);
    let x = x0 + 3;
    for (let i = 0; i < rowData.length; i++) {
      doc.text(String(rowData[i]), x + 3, yPos + rowH / 2 + 1.2);
      if (i < rowData.length - 1) {
        doc.setDrawColor(210, 212, 218);
        doc.setLineWidth(0.15);
        doc.line(x + colWidths[i], yPos, x + colWidths[i], yPos + rowH);
      }
      x += colWidths[i];
    }
  };

  const addPageIfNeeded = (yPos) => {
    if (yPos + rowH + 10 > pageHeight - 20) {
      doc.addPage("landscape");
      drawPageHeader();
      yPos = topMargin;
      drawTableHeader(yPos);
      yPos += headerH;
    }
    return yPos;
  };

  drawPageHeader();
  drawTableHeader(y);
  y += headerH;

  for (let i = 0; i < pagos.length; i++) {
    y = addPageIfNeeded(y);
    const p = pagos[i];
    const rowData = [
      (p.fecha_hora || "").replace("T", " "),
      p.nombre_cuenta || "-",
      `$${(p.monto || 0).toFixed(2)}`,
      p.banco || "-",
      p.tipo || "-",
    ];
    drawRow(y, rowData, i % 2 === 1, i === pagos.length - 1);
    y += rowH;
  }

  y += 4;
  y = addPageIfNeeded(y);

  const total = pagos.reduce((s, p) => s + (p.monto || 0), 0);
  const totalLineWidth = 120;
  const totalX = pageWidth - mr - totalLineWidth;
  doc.setDrawColor(70, 70, 80);
  doc.setLineWidth(0.6);
  doc.line(totalX, y, totalX + totalLineWidth, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 50);
  doc.text("TOTAL GENERAL:", totalX, y);
  doc.text(`$${total.toFixed(2)}`, totalX + totalLineWidth, y, { align: "right" });

  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.setFont("helvetica", "normal");
  doc.text("Documento generado automaticamente por el Sistema de Gestion Mar Azul", pageWidth / 2, pageHeight - 12, { align: "center" });

  doc.save(`resumen-pagos-${fecha}.pdf`);
};

export const generarResumenPagosPorProveedorPDF = async (pagos, fecha) => {
  const pagosPorProveedor = {};
  const pagosSinProveedor = [];

  for (const pago of pagos) {
    if (pago.proveedor && pago.proveedor.id) {
      const key = `${pago.proveedor.id}-${pago.proveedor.nombre}`;
      if (!pagosPorProveedor[key]) {
        pagosPorProveedor[key] = {
          proveedor: pago.proveedor,
          pagos: [],
        };
      }
      pagosPorProveedor[key].pagos.push(pago);
    } else {
      pagosSinProveedor.push(pago);
    }
  }

  const proveedores = Object.values(pagosPorProveedor);

  if (proveedores.length === 0 && pagosSinProveedor.length === 0) {
    alert("No hay pagos para generar PDF");
    return;
  }
  
  const logo = await cargarLogo();

  for (const grupo of proveedores) {
    const doc = new jsPDF("landscape");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const ml = 18;
    const mr = 18;
    const tableWidth = pageWidth - ml - mr;
    const colWidths = [50, 55, 38, 50, tableWidth - 50 - 55 - 38 - 50];
    const headers = ["Fecha y Hora", "Titular", "Monto", "Banco", "Tipo"];
    const rowH = 7;
    const headerH = 9;
    const fontSize = 12;
    const headerFontSize = 12.5;
    const headerBarH = 32;
    const topMargin = headerBarH + 14;

    let y = topMargin;

    const drawPageHeader = () => {
      doc.setFillColor(26, 26, 46);
      doc.rect(0, 0, pageWidth, headerBarH, "F");
      
      if (logo) {
        doc.addImage(logo, "JPEG", ml, 2, 28, 28);
      }
      
      doc.setTextColor(217, 119, 6);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Mar Azul", pageWidth / 2, 14, { align: "center" });
      doc.setTextColor(226, 232, 240);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Transferencias - ${grupo.proveedor.nombre}`, pageWidth / 2, 25, { align: "center" });
    };

    const drawTableHeader = (yPos) => {
      const x0 = ml;
      doc.setFillColor(230, 232, 240);
      doc.rect(x0, yPos, tableWidth, headerH, "F");
      doc.setDrawColor(190, 192, 200);
      doc.setLineWidth(0.4);
      doc.rect(x0, yPos, tableWidth, headerH, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(headerFontSize);
      doc.setTextColor(40, 40, 50);
      let x = x0 + 3;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x + 3, yPos + headerH / 2 + 1.2);
        if (i < headers.length - 1) {
          doc.setDrawColor(190, 192, 200);
          doc.setLineWidth(0.2);
          doc.line(x + colWidths[i], yPos, x + colWidths[i], yPos + headerH);
        }
        x += colWidths[i];
      }
    };

    const drawRow = (yPos, rowData, isEven, isLast) => {
      const x0 = ml;
      if (isEven) {
        doc.setFillColor(248, 249, 250);
        doc.rect(x0, yPos, tableWidth, rowH, "F");
      }
      doc.setDrawColor(210, 212, 218);
      doc.setLineWidth(0.2);
      doc.line(x0, yPos, x0 + tableWidth, yPos);
      if (isLast) {
        doc.line(x0, yPos + rowH, x0 + tableWidth, yPos + rowH);
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(50, 50, 60);
      let x = x0 + 3;
      for (let i = 0; i < rowData.length; i++) {
        doc.text(String(rowData[i]), x + 3, yPos + rowH / 2 + 1.2);
        if (i < rowData.length - 1) {
          doc.setDrawColor(210, 212, 218);
          doc.setLineWidth(0.15);
          doc.line(x + colWidths[i], yPos, x + colWidths[i], yPos + rowH);
        }
        x += colWidths[i];
      }
    };

    const addPageIfNeeded = (yPos) => {
      if (yPos + rowH + 10 > pageHeight - 20) {
        doc.addPage("landscape");
        drawPageHeader();
        yPos = topMargin;
        drawTableHeader(yPos);
        yPos += headerH;
      }
      return yPos;
    };

    drawPageHeader();
    drawTableHeader(y);
    y += headerH;

    for (let i = 0; i < grupo.pagos.length; i++) {
      y = addPageIfNeeded(y);
      const p = grupo.pagos[i];
      const rowData = [
        (p.fecha_hora || "").replace("T", " "),
        p.nombre_cuenta || "-",
        `$${(p.monto || 0).toFixed(2)}`,
        p.banco || "-",
        p.tipo || "-",
      ];
      drawRow(y, rowData, i % 2 === 1, i === grupo.pagos.length - 1);
      y += rowH;
    }

    y += 4;
    y = addPageIfNeeded(y);

    const total = grupo.pagos.reduce((s, p) => s + (p.monto || 0), 0);
    const totalLineWidth = 120;
    const totalX = pageWidth - mr - totalLineWidth;
    doc.setDrawColor(70, 70, 80);
    doc.setLineWidth(0.6);
    doc.line(totalX, y, totalX + totalLineWidth, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 50);
    doc.text("TOTAL:", totalX, y);
    doc.text(`$${total.toFixed(2)}`, totalX + totalLineWidth, y, { align: "right" });

    if (grupo.proveedor.alias) {
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 110);
      doc.text(`Alias: ${grupo.proveedor.alias}`, ml, y);
    }

    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.setFont("helvetica", "normal");
    doc.text("Documento generado automaticamente por el Sistema de Gestion Mar Azul", pageWidth / 2, pageHeight - 12, { align: "center" });

    const nombreArchivo = `transferencias-${grupo.proveedor.nombre.replace(/\s+/g, "-").toLowerCase()}-${fecha}.pdf`;
    doc.save(nombreArchivo);
  }

  if (pagosSinProveedor.length > 0) {
    generarResumenPagosPDF(pagosSinProveedor, `${fecha}-sin-proveedor`);
  }
};

export const generarCierreCajaPDF = async (datos) => {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 15, mr = 15;
  const cw = pw - ml - mr;

  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pw, 38, "F");
  
  const logo = await cargarLogo();
  if (logo) {
    doc.addImage(logo, "JPEG", ml, 4, 30, 30);
  }
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(217, 119, 6);
  doc.text("MAR AZUL", ml + 35, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Sistema de Gestion de Repartos", ml + 35, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(226, 232, 240);
  doc.text("Cierre de Caja", pw - mr, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 185, 195);
  doc.text(`Fecha: ${datos.fecha}`, pw - mr, 22, { align: "right" });

  let y = 48;

  doc.setFillColor(248, 249, 252);
  doc.rect(ml, y - 4, cw, 20, "F");
  doc.setDrawColor(220, 222, 228);
  doc.setLineWidth(0.3);
  doc.rect(ml, y - 4, cw, 20, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 110);
  doc.text("INFORMACION DEL CIERRE", ml, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 60);
  doc.text(`Hora de cierre: ${datos.hora}`, ml, y + 8);
  doc.text(`Usuario: ${datos.usuario_cierre}`, ml + 80, y + 8);
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(26, 26, 46);
  doc.text("RESUMEN DE VENTAS", ml, y);
  y += 6;

  doc.setFillColor(245, 246, 250);
  doc.rect(ml, y, cw, 40, "F");
  doc.setDrawColor(190, 192, 200);
  doc.setLineWidth(0.4);
  doc.rect(ml, y, cw, 40, "S");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 60);
  let ry = y + 8;
  doc.text(`Mercadería Enviada:`, ml + 4, ry);
  doc.setFont("helvetica", "bold");
  doc.text(`$${parseFloat(datos.mercaderia_enviada || 0).toFixed(2)}`, ml + 60, ry);
  doc.setFont("helvetica", "normal");
  doc.text(`Mercadería Devuelta:`, ml + 4, ry + 7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(239, 68, 68);
  doc.text(`-$${parseFloat(datos.mercaderia_devuelta || 0).toFixed(2)}`, ml + 60, ry + 7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 60);
  doc.text(`Ventas Netas:`, ml + 4, ry + 14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.text(`$${parseFloat(datos.ventas_netas || 0).toFixed(2)}`, ml + 60, ry + 14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 60);
  doc.text(`Total Ventas:`, ml + 4, ry + 21);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(26, 26, 46);
  doc.text(`$${parseFloat(datos.total_ventas || 0).toFixed(2)}`, ml + 60, ry + 21);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 60);
  doc.text(`Cantidad de Salidas:`, ml + 100, ry);
  doc.setFont("helvetica", "bold");
  doc.text(`${datos.salidas_count || 0}`, ml + 150, ry);
  doc.setFont("helvetica", "normal");
  doc.text(`Ventas Mayoristas:`, ml + 100, ry + 7);
  doc.setFont("helvetica", "bold");
  doc.text(`${datos.local_count || 0}`, ml + 150, ry + 7);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Mayorista:`, ml + 100, ry + 14);
  doc.setFont("helvetica", "bold");
  doc.text(`$${parseFloat(datos.local_monto || 0).toFixed(2)}`, ml + 150, ry + 14);
  doc.setFont("helvetica", "normal");
  doc.text(`Ventas por Reparto:`, ml + 100, ry + 21);
  doc.setFont("helvetica", "bold");
  doc.text(`${datos.reparto_count || 0}`, ml + 150, ry + 21);

  y += 44;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(26, 26, 46);
  doc.text("DETALLE DE PAGOS", ml, y);
  y += 6;

  const pagos = datos.pagos || [];
  const totalEfectivo = pagos.filter(p => p.tipo === "Efectivo").reduce((s, p) => s + (p.monto || 0), 0);
  const totalTransferencias = pagos.filter(p => p.tipo === "Transferencia").reduce((s, p) => s + (p.monto || 0), 0);
  const totalTarjetas = pagos.filter(p => p.tipo === "Tarjeta").reduce((s, p) => s + (p.monto || 0), 0);

  doc.setFillColor(230, 232, 240);
  doc.rect(ml, y, cw, 24, "F");
  doc.setDrawColor(190, 192, 200);
  doc.setLineWidth(0.4);
  doc.rect(ml, y, cw, 24, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 50);
  doc.text("EFECTIVO", ml + 4, y + 6);
  doc.setFontSize(10);
  doc.setTextColor(16, 185, 129);
  doc.text(`$${totalEfectivo.toFixed(2)}`, ml + 4, y + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 50);
  doc.text("TRANSFERENCIAS", ml + 60, y + 6);
  doc.setFontSize(10);
  doc.setTextColor(59, 130, 246);
  doc.text(`$${totalTransferencias.toFixed(2)}`, ml + 60, y + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 50);
  doc.text("TARJETAS", ml + 120, y + 6);
  doc.setFontSize(10);
  doc.setTextColor(139, 92, 246);
  doc.text(`$${totalTarjetas.toFixed(2)}`, ml + 120, y + 14);

  y += 28;

  if (datos.kg_pollos !== undefined || datos.kg_devueltos !== undefined) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(26, 26, 46);
    doc.text("RESUMEN DE KILOS", ml, y);
    y += 6;

    doc.setFillColor(254, 249, 237);
    doc.rect(ml, y, cw, 16, "F");
    doc.setDrawColor(240, 210, 140);
    doc.setLineWidth(0.4);
    doc.rect(ml, y, cw, 16, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(180, 130, 20);
    doc.text("KG ENVIADOS:", ml + 4, y + 6);
    doc.setFontSize(10);
    doc.text(`${datos.kg_pollos || 0} kg`, ml + 40, y + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("KG DEVUELTOS:", ml + 80, y + 6);
    doc.setFontSize(10);
    doc.text(`${datos.kg_devueltos || 0} kg`, ml + 120, y + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("KG NETOS:", ml + 150, y + 6);
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text(`${(datos.kg_pollos || 0) - (datos.kg_devueltos || 0)} kg`, ml + 180, y + 6);

    y += 20;
  }

  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.2);
  doc.line(ml, y, pw - mr, y);
  y += 8;
  const firmaW = 80;
  const firmaX = (pw - firmaW) / 2;
  doc.setDrawColor(180, 180, 190);
  doc.setLineWidth(0.4);
  doc.line(firmaX, y, firmaX + firmaW, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 130);
  doc.text("Firma del Responsable", firmaX + firmaW / 2, y + 6, { align: "center" });

  doc.setFontSize(6.5);
  doc.setTextColor(170, 170, 180);
  doc.text("Documento generado automaticamente por el Sistema de Gestion Mar Azul", pw / 2, ph - 10, { align: "center" });

  doc.save(`cierre-caja-${datos.fecha}.pdf`);
};

export const generarTransferenciaIndividualPDF = async (pago, fecha) => {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 15, mr = 15;
  const cw = pw - ml - mr;

  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pw, 38, "F");
  
  const logo = await cargarLogo();
  if (logo) {
    doc.addImage(logo, "JPEG", ml, 4, 30, 30);
  }
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(217, 119, 6);
  doc.text("MAR AZUL", ml + 35, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Sistema de Gestion de Repartos", ml + 35, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(226, 232, 240);
  doc.text("Comprobante de Transferencia", pw - mr, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 185, 195);
  doc.text(`Fecha: ${fecha}`, pw - mr, 22, { align: "right" });

  let y = 48;

  if (pago.proveedor) {
    doc.setFillColor(248, 249, 252);
    doc.rect(ml, y - 4, cw, 30, "F");
    doc.setDrawColor(220, 222, 228);
    doc.setLineWidth(0.3);
    doc.rect(ml, y - 4, cw, 30, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 110);
    doc.text("PROVEEDOR", ml, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 60);
    doc.text(pago.proveedor.nombre, ml, y + 9);
    if (pago.proveedor.alias) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 130);
      doc.text(`Alias: ${pago.proveedor.alias}`, ml, y + 18);
    }
    y += 34;
  }

  doc.setFillColor(245, 246, 250);
  doc.rect(ml, y, cw, 52, "F");
  doc.setDrawColor(190, 192, 200);
  doc.setLineWidth(0.4);
  doc.rect(ml, y, cw, 52, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 110);
  doc.text("DETALLE DE LA TRANSFERENCIA", ml + 4, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 60);
  let dy = y + 17;
  doc.text(`Tipo: ${pago.tipo || "Transferencia"}`, ml + 4, dy); dy += 8;
  doc.text(`Fecha/Hora: ${(pago.fecha_hora || "").replace("T", " ")}`, ml + 4, dy); dy += 8;
  doc.text(`Banco: ${pago.banco || "-"}`, ml + 4, dy); dy += 8;
  doc.text(`Titular: ${pago.nombre_cuenta || "-"}`, ml + 4, dy);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(26, 26, 46);
  doc.text(`$${(pago.monto || 0).toFixed(2)}`, pw - mr - 8, y + 32, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 130);
  doc.text("MONTO", pw - mr - 8, y + 38, { align: "right" });

  y += 58;

  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.2);
  doc.line(ml, y, pw - mr, y);
  y += 8;
  const firmaW = 80;
  const firmaX = (pw - firmaW) / 2;
  doc.setDrawColor(180, 180, 190);
  doc.setLineWidth(0.4);
  doc.line(firmaX, y, firmaX + firmaW, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 130);
  doc.text("Firma", firmaX + firmaW / 2, y + 6, { align: "center" });

  doc.setFontSize(6.5);
  doc.setTextColor(170, 170, 180);
  doc.text("Documento generado automaticamente por el Sistema de Gestion Mar Azul", pw / 2, ph - 10, { align: "center" });

  const nombreProv = pago.proveedor ? pago.proveedor.nombre.replace(/\s+/g, "-").toLowerCase() : "sin-proveedor";
  const aliasPart = pago.proveedor?.alias ? `-${pago.proveedor.alias.replace(/\s+/g, "-").toLowerCase()}` : "";
  const titular = (pago.nombre_cuenta || "sintitular").replace(/\s+/g, "-").toLowerCase();
  doc.save(`transferencia-${nombreProv}${aliasPart}-${titular}-${fecha}.pdf`);
};

export const generarResumenEntregaPDF = async (salida, ventas) => {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 15, mr = 15;
  const cw = pw - ml - mr;

  const rowH = 6;
  const tableHeaderH = 7;
  const padH = 3;

  let y = 0;
  
  const logo = await cargarLogo();

  const addPageIfNeeded = (spaceNeeded) => {
    if (y + spaceNeeded > ph - 25) {
      doc.addPage();
      y = 15;
    }
  };

  const drawEncabezado = () => {
    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, pw, 36, "F");
    
    if (logo) {
      doc.addImage(logo, "JPEG", ml, 3, 28, 28);
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(217, 119, 6);
    doc.text("MAR AZUL", ml + 32, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Sistema de Gestion de Repartos", ml + 32, 19);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(226, 232, 240);
    doc.text("Resumen de Entrega", ml + 32, 27);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(180, 185, 195);
    doc.text(salida.fecha, ml + 82, 27);
    y = 42;
  };

  const drawSectionTitle = (title) => {
    addPageIfNeeded(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(26, 26, 46);
    doc.setFillColor(245, 245, 248);
    doc.rect(ml, y - 3, cw, 10, "F");
    doc.text(title, ml + 3, y + 4);
    y += 11;
  };

  const drawInfoBox = () => {
    addPageIfNeeded(36);
    doc.setFillColor(248, 249, 252);
    doc.rect(ml, y - 3, cw, 30, "F");
    doc.setDrawColor(220, 222, 228);
    doc.setLineWidth(0.3);
    doc.rect(ml, y - 3, cw, 30, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 110);
    doc.text("INFORMACION DE LA SALIDA", ml + 3, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 60);
    doc.text(`Camion: ${salida.camion || "-"}`, ml + 3, y + 7);
    doc.text(`Repartidor: ${salida.repartidor_asignado?.nombre || "-"}`, ml + 3, y + 13);
    doc.text(`Destino: ${salida.destino || "-"}`, ml + 3, y + 19);
    doc.text(`Total enviado: $${parseFloat(salida.monto_salida || 0).toFixed(2)}`, ml + 3, y + 25);
    const neto = parseFloat(salida.monto_salida || 0) - parseFloat(salida.monto_regreso || 0);
    doc.text(`Total devuelto: $${parseFloat(salida.monto_regreso || 0).toFixed(2)}`, ml + 80, y + 25);

    y += 32;
  };

  const drawSimpleTable = (headers, colWidths, cellGetters, rows) => {
    if (rows.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Sin datos", ml + 3, y + 4);
      y += 9;
      return;
    }

    addPageIfNeeded(tableHeaderH + rows.length * rowH + 8);

    doc.setFillColor(230, 232, 240);
    doc.rect(ml, y, cw, tableHeaderH, "F");
    doc.setDrawColor(190, 192, 200);
    doc.setLineWidth(0.3);
    doc.rect(ml, y, cw, tableHeaderH, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(40, 40, 50);
    let hx = ml + padH;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], hx, y + 4.5);
      if (i < headers.length - 1) {
        doc.setDrawColor(190, 192, 200);
        doc.setLineWidth(0.15);
        doc.line(hx + colWidths[i], y, hx + colWidths[i], y + tableHeaderH);
      }
      hx += colWidths[i];
    }
    y += tableHeaderH;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    for (let i = 0; i < rows.length; i++) {
      addPageIfNeeded(rowH + 4);
      if (i % 2 === 1) {
        doc.setFillColor(248, 249, 250);
        doc.rect(ml, y, cw, rowH, "F");
      }
      doc.setDrawColor(215, 217, 223);
      doc.setLineWidth(0.15);
      doc.line(ml, y, ml + cw, y);
      doc.setTextColor(50, 50, 60);
      let rx = ml + padH;
      for (let j = 0; j < cellGetters.length; j++) {
        doc.text(String(cellGetters[j](rows[i])), rx, y + 4);
        if (j < colWidths.length - 1) {
          doc.setDrawColor(215, 217, 223);
          doc.setLineWidth(0.1);
          doc.line(rx + colWidths[j], y, rx + colWidths[j], y + rowH);
        }
        rx += colWidths[j];
      }
      y += rowH;
    }
    doc.setDrawColor(210, 210, 215);
    doc.setLineWidth(0.3);
    doc.line(ml, y, ml + cw, y);
    y += 3;
  };

  // ---- Build PDF ----
  drawEncabezado();
  drawInfoBox();

  // 1. Mercaderia enviada
  drawSectionTitle("Mercaderia Enviada");
  const enviados = salida.SalidaCamionItems || [];
  drawSimpleTable(
    ["Producto", "Cantidad", "P.Unit.", "Subtotal"],
    [cw - 28 - 26 - 30, 28, 26, 30],
    [
      (r) => r.Producto?.nombre || "N/A",
      (r) => r.cantidad,
      (r) => `$${parseFloat(r.precio_unitario).toFixed(2)}`,
      (r) => `$${(r.cantidad * parseFloat(r.precio_unitario)).toFixed(2)}`,
    ],
    enviados
  );

  // 2. Mercaderia devuelta
  drawSectionTitle("Mercaderia Devuelta");
  const devueltos = enviados.filter((item) => (item.cantidad_devuelta || 0) > 0);
  drawSimpleTable(
    ["Producto", "Devuelto", "P.Unit.", "Subtotal"],
    [cw - 28 - 26 - 30, 28, 26, 30],
    [
      (r) => r.Producto?.nombre || "N/A",
      (r) => r.cantidad_devuelta,
      (r) => `$${parseFloat(r.precio_unitario).toFixed(2)}`,
      (r) => `$${(r.cantidad_devuelta * parseFloat(r.precio_unitario)).toFixed(2)}`,
    ],
    devueltos
  );

  // 3. Ventas realizadas
  drawSectionTitle("Ventas Realizadas");
  const ventasItems = [];
  for (const v of ventas) {
    for (const vi of v.VentaItems || []) {
      ventasItems.push({
        comprobante: v.numero_comprobante,
        cliente: v.cliente?.nombre || v.cliente_nombre || "-",
        producto: vi.Producto?.nombre || "N/A",
        cantidad: vi.cantidad,
        precio: parseFloat(vi.precio_unitario),
        subtotal: vi.cantidad * parseFloat(vi.precio_unitario),
      });
    }
  }
  const totalVentas = ventasItems.reduce((s, r) => s + r.subtotal, 0);

  drawSimpleTable(
    ["Comprobante", "Cliente", "Producto", "Cant.", "P.Unit.", "Subtotal"],
    [38, 28, cw - 38 - 28 - 22 - 26 - 28, 22, 26, 28],
    [
      (r) => r.comprobante,
      (r) => r.cliente,
      (r) => r.producto,
      (r) => r.cantidad,
      (r) => `$${r.precio.toFixed(2)}`,
      (r) => `$${r.subtotal.toFixed(2)}`,
    ],
    ventasItems
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(26, 26, 46);
  doc.text(`Total Ventas: $${totalVentas.toFixed(2)}`, ml + 3, y + 4);
  y += 8;

  // 4. Observaciones de ventas
  drawSectionTitle("Observaciones de Ventas");
  const ventasConNotas = ventas.filter((v) => v.notas);
  if (ventasConNotas.length > 0) {
    for (const v of ventasConNotas) {
      addPageIfNeeded(16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(60, 60, 70);
      doc.text(`${v.numero_comprobante} - ${v.cliente?.nombre || v.cliente_nombre || "-"}`, ml + 3, y + 3);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      const lines = doc.splitTextToSize(v.notas, cw - 10);
      doc.text(lines, ml + 6, y + 8);
      y += 8 + lines.length * 4 + 2;
    }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Sin observaciones", ml + 3, y + 4);
    y += 9;
  }

  // Summary box
  y = Math.max(y + 2, ph - 50);
  doc.setFillColor(245, 246, 250);
  doc.rect(ml, y, cw, 18, "F");
  doc.setDrawColor(190, 192, 200);
  doc.setLineWidth(0.4);
  doc.rect(ml, y, cw, 18, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(26, 26, 46);
  doc.text("RESUMEN", ml + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 70);
  doc.text(`Enviado: $${parseFloat(salida.monto_salida || 0).toFixed(2)}`, ml + 4, y + 13);
  doc.text(`Vendido: $${totalVentas.toFixed(2)}`, ml + 55, y + 13);
  doc.text(`Devuelto: $${parseFloat(salida.monto_regreso || 0).toFixed(2)}`, ml + 120, y + 13);
  y += 22;

  // Footer
  doc.setFontSize(6);
  doc.setTextColor(170, 170, 180);
  doc.text("Documento generado automaticamente por el Sistema de Gestion Mar Azul", pw / 2, ph - 8, { align: "center" });

  doc.save(`resumen-entrega-${salida.camion?.replace(/\s+/g, "-") || salida.id}-${salida.fecha}.pdf`);
};
