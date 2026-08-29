const schedules = new Set(['once', 'daily', 'weekdays', 'weekly', 'monthly', 'interval']);
const categories = new Set(['cleaning', 'maintenance', 'pets', 'errands', 'finances', 'administration', 'outdoors', 'other']);

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const asDate = value => datePattern.test(String(value || '')) ? String(value) : '';
const dayNumber = value => Math.floor(new Date(`${value}T12:00:00Z`).getTime() / 86400000);
const addDays = (value, days) => { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };

export function normalizeResponsibility(item = {}, fallbackId = '') {
  const title = String(item.title || '').trim().slice(0, 120);
  const id = String(item.id || fallbackId).trim().slice(0, 100);
  const schedule = schedules.has(item.schedule) ? item.schedule : 'weekly';
  const assignees = [...new Set((Array.isArray(item.assignees) ? item.assignees : [])
    .map(value => String(value || '').trim().slice(0, 80)).filter(Boolean))].slice(0, 20);
  if (!id || !title || !asDate(item.startDate)) return null;
  return {
    id,
    title,
    description: String(item.description || '').trim().slice(0, 1000),
    category: categories.has(item.category) ? item.category : 'other',
    schedule,
    intervalDays: schedule === 'interval' ? Math.max(1, Math.min(365, Number(item.intervalDays) || 7)) : 0,
    startDate: asDate(item.startDate),
    dueWindowDays: Math.max(0, Math.min(30, Number(item.dueWindowDays) || 0)),
    assignees,
    rotate: Boolean(item.rotate && assignees.length > 1),
    effort: Math.max(1, Math.min(5, Number(item.effort) || 1)),
    points: Math.max(0, Math.min(100, Number(item.points) || Math.max(1, Number(item.effort) || 1) * 5)),
    private: Boolean(item.private),
    verification: Boolean(item.verification),
    checklist: (Array.isArray(item.checklist) ? item.checklist : []).map(value => String(value || '').trim().slice(0, 160)).filter(Boolean).slice(0, 20),
    supplies: (Array.isArray(item.supplies) ? item.supplies : []).map(value => String(value || '').trim().slice(0, 120)).filter(Boolean).slice(0, 20),
    createdAt: String(item.createdAt || new Date().toISOString())
  };
}

export function occursOn(item, date) {
  if (!datePattern.test(date) || date < item.startDate) return false;
  if (item.schedule === 'once') return date === item.startDate;
  if (item.schedule === 'daily') return true;
  const target = new Date(`${date}T12:00:00Z`);
  const start = new Date(`${item.startDate}T12:00:00Z`);
  if (item.schedule === 'weekdays') return target.getUTCDay() > 0 && target.getUTCDay() < 6;
  if (item.schedule === 'weekly') return target.getUTCDay() === start.getUTCDay();
  if (item.schedule === 'monthly') return target.getUTCDate() === start.getUTCDate();
  if (item.schedule === 'interval') return (dayNumber(date) - dayNumber(item.startDate)) % item.intervalDays === 0;
  return false;
}

export function currentAssignee(item, occurrenceIndex = 0) {
  if (!item.assignees.length) return 'Household';
  if (!item.rotate) return item.assignees.join(', ');
  return item.assignees[Math.abs(occurrenceIndex) % item.assignees.length];
}

export function responsibilityOccurrences(items, completions, from, days = 14) {
  const completionMap = new Map((Array.isArray(completions) ? completions : []).map(entry => [`${entry.responsibilityId}:${entry.date}`, entry]));
  const output = [];
  for (const item of items) {
    let occurrenceIndex = 0;
    for (let cursor = item.startDate; cursor < from; cursor = new Date(`${cursor}T12:00:00Z`).toISOString().slice(0, 10)) {
      const next = new Date(`${cursor}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      cursor = next.toISOString().slice(0, 10);
      if (occursOn(item, cursor)) occurrenceIndex += 1;
    }
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(`${from}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + offset);
      const key = date.toISOString().slice(0, 10);
      if (!occursOn(item, key)) continue;
      const completion = completionMap.get(`${item.id}:${key}`) || null;
      output.push({ ...item, occurrenceDate: key, dueDate: addDays(key, item.dueWindowDays), assignee: currentAssignee(item, occurrenceIndex), completed: Boolean(completion), completion });
      occurrenceIndex += 1;
    }
  }
  return output.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate) || b.effort - a.effort);
}

export function contributionSummary(completions, days = 30, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const people = {};
  for (const entry of Array.isArray(completions) ? completions : []) {
    if (new Date(entry.completedAt || `${entry.date}T12:00:00Z`) < cutoff) continue;
    const person = String(entry.completedByName || 'Household');
    people[person] ??= { completions: 0, points: 0, effort: 0, streakWeeks: 0, completionWeeks: new Set() };
    people[person].completions += 1;
    people[person].points += Number(entry.points) || 0;
    people[person].effort += Number(entry.effort) || 0;
    const completed = new Date(entry.completedAt || `${entry.date}T12:00:00Z`), monday = new Date(completed); monday.setUTCDate(completed.getUTCDate() - ((completed.getUTCDay() + 6) % 7)); people[person].completionWeeks.add(monday.toISOString().slice(0, 10));
  }
  const thisMonday = new Date(now); thisMonday.setUTCHours(12,0,0,0); thisMonday.setUTCDate(thisMonday.getUTCDate() - ((thisMonday.getUTCDay() + 6) % 7));
  for (const score of Object.values(people)) { for (let offset = 0; ; offset += 1) { const week = new Date(thisMonday); week.setUTCDate(week.getUTCDate() - offset * 7); if (!score.completionWeeks.has(week.toISOString().slice(0, 10))) break; score.streakWeeks += 1; } delete score.completionWeeks; }
  return people;
}

export function workloadSummary(occurrences) {
  const people = {};
  for (const item of Array.isArray(occurrences) ? occurrences : []) {
    if (item.completed) continue;
    for (const person of String(item.assignee || 'Household').split(',').map(value => value.trim()).filter(Boolean)) {
      people[person] ??= { responsibilities: 0, effort: 0, points: 0 };
      people[person].responsibilities += 1; people[person].effort += Number(item.effort) || 0; people[person].points += Number(item.points) || 0;
    }
  }
  return people;
}
