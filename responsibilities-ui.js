const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const authHeaders = () => window.havenAccessToken ? { Authorization: `Bearer ${window.havenAccessToken}` } : {};
const dateLabel = value => new Date(`${value}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
let notify = () => {};
let state = { items: [], occurrences: [], history: [], contributions: {}, workload: {}, pendingVerification: [], today: '' };
let pendingCompletion = null;

async function request(method = 'GET', body) {
  const response = await fetch('/api/responsibilities', { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...authHeaders() }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Responsibilities are unavailable');
  return data;
}

function renderWidget() {
  const root = document.querySelector('#responsibilities-widget-list');
  if (!root) return;
  const today = state.occurrences.filter(item => item.occurrenceDate <= state.today && item.dueDate >= state.today && !item.completed);
  root.innerHTML = today.length ? today.slice(0, 4).map(item => `<button class="responsibility-mini" data-responsibility-complete="${escapeHtml(item.id)}" data-date="${item.occurrenceDate}"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.assignee)} · effort ${item.effort}/5</small></span><i aria-hidden="true">✓</i></button>`).join('') : '<div class="integration-empty success-empty">Everything is handled for today.</div>';
  const count = document.querySelector('#responsibilities-widget-count');
  if (count) count.textContent = String(today.length);
  window.dispatchEvent(new CustomEvent('haven:responsibilities', { detail: { due: today.length, upcoming: state.occurrences.filter(item => !item.completed).length } }));
}

function renderPage() {
  const root = document.querySelector('#responsibilities-content');
  if (!root) return;
  const open = state.occurrences.filter(item => !item.completed);
  const today = open.filter(item => item.occurrenceDate <= state.today && item.dueDate >= state.today);
  const upcoming = open.filter(item => item.occurrenceDate > state.today).slice(0, 20);
  const contributions = Object.entries(state.contributions).sort((a, b) => b[1].points - a[1].points);
  const workload = Object.entries(state.workload || {}).sort((a,b) => b[1].effort-a[1].effort), maxEffort = Math.max(1,...workload.map(([,score])=>score.effort));
  const cards = list => list.map(item => `<article class="responsibility-card"><button class="responsibility-check" data-responsibility-complete="${escapeHtml(item.id)}" data-date="${item.occurrenceDate}" aria-label="Complete ${escapeHtml(item.title)}">✓</button><div><span class="responsibility-meta">${escapeHtml(item.category)} · ${dateLabel(item.occurrenceDate)}${item.dueDate!==item.occurrenceDate?`–${dateLabel(item.dueDate)}`:''}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.assignee)} · Effort ${item.effort}/5 · ${item.points} contribution points</p>${item.description ? `<small>${escapeHtml(item.description)}</small>` : ''}${item.checklist.length ? `<ul>${item.checklist.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ul>` : ''}${item.supplies.length?`<small class="responsibility-supplies">Supplies: ${item.supplies.map(escapeHtml).join(', ')}</small>`:''}</div>${state.canManage ? `<button class="responsibility-edit" data-responsibility-edit="${escapeHtml(item.id)}">Edit</button>` : ''}</article>`).join('') || '<div class="responsibility-empty">Nothing needs attention here.</div>';
  document.querySelector('#add-responsibility')?.classList.toggle('hidden', !state.canManage);
  const history=(state.history||[]).slice(0,20).map(entry=>`<article class="responsibility-history-row"><span class="${entry.verified===false?'pending':''}">${entry.verified===false?'Awaiting verification':'Completed'}</span><strong>${escapeHtml(state.items.find(item=>item.id===entry.responsibilityId)?.title||'Responsibility')}</strong><small>${escapeHtml(entry.completedByName)} · ${new Date(entry.completedAt).toLocaleString()}${entry.notes?` · ${escapeHtml(entry.notes)}`:''}</small><div>${entry.photoId?`<button class="text-button" data-view-completion-photo="${escapeHtml(entry.id)}">View photo</button>`:''}${entry.verified===false&&state.canManage?`<button class="text-button" data-verify-completion="${escapeHtml(entry.id)}">Verify</button>`:''}</div></article>`).join('')||'<div class="responsibility-empty">No completion history yet.</div>';
  root.innerHTML = `<div class="responsibility-stats"><div><strong>${today.length}</strong><span>Due now</span></div><div><strong>${open.length}</strong><span>Next 30 days</span></div><div><strong>${state.items.length}</strong><span>Active responsibilities</span></div></div><div class="responsibility-layout"><section><div class="section-heading"><div><p class="eyebrow">DUE NOW</p><h2>What needs handling</h2></div></div><div class="responsibility-list">${cards(today)}</div><div class="section-heading responsibility-upcoming-title"><div><p class="eyebrow">UPCOMING</p><h2>Plan ahead</h2></div></div><div class="responsibility-list">${cards(upcoming)}</div></section><aside><section class="card contribution-panel"><p class="eyebrow">CONTRIBUTION</p><h2>Last 30 days</h2><p>Momentum and household load—not money.</p><div>${contributions.map(([name, score], index) => `<div class="contribution-row"><b>${index + 1}</b><span><strong>${escapeHtml(name)}</strong><small>${score.completions} completed · effort ${score.effort}${score.streakWeeks?` · ${score.streakWeeks}w streak`:''}</small></span><em>${score.points} pts</em></div>`).join('') || '<div class="responsibility-empty">Complete work to build momentum.</div>'}</div></section><section class="card workload-panel"><p class="eyebrow">HOUSEHOLD LOAD</p><h2>Upcoming effort</h2>${workload.map(([name,score])=>`<div class="workload-row"><span>${escapeHtml(name)} <b>${score.effort}</b></span><i><b style="width:${Math.round(score.effort/maxEffort*100)}%"></b></i></div>`).join('')||'<div class="responsibility-empty">No assigned workload.</div>'}</section>${state.externalChoreAppConfigured ? `<section class="migration-note"><strong>Existing chore app connected</strong><p>Import its currently pending chores as one-time Haven responsibilities. Duplicates are skipped.</p>${state.canManage?'<button class="outline-button" type="button" data-import-chores>Import pending chores</button>':''}</section>` : ''}</aside></div><section class="card responsibility-history"><div class="section-heading"><div><p class="eyebrow">HISTORY</p><h2>Completion record</h2></div><span>${state.pendingVerification?.length||0} awaiting verification</span></div>${history}</section>`;
}

export async function loadResponsibilities() {
  if (!window.havenAccessToken && !window.havenOfflineMode) return;
  try { const result=await cachedUserJson('responsibilities',()=>request()); state = result.data; state.stale=result.stale; renderWidget(); renderPage(); }
  catch (error) {
    const root = document.querySelector('#responsibilities-content');
    if (root) root.innerHTML = `<div class="empty-state"><h2>Responsibilities unavailable</h2><p>${escapeHtml(error.message)}</p><button class="primary-button" data-responsibilities-retry>Try again</button></div>`;
  }
}

import { cachedUserJson } from './offline-data.js';

function openEditor(id = '') {
  const form = document.querySelector('#responsibility-form');
  const panel = document.querySelector('#responsibility-editor');
  form.reset();
  const item = state.items.find(entry => entry.id === id);
  form.elements.id.value = item?.id || '';
  form.elements.title.value = item?.title || '';
  form.elements.description.value = item?.description || '';
  form.elements.category.value = item?.category || 'cleaning';
  form.elements.schedule.value = item?.schedule || 'weekly';
  form.elements.startDate.value = item?.startDate || state.today || new Date().toISOString().slice(0, 10);
  form.elements.intervalDays.value = item?.intervalDays || 7;
  form.elements.dueWindowDays.value = item?.dueWindowDays || 0;
  form.elements.assignees.value = item?.assignees?.join(', ') || '';
  form.elements.rotate.checked = Boolean(item?.rotate);
  form.elements.effort.value = item?.effort || 2;
  form.elements.points.value = item?.points || 10;
  form.elements.checklist.value = item?.checklist?.join('\n') || '';
  form.elements.supplies.value = item?.supplies?.join('\n') || '';
  form.elements.verification.checked = Boolean(item?.verification);
  form.elements.private.checked = Boolean(item?.private);
  document.querySelector('#responsibility-editor-title').textContent = item ? 'Edit responsibility' : 'Add responsibility';
  document.querySelector('#responsibility-delete').classList.toggle('hidden', !item);
  panel.classList.remove('hidden');
}

export function initializeResponsibilities(options = {}) {
  notify = options.toast || notify;
  document.addEventListener('click', async event => {
    const complete = event.target.closest('[data-responsibility-complete]');
    const edit = event.target.closest('[data-responsibility-edit]');
    const verify = event.target.closest('[data-verify-completion]');
    const photo = event.target.closest('[data-view-completion-photo]');
    if (event.target.closest('#add-responsibility')) return openEditor();
    if (edit) return openEditor(edit.dataset.responsibilityEdit);
    if (event.target.closest('#responsibility-editor-close')) return document.querySelector('#responsibility-editor').classList.add('hidden');
    if (event.target.closest('[data-responsibilities-retry]')) return loadResponsibilities();
    if (event.target.closest('[data-import-chores]')) { try { const result=await request('POST',{action:'import-external'}); state=result; renderWidget(); renderPage(); notify(`${result.imported} pending chores imported`); } catch(error){ notify(error.message); } return; }
    if (verify) { try { state=await request('PATCH',{action:'verify',completionId:verify.dataset.verifyCompletion}); renderWidget(); renderPage(); notify('Completion verified'); } catch(error){ notify(error.message); } return; }
    if (photo) { try { const response=await fetch(`/api/responsibility-photo?completionId=${encodeURIComponent(photo.dataset.viewCompletionPhoto)}`,{headers:authHeaders()});if(!response.ok)throw new Error('Photo unavailable');const url=URL.createObjectURL(await response.blob());window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),60000); } catch(error){notify(error.message);} return; }
    if (complete) {
      pendingCompletion={id:complete.dataset.responsibilityComplete,date:complete.dataset.date,title:state.items.find(item=>item.id===complete.dataset.responsibilityComplete)?.title||'Responsibility'};document.querySelector('#completion-description').textContent=pendingCompletion.title;document.querySelector('#completion-form').reset();document.querySelector('#completion-dialog').classList.remove('hidden');return;
    }
  });
  document.querySelector('#responsibility-form')?.addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const id = data.get('id');
    const body = { id, title: data.get('title'), description: data.get('description'), category: data.get('category'), schedule: data.get('schedule'), startDate: data.get('startDate'), intervalDays: data.get('intervalDays'), dueWindowDays: data.get('dueWindowDays'), assignees: String(data.get('assignees') || '').split(',').map(value => value.trim()).filter(Boolean), rotate: data.get('rotate') === 'on', effort: data.get('effort'), points: data.get('points'), checklist: String(data.get('checklist') || '').split('\n'), supplies: String(data.get('supplies') || '').split('\n'), verification: data.get('verification') === 'on', private: data.get('private') === 'on' };
    try { state = await request(id ? 'PATCH' : 'POST', body); document.querySelector('#responsibility-editor').classList.add('hidden'); renderWidget(); renderPage(); notify(id ? 'Responsibility updated' : 'Responsibility added'); }
    catch (error) { notify(error.message); }
  });
  document.querySelector('#responsibility-delete')?.addEventListener('click', async () => {
    const id = document.querySelector('#responsibility-form').elements.id.value; if (!id || !confirm('Delete this responsibility and its completion history?')) return;
    try { state = await request('DELETE', { id }); document.querySelector('#responsibility-editor').classList.add('hidden'); renderWidget(); renderPage(); notify('Responsibility deleted'); }
    catch (error) { notify(error.message); }
  });
  document.querySelector('#completion-cancel')?.addEventListener('click',()=>{pendingCompletion=null;document.querySelector('#completion-dialog').classList.add('hidden')});
  document.querySelector('#completion-form')?.addEventListener('submit',async event=>{event.preventDefault();if(!pendingCompletion)return;const form=event.currentTarget,data=new FormData(form),button=form.querySelector('[type="submit"]');button.disabled=true;try{state=await request('PATCH',{id:pendingCompletion.id,date:pendingCompletion.date,action:'complete',completed:true,notes:data.get('notes')});const completion=state.history.find(entry=>entry.responsibilityId===pendingCompletion.id&&entry.date===pendingCompletion.date),file=data.get('photo');if(file?.size){if(file.size>2*1024*1024)throw new Error('Photo must be 2 MB or smaller');const response=await fetch(`/api/responsibility-photo?completionId=${encodeURIComponent(completion.id)}`,{method:'POST',headers:{'Content-Type':file.type,...authHeaders()},body:file});const result=await response.json();if(!response.ok)throw new Error(result.error)}pendingCompletion=null;document.querySelector('#completion-dialog').classList.add('hidden');await loadResponsibilities();notify('Responsibility completed')}catch(error){notify(error.message||'Responsibility could not be completed')}finally{button.disabled=false}});
}
