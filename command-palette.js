const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
let selectedIndex = 0;
let results = [];

function uniqueElements(selector) {
  return [...new Set([...document.querySelectorAll(selector)])];
}

function buildIndex() {
  const entries = [];
  for (const button of uniqueElements('.sidebar [data-page]')) entries.push({ label: button.textContent.trim(), kind: 'Page', element: button });
  for (const button of uniqueElements('#all-apps .app-tile')) entries.push({ label: button.dataset.app || button.textContent.trim(), detail: button.querySelector('small')?.textContent || '', kind: 'Application', element: button });
  for (const button of uniqueElements('#home-control-content button')) entries.push({ label: button.querySelector('strong')?.textContent || button.textContent.trim(), detail: button.textContent.trim(), kind: 'Home', element: button });
  for (const button of uniqueElements('#quick-actions button')) entries.push({ label: button.querySelector('strong')?.textContent || button.textContent.trim(), detail: button.querySelector('small')?.textContent || '', kind: 'Scene', element: button });
  for (const button of uniqueElements('[data-responsibility-complete]')) entries.push({ label: button.querySelector('strong')?.textContent || button.getAttribute('aria-label') || 'Complete responsibility', detail: 'Mark complete', kind: 'Responsibility', element: button });
  return entries.filter(entry => entry.label);
}

function render(query = '') {
  const list = document.querySelector('#command-results');
  const normalized = query.trim().toLowerCase();
  results = buildIndex().filter(entry => !normalized || `${entry.label} ${entry.detail} ${entry.kind}`.toLowerCase().includes(normalized)).slice(0, 12);
  selectedIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));
  list.innerHTML = results.length ? results.map((entry, index) => `<button type="button" class="command-result${index === selectedIndex ? ' selected' : ''}" data-command-index="${index}"><span><b>${escapeHtml(entry.label)}</b><small>${escapeHtml(entry.detail)}</small></span><em>${escapeHtml(entry.kind)}</em></button>`).join('') : '<div class="command-empty">No matching apps, controls, pages, or responsibilities.</div>';
}

function openPalette(query = '') {
  const palette = document.querySelector('#command-palette');
  const input = document.querySelector('#command-input');
  palette.classList.remove('hidden');
  input.value = query;
  selectedIndex = 0;
  render(query);
  requestAnimationFrame(() => input.focus());
}

function closePalette() {
  document.querySelector('#command-palette')?.classList.add('hidden');
  document.querySelector('#search').value = '';
}

function run(index) {
  const result = results[index];
  if (!result) return;
  closePalette();
  result.element.click();
}

export function initializeCommandPalette() {
  const search = document.querySelector('#search');
  const input = document.querySelector('#command-input');
  search.addEventListener('focus', () => openPalette(search.value));
  search.addEventListener('input', () => openPalette(search.value));
  input.addEventListener('input', () => { selectedIndex = 0; render(input.value); });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); selectedIndex = Math.min(results.length - 1, selectedIndex + 1); render(input.value); }
    if (event.key === 'ArrowUp') { event.preventDefault(); selectedIndex = Math.max(0, selectedIndex - 1); render(input.value); }
    if (event.key === 'Enter') { event.preventDefault(); run(selectedIndex); }
    if (event.key === 'Escape') closePalette();
  });
  document.querySelector('#command-results').addEventListener('click', event => { const button = event.target.closest('[data-command-index]'); if (button) run(Number(button.dataset.commandIndex)); });
  document.querySelector('#command-backdrop').addEventListener('click', closePalette);
  document.querySelector('#command-close').addEventListener('click', closePalette);
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openPalette(); }
    if (event.key === 'Escape' && !document.querySelector('#command-palette').classList.contains('hidden')) closePalette();
  });
}
