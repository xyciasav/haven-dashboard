const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export function adaptiveRefreshDelay({ visible = true, online = true, failures = 0 } = {}) {
  if (!online) return 120000;
  if (!visible) return 60000;
  return Math.min(120000, 15000 * (2 ** Math.min(3, failures)));
}

export async function fetchJsonWithRetry(url, options = {}, retries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(10000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `${response.status} ${response.statusText}`);
      return { data, response, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await wait(250 * (2 ** attempt));
    }
  }
  throw lastError;
}

export async function cachedPublicJson(key, url, options = {}) {
  try {
    const result = await fetchJsonWithRetry(url, options, 1);
    const record = { at: Date.now(), data: result.data };
    localStorage.setItem(`haven-cache:${key}`, JSON.stringify(record));
    return { ...result, stale: false, updatedAt: record.at };
  } catch (error) {
    try {
      const record = JSON.parse(localStorage.getItem(`haven-cache:${key}`) || 'null');
      if (record?.data && Date.now() - record.at < 24 * 60 * 60 * 1000) return { data: record.data, stale: true, updatedAt: record.at, error };
    } catch {}
    throw error;
  }
}

export function setWidgetFreshness(widget, { stale = false, updatedAt = Date.now(), error = '' } = {}) {
  if (!widget) return;
  let badge = widget.querySelector('.freshness-badge');
  if (!badge) { badge = document.createElement('span'); badge.className = 'freshness-badge'; widget.append(badge); }
  const age = Math.max(0, Math.round((Date.now() - updatedAt) / 60000));
  badge.classList.toggle('stale', stale);
  badge.textContent = stale ? `Cached · ${age < 1 ? 'just now' : `${age}m ago`}` : 'Live';
  badge.title = error || (stale ? 'Showing the last successful update' : 'Updated just now');
}

export function renderRetryState({ title, message, action }) {
  return `<div class="integration-empty resilient-error"><strong>${title}</strong><span>${message}</span><button type="button" class="text-button" data-retry-load="${action}">Try again</button></div>`;
}
