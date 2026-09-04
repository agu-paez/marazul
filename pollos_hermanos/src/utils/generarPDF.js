import jsPDF from "jspdf";
import { getFechaLocal } from "./fecha.js";

const montoEntero = (valor) => Math.round(Number(valor) || 0).toString();

const createPdf = (...args) => {
  const doc = new jsPDF(...args);
  const setFontSize = doc.setFontSize.bind(doc);
  doc.setFontSize = (size) => setFontSize(size * 1.2);
  return doc;
};

const esIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const descargarPDF = (doc, nombreArchivo) => {
  if (!esIOS()) {
    doc.save(nombreArchivo);
    return;
  }

  const url = URL.createObjectURL(doc.output("blob"));
  const ventana = window.open(url, "_blank");
  if (!ventana) window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

export const descargarPDFBlob = (blob, nombreArchivo) => {
  const url = URL.createObjectURL(blob);
  if (esIOS()) {
    const ventana = window.open(url, "_blank");
    if (!ventana) window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

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
    img.src = `${import.meta.env.BASE_URL}logo-marazul.jpeg`;
  });
};

export const generarComprobantePDF = async (venta) => {
  const doc = createPdf();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 15, mr = 15;
  const cw = pw - ml - mr;

  const medioLabel = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta", cheque: "Cheque", ercheck: "ER Check", cuenta_corriente: "Cuenta Corriente", otro: "Otro" };

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
    for (const d of parseDatos(venta.datos_cheque)) {
      rows.push({ metodo: "Cheque", banco: d.banco || "-", titular: d.nombre_cuenta || "-", monto: parseFloat(d.monto || 0) });
    }
    for (const d of parseDatos(venta.datos_ercheck)) {
      rows.push({ metodo: "ER Check", banco: d.banco || "-", titular: d.nombre_cuenta || "-", monto: parseFloat(d.monto || 0) });
    }
    if (venta.pago_dividido && venta.VentaPagos) {
      for (const p of venta.VentaPagos) {
        if (!["transferencia", "tarjeta", "cheque", "ercheck"].includes(p.medio_pago)) {
          rows.push({ metodo: medioLabel[p.medio_pago] || p.medio_pago, banco: "-", titular: "-", monto: parseFloat(p.monto || 0) });
        }
      }
    } else if (!["transferencia", "tarjeta", "cheque", "ercheck"].includes(venta.medio_pago)) {
       rows.push({ metodo: medioLabel[venta.medio_pago] || venta.medio_pago, banco: "-", titular: "-", monto: parseFloat(venta.VentaPagos?.[0]?.monto ?? venta.total ?? 0) });
    }
    return rows;
  };

  const pagos = buildPagos();
  const items = venta.VentaItems || [];
  const montoDeudaPagado = parseFloat(venta.monto_deuda_pagado || 0) || 0;
  const montoSaldoDescontado = parseFloat(venta.monto_sobrante || 0) || 0;
  const hasDeuda = montoDeudaPagado > 0;
  const saldoRestante = hasDeuda ? (venta.cliente?.saldo_pendiente ? parseFloat(venta.cliente.saldo_pendiente) : 0) : 0;
  const saldoPendiente = parseFloat(venta.cliente?.saldo_pendiente || 0) || 0;
  const saldoFavor = parseFloat(venta.cliente?.saldo_favor || 0) || 0;
  const saldoSumadoVenta = (venta.VentaPagos || [])
    .filter((p) => p.medio_pago === "cuenta_corriente")
    .reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
  // Reconstruct the balance before this sale from the current net balance.
  // Account credit increases debt, while an overpayment or debt payment reduces it.
  const saldoNetoActual = saldoPendiente - saldoFavor;
  const variacionSaldo = saldoSumadoVenta - montoSaldoDescontado - montoDeudaPagado;
  const saldoNetoAnterior = saldoNetoActual - variacionSaldo;
   const saldoAnteriorCalculado = Math.max(0, saldoNetoAnterior);
  const saldoAnteriorMostrado = Number(venta.saldo_anterior_manual ?? saldoAnteriorCalculado) || 0;
  const tieneSaldoActualizadoManual = venta.saldo_actualizado_manual !== null && venta.saldo_actualizado_manual !== undefined;
  const saldoActualizadoMostrado = tieneSaldoActualizadoManual
    ? Number(venta.saldo_actualizado_manual) || 0
    : Math.max(0, saldoNetoActual);
  const saldoFavorMostrado = tieneSaldoActualizadoManual ? 0 : Math.max(0, -saldoNetoActual);
  const muestraCambioSaldo = saldoSumadoVenta > 0 || hasDeuda || montoSaldoDescontado > 0;

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
  if (venta.cliente_telefono) { doc.text(`Tel: ${venta.cliente_telefono}`, ml, cy); }

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
      const vals = [p.metodo, p.banco, p.titular, `$${montoEntero(p.monto)}`];
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
    const esKg = ["kg", "kilogramo"].includes(String(item.Producto?.unidad || "").toLowerCase());
    const nombreBase = item.Producto?.nombre || "N/A";
    const nombre = !esKg ? `${nombreBase} (unid.)` : nombreBase;
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
    doc.text(`${cant}${esKg ? " kg" : ""}`, rx, y + 4.5); rx += prodCols[1];
     doc.text(`$${montoEntero(precio)}`, rx, y + 4.5); rx += prodCols[2];
      doc.text(`$${montoEntero(sub)}`, rx, y + 4.5);
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
  doc.text(`$${montoEntero(venta.total)}`, pw - mr - 8, y + 9.5, { align: "right" });
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
     doc.text(`$${montoEntero(venta.monto_deuda_pagado)}`, ml + 8, y + 12);
    if (saldoRestante > 0) {
       doc.text(`Saldo pendiente: $${montoEntero(saldoRestante)}`, pw - mr - 8, y + 6, { align: "right" });
    } else {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(50, 140, 50);
      doc.text("SALDADO", pw - mr - 8, y + 12, { align: "right" });
    }
    y += 19;
  }

  // ---- SALDOS DE CUENTA ----
  const saldoBoxH = 28;
  doc.setFillColor(248, 249, 252);
  doc.rect(ml, y, cw, saldoBoxH, "F");
  doc.setDrawColor(210, 212, 220);
  doc.setLineWidth(0.35);
  doc.rect(ml, y, cw, saldoBoxH, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 90);
  doc.text("SALDOS DE CUENTA", ml + 8, y + 6);
  doc.setFontSize(7.5);
  if (muestraCambioSaldo) {
    doc.setTextColor(80, 80, 85);
     doc.text(`Saldo anterior: $${montoEntero(saldoAnteriorMostrado)}`, ml + 8, y + 14);
    doc.setTextColor(210, 38, 38);
     doc.text(`Saldo actualizado: $${montoEntero(saldoActualizadoMostrado)}`, ml + 8, y + 21);
  } else {
    doc.setTextColor(210, 38, 38);
     doc.text(`Saldo pendiente: $${montoEntero(saldoPendiente)}`, ml + 8, y + 14);
  }
  doc.setTextColor(37, 99, 235);
    doc.text(`Saldo a favor del cliente: $${montoEntero(saldoFavorMostrado)}`, pw - mr - 8, y + 14, { align: "right" });
  y += saldoBoxH + 3;

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

  descargarPDF(doc, `comprobante-${venta.numero_comprobante}.pdf`);
};

