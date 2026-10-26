const PDFDocument = require('pdfkit');
const styles = ['classic', 'modern', 'compact', 'minimal'];
const types = { invoice: 'Invoice', tax_invoice: 'Tax Invoice', proforma: 'Pro Forma Invoice', sales_order: 'Sales Order', quotation: 'Quotation', receipt: 'Payment Receipt', expense: 'Expense Voucher' };
function validateSettings(value) {
  if (!value || typeof value !== 'object' || !value.defaults || typeof value.defaults !== 'object') throw new Error('Defaults are required');
  const defaults = {};
  for (const [type, style] of Object.entries(value.defaults)) {
    if (!Object.hasOwn(types, type) || !styles.includes(style)) throw new Error('Unknown document type or template');
    defaults[type] = style;
  }
  if (typeof value.footer !== 'string' || value.footer.length > 1200) throw new Error('Footer must be at most 1200 characters');
  return { defaults, footer: value.footer };
}
// One renderer for previews and exports. Every row is measured before pagination.
function renderDocument(data, style, output) {
  if (!styles.includes(style)) throw new Error('Unknown template');
  const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
  doc.pipe(output);
  const color = { classic: '#334155', modern: '#327565', compact: '#475569', minimal: '#111827' }[style];
  const compact = style === 'compact';
  const money = n => `AED ${Number(n || 0).toFixed(2)}`;
  const page = () => { doc.addPage(); doc.y = 48; };
  const space = height => { if (doc.y + height > 740) page(); };
  if (style === 'modern') doc.rect(0, 0, 595, 12).fill(color);
  if (data.logo) { try { doc.image(data.logo, 42, doc.y, { fit: [110, 45] }); doc.y += 55; } catch { /* Invalid or unsupported logos do not block exports. */ } }
  doc.fillColor(color).font('Helvetica-Bold').fontSize(style === 'minimal' ? 20 : 26).text(data.company || 'My Company');
  doc.font('Helvetica').fontSize(9).fillColor('#475569').text(data.companyDetails || '', { width: 510 });
  doc.moveDown();
  doc.font('Helvetica-Bold').fontSize(18).fillColor(color).text(data.title);
  doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`${data.number}   |   ${data.date || ''}`);
  doc.moveDown().text(data.customer || '', { width: 510 });
  if (data.status) doc.text(`Status: ${data.status}`);
  doc.moveDown();
  function tableHeader() {
    const y = doc.y;
    if (style !== 'minimal') doc.rect(42, y, 511, 24).fill(style === 'modern' ? '#e6f1ed' : '#f1f5f9');
    doc.fillColor(color).font('Helvetica-Bold').fontSize(9);
    doc.text('Description', 50, y + 7, { width: 270 });
    doc.text('Qty', 330, y + 7, { width: 35, align: 'right' });
    doc.text('Rate', 370, y + 7, { width: 75, align: 'right' });
    doc.text('Amount', 450, y + 7, { width: 95, align: 'right' });
    doc.y = y + 30;
  }
  tableHeader();
  for (const row of data.items) {
    doc.font('Helvetica').fontSize(compact ? 9 : 10);
    // Split very long descriptions into bounded chunks so no row exceeds a page.
    const description = String(row.description || 'Item');
    const chunks = description.match(/[\s\S]{1,650}/g) || ['Item'];
    for (let i = 0; i < chunks.length; i++) {
      const height = Math.max(compact ? 23 : 32, doc.heightOfString(chunks[i], { width: 270 }) + 12);
      if (doc.y + height > 720) { page(); tableHeader(); doc.font('Helvetica').fontSize(compact ? 9 : 10); }
      const y = doc.y;
      doc.fillColor('#334155').text(chunks[i], 50, y, { width: 270 });
      if (!i) {
        doc.text(String(row.quantity ?? 1), 330, y, { width: 35, align: 'right' });
        doc.text(money(row.rate), 370, y, { width: 75, align: 'right' });
        doc.text(money(row.total), 450, y, { width: 95, align: 'right' });
      }
      doc.y = y + height;
    }
  }
  space(130); doc.moveDown();
  for (const [label, amount] of data.totals) {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(color).text(label, 310, y, { width: 130 });
    doc.text(money(amount), 440, y, { width: 105, align: 'right' });
    doc.y = y + 21;
  }
  for (const section of data.sections || []) {
    if (!section.text) continue;
    space(65); doc.moveDown().font('Helvetica-Bold').fontSize(10).fillColor(color).text(section.title,42,doc.y,{width:510});
    doc.moveDown(.4).font('Helvetica').fontSize(9).fillColor('#334155');
    const paragraphs=[];
    for(const paragraph of String(section.text).split(/\r?\n/)){
      let block='';
      for(const word of paragraph.split(/\s+/)){
        if(block && block.length+word.length+1>600){paragraphs.push(block);block='';}
        block+=(block?' ':'')+word;
      }
      if(block)paragraphs.push(block);
    }
    for (const paragraph of paragraphs) { const height=doc.heightOfString(paragraph,{width:510});space(height+12);doc.text(paragraph,42,doc.y,{width:510}); }
  }
  if (data.footer) { doc.font('Helvetica').fontSize(9); const h = doc.heightOfString(data.footer, { width: 510 }); space(h + 25); doc.moveDown().text(data.footer, 42, doc.y, { width: 510 }); }
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i); doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(`${data.number} · ${i + 1} / ${range.count}`, 42, 780, { width: 510, align: 'right', lineBreak: false });
  }
  doc.end();
  return doc;
}
module.exports = { styles, types, validateSettings, renderDocument };
