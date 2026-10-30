const emailPattern = /^[^\s@<>;,\r\n]+@[^\s@<>;,\r\n]+\.[^\s@<>;,\r\n]+$/;
function email(value) { return typeof value === 'string' && value.length <= 250 && emailPattern.test(value); }
function recipients(input) {
  const values = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/[;,\n]/) : input == null ? [] : [input];
  if (values.length > 20 || values.some(value => typeof value !== 'string')) throw new Error('Add no more than 20 valid CC email addresses.');
  const addresses = [...new Set(values.map(value => value.trim()).filter(Boolean))];
  if (addresses.some(value => !email(value))) throw new Error('Enter valid CC email addresses, separated by commas.');
  return addresses;
}
function validateMessage(input) {
  const to = typeof input.to === 'string' ? input.to.trim() : '';
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  if (!email(to)) throw new Error('Enter one valid recipient email address.');
  if (!subject || subject.length > 250 || /[\r\n]/.test(subject)) throw new Error('Enter a subject of up to 250 characters on one line.');
  if (!body || body.length > 20000) throw new Error('Enter a message of up to 20,000 characters.');
  return { to, cc: recipients(input.cc).filter(address => address.toLowerCase() !== to.toLowerCase()), subject, body };
}
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function draft(document, company) {
  const date = String(document.expiry_date).slice(0, 10);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  const expiry = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  const type = document.DocumentType?.name || document.type || 'Document';
  const timing = days < 0 ? `expired ${Math.abs(days)} day(s) ago` : days === 0 ? 'expires today' : `expires in ${days} day(s)`;
  const name = document.Customer?.name || 'Customer';
  return {
    to: document.Customer?.email || '', cc: [],
    subject: `${type} expiry reminder${document.doc_number ? ` – ${document.doc_number}` : ''}`.slice(0, 250),
    body: `Dear ${name},\n\nThis is a reminder that your ${type} ${timing}.\n\nDocument number: ${document.doc_number || 'Not specified'}\nExpiry date: ${expiry}${document.staff_name ? `\nDocument holder: ${document.staff_name}` : ''}\n\nPlease arrange the renewal to avoid any interruption or penalties. Contact us if you need assistance.\n\nKind regards,\n${company}`
  };
}
module.exports = { email, recipients, validateMessage, escapeHtml, draft };