export const generarResumenPagosPDF = async (pagos, fecha) => {
  const doc = createPdf("landscape");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const ml = 18;
  const mr = 18;
  const tableWidth = pageWidth - ml - mr;
   const colWidths = [50, 70, 55, 45, tableWidth - 220];
   const headers = ["Fecha", "Titular", "Banco", "Tipo", "Monto"];
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
      let cellText = String(rowData[i]);
      const maxWidth = colWidths[i] - 6;
      while (cellText.length > 3 && (doc.getTextWidth ? doc.getTextWidth(cellText) : cellText.length * 4) > maxWidth) {
        cellText = `${cellText.slice(0, -4)}...`;
      }
      doc.text(cellText, x + 3, yPos + rowH / 2 + 1.2);
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
       String(p.fecha_hora || "").replace("T", " ").split(" ")[0],
       p.titular || p.nombre_cuenta || "-",
       p.banco || "-",
       p.tipo || "-",
       `$${Number(p.monto || 0).toFixed(2)}`,
    ];
    drawRow(y, rowData, i % 2 === 1, i === pagos.length - 1);
    y += rowH;
  }

  y += 4;
  y = addPageIfNeeded(y);

  const total = pagos.reduce((s, p) => s + Number(p.monto || 0), 0);
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

  descargarPDF(doc, `resumen-pagos-${fecha}.pdf`);
};

export const generarResumenPagosPorProveedorPDF = async (pagos, fecha) => {
  const pagosPorProveedor = {};

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
    }
  }

  const proveedores = Object.values(pagosPorProveedor);

  if (proveedores.length === 0) {
    alert("No hay pagos para generar PDF");
    return;
  }
  
  const logo = await cargarLogo();

  for (const grupo of proveedores) {
    const doc = createPdf("landscape");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const ml = 18;
    const mr = 18;
    const tableWidth = pageWidth - ml - mr;
     const colWidths = [50, 70, 55, 45, tableWidth - 220];
     const headers = ["Fecha", "Titular", "Banco", "Tipo", "Monto"];
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
        let cellText = String(rowData[i]);
        const maxWidth = colWidths[i] - 6;
        while (cellText.length > 3 && (doc.getTextWidth ? doc.getTextWidth(cellText) : cellText.length * 4) > maxWidth) {
          cellText = `${cellText.slice(0, -4)}...`;
        }
        doc.text(cellText, x + 3, yPos + rowH / 2 + 1.2);
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
        String(p.fecha_hora || "").replace("T", " ").split(" ")[0],
         p.titular || p.nombre_cuenta || "-",
         p.banco || "-",
         p.tipo || "-",
         `$${Number(p.monto || 0).toFixed(2)}`,
      ];
      drawRow(y, rowData, i % 2 === 1, i === grupo.pagos.length - 1);
      y += rowH;
    }

    y += 4;
    y = addPageIfNeeded(y);

    const total = grupo.pagos.reduce((s, p) => s + Number(p.monto || 0), 0);
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
    descargarPDF(doc, nombreArchivo);
  }

};

