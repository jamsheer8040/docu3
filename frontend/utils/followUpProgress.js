// Calendar-day progress in UAE time. The entire due day is already 100%.
export function followUpProgress(lead, today) {
  if (lead.status !== 'Follow-up' || !lead.next_follow_up_date || !today) return 0;
  const deadline = Date.parse(lead.next_follow_up_date);
  const current = Date.parse(today);
  if (!Number.isFinite(deadline) || !Number.isFinite(current)) return 0;
  if (current >= deadline) return 100;
  const scheduled = new Date(lead.follow_up_scheduled_at || lead.created_at);
  if (!Number.isFinite(scheduled.getTime())) return 0;
  const start = Date.parse(new Date(scheduled.getTime() + 14400000).toISOString().slice(0, 10));
  if (start >= deadline) return 0;
  return Math.max(0, Math.min(100, (current - start) / (deadline - start) * 100));
}
