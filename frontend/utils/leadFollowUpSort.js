export function sortLeadFollowUps(leads, direction) {
  if (!['asc', 'desc'].includes(direction)) return leads;
  const date = lead => lead.status === 'Follow-up' && lead.next_follow_up_date ? Date.parse(lead.next_follow_up_date) : NaN;
  return [...leads].sort((a, b) => {
    const first = date(a); const second = date(b);
    if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : 0;
    if (!Number.isFinite(second)) return -1;
    return direction === 'asc' ? first - second : second - first;
  });
}