export const generarCierreCajaPDF = async (datos) => {
  const doc = createPdf();
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
    doc.setDrawColor(240, 210, 140);
    doc.rect(ml, y, cw, 16, "FD");
    doc.setFontSize(8);
    doc.setTextColor(180, 130, 20);
    doc.text("KG ENVIADOS:", ml + 4, y + 6);
    doc.setFontSize(10);
    doc.text(`${Number(datos.kg_pollos || 0).toFixed(2)} kg`, ml + 40, y + 6);
    doc.setFontSize(8);
    doc.text("KG DEVUELTOS:", ml + 80, y + 6);
    doc.setFontSize(10);
    doc.text(`${Number(datos.kg_devueltos || 0).toFixed(2)} kg`, ml + 120, y + 6);
    doc.setFontSize(8);
    doc.text("KG NETOS:", ml + 142, y + 6);
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text(`${(Number(datos.kg_pollos || 0) - Number(datos.kg_devueltos || 0)).toFixed(2)} kg`, ml + 164, y + 6);
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

  descargarPDF(doc, `cierre-caja-${datos.fecha}.pdf`);
};

export const generarTransferenciaIndividualPDF = async (pago, fecha) => {
  const doc = createPdf();
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
  descargarPDF(doc, `transferencia-${nombreProv}${aliasPart}-${titular}-${fecha}.pdf`);
};

