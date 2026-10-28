const PDFDocument = require('pdfkit');

/**
 * Generate PDF using pdfkit
 */
exports.generateInvoicePDF = (invoice, res, policy = { title: 'Invoice' }) => {
    const doc = new PDFDocument({ margin: 50 });

    // Stream the PDF to the response
    doc.pipe(res);

    // --- Header ---
    doc.fillColor('#444444')
       .fontSize(24)
       .text('DocClear Management System', 50, 50)
       .fontSize(10)
       .text('Building A-1, Business Bay', 50, 80)
       .text('Dubai, UAE', 50, 95)
       .text('Phone: +971 4 000 0000', 50, 110)
       .moveDown();

    // --- Invoice Info ---
    doc.fillColor('#000000')
       .fontSize(20)
       .text(policy.title.toUpperCase(), 50, 160);
    if (policy.type === 'tax_invoice' && policy.trn) doc.fontSize(10).text(`TRN: ${policy.trn}`, 50, 190);

    doc.fontSize(10)
       .text(`Invoice Number: ${invoice.invoice_number}`, 400, 160)
       .text(`Invoice Date: ${new Date(invoice.createdAt).toLocaleDateString('en-GB')}`, 400, 175)
       .text(`Due Date: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'N/A'}`, 400, 190)
       .moveDown();

    // --- Customer Info ---
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Bill To:', 50, 220);
    
    doc.font('Helvetica')
       .fontSize(10)
       .text(invoice.Customer?.name || 'Customer Name', 50, 235)
       .text(invoice.Customer?.email || 'Email: N/A', 50, 250)
       .text(invoice.Customer?.phone_whatsapp || 'Phone: N/A', 50, 265);

    // --- Table Header ---
    const tableTop = 330;
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .text('Description', 50, tableTop)
       .text('Qty', 270, tableTop)
       .text('Cost', 310, tableTop, { width: 70, align: 'right' })
       .text('Service Chg', 390, tableTop, { width: 70, align: 'right' })
       .text('Total', 470, tableTop, { width: 70, align: 'right' });

    doc.moveTo(50, tableTop + 15)
       .lineTo(550, tableTop + 15)
       .stroke();

    // --- Table Rows ---
    let position = tableTop + 30;
    doc.font('Helvetica');

    invoice.InvoiceItems.forEach(item => {
        doc.fontSize(10)
           .text(item.description, 50, position, { width: 210 })
           .text(item.quantity.toString(), 270, position)
           .text(`${parseFloat(item.cost_price || 0).toFixed(2)}`, 310, position, { width: 70, align: 'right' })
           .text(`${parseFloat(item.service_charge || 0).toFixed(2)}`, 390, position, { width: 70, align: 'right' })
           .text(`${parseFloat(item.total || 0).toFixed(2)}`, 470, position, { width: 70, align: 'right' });

        position += 20;
    });

    // --- Totals ---
    const subtotalPosition = position + 30;
    doc.moveTo(350, subtotalPosition - 10)
       .lineTo(550, subtotalPosition - 10)
       .stroke();

    doc.fontSize(10)
       .text('Subtotal:', 350, subtotalPosition, { width: 90, align: 'right' })
       .text(`${parseFloat(invoice.subtotal).toFixed(2)}`, 450, subtotalPosition, { width: 90, align: 'right' });

    if (invoice.discount > 0) {
        doc.text('Discount:', 350, subtotalPosition + 20, { width: 90, align: 'right' })
           .text(`-${parseFloat(invoice.discount).toFixed(2)}`, 450, subtotalPosition + 20, { width: 90, align: 'right' });
    }

    if (invoice.tax > 0) {
        doc.text('Tax:', 350, subtotalPosition + 40, { width: 90, align: 'right' })
           .text(`${parseFloat(invoice.tax).toFixed(2)}`, 450, subtotalPosition + 40, { width: 90, align: 'right' });
    }

    doc.font('Helvetica-Bold')
       .fontSize(12)
       .fillColor('#0B57D0')
       .text('Total (AED):', 340, subtotalPosition + 60, { width: 100, align: 'right' })
       .text(`${parseFloat(invoice.total).toFixed(2)}`, 450, subtotalPosition + 60, { width: 90, align: 'right' });

    // --- Footer ---
    doc.fillColor('#aaaaaa')
       .fontSize(10)
       .text('Thank you for your business. Payment is due within 15 days.', 50, 700, { align: 'center', width: 500 });

    doc.end();
};

