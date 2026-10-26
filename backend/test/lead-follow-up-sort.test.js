const test = require('node:test');
const assert = require('node:assert/strict');
test('follow-up sorting orders remaining days with unscheduled leads last in either direction', async () => {
  const { sortLeadFollowUps } = await import('../../frontend/utils/leadFollowUpSort.js');
  const leads = [{ id: 1, status: 'New' }, { id: 2, status: 'Follow-up', next_follow_up_date: '2026-10-20' }, { id: 3, status: 'Follow-up', next_follow_up_date: '2026-10-17' }, { id: 4, status: 'Follow-up', next_follow_up_date: '2026-10-15' }, { id: 5, status: 'Follow-up', next_follow_up_date: 'invalid' }];
  assert.deepEqual(sortLeadFollowUps(leads, 'asc').map(lead => lead.id), [4,3,2,1,5]);
  assert.deepEqual(sortLeadFollowUps(leads, 'desc').map(lead => lead.id), [2,3,4,1,5]);
  assert.deepEqual(leads.map(lead => lead.id), [1,2,3,4,5]);
  assert.equal(sortLeadFollowUps(leads, 'default'), leads);
});