export const generarResumenEntregaPDF = async (salida, ventas, conteo, pagosDeuda = []) => {
  const doc = createPdf();
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
    addPageIfNeeded(42);
    doc.setFillColor(248, 249, 252);
    doc.rect(ml, y - 3, cw, 36, "F");
    doc.setDrawColor(220, 222, 228);
    doc.setLineWidth(0.3);
    doc.rect(ml, y - 3, cw, 36, "S");

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
    doc.text(`Total devuelto: $${parseFloat(salida.monto_regreso || 0).toFixed(2)}`, ml + 80, y + 25);
    doc.text(`Salida autorizada por: ${salida.autorizado_por?.nombre || "-"}`, ml + 3, y + 31);

    y += 38;
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

  if (salida.estado === "sobrante" && salida.sobrantes?.length > 0) {
    const faltantesTexto = salida.sobrantes
      .map((item) => {
        const nombre = item.Producto?.nombre || "Producto";
        const valor = Number(item.faltante) || 0;
        return `${nombre}: ${valor}`;
      })
      .join(" | ");
    const lineas = doc.splitTextToSize(`FALTO DEVOLVER: ${faltantesTexto}`, cw - 10);
    addPageIfNeeded(14 + lineas.length * 4);
    doc.setFillColor(254, 226, 226);
    doc.setDrawColor(220, 38, 38);
    doc.rect(ml, y - 3, cw, 10 + lineas.length * 4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(153, 27, 27);
    doc.text(lineas, ml + 4, y + 4);
    y += 14 + lineas.length * 4;
  }

  // 0. Observaciones de la salida
  if (salida.notas) {
    const esCancelada = salida.estado === "cancelado";
    const motivo = String(salida.notas).replace(/^ENVIO CANCELADO\s*\n?/i, "");
    const lineas = doc.splitTextToSize(motivo || "Sin motivo detallado", cw - 10);
    addPageIfNeeded(18 + lineas.length * 4);
    doc.setFillColor(esCancelada ? 254 : 244, esCancelada ? 226 : 245, esCancelada ? 226 : 248);
    doc.setDrawColor(esCancelada ? 220 : 190, esCancelada ? 38 : 192, esCancelada ? 38 : 200);
    doc.rect(ml, y - 3, cw, 16 + lineas.length * 4, "FD");
    if (esCancelada) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(153, 27, 27);
      doc.text("ENVIO CANCELADO", ml + 4, y + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(60, 60, 70);
      doc.text(lineas, ml + 4, y + 11);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(26, 26, 46);
      doc.text("OBSERVACIONES", ml + 4, y + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(60, 60, 70);
      doc.text(lineas, ml + 4, y + 11);
    }
    y += 16 + lineas.length * 4 + 6;
  }

  // 1. Mercaderia enviada
  drawSectionTitle("Mercaderia Enviada");
  const enviados = salida.SalidaCamionItems || [];
  const cantidadEnUnidades = (item, tipo) => Number(tipo === "devuelto" ? item.cantidad_devuelta : item.cantidad || 0).toFixed(2);
  drawSimpleTable(
    ["Producto", "Cant. / und.", "P.Unit.", "Subtotal"],
    [cw - 54 - 26 - 30, 54, 26, 30],
    [
      (r) => r.Producto?.nombre || "N/A",
      (r) => cantidadEnUnidades(r, "cargado"),
      (r) => `$${parseFloat(r.precio_unitario).toFixed(2)}`,
      (r) => `$${(Number(r.cantidad || 0) * parseFloat(r.precio_unitario)).toFixed(2)}`,
    ],
    enviados
  );

  // 2. Mercaderia devuelta
  drawSectionTitle("Mercaderia Devuelta");
  const devueltos = enviados.filter((item) => (item.cantidad_devuelta || 0) > 0);
  drawSimpleTable(
    ["Producto", "Devuelto / und.", "P.Unit.", "Subtotal"],
    [cw - 54 - 26 - 30, 54, 26, 30],
    [
      (r) => r.Producto?.nombre || "N/A",
      (r) => cantidadEnUnidades(r, "devuelto"),
      (r) => `$${parseFloat(r.precio_unitario).toFixed(2)}`,
      (r) => `$${(Number(r.cantidad_devuelta || 0) * parseFloat(r.precio_unitario)).toFixed(2)}`,
    ],
    devueltos
  );

  // 3. Medios de pago
  drawSectionTitle("Medios de Pago");
  const pagosResumen = { efectivo: 0, transferencia: 0, debito: 0, credito: 0, tarjeta_sin_tipo: 0, cuenta_corriente: 0, otro: 0 };
  let cantidadTransferencias = 0;
  for (const venta of ventas) {
    const pagosVenta = venta.VentaPagos?.length
      ? venta.VentaPagos
      : [{ medio_pago: venta.medio_pago, monto: venta.total }];
    for (const pago of pagosVenta) {
      const monto = parseFloat(pago.monto) || 0;
      const medio = String(pago.medio_pago || "otro").toLowerCase();
      if (medio === "efectivo") pagosResumen.efectivo += monto;
      else if (medio === "transferencia") {
        pagosResumen.transferencia += monto;
        cantidadTransferencias++;
      }
      else if (medio === "debito" || medio === "débito") pagosResumen.debito += monto;
      else if (medio === "credito" || medio === "crédito") pagosResumen.credito += monto;
      else if (medio === "tarjeta") pagosResumen.tarjeta_sin_tipo += monto;
      else if (medio === "cuenta_corriente") pagosResumen.cuenta_corriente += monto;
      else pagosResumen.otro += monto;
    }
  }
  for (const pago of pagosDeuda) {
    const monto = parseFloat(pago.monto) || 0;
    const medio = String(pago.medio_pago || "otro").toLowerCase();
    if (medio === "efectivo") pagosResumen.efectivo += monto;
    else if (medio === "transferencia") {
      pagosResumen.transferencia += monto;
      cantidadTransferencias++;
    } else if (medio === "cuenta_corriente") pagosResumen.cuenta_corriente += monto;
    else pagosResumen.otro += monto;
  }
  const pagosFilas = [
    { medio: "Efectivo", monto: pagosResumen.efectivo },
    { medio: "Transferencia", monto: pagosResumen.transferencia },
    { medio: "Débito", monto: pagosResumen.debito },
    { medio: "Crédito", monto: pagosResumen.credito },
    { medio: "Tarjeta sin tipo", monto: pagosResumen.tarjeta_sin_tipo },
    { medio: "Cuenta corriente", monto: pagosResumen.cuenta_corriente },
    { medio: "Otro", monto: pagosResumen.otro },
  ];
  drawSimpleTable(
    ["Medio", "Monto"],
    [cw - 45, 45],
    [(r) => r.medio, (r) => `$${r.monto.toFixed(2)}`],
    pagosFilas
  );

  // 6. Control de conteo de billetes contra efectivo registrado
  if (conteo && typeof conteo === "object") {
    const totalConteo = Object.entries(conteo.billetes || {}).reduce(
      (s, [valor, cant]) => s + Number(valor) * (Number(cant) || 0),
      0
    );
    const gastosCombustible = Number(conteo.gastos_combustible) || 0;
    const gastosOtros = Number(conteo.gastos_otros) || 0;
    const totalGastos = gastosCombustible + gastosOtros;
    const efectivoVentasNeto = Math.round((pagosResumen.efectivo - totalGastos) * 100) / 100;
    const dif = Math.round((totalConteo - efectivoVentasNeto) * 100) / 100;
    const ok = Math.abs(dif) < 0.01;
    const sobra = !ok && dif > 0;
    const enVerde = ok || sobra;
    const lineasConteo = [
      `Billetes contados: $${totalConteo.toFixed(2)}`,
      `Gastos de combustible: $${gastosCombustible.toFixed(2)}`,
      `Otros gastos: $${gastosOtros.toFixed(2)}`,
      `Efectivo segun ventas: $${pagosResumen.efectivo.toFixed(2)}`,
      totalGastos > 0 && `Efectivo segun ventas (ventas - gastos): $${efectivoVentasNeto.toFixed(2)}`,
      !ok && `Diferencia ${sobra ? "SOBRANTE" : "FALTANTE"}: $${Math.abs(dif).toFixed(2)}`,
    ].filter(Boolean);
    const conteoBoxH = 15 + lineasConteo.length * 5;
    addPageIfNeeded(conteoBoxH + 5);
    doc.setFillColor(enVerde ? 236 : 254, enVerde ? 253 : 226, enVerde ? 245 : 226);
    doc.setDrawColor(enVerde ? 16 : 220, enVerde ? 185 : 38, enVerde ? 129 : 38);
    doc.rect(ml, y - 3, cw, conteoBoxH, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(enVerde ? 21 : 153, enVerde ? 128 : 27, enVerde ? 61 : 27);
    doc.text(ok ? "CONTEO CORROBORADO" : "DIFERENCIA EN CONTEO DE EFECTIVO", ml + 4, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 70);
    doc.text(lineasConteo, ml + 4, y + 10, { lineHeightFactor: 1.25 });
    y += conteoBoxH + 5;

    addPageIfNeeded(22);
    doc.setFillColor(236, 248, 253);
    doc.setDrawColor(14, 116, 144);
    doc.rect(ml, y - 3, cw, 18, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(15, 78, 100);
    doc.text("TRANSFERENCIAS REALIZADAS", ml + 4, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Cantidad de transferencias: ${cantidadTransferencias}`, ml + 4, y + 11);
    y += 24;
  }

  // 4. Ventas realizadas
  drawSectionTitle("Ventas Realizadas");
  const ventasItems = [];
  for (const v of ventas) {
    for (const vi of v.VentaItems || []) {
      ventasItems.push({
        comprobante: v.numero_comprobante,
        cliente: v.cliente?.nombre || v.cliente_nombre || "-",
         producto: vi.Producto?.nombre || "N/A",
         cantidad: vi.cantidad,
          modalidad: "Unidad",
         precio: parseFloat(vi.precio_unitario),
        subtotal: vi.cantidad * parseFloat(vi.precio_unitario),
      });
    }
  }
  const totalVentas = ventasItems.reduce((s, r) => s + r.subtotal, 0);

  drawSimpleTable(
    ["Comprobante", "Cliente", "Producto", "Venta", "Cant.", "P.Unit.", "Subtotal"],
    [30, 22, cw - 30 - 22 - 22 - 15 - 22 - 24, 22, 15, 22, 24],
    [
      (r) => r.comprobante,
       (r) => r.cliente,
       (r) => r.producto,
       (r) => r.modalidad,
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

  // 5. Observaciones de ventas
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

  descargarPDF(doc, `resumen-entrega-${salida.camion?.replace(/\s+/g, "-") || salida.id}-${salida.fecha}.pdf`);
};

export const generarGastosDiaPDF = (gasto) => {
  const doc = createPdf();
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pw, 34, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(217, 119, 6);
  doc.text("MAR AZUL", 15, 14);
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("Historial de Gastos del Dia", pw - 15, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(55, 55, 65);
  doc.text(`Fecha: ${gasto.fecha}`, 15, 50);
  doc.text(`Cierre realizado por: ${gasto.usuario_cierre || "-"}`, 15, 58);
  doc.setFillColor(245, 246, 250);
  doc.roundedRect(15, 70, pw - 30, 62, 3, 3, "F");
  doc.setFontSize(11);
  doc.text("Gastos registrados", 22, 82);
  doc.text(`Combustible: $${parseFloat(gasto.gastos_combustible || 0).toFixed(2)}`, 22, 96);
  doc.text(`Otros gastos: $${parseFloat(gasto.gastos_otros || 0).toFixed(2)}`, 22, 106);
  doc.setFont("helvetica", "bold");
  doc.text(`Total: $${parseFloat(gasto.total || 0).toFixed(2)}`, 22, 120);
  doc.setFont("helvetica", "normal");
  const descripcion = doc.splitTextToSize(`Descripcion: ${gasto.descripcion_otros_gastos || "Sin descripcion"}`, pw - 44);
  doc.text(descripcion, 22, 145);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Documento generado por el Sistema de Gestion Mar Azul", pw / 2, 280, { align: "center" });
  descargarPDF(doc, `gastos-${gasto.fecha}.pdf`);
};

export const generarPagosEmpleadosPDF = (registro) => {
  const doc = createPdf();
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pw, 34, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(217, 119, 6);
  doc.text("MAR AZUL", 15, 14);
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("Historial de Pagos a Empleados", pw - 15, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(55, 55, 65);
  doc.text(`Fecha: ${registro.fecha}`, 15, 50);
  doc.text(`Cierre realizado por: ${registro.usuario_cierre || "-"}`, 15, 58);
  let y = 76;
  doc.setFillColor(245, 246, 250);
  doc.rect(15, y - 8, pw - 30, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.text("Empleado", 20, y);
  doc.text("Rol", 100, y);
  doc.text("Monto", pw - 20, y, { align: "right" });
  y += 12;
  doc.setFont("helvetica", "normal");
  let total = 0;
  for (const pago of registro.pagos || []) {
    const monto = parseFloat(pago.monto || 0);
    total += monto;
    doc.text(pago.nombre || "-", 20, y);
    doc.text(pago.rol || "-", 100, y);
    doc.text(`$${monto.toFixed(2)}`, pw - 20, y, { align: "right" });
    y += 9;
    if (y > 265) { doc.addPage(); y = 20; }
  }
  doc.setFont("helvetica", "bold");
  doc.line(15, y + 2, pw - 15, y + 2);
  doc.text(`Total pagado: $${total.toFixed(2)}`, pw - 20, y + 11, { align: "right" });
  descargarPDF(doc, `pagos-empleados-${registro.fecha}.pdf`);
};

export const generarResumenZonasPDF = async (clientes, zonas = []) => {
  const doc = createPdf();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 15;
  const mr = 15;
  const cw = pw - ml - mr;
  const zonasFiltradas = zonas.length > 0
    ? zonas
    : [...new Set(clientes.map((c) => String(c.zona || "").trim()).filter(Boolean))];

  const normalizar = (zona) => String(zona || "").trim().toLowerCase().replace(/\s+/g, " ");

  const logo = await cargarLogo();

  const headerBarH = 38;
  let y = headerBarH + 16;

  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pw, headerBarH, "F");
  if (logo) {
    doc.addImage(logo, "JPEG", ml, 4, 30, 30);
  }
  doc.setTextColor(217, 119, 6);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Mar Azul", pw / 2, 14, { align: "center" });
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Resumen de Clientes por Zonas", pw / 2, 25, { align: "center" });
  doc.setFontSize(8);
  doc.text(getFechaLocal(), pw - mr, headerBarH + 8, { align: "right" });

  for (const zona of zonasFiltradas) {
    const clientesZona = clientes.filter((c) => normalizar(c.zona) === normalizar(zona));

    if (y + 34 > ph - 20) {
      doc.addPage();
      y = headerBarH + 16;
    }

    doc.setFillColor(74, 107, 90);
    doc.rect(ml, y, cw, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(zona.toUpperCase(), ml + 4, y + 7);
    y += 16;

    if (clientesZona.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(130, 130, 140);
      doc.text("Sin clientes cargados", ml + 4, y);
      y += 14;
      continue;
    }

    doc.setFillColor(230, 232, 240);
    doc.rect(ml, y - 5, cw, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 50);
    doc.text("Cliente", ml + 4, y);
    doc.text("Saldo actual", pw - mr - 4, y, { align: "right" });
    y += 9;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    clientesZona.forEach((c, idx) => {
      if (y > ph - 20) {
        doc.addPage();
        y = 20;
      }
      if (idx % 2 === 1) {
        doc.setFillColor(248, 249, 250);
        doc.rect(ml, y - 5, cw, 9, "F");
      }
      doc.setDrawColor(210, 212, 218);
      doc.setLineWidth(0.2);
      doc.line(ml, y, ml + cw, y);
      doc.setTextColor(50, 50, 60);
      doc.text(c.nombre, ml + 4, y);
      const saldoActual = (parseFloat(c.saldo_pendiente) || 0) - (parseFloat(c.saldo_favor) || 0);
      const saldoTexto = saldoActual < 0
        ? `A favor: $${Math.abs(saldoActual).toFixed(2)}`
        : `$${saldoActual.toFixed(2)}`;
      doc.text(saldoTexto, pw - mr - 4, y, { align: "right" });
      y += 9;
    });
    y += 8;
  }

  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.setFont("helvetica", "normal");
  doc.text("Documento generado automaticamente por el Sistema de Gestion Mar Azul", pw / 2, ph - 12, { align: "center" });

  descargarPDF(doc, `resumen-por-zonas-${getFechaLocal()}.pdf`);
};

const nombreArchivoSeguro = (nombre) => String(nombre || "cliente").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

const montoCuentaCorriente = (venta) => {
  if (venta.pago_dividido) {
    return (venta.VentaPagos || [])
      .filter((pago) => pago.medio_pago === "cuenta_corriente")
      .reduce((total, pago) => total + Number(pago.monto || 0), 0);
  }
  return venta.medio_pago === "cuenta_corriente" ? Number(venta.total || 0) : 0;
};

const prepararEncabezadoCliente = async (doc, titulo, cliente) => {
  const pw = doc.internal.pageSize.getWidth();
  const logo = await cargarLogo();
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pw, 38, "F");
  if (logo) doc.addImage(logo, "JPEG", 15, 4, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(217, 119, 6);
  doc.text("MAR AZUL", 50, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(226, 232, 240);
  doc.text(titulo, 50, 23);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(cliente?.nombre || "Cliente", pw - 15, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generado: ${getFechaLocal()}`, pw - 15, 26, { align: "right" });
};

export const generarHistorialDeudasPDF = async (historial) => {
  const doc = createPdf("landscape");
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 15;
  const cw = pw - 30;
  await prepararEncabezadoCliente(doc, "Historial de deudas y pagos", historial.cliente);

  const movimientos = [];
  for (const venta of historial.ventas || []) {
    const deuda = montoCuentaCorriente(venta);
    if (deuda > 0) {
      movimientos.push({ fecha: `${venta.fecha} ${venta.hora || ""}`, tipo: "Deuda por venta", operacion: venta.tipo_venta === "reparto" ? "Venta reparto" : "Venta local", detalle: `${venta.numero_comprobante} - Cuenta corriente`, monto: deuda, signo: "+" });
    }
  }
  for (const pago of historial.pagos || []) {
    const pagoDesdeVenta = String(pago.notas || "").toLowerCase().includes("incluido en venta");
    const fechaPago = `${pago.fecha_pago || pago.fecha}${pagoDesdeVenta && pago.hora ? ` ${pago.hora}` : ""}`;
    movimientos.push({ fecha: fechaPago, tipo: "Pago de deuda", operacion: pagoDesdeVenta ? "Pago en ventas" : "Registro de pago de cliente", detalle: pago.medio_pago || "-", monto: Number(pago.monto || 0), signo: "-" });
  }
  movimientos.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38);
  doc.text(`Deuda actual: $${Number(historial.saldo_pendiente || 0).toFixed(2)}`, ml, 53);
  doc.setTextColor(16, 140, 80);
  doc.text(`Saldo a favor: $${Number(historial.saldo_favor || 0).toFixed(2)}`, ml + 75, 53);

  const headers = ["Fecha", "Tipo", "Tipo de operacion", "Detalle", "Monto"];
  const widths = [42, 38, 58, cw - 42 - 38 - 58 - 35, 35];
  let y = 62;
  const drawHeader = () => {
    doc.setFillColor(230, 232, 240);
    doc.rect(ml, y, cw, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 50);
    let x = ml + 3;
    headers.forEach((header, index) => { doc.text(header, x, y + 6); x += widths[index]; });
    y += 9;
  };
  drawHeader();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (let index = 0; index < movimientos.length; index++) {
    if (y > ph - 25) { doc.addPage("landscape"); await prepararEncabezadoCliente(doc, "Historial de deudas y pagos", historial.cliente); y = 48; drawHeader(); }
    const movimiento = movimientos[index];
    if (index % 2) { doc.setFillColor(248, 249, 250); doc.rect(ml, y, cw, 8, "F"); }
    let x = ml + 3;
    const values = [movimiento.fecha, movimiento.tipo, movimiento.operacion, movimiento.detalle, `${movimiento.signo}$${movimiento.monto.toFixed(2)}`];
    values.forEach((value, cellIndex) => { doc.setTextColor(cellIndex === 4 && movimiento.signo === "+" ? 180 : 50, cellIndex === 4 && movimiento.signo === "+" ? 100 : 50, cellIndex === 4 && movimiento.signo === "+" ? 40 : 60); doc.text(String(value), x, y + 5.5); x += widths[cellIndex]; });
    doc.setDrawColor(215, 217, 223); doc.line(ml, y + 8, ml + cw, y + 8); y += 8;
  }
  if (!movimientos.length) { doc.setFont("helvetica", "italic"); doc.setTextColor(120, 120, 130); doc.text("No hay deudas ni pagos registrados.", ml + 3, y + 8); }
  doc.setFontSize(7); doc.setTextColor(160, 160, 160); doc.text("Documento generado automaticamente por el Sistema de Gestion Mar Azul", pw / 2, ph - 10, { align: "center" });
  descargarPDF(doc, `historial-deudas-${nombreArchivoSeguro(historial.cliente?.nombre)}.pdf`);
};

export const generarDeudaVentaPDF = async (venta, historial) => {
  const doc = createPdf();
  const pw = doc.internal.pageSize.getWidth();
  const cliente = historial.cliente || venta.cliente;
  await prepararEncabezadoCliente(doc, "Detalle de deuda de venta", cliente);
  const deudaGenerada = montoCuentaCorriente(venta);
  const deudaPagada = Number(venta.monto_deuda_pagado || 0);
  const estados = [];
  if (deudaGenerada > 0) estados.push("Se agrego a cuenta corriente");
  if (deudaPagada > 0) estados.push("Se pago deuda en esta venta");
  const estado = estados.join(" y ") || "Venta sin movimiento de deuda";
  const rows = [
    ["Comprobante", venta.numero_comprobante || "-"],
    ["Fecha", `${venta.fecha} ${venta.hora || ""}`],
    ["Total de la venta", `$${Number(venta.total || 0).toFixed(2)}`],
    ["Agregado a cuenta corriente", `$${deudaGenerada.toFixed(2)}`],
    ["Pagado de deuda en la venta", `$${deudaPagada.toFixed(2)}`],
    ["Deuda actual del cliente", `$${Number(historial.saldo_pendiente || 0).toFixed(2)}`],
    ["Estado", estado],
  ];
  let y = 55;
  const tableX = 15;
  const tableW = pw - 30;
  const labelW = 72;
  const rowH = 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(45, 58, 30);
  doc.text("Detalle de la deuda", tableX, y);
  y += 6;
  doc.setFillColor(230, 232, 240);
  doc.rect(tableX, y, tableW, 10, "F");
  doc.setDrawColor(190, 192, 200);
  doc.rect(tableX, y, tableW, 10, "S");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 50);
  doc.text("Concepto", tableX + 4, y + 6.5);
  doc.text("Valor", tableX + labelW + 4, y + 6.5);
  y += 10;
  rows.forEach(([label, value], index) => {
    if (index % 2 === 1) {
      doc.setFillColor(248, 249, 250);
      doc.rect(tableX, y, tableW, rowH, "F");
    }
    doc.setDrawColor(215, 217, 223);
    doc.rect(tableX, y, tableW, rowH, "S");
    doc.line(tableX + labelW, y, tableX + labelW, y + rowH);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(70, 70, 75);
    doc.text(label, tableX + 4, y + 7);
    doc.setFont("helvetica", index === rows.length - 1 ? "bold" : "normal");
    doc.setTextColor(index === rows.length - 1 && deudaGenerada > 0 ? 180 : 50, index === rows.length - 1 && deudaGenerada > 0 ? 120 : 50, index === rows.length - 1 && deudaGenerada > 0 ? 20 : 60);
    doc.text(String(value), tableX + labelW + 4, y + 7);
    y += rowH;
  });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 75);
  doc.text("El estado refleja los movimientos registrados al momento de generar este documento.", tableX, y);
  doc.setFontSize(7); doc.setTextColor(160, 160, 160); doc.text("Documento generado automaticamente por el Sistema de Gestion Mar Azul", pw / 2, 285, { align: "center" });
  descargarPDF(doc, `deuda-venta-${venta.numero_comprobante || venta.id}.pdf`);
};

export const generarPagoClientePDF = async (pago, historial) => {
  const doc = createPdf();
  const pw = doc.internal.pageSize.getWidth();
  const cliente = historial.cliente;
  await prepararEncabezadoCliente(doc, "Comprobante de pago de cliente", cliente);
  const datosBancarios = pago?.datos_transferencia || pago?.datos_tarjeta;
  const parseDatos = (datos) => {
    if (!datos) return null;
    if (typeof datos === "string") { try { return JSON.parse(datos); } catch { return null; } }
    return datos;
  };
  const datos = parseDatos(datosBancarios) || {};
  const montoPago = Number(pago?.monto || 0);
  const saldoActual = Number(pago?.saldo_actual ?? historial.saldo_pendiente ?? 0);
  const saldoAnterior = Number(pago?.saldo_anterior ?? saldoActual + montoPago);
  const rows = [
    ["Fecha de emision del pago", `${pago?.fecha_pago || pago?.fecha || "-"}`],
    ["Medio de pago", pago?.medio_pago || "-"],
    ["Monto pagado", `$${montoPago.toFixed(2)}`],
    ["Cuenta / titular", pago?.titular || datos.titular || datos.nombre_cuenta || "-"],
    ["Banco", pago?.banco || datos.banco || datos.nombre_banco || "-"],
    ["Observaciones", pago?.notas || "-"],
    ["Saldo anterior", `$${saldoAnterior.toFixed(2)}`],
    ["Saldo actual", `$${saldoActual.toFixed(2)}`],
    ["Saldo a favor actual", `$${Number(historial.saldo_favor || 0).toFixed(2)}`],
  ];
  const tableX = 15;
  const tableW = pw - 30;
  const labelW = 72;
  const rowH = 12;
  let y = 58;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(45, 58, 30);
  doc.text("Datos del pago registrado", tableX, y);
  y += 6;
  doc.setFillColor(230, 232, 240);
  doc.rect(tableX, y, tableW, 10, "F");
  doc.setDrawColor(190, 192, 200);
  doc.rect(tableX, y, tableW, 10, "S");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 50);
  doc.text("Concepto", tableX + 4, y + 6.5);
  doc.text("Valor", tableX + labelW + 4, y + 6.5);
  y += 10;
  rows.forEach(([label, value], index) => {
    if (index % 2) { doc.setFillColor(248, 249, 250); doc.rect(tableX, y, tableW, rowH, "F"); }
    doc.setDrawColor(215, 217, 223);
    doc.rect(tableX, y, tableW, rowH, "S");
    doc.line(tableX + labelW, y, tableX + labelW, y + rowH);
    doc.setFont("helvetica", "bold"); doc.setTextColor(70, 70, 75); doc.text(label, tableX + 4, y + 7.5);
    doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 60); doc.text(String(value), tableX + labelW + 4, y + 7.5);
    y += rowH;
  });
  doc.setFontSize(7); doc.setTextColor(160, 160, 160); doc.text("Documento generado automaticamente por el Sistema de Gestion Mar Azul", pw / 2, 285, { align: "center" });
  descargarPDF(doc, `pago-cliente-${nombreArchivoSeguro(cliente?.nombre)}-${pago?.id || pago?.fecha || "registro"}.pdf`);
};