/**
 * Generate Proforma Invoice PDF using pdfkit for a Sales Order
 */
exports.generateProformaInvoicePDF = async (order, tenantId, res) => {
    const { SystemConfig, VoucherDesign, Tax } = require('../models');
    const fs = require('fs');
    const path = require('path');

    // ── Fetch tenant configs ──
    const configs = await SystemConfig.findAll({ where: { tenant_id: tenantId } });
    const configMap = {};
    configs.forEach(c => {
      try { configMap[c.key] = JSON.parse(c.value); } catch { configMap[c.key] = c.value; }
    });

    // ── Fetch voucher design template (Sales Order default) ──
    let template = await VoucherDesign.findOne({
      where: { tenant_id: tenantId, voucher_type: 'Sales Order', is_default: true }
    });
    // Fallback: try Invoice template
    if (!template) {
      template = await VoucherDesign.findOne({
        where: { tenant_id: tenantId, voucher_type: 'Invoice', is_default: true }
      });
    }

    const footerConfig = template?.footer_config || {};
    const brandingConfig = template?.branding_config || {};

    const financials = await require('./salesOrderPricing').totals(order, tenantId);
    const taxRate = financials.tax_rate;

    // ── Resolve logo path ──
    const logoPath = configMap.app_logo
      ? path.join(__dirname, '..', configMap.app_logo.replace(/^\//, ''))
      : null;
    const hasLogo = logoPath && fs.existsSync(logoPath);

    // ── Company Info from configs ──
    const companyName = configMap.app_name || 'My Company';
    const trn = configMap.tax_global_config?.tax_registration_number || '';
    const companyAddress = configMap.company_address || '';
    const companyPhone = configMap.company_phone || '';
    const companyEmail = configMap.company_email || '';

    // ── Colors ──
    const primaryColor = brandingConfig.primaryColor || '#0054a6';
    const headerBgColor = primaryColor;
    const textDark = '#1a1a2e';
    const textMuted = '#555555';
    const borderColor = '#d0d5dd';
    const tableBg = '#f8f9fb';

    // ── Create PDF ──
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const marginLeft = 40;
    const marginRight = 40;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const rightColX = pageWidth - marginRight;

    // ═══════════════════════════════════════════
    // HEADER SECTION
    // ═══════════════════════════════════════════
    let headerY = 40;

    // Logo + Company Name (left side)
    let textStartY = headerY;
    if (hasLogo) {
      try {
        doc.image(logoPath, marginLeft, headerY, { fit: [135, 55] });
        textStartY = headerY + 65; // Place text neatly below the logo
      } catch (e) { /* skip if image fails */ }
    }

    const companyTextX = marginLeft;
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000') // Black color
       .text(companyName, companyTextX, textStartY);

    let infoY = textStartY + 18;
    doc.font('Helvetica').fontSize(9).fillColor('#000000'); // Black color
    if (trn) {
      doc.text(`TRN: ${trn}`, companyTextX, infoY);
      infoY += 13;
    }
    if (companyAddress) {
      doc.text(companyAddress, companyTextX, infoY);
      infoY += 13;
    }
    if (companyPhone) {
      doc.text(`Tel: ${companyPhone}`, companyTextX, infoY);
      infoY += 13;
    }
    if (companyEmail) {
      doc.text(companyEmail, companyTextX, infoY);
      infoY += 13;
    }

    // "PROFORMA INVOICE" title (right side)
    doc.font('Helvetica-Bold').fontSize(20).fillColor(primaryColor)
       .text('PROFORMA INVOICE', marginLeft, headerY, { width: contentWidth, align: 'right' });

    // ── Divider line ──
    const dividerY = Math.max(infoY, headerY + 60) + 8;
    doc.moveTo(marginLeft, dividerY)
       .lineTo(rightColX, dividerY)
       .strokeColor(primaryColor).lineWidth(2).stroke();

    // ═══════════════════════════════════════════
    // INVOICE META + BILL TO (Two column section)
    // ═══════════════════════════════════════════
    let sectionY = dividerY + 16;

    // Left: Bill To
    doc.font('Helvetica-Bold').fontSize(9).fillColor(textMuted)
       .text('BILL TO', marginLeft, sectionY);
    sectionY += 14;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(textDark)
       .text(order.Customer?.name || 'Customer', marginLeft, sectionY);
    sectionY += 15;
    doc.font('Helvetica').fontSize(9).fillColor(textMuted);
    if (order.Customer?.address) {
      doc.text(order.Customer.address, marginLeft, sectionY);
      sectionY += 12;
    }
    const cityCountry = [order.Customer?.city, order.Customer?.country].filter(Boolean).join(', ');
    if (cityCountry) {
      doc.text(cityCountry, marginLeft, sectionY);
      sectionY += 12;
    }
    if (order.Customer?.phone_whatsapp) {
      doc.text(order.Customer.phone_whatsapp, marginLeft, sectionY);
      sectionY += 12;
    }
    if (order.Customer?.email) {
      doc.text(order.Customer.email, marginLeft, sectionY);
      sectionY += 12;
    }

    // Right: Invoice details box
    const metaBoxX = pageWidth - marginRight - 200;
    const metaBoxY = dividerY + 16;
    const metaBoxW = 200;

    // Light background box for meta
    doc.roundedRect(metaBoxX, metaBoxY, metaBoxW, 80, 4)
       .fillColor('#f0f4fa').fill();

    const metaLabelX = metaBoxX + 12;
    const metaValueX = metaBoxX + metaBoxW - 12;
    let metaY = metaBoxY + 10;

    const drawMetaRow = (label, value) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(textMuted)
         .text(label, metaLabelX, metaY, { width: 80 });
      doc.font('Helvetica').fontSize(9).fillColor(textDark)
         .text(value, metaLabelX + 80, metaY, { width: metaBoxW - 104, align: 'right' });
      metaY += 16;
    };

    drawMetaRow('Reference No:', order.order_number || '—');
    drawMetaRow('Date:', new Date(order.order_date).toLocaleDateString('en-GB'));
    if (order.payment_terms == null) drawMetaRow('Due Date:', new Date(order.order_date).toLocaleDateString('en-GB'));
    drawMetaRow('Terms:', order.payment_terms == null ? 'Due on receipt' : order.payment_terms ? 'See below' : 'Not specified');

    // ═══════════════════════════════════════════
    // TABLE SECTION
    // ═══════════════════════════════════════════
    const tableTop = Math.max(sectionY, metaBoxY + 100) + 16;

    // Column widths
    const col1W = 30;   // #
    const col2W = contentWidth - 30 - 60 - 90 - 90; // Description (flexible)
    const col3W = 60;   // Qty
    const col4W = 90;   // Rate
    const col5W = 90;   // Amount

    const col1X = marginLeft;
    const col2X = col1X + col1W;
    const col3X = col2X + col2W;
    const col4X = col3X + col3W;
    const col5X = col4X + col4W;

    const rowHeight = 28;

    // Table header row (colored background)
    doc.roundedRect(marginLeft, tableTop, contentWidth, rowHeight, 3)
       .fillColor(headerBgColor).fill();

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff');
    const headerTextY = tableTop + 9;
    doc.text('#', col1X + 8, headerTextY, { width: col1W - 8 });
    doc.text('Item / Description', col2X + 8, headerTextY, { width: col2W - 8 });
    doc.text('Qty', col3X, headerTextY, { width: col3W, align: 'center' });
    doc.text('Rate', col4X, headerTextY, { width: col4W - 8, align: 'right' });
    doc.text('Amount (AED)', col5X, headerTextY, { width: col5W - 8, align: 'right' });

    // ── Table rows ──
    let currentY = tableTop + rowHeight;
    let subtotal = 0;

    if (order.SalesOrderItems && Array.isArray(order.SalesOrderItems)) {
      order.SalesOrderItems.forEach((item, idx) => {
        const qty = item.quantity || 1;
        const price = parseFloat(item.estimated_price || 0);
        const lineTotal = qty * price;
        subtotal += lineTotal;

        // Alternating row background
        if (idx % 2 === 0) {
          doc.rect(marginLeft, currentY, contentWidth, rowHeight)
             .fillColor(tableBg).fill();
        }

        const rowTextY = currentY + 9;
        doc.font('Helvetica').fontSize(9).fillColor(textDark);
        doc.text((idx + 1).toString(), col1X + 8, rowTextY, { width: col1W - 8 });

        // Service name
        const serviceName = item.service_name || item.description || '';
        doc.font('Helvetica').fontSize(9).fillColor(textDark)
           .text(serviceName, col2X + 8, rowTextY, { width: col2W - 16 });

        doc.text(qty.toString(), col3X, rowTextY, { width: col3W, align: 'center' });
        doc.text(price.toFixed(2), col4X, rowTextY, { width: col4W - 8, align: 'right' });
        doc.text(lineTotal.toFixed(2), col5X, rowTextY, { width: col5W - 8, align: 'right' });

        currentY += rowHeight;

        // Description on secondary line if different
        if (item.description && item.description !== item.service_name) {
          doc.font('Helvetica').fontSize(7.5).fillColor(textMuted)
             .text(item.description, col2X + 8, currentY + 2, { width: col2W - 16 });
          currentY += 16;
        }
      });
    }

    // Bottom border of table
    doc.moveTo(marginLeft, currentY)
       .lineTo(rightColX, currentY)
       .strokeColor(borderColor).lineWidth(0.5).stroke();

    // ═══════════════════════════════════════════
    // TOTALS SECTION (right-aligned)
    // ═══════════════════════════════════════════
    const totalsX = pageWidth - marginRight - 220;
    const totalsW = 220;
    let totalsY = currentY + 14;

    const vatAmount = financials.tax_amount;
    const grandTotal = financials.total;

    const drawTotalRow = (label, value, isBold, isHighlight) => {
      if (isHighlight) {
        doc.roundedRect(totalsX - 4, totalsY - 4, totalsW + 8, 24, 3)
           .fillColor(primaryColor).fill();
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
           .text(label, totalsX, totalsY, { width: totalsW * 0.6, align: 'left' })
           .text(value, totalsX + totalsW * 0.6, totalsY, { width: totalsW * 0.4, align: 'right' });
        totalsY += 30;
      } else {
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(textDark)
           .text(label, totalsX, totalsY, { width: totalsW * 0.6, align: 'left' })
           .text(value, totalsX + totalsW * 0.6, totalsY, { width: totalsW * 0.4, align: 'right' });
        totalsY += 18;
      }
    };

    drawTotalRow('Subtotal:', financials.subtotal.toFixed(2), false, false);
    if (financials.discount > 0) drawTotalRow('Discount:', `-${financials.discount.toFixed(2)}`, false, false);
    if (taxRate > 0) {
      drawTotalRow(`VAT (${taxRate}%):`, vatAmount.toFixed(2), false, false);
    }
    // Separator
    doc.moveTo(totalsX, totalsY - 4)
       .lineTo(totalsX + totalsW, totalsY - 4)
       .strokeColor(borderColor).lineWidth(0.5).stroke();
    totalsY += 6;
    drawTotalRow('Total Balance Due (AED)', grandTotal.toFixed(2), true, true);

    // ═══════════════════════════════════════════
    // BANK DETAILS (bottom left)
    // ═══════════════════════════════════════════
    // Flow saved document sections below totals, reserving footer space.
    const sections = require('./salesOrderDocument').sections(order, footerConfig);
    doc.page.margins.bottom = 90;
    doc.on('pageAdded', () => { doc.page.margins.bottom = 90; });
    let documentY = totalsY + 20;
    for (const section of sections) {
      if (documentY + 45 > doc.page.height - 90) { doc.addPage(); documentY = doc.page.margins.top; }
      doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text(section.title, marginLeft, documentY, { width: contentWidth });
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(8.5).fillColor(textDark).text(section.text, marginLeft, doc.y, { width: contentWidth });
      documentY = doc.y + 18;
    }
    if (documentY > doc.page.height - 85) doc.addPage();
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - 70;
    doc.moveTo(marginLeft, footerY).lineTo(rightColX, footerY).strokeColor(borderColor).lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(textMuted)
      .text('This is a Proforma Invoice. Not a request for payment.', marginLeft, footerY + 8, { width: contentWidth, align: 'center' })
      .text('Thank you for your business!', marginLeft, footerY + 22, { width: contentWidth, align: 'center' });

    doc.end();
};

