let step = 0;
const steps = [
  { eyebrow: 'WELCOME HOME', title: 'Make Haven yours', text: 'Haven brings household work, services, planning, and controls into one calm place.' },
  { eyebrow: 'QUICK ACCESS', title: 'Find anything fast', text: 'Press Ctrl or Command + K to launch apps, open pages, run scenes, and find responsibilities.' },
  { eyebrow: 'SHARED OWNERSHIP', title: 'Set up the household', text: 'Connect services, add responsibilities, and choose what deserves attention on the home dashboard.' }
];

function render() {
  const content = document.querySelector('#onboarding-content'), current = steps[step];
  content.innerHTML = `<p class="eyebrow">${current.eyebrow}</p><h1>${current.title}</h1><p>${current.text}</p><div class="onboarding-progress">${steps.map((_, index) => `<i class="${index <= step ? 'active' : ''}"></i>`).join('')}</div><div class="onboarding-actions"><button class="text-button" type="button" data-onboarding-skip>Skip</button><button class="primary-button" type="button" data-onboarding-next>${step === steps.length - 1 ? 'Set up integrations' : 'Continue'}</button></div>`;
}

function finish(openIntegrations = false) {
  localStorage.setItem('haven-onboarding-complete', '1');
  document.querySelector('#onboarding')?.classList.add('hidden');
  if (openIntegrations) document.querySelector('[data-page="integrations"]')?.click();
}

function maybeShow() {
  if (localStorage.getItem('haven-onboarding-complete') || localStorage.getItem('haven-settings') || new URLSearchParams(location.search).has('setup')) return;
  document.querySelector('#onboarding').classList.remove('hidden'); render();
}

export function initializeOnboarding() {
  document.body.insertAdjacentHTML('beforeend', '<div class="onboarding hidden" id="onboarding" role="dialog" aria-modal="true" aria-label="Welcome to Haven"><div class="onboarding-card"><div class="brand-mark large">H</div><div id="onboarding-content"></div></div></div>');
  document.addEventListener('click', event => { if (event.target.closest('[data-onboarding-skip]')) finish(); if (event.target.closest('[data-onboarding-next]')) { if (step < steps.length - 1) { step += 1; render(); } else finish(true); } });
  const app = document.querySelector('#app');
  const observer = new MutationObserver(() => { if (!app.classList.contains('hidden')) { observer.disconnect(); setTimeout(maybeShow, 250); } });
  observer.observe(app, { attributes: true, attributeFilter: ['class'] });
  if (!app.classList.contains('hidden')) maybeShow();
}