export const generarHistorialProveedorPDF = (movimiento) => {
  const doc = createPdf();
  const pw = doc.internal.pageSize.getWidth();
  const proveedor = movimiento?.proveedor || {};
  const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`;
  const rows = [
    ["Fecha", movimiento?.fecha || "-"],
    ["Proveedor", proveedor.nombre || "-"],
    ["Mercaderías compradas", dinero(movimiento?.mercaderias_compradas)],
    ["Efectivo enviado", dinero(movimiento?.dinero_ventas)],
    ["Transferencias acumuladas", dinero(movimiento?.transferencias)],
    ["Diferencia del movimiento", dinero(movimiento?.diferencia)],
    ["Deuda / diferencia anterior", dinero(movimiento?.saldo_anterior)],
    ["Deuda / diferencia actual", dinero(movimiento?.saldo_actual)],
  ];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(45, 58, 30);
  doc.text("Historial de proveedor", pw / 2, 25, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  doc.text("Detalle de Saldos y Diferencias", pw / 2, 34, { align: "center" });

  const tableX = 15;
  const tableW = pw - 30;
  const labelW = 85;
  const rowH = 13;
  let y = 52;
  doc.setFillColor(230, 232, 240);
  doc.rect(tableX, y, tableW, 10, "F");
  doc.setDrawColor(190, 192, 200);
  doc.rect(tableX, y, tableW, 10, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 50);
  doc.text("Concepto", tableX + 4, y + 6.5);
  doc.text("Importe", tableX + labelW + 4, y + 6.5);
  y += 10;

  rows.forEach(([label, value], index) => {
    if (index % 2) {
      doc.setFillColor(248, 249, 250);
      doc.rect(tableX, y, tableW, rowH, "F");
    }
    doc.setDrawColor(215, 217, 223);
    doc.rect(tableX, y, tableW, rowH, "S");
    doc.line(tableX + labelW, y, tableX + labelW, y + rowH);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(70, 70, 75);
    doc.text(label, tableX + 4, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 60);
    doc.text(String(value), tableX + labelW + 4, y + 8);
    y += rowH;
  });

  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text("Documento generado automaticamente por el Sistema de Gestion Mar Azul", pw / 2, 285, { align: "center" });
  descargarPDF(doc, `historial-proveedor-${nombreArchivoSeguro(proveedor.nombre)}-${movimiento?.id || movimiento?.fecha || "registro"}.pdf`);
};
