const round = value => Math.round(Number(value || 0) * 100) / 100;

export function bundleLines(items, { kind, pricingCategory = 'Normal' } = {}) {
  return items.map(({ service, quantity }) => {
    const prices = service.ServiceTypePricings || [];
    const pricing = service.pricing_mode === 'Multi'
      ? prices.find(price => price.pricing_type === pricingCategory)
      : prices.find(price => price.pricing_type === 'Single') || prices[0];
    const cost = Number(service.cost_price || 0);
    const service_charge = Number(pricing?.service_charge ?? service.service_charge ?? 0);
    const common = { service_type_id: service.id, service_name: service.name, description: '', quantity, cost, service_charge, expected_processing_time: '' };
    return kind === 'quotation'
      ? { ...common, rate: round(cost + service_charge) }
      : { ...common, estimated_price: round(cost + service_charge), priority: 'Normal', is_locked: false };
  });
}

// Replace only the untouched initial placeholder. Never overwrite an existing row.
export function appendBundleLines(existing, incoming, limit = Infinity) {
  const blank = item => !item.id && !item.is_locked && !item.service_type_id && !item.service_name && !item.description &&
    Number(item.quantity) === 1 && !Number(item.cost) && !Number(item.service_charge) && !Number(item.rate || item.estimated_price) &&
    !item.expected_processing_time && (!item.priority || item.priority === 'Normal');
  const retained = existing.length === 1 && blank(existing[0]) ? [] : existing;
  if (retained.length + incoming.length > limit) throw new Error(`A document can contain at most ${limit} service lines. No template services were added.`);
  return [...retained, ...incoming.map(item => ({ ...item }))];
}
