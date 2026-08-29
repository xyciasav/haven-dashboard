import assert from 'node:assert/strict';
import test from 'node:test';
import { contributionSummary, currentAssignee, normalizeResponsibility, occursOn, responsibilityOccurrences, workloadSummary } from '../lib/responsibilities.js';

const weekly = normalizeResponsibility({ id: 'filters', title: 'Check HVAC filter', category: 'maintenance', schedule: 'weekly', startDate: '2026-08-28', assignees: ['Mike', 'Alex'], rotate: true, effort: 2 });

test('responsibilities are normalized with adult workload metadata', () => {
  assert.equal(weekly.points, 10);
  assert.equal(weekly.category, 'maintenance');
  assert.deepEqual(weekly.assignees, ['Mike', 'Alex']);
});

test('weekly and weekday recurrence are calculated in UTC-safe calendar days', () => {
  assert.equal(occursOn(weekly, '2026-09-04'), true);
  assert.equal(occursOn(weekly, '2026-09-05'), false);
  const weekday = normalizeResponsibility({ id: 'mail', title: 'Check mail', schedule: 'weekdays', startDate: '2026-08-28' });
  assert.equal(occursOn(weekday, '2026-08-29'), false);
  assert.equal(occursOn(weekday, '2026-08-31'), true);
});

test('rotation changes ownership without changing shared assignments', () => {
  assert.equal(currentAssignee(weekly, 0), 'Mike');
  assert.equal(currentAssignee(weekly, 1), 'Alex');
});

test('occurrences merge completion history', () => {
  const completions = [{ responsibilityId: 'filters', date: '2026-08-28', completedAt: '2026-08-28T18:00:00Z', completedByName: 'Mike' }];
  const occurrences = responsibilityOccurrences([weekly], completions, '2026-08-28', 9);
  assert.equal(occurrences.length, 2);
  assert.equal(occurrences[0].completed, true);
  assert.equal(occurrences[1].assignee, 'Alex');
});

test('due windows expose a usable completion range', () => {
  const item = normalizeResponsibility({ id: 'filter', title: 'Replace filter', schedule: 'monthly', startDate: '2026-08-28', dueWindowDays: 5 });
  const [occurrence] = responsibilityOccurrences([item], [], '2026-08-28', 1);
  assert.equal(occurrence.occurrenceDate, '2026-08-28');
  assert.equal(occurrence.dueDate, '2026-09-02');
});

test('contribution summaries measure completed work rather than currency', () => {
  const summary = contributionSummary([{ completedByName: 'Mike', completedAt: '2026-08-28T12:00:00Z', points: 10, effort: 2 }], 30, new Date('2026-08-28T18:00:00Z'));
  assert.deepEqual(summary.Mike, { completions: 1, points: 10, effort: 2, streakWeeks: 1 });
});

test('workload summaries compare planned effort without treating points as money', () => {
  const summary = workloadSummary([{ assignee: 'Mike', effort: 3, points: 15, completed: false }, { assignee: 'Alex', effort: 1, points: 5, completed: true }]);
  assert.deepEqual(summary, { Mike: { responsibilities: 1, effort: 3, points: 15 } });
});
