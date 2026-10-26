const test = require('node:test');
const assert = require('node:assert/strict');
test('follow-up border follows UAE calendar days, caps at due date and restarts on reschedule', async () => {
  const { followUpProgress } = await import('../../frontend/utils/followUpProgress.js');
  const lead = { status: 'Follow-up', follow_up_scheduled_at: '2026-10-16T20:00:00Z', next_follow_up_date: '2026-10-19' };
  assert.equal(followUpProgress(lead,'2026-10-17'),0);
  assert.equal(followUpProgress(lead,'2026-10-18'),50);
  assert.equal(followUpProgress(lead,'2026-10-19'),100);
  assert.equal(followUpProgress(lead,'2026-10-21'),100);
  assert.equal(followUpProgress({...lead,follow_up_scheduled_at:'2026-10-18T08:00:00Z'},'2026-10-18'),0);
  assert.equal(followUpProgress({...lead,status:'Qualified'},'2026-10-18'),0);
  assert.equal(followUpProgress({...lead,follow_up_scheduled_at:null,created_at:'2026-10-17T08:00:00Z'},'2026-10-18'),50);
  assert.equal(followUpProgress({...lead,follow_up_scheduled_at:'bad'},'2026-10-18'),0);
});
