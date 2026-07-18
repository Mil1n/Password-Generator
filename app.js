import {
  DEFAULT_SYMBOLS,
  PRESETS,
  buildPool,
  generatePassword,
  generatePassphrase,
  hasCrypto,
  scorePassword,
  weakSettingsMessage
} from './core.js';

const el = (id) => document.getElementById(id);
const historyKey = 'milinpass-history';
const settingsKey = 'milinpass-settings';
let revealPassword = true;
let lastPassword = '';
let clearTimer;

function currentSettings() {
  return {
    mode: el('preset').value === 'passphrase' ? 'passphrase' : 'password',
    preset: el('preset').value,
    length: Number(el('length').value),
    upper: el('upper').checked,
    lower: el('lower').checked,
    numbers: el('numbers').checked,
    symbols: el('symbols').checked,
    excludeAmbiguous: el('excludeAmbiguous').checked,
    customSymbols: el('customSymbols').value,
    minNumbers: Number(el('minNumbers').value),
    minSymbols: Number(el('minSymbols').value),
    saveHistory: el('saveHistory').checked,
    wordCount: Number(el('wordCount').value),
    separator: el('separator').value,
    phraseNumber: el('phraseNumber').checked,
    phraseSymbol: el('phraseSymbol').checked,
    wordList: el('wordList').value,
    caseMode: el('caseMode').value,
    autoClearSeconds: Number(el('autoClearSeconds').value),
    theme: document.documentElement.dataset.theme || 'dark'
  };
}

function displayPassword(value = lastPassword) {
  el('password').value = revealPassword ? value : '•'.repeat([...value].length);
  el('revealBtn').textContent = revealPassword ? 'Скрыть' : 'Показать';
  el('revealBtn').setAttribute('aria-pressed', String(revealPassword));
}

function scheduleAutoClear(settings) {
  clearTimeout(clearTimer);
  if (!settings.autoClearSeconds || settings.autoClearSeconds < 1) return;
  clearTimer = setTimeout(() => {
    lastPassword = '';
    displayPassword('');
    paintScore(0, 'Нет данных', 0, []);
    showToast('Пароль очищен');
  }, settings.autoClearSeconds * 1000);
}

function paintScore(score, label, entropy, checks = []) {
  const fill = el('meterFill');
  const meter = document.querySelector('.meter');
  fill.style.width = `${score}%`;
  fill.style.background = score < 45 ? 'var(--danger)' : score < 75 ? 'var(--warn)' : 'var(--ok)';
  meter.setAttribute('aria-valuenow', String(score));
  el('scoreText').textContent = `${label} — ${score}/100 · ~${entropy} бит энтропии`;
  el('policyList').innerHTML = checks.map((check) => `<li class="${check.pass ? 'pass' : 'fail'}">${check.pass ? '✓' : '×'} ${check.label}</li>`).join('');
}

function readHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(historyKey) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(value) {
  if (!el('saveHistory').checked) return;
  const arr = readHistory().filter((item) => item.value !== value);
  arr.unshift({ value, time: new Date().toLocaleString() });
  localStorage.setItem(historyKey, JSON.stringify(arr.slice(0, 10)));
  renderHistory();
}

function renderHistory() {
  const arr = readHistory();
  const history = el('history');
  history.innerHTML = '';
  if (!arr.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Пока пусто';
    history.append(empty);
    return;
  }
  arr.forEach((item) => {
    const row = document.createElement('div');
    const value = document.createElement('span');
    const date = document.createElement('span');
    const copy = document.createElement('button');
    row.className = 'item';
    value.textContent = item.value;
    date.className = 'mini';
    date.textContent = item.time;
    copy.className = 'btn-soft';
    copy.type = 'button';
    copy.textContent = 'Копировать';
    copy.addEventListener('click', () => copyText(item.value));
    row.append(value, date, copy);
    history.append(row);
  });
}

function showToast(message) {
  const toast = el('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1600);
}

async function copyText(value) {
  if (!value) return;
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
  else {
    const oldReveal = revealPassword;
    revealPassword = true;
    displayPassword(value);
    el('password').select();
    document.execCommand('copy');
    el('password').blur();
    revealPassword = oldReveal;
    displayPassword(value);
  }
  showToast('Скопировано ✅');
}

function updateWeakWarning(settings) {
  const message = weakSettingsMessage(settings);
  el('weakWarning').textContent = message;
  el('weakWarning').classList.toggle('hidden', !message);
}

function create(type = currentSettings().mode) {
  const settings = { ...currentSettings(), mode: type };
  let value;
  try {
    value = type === 'passphrase' ? generatePassphrase(settings) : generatePassword(settings);
  } catch (error) {
    value = error.message;
  }
  lastPassword = value;
  displayPassword(value);
  const result = scorePassword(value, settings);
  paintScore(result.score, result.label, result.entropy, result.checks);
  updateWeakWarning(settings);
  scheduleAutoClear(settings);
  if (!value.includes('Выберите') && !value.includes('Длина') && !value.includes('недоступен')) saveHistory(value);
}

function serializableSettings() {
  const settings = currentSettings();
  return { ...settings, generatedAt: undefined };
}

function saveSettings() {
  localStorage.setItem(settingsKey, JSON.stringify(serializableSettings()));
}

function applySettings(settings = {}) {
  document.documentElement.dataset.theme = settings.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  el('preset').value = settings.preset || 'maximum';
  ['upper', 'lower', 'numbers', 'symbols', 'excludeAmbiguous', 'saveHistory', 'phraseNumber', 'phraseSymbol'].forEach((id) => {
    if (typeof settings[id] === 'boolean') el(id).checked = settings[id];
  });
  ['length', 'wordCount', 'separator', 'wordList', 'caseMode', 'customSymbols', 'minNumbers', 'minSymbols', 'autoClearSeconds'].forEach((id) => {
    if (settings[id] !== undefined) el(id).value = settings[id];
  });
  syncLabels();
}

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(settingsKey) || '{}'); }
  catch { return {}; }
}

