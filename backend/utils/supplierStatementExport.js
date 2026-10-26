const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const dateText = date => new Date(date).toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric' });
const money = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const headers = ['Date', 'Reference', 'Description', 'Debit (AED)', 'Credit (AED)', 'Balance (AED)'];
function totals(rows, period) {
  return [rows.reduce((s, r) => s + r.debitCents, 0) / 100, rows.reduce((s, r) => s + r.creditCents, 0) / 100, period.closing ?? rows.at(-1)?.balance ?? 0];
}
const periodText = period => period.from || period.to ? `${period.from || 'Beginning'} to ${period.to || 'Latest'}` : 'All transactions';
async function excel(supplier, rows, period = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Supplier Statement', { views: [{ state: 'frozen', ySplit: 6 }] });
  sheet.columns = [18, 18, 65, 20, 20, 20].map(width => ({ width }));
  sheet.mergeCells('A1:F1'); sheet.getCell('A1').value = 'Supplier Statement';
  sheet.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FF4F7D71' } };
  sheet.mergeCells('A2:F2'); sheet.getCell('A2').value = supplier.name;
  sheet.mergeCells('A3:F3'); sheet.getCell('A3').value = `${periodText(period)} | Debit = payments | Credit = purchases | Negative balance = advance / credit`;
  sheet.mergeCells('A4:F4'); sheet.getCell('A4').value = `Exported ${dateText(new Date())} | Opening balance AED ${money(period.opening || 0)}`;
  sheet.addRow([]); sheet.addRow(headers);
  if (period.from) sheet.addRow([period.from, '', 'Opening balance (brought forward)', 0, 0, period.opening || 0]).font = { bold: true };
  for (const row of rows) {
    const added = sheet.addRow([dateText(row.date), row.reference, `${row.description}\n${row.kind} - ${row.detail}`, row.debit, row.credit, row.balance]);
    added.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    added.height = Math.max(32, Math.ceil((row.description.length + row.detail.length + 15) / 60) * 15);
  }
  sheet.addRow(['', '', 'Totals / Closing balance', ...totals(rows, period)]).font = { bold: true };
  for (let n = 7; n <= sheet.rowCount; n++) for (let c = 4; c <= 6; c++) sheet.getCell(n, c).numFmt = '#,##0.00;[Red]-#,##0.00';
  sheet.getRow(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F7D71' } };
  sheet.autoFilter = { from: 'A6', to: `F${Math.max(6, sheet.rowCount - 1)}` };
  sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:6' };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
function pdf(supplier, rows, period = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true });
    const chunks = []; doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const widths = [82, 70, 300, 104, 104, 109];
    const bottom = doc.page.height - 55;
    let y;
    function tableRow(values, height, bold = false) {
      let x = 36;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#263f37');
      values.forEach((value, i) => { doc.text(String(value), x + 5, y + 7, { width: widths[i] - 10, height: height - 10, align: i >= 3 ? 'right' : 'left' }); x += widths[i]; });
      doc.strokeColor('#e4ece8').moveTo(36, y + height).lineTo(805, y + height).stroke();
      y += height;
    }
    function page() {
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#4f7d71').text('Supplier Statement', 36, 32);
      doc.fontSize(11).text(supplier.name, 36, 59, { width: 769, height: 30, ellipsis: true });
      doc.font('Helvetica').fontSize(9).text(`${periodText(period)} | Exported ${dateText(new Date())} | Opening balance AED ${money(period.opening || 0)}`, 36, 92);
      doc.text('Debit = payments | Credit = purchases | Negative balance = advance / credit', 36, 108);
      y = 130; tableRow(headers, 30, true);
    }
    page();
    if (period.from) tableRow([period.from, '', 'Opening balance (brought forward)', '', '', money(period.opening || 0)], 38, true);
    for (const row of rows) {
      const values = [dateText(row.date), row.reference, `${row.description}\n${row.kind} - ${row.detail}`, money(row.debit), money(row.credit), money(row.balance)];
      doc.font('Helvetica').fontSize(9);
      const height = Math.max(38, ...values.map((value, i) => doc.heightOfString(value, { width: widths[i] - 10 }) + 16));
      if (y + height > bottom) { doc.addPage(); page(); }
      tableRow(values, height);
    }
    if (y + 38 > bottom) { doc.addPage(); page(); }
    tableRow(['', '', 'Totals / Closing balance', ...totals(rows, period).map(money)], 38, true);
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      // Footer is deliberately inside the margin; prevent PDFKit inserting a blank page.
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(8).text(`Page ${i + 1} of ${range.count}`, 36, doc.page.height - 35, { width: 769, align: 'right', lineBreak: false });
      doc.page.margins.bottom = bottomMargin;
    }
    doc.end();
  });
}
module.exports = { excel, pdf };
