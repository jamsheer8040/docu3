// Additive storage: no changes to historical business rows or voucher designs.
// Capture layout defaults inside the same transaction that creates a document.
module.exports = function installSnapshots({ SystemConfig, DocumentTemplateSnapshot, Invoice, SalesOrder, Expense, WalletTransaction }) {
  const groups = [[Invoice, 'invoice', ['invoice', 'tax_invoice']], [SalesOrder, 'order', ['sales_order', 'proforma']], [Expense, 'expense', ['expense']], [WalletTransaction, 'receipt', ['receipt']]];
  for (const [Model, group, types] of groups) {
    Model.addHook('afterCreate', 'documentTemplateSnapshot', async (record, options) => {
      if (!record.tenant_id) return;
      if (group === 'receipt' && !(record.type === 'Income' && record.direction === 'In' && record.reference_type === 'Invoice')) return;
      const transaction = options.transaction;
      const tenant_id = record.tenant_id;
      const row = await SystemConfig.findOne({ where: { key: 'document_templates', tenant_id }, transaction });
      let preferences; try { preferences = JSON.parse(row?.value || '{}'); } catch { preferences = {}; }
      const defaults = Object.fromEntries(types.map(type => [type, preferences.defaults?.[type] || 'classic']));
      await DocumentTemplateSnapshot.create({ document_group: group, record_id: record.id, tenant_id, version: 1, defaults, footer: preferences.footer || '' }, { transaction });
    });
  }
};