function syncLabels() {
  el('lenVal').textContent = el('length').value;
  el('wordCountVal').textContent = el('wordCount').value;
  el('passphraseSettings').open = el('preset').value === 'passphrase';
}

function applyPreset(name) {
  if (name === 'custom') return;
  if (name === 'passphrase') {
    el('passphraseSettings').open = true;
    return;
  }
  const preset = PRESETS[name];
  Object.entries(preset).forEach(([key, value]) => {
    if (key === 'mode') return;
    if (key === 'length' || key === 'customSymbols' || key === 'minNumbers' || key === 'minSymbols') el(key).value = value;
    else el(key).checked = value;
  });
  syncLabels();
}

function exportSettings() {
  const payload = JSON.stringify(serializableSettings(), null, 2);
  el('settingsTransfer').classList.remove('hidden');
  el('settingsTransfer').value = payload;
  el('settingsTransfer').select();
  copyText(payload);
  showToast('Настройки экспортированы');
}

function importSettings() {
  el('settingsTransfer').classList.remove('hidden');
  const raw = el('settingsTransfer').value.trim();
  if (!raw) {
    showToast('Вставьте JSON настроек в поле');
    return;
  }
  try {
    applySettings(JSON.parse(raw));
    saveSettings();
    create();
    showToast('Настройки импортированы');
  } catch {
    showToast('Некорректный JSON');
  }
}

function resetAll() {
  localStorage.removeItem(settingsKey);
  localStorage.removeItem(historyKey);
  applySettings({ preset: 'maximum', customSymbols: DEFAULT_SYMBOLS, minNumbers: 1, minSymbols: 1, phraseNumber: true, phraseSymbol: true, wordCount: 4, separator: '-', wordList: 'en', caseMode: 'title', autoClearSeconds: 0 });
  renderHistory();
  create('password');
  showToast('Настройки сброшены');
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('service-worker.js').then((registration) => {
    registration.addEventListener('updatefound', () => showToast('Доступна новая версия приложения'));
  }).catch(() => showToast('Service worker не зарегистрирован'));
}

el('cryptoWarning').classList.toggle('hidden', hasCrypto());
applySettings(loadSettings());
renderHistory();
create();
registerServiceWorker();

el('length').addEventListener('input', () => { el('preset').value = 'custom'; syncLabels(); create(); saveSettings(); });
el('wordCount').addEventListener('input', () => { syncLabels(); create('passphrase'); saveSettings(); });
['upper','lower','numbers','symbols','excludeAmbiguous'].forEach((id) => el(id).addEventListener('change', () => { el('preset').value = 'custom'; create(); saveSettings(); }));
['separator','phraseNumber','phraseSymbol','wordList','caseMode','saveHistory','customSymbols','minNumbers','minSymbols','autoClearSeconds'].forEach((id) => el(id).addEventListener('change', () => { create(currentSettings().mode); saveSettings(); }));
el('preset').addEventListener('change', (event) => { applyPreset(event.target.value); create(event.target.value === 'passphrase' ? 'passphrase' : 'password'); saveSettings(); });
el('generateBtn').addEventListener('click', () => { create(); saveSettings(); });
el('passphraseBtn').addEventListener('click', () => { el('preset').value = 'passphrase'; applyPreset('passphrase'); create('passphrase'); saveSettings(); });
el('revealBtn').addEventListener('click', () => { revealPassword = !revealPassword; displayPassword(); });
el('copyBtn').addEventListener('click', () => copyText(lastPassword));
el('clearPasswordBtn').addEventListener('click', () => { lastPassword = ''; displayPassword(''); paintScore(0, 'Нет данных', 0, []); });
el('clearHistoryBtn').addEventListener('click', () => { localStorage.removeItem(historyKey); renderHistory(); });
el('toggleHistoryBtn').addEventListener('click', () => {
  const hidden = el('history').classList.toggle('hidden');
  el('toggleHistoryBtn').textContent = hidden ? 'Показать' : 'Скрыть';
  el('toggleHistoryBtn').setAttribute('aria-expanded', String(!hidden));
});
el('themeBtn').addEventListener('click', () => {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  saveSettings();
});
el('exportSettingsBtn').addEventListener('click', exportSettings);
el('importSettingsBtn').addEventListener('click', importSettings);
el('resetSettingsBtn').addEventListener('click', resetAll);
