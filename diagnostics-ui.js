const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const authHeaders = () => window.havenAccessToken ? { Authorization: `Bearer ${window.havenAccessToken}` } : {};

function duration(seconds) {
  const days = Math.floor(seconds / 86400), hours = Math.floor((seconds % 86400) / 3600), minutes = Math.floor((seconds % 3600) / 60);
  return [days && `${days}d`, hours && `${hours}h`, `${minutes}m`].filter(Boolean).join(' ');
}

export async function loadDiagnostics() {
  if (!window.havenAccessToken) return;
  const root = document.querySelector('#diagnostics-content');
  if (!root) return;
  root.innerHTML = '<div class="empty-state"><h2>Running Haven checks</h2><p>Reading runtime and integration health.</p></div>';
  try {
    const started = performance.now(), response = await fetch('/api/diagnostics', { headers: authHeaders(), cache: 'no-store' }), data = await response.json(), latency = Math.round(performance.now() - started);
    if (!response.ok) throw new Error(data.error || 'Diagnostics unavailable');
    const integrations = Object.entries(data.integrations || {}).filter(([, value]) => value && typeof value === 'object' && Object.hasOwn(value, 'configured'));
    root.innerHTML = `<div class="diagnostic-summary"><div><strong>${escapeHtml(data.version)}</strong><span>Haven version</span></div><div><strong>${duration(data.uptimeSeconds)}</strong><span>Uptime</span></div><div><strong>${latency} ms</strong><span>API response</span></div><div><strong>${data.memoryMb.resident} MB</strong><span>Memory</span></div></div><div class="diagnostic-layout"><section class="card diagnostic-panel"><div class="section-heading"><div><p class="eyebrow">CONNECTIONS</p><h2>Integration readiness</h2></div><button class="outline-button" type="button" data-refresh-diagnostics>Refresh</button></div><div class="diagnostic-list">${integrations.map(([name, value]) => `<div><span class="diagnostic-dot ${value.configured ? 'ready' : ''}"></span><strong>${escapeHtml(name.replaceAll(/([A-Z])/g, ' $1'))}</strong><small>${value.configured ? 'Configured' : 'Not configured'}</small></div>`).join('')}</div></section><section class="card diagnostic-panel"><p class="eyebrow">DATA</p><h2>Stored records</h2><div class="diagnostic-counts">${Object.entries(data.data).map(([name, count]) => `<div><strong>${count}</strong><span>${escapeHtml(name.replaceAll(/([A-Z])/g, ' $1'))}</span></div>`).join('')}</div><p class="diagnostic-runtime">${escapeHtml(data.node)} · household role: ${escapeHtml(data.role)}</p></section></div>${data.recentAudit?.length ? `<section class="card diagnostic-panel diagnostic-audit"><p class="eyebrow">AUDIT HISTORY</p><h2>Recent household changes</h2><div>${data.recentAudit.map(entry => `<article><time>${new Date(entry.at).toLocaleString()}</time><strong>${escapeHtml(entry.actorName)}</strong><span>${escapeHtml(entry.action.replaceAll('.', ' '))}</span><small>${escapeHtml(entry.detail || entry.target)}</small></article>`).join('')}</div></section>` : ''}`;
  } catch (error) { root.innerHTML = `<div class="empty-state"><h2>Diagnostics unavailable</h2><p>${escapeHtml(error.message)}</p><button class="primary-button" type="button" data-refresh-diagnostics>Try again</button></div>`; }
}

export function initializeDiagnostics() {
  document.addEventListener('click', event => { if (event.target.closest('[data-refresh-diagnostics]')) loadDiagnostics(); });
}
