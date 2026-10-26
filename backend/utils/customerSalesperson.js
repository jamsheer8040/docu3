const { resolveAssignee } = require('./serviceAssignment');

// Omitted creation values default to the acting user. An explicit empty value
// is an invalid selection, rather than a request to leave a customer unassigned.
async function customerSalesperson(value, actor, transaction) {
  const id = await resolveAssignee(value === undefined ? actor.id : value, actor.tenant_id, transaction);
  if (id == null) throw Object.assign(new Error('A salesperson is required for the customer.'), { status: 400 });
  return id;
}
module.exports = { customerSalesperson };
