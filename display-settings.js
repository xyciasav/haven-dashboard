const defaults = { density: 'comfortable', mode: 'standard', motion: 'system' };

function readSettings() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('haven-display') || '{}') }; } catch { return { ...defaults }; }
}

function apply(settings) {
  document.body.dataset.density = settings.density;
  document.body.dataset.displayMode = settings.mode;
  document.body.dataset.motion = settings.motion;
  document.querySelector('#display-mode-indicator')?.classList.toggle('hidden', settings.mode === 'standard');
}

function injectPanel() {
  const layout = document.querySelector('#settings-content .settings-layout');
  if (!layout || document.querySelector('#display-settings')) return;
  const settings = readSettings();
  layout.insertAdjacentHTML('beforeend', `<form class="settings-panel display-settings" id="display-settings"><div class="settings-title"><span class="integration-logo">Aa</span><div><h2>Display on this device</h2><p>Density, motion, and dedicated-screen behavior</p></div></div><div class="url-grid"><label>Density<select name="density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><label>Display mode<select name="mode"><option value="standard">Standard</option><option value="kiosk">Kiosk</option><option value="wall">Wall display</option></select></label><label>Motion<select name="motion"><option value="system">Follow device</option><option value="reduced">Reduce motion</option></select></label></div><button class="primary-button" type="submit">Apply to this device</button><small class="privacy-note">Kiosk and wall modes hide navigation. Press Escape at any time to return to standard mode.</small></form>`);
  for (const [key, value] of Object.entries(settings)) if (layout.querySelector(`#display-settings [name="${key}"]`)) layout.querySelector(`#display-settings [name="${key}"]`).value = value;
  layout.querySelector('#display-settings').addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget), next = { density: data.get('density'), mode: data.get('mode'), motion: data.get('motion') }; localStorage.setItem('haven-display', JSON.stringify(next)); apply(next); });
}

export function initializeDisplaySettings() {
  apply(readSettings()); injectPanel();
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.body.dataset.displayMode !== 'standard') { const next = { ...readSettings(), mode: 'standard' }; localStorage.setItem('haven-display', JSON.stringify(next)); apply(next); const select = document.querySelector('#display-settings [name="mode"]'); if (select) select.value = 'standard'; } });
}
