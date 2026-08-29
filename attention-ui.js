const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
let responsibilities = { due: 0, upcoming: 0 };

function collectAttention() {
  const items = [];
  if (!navigator.onLine) items.push({ tone: 'warning', title: 'Haven is offline', detail: 'Live controls are paused; cached information remains available.' });
  const homeTitle = document.querySelector('#home-status-title')?.textContent || '';
  if (/unavailable|error/i.test(homeTitle)) items.push({ tone: 'warning', title: 'Home Assistant needs attention', detail: homeTitle, page: 'integrations' });
  const sentinel = document.querySelector('#sentinel-status');
  if (sentinel?.classList.contains('degraded')) items.push({ tone: 'warning', title: 'A household service is degraded', detail: sentinel.textContent.trim(), page: 'diagnostics' });
  if (responsibilities.due) items.push({ tone: 'action', title: `${responsibilities.due} ${responsibilities.due === 1 ? 'responsibility' : 'responsibilities'} due today`, detail: 'Review today’s shared household work.', page: 'responsibilities' });
  return items;
}

export function renderAttention() {
  const root = document.querySelector('#attention-list');
  const card = document.querySelector('[data-widget="attention"]');
  if (!root || !card) return;
  const items = collectAttention();
  card.classList.toggle('all-calm', !items.length);
  document.querySelector('#attention-title').textContent = items.length ? 'A few things need attention' : 'Everything looks calm';
  document.querySelector('#attention-count').textContent = items.length ? String(items.length) : '✓';
  root.innerHTML = items.length ? items.map(item => `<button type="button" class="attention-item ${item.tone}" ${item.page ? `data-page-target="${item.page}"` : ''}><span></span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div><b>→</b></button>`).join('') : '<div class="attention-calm"><span>✓</span><p>No urgent household work or service problems right now.</p></div>';
}

export function initializeAttention() {
  window.addEventListener('haven:responsibilities', event => { responsibilities = event.detail; renderAttention(); });
  window.addEventListener('online', renderAttention); window.addEventListener('offline', renderAttention);
  const observer = new MutationObserver(renderAttention);
  for (const target of [document.querySelector('#home-status-title'), document.querySelector('#sentinel-status')]) if (target) observer.observe(target, { childList: true, subtree: true, attributes: true });
  renderAttention();
}
