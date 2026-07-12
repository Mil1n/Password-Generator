const el = (id) => document.getElementById(id);
const chars = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnopqrstuvwxyz',
  numbers: '23456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>/?'
};
const ambiguous = 'O0Il1';
const commonPatterns = ['1234', 'qwerty', 'password', 'admin', 'letmein', '1111', '0000', 'пароль'];
const historyKey = 'milinpass-history';
const settingsKey = 'milinpass-settings';
const wordLists = {
  en: ['neon', 'rocket', 'pixel', 'orbit', 'cipher', 'shadow', 'matrix', 'aurora', 'hyper', 'forest', 'silver', 'planet', 'harbor', 'velvet', 'signal', 'summit'],
  ru: ['север', 'искра', 'орбита', 'шифр', 'пиксель', 'радуга', 'ветер', 'сокол', 'берег', 'космос', 'маяк', 'тайга', 'звезда', 'волна', 'камень', 'молния']
};
const presets = {
  maximum: { length: 32, upper: true, lower: true, numbers: true, symbols: true, excludeAmbiguous: false },
  readable: { length: 24, upper: true, lower: true, numbers: true, symbols: true, excludeAmbiguous: true },
  limited: { length: 20, upper: true, lower: true, numbers: true, symbols: false, excludeAmbiguous: true },
  alnum: { length: 24, upper: true, lower: true, numbers: true, symbols: false, excludeAmbiguous: false },
  passphrase: { passphrase: true }
};

function hasCrypto() {
  return Boolean(globalThis.crypto?.getRandomValues);
}

function randomInt(max) {
  if (!Number.isSafeInteger(max) || max < 1) throw new Error('Некорректная верхняя граница генератора случайных чисел');
  if (!hasCrypto()) throw new Error('Web Crypto API недоступен');
  const range = 0x100000000;
  const limit = range - (range % max);
  const a = new Uint32Array(1);
  do crypto.getRandomValues(a); while (a[0] >= limit);
  return a[0] % max;
}

function shuffle(value) {
  const arr = [...value];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

function selectedSets() {
  return ['upper', 'lower', 'numbers', 'symbols'].filter((id) => el(id).checked).map((id) => chars[id]);
}

function buildPool() {
  const selected = selectedSets();
  if (!selected.length) return '';
  let pool = selected.join('');
  if (!el('excludeAmbiguous').checked) pool += ambiguous;
  return [...new Set([...pool])].join('');
}

function generatePassword() {
  try {
    const len = Number(el('length').value);
    const sets = selectedSets();
    const pool = buildPool();
    if (!pool) return 'Выберите хотя бы один набор символов';
    if (sets.length > len) return 'Длина меньше количества выбранных наборов';
    const requiredChars = sets.map((set) => set[randomInt(set.length)]);
    const randomChars = Array.from({ length: len - requiredChars.length }, () => pool[randomInt(pool.length)]);
    return shuffle([...requiredChars, ...randomChars].join(''));
  } catch (error) {
    return error.message;
  }
}

function generatePassphrase() {
  try {
    const words = wordLists[el('wordList').value];
    const count = Number(el('wordCount').value);
    const separator = el('separator').value;
    const picked = Array.from({ length: count }, () => words[randomInt(words.length)]);
    picked[0] = picked[0][0].toUpperCase() + picked[0].slice(1);
    let phrase = picked.join(separator);
    if (el('phraseNumber').checked) phrase += `${separator}${randomInt(90) + 10}`;
    if (el('phraseSymbol').checked) phrase += chars.symbols[randomInt(chars.symbols.length)];
    return phrase;
  } catch (error) {
    return error.message;
  }
}

function hasCommonPattern(value) {
  const normalized = value.toLowerCase();
  return commonPatterns.some((pattern) => normalized.includes(pattern));
}

function policyChecks(p) {
  return [
    { label: '12–64 символа', pass: p.length >= 12 && p.length <= 64 },
    { label: 'Есть A–Z/А–Я', pass: /[A-ZА-ЯЁ]/.test(p) },
    { label: 'Есть a–z/а–я', pass: /[a-zа-яё]/.test(p) },
    { label: 'Есть цифра', pass: /\d/.test(p) },
    { label: 'Есть спецсимвол', pass: /[^A-Za-zА-Яа-яЁё0-9]/.test(p) },
    { label: 'Нет явных шаблонов', pass: !hasCommonPattern(p) && !/(.)\1{2,}/.test(p) }
  ];
}

function estimateEntropy(p) {
  let poolSize = 0;
  if (/[A-ZА-ЯЁ]/.test(p)) poolSize += 59;
  if (/[a-zа-яё]/.test(p)) poolSize += 59;
  if (/\d/.test(p)) poolSize += 10;
  if (/[^A-Za-zА-Яа-яЁё0-9]/.test(p)) poolSize += chars.symbols.length + 4;
  return poolSize ? Math.round(p.length * Math.log2(poolSize)) : 0;
}

function scorePassword(p) {
  if (!p || p.includes('Выберите') || p.includes('Длина') || p.includes('недоступен')) return {score: 0, label: 'Нет данных', entropy: 0, checks: []};
  const checks = policyChecks(p);
  const entropy = estimateEntropy(p);
  let score = Math.min(100, Math.round((entropy / 120) * 100));
  score -= checks.filter((check) => !check.pass).length * 10;
  score = Math.max(0, Math.min(100, score));
  const label = score < 45 ? 'Слабый' : score < 75 ? 'Средний' : score < 90 ? 'Сильный' : 'Очень сильный';
  return { score, label, entropy, checks };
}

function paintScore(score, label, entropy, checks = []) {
  const fill = el('meterFill');
  const meter = document.querySelector('.meter');
  fill.style.width = score + '%';
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
    const date = document.createElement('span');
    const copy = document.createElement('button');
    row.className = 'item';
    row.append(item.value);
    date.className = 'mini';
    date.textContent = item.time;
    copy.className = 'btn-soft';
    copy.type = 'button';
    copy.textContent = 'Копировать';
    copy.addEventListener('click', () => copyText(item.value));
    row.append(date, copy);
    history.append(row);
  });
}

function showToast(message) {
  const toast = el('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1400);
}

async function copyText(value) {
  if (!value) return;
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
  else {
    el('password').value = value;
    el('password').select();
    document.execCommand('copy');
    el('password').blur();
  }
  showToast('Скопировано ✅');
}

function weakSettingsMessage() {
  const len = Number(el('length').value);
  const sets = selectedSets().length;
  if (el('preset').value === 'passphrase') return '';
  if (sets === 1) return 'Предупреждение: выбран только один набор символов — такой пароль проще перебрать.';
  if (len < 16) return 'Предупреждение: для важных аккаунтов лучше использовать 16+ символов.';
  if (!el('symbols').checked) return 'Подсказка: спецсимволы обычно повышают устойчивость пароля.';
  return '';
}

function updateWeakWarning() {
  const message = weakSettingsMessage();
  el('weakWarning').textContent = message;
  el('weakWarning').classList.toggle('hidden', !message);
}

function create(type = el('preset').value === 'passphrase' ? 'passphrase' : 'password') {
  const value = type === 'passphrase' ? generatePassphrase() : generatePassword();
  el('password').value = value;
  const {score, label, entropy, checks} = scorePassword(value);
  paintScore(score, label, entropy, checks);
  updateWeakWarning();
  if (!value.includes('Выберите') && !value.includes('Длина') && !value.includes('недоступен')) saveHistory(value);
}

function saveSettings() {
  const settings = {
    theme: document.documentElement.dataset.theme || 'dark',
    preset: el('preset').value,
    length: el('length').value,
    upper: el('upper').checked,
    lower: el('lower').checked,
    numbers: el('numbers').checked,
    symbols: el('symbols').checked,
    excludeAmbiguous: el('excludeAmbiguous').checked,
    saveHistory: el('saveHistory').checked,
    wordCount: el('wordCount').value,
    separator: el('separator').value,
    phraseNumber: el('phraseNumber').checked,
    phraseSymbol: el('phraseSymbol').checked,
    wordList: el('wordList').value
  };
  localStorage.setItem(settingsKey, JSON.stringify(settings));
}

function applySettings(settings = {}) {
  document.documentElement.dataset.theme = settings.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  el('preset').value = settings.preset || 'maximum';
  ['upper', 'lower', 'numbers', 'symbols', 'excludeAmbiguous', 'saveHistory', 'phraseNumber', 'phraseSymbol'].forEach((id) => {
    if (typeof settings[id] === 'boolean') el(id).checked = settings[id];
  });
  ['length', 'wordCount', 'separator', 'wordList'].forEach((id) => {
    if (settings[id]) el(id).value = settings[id];
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
    create('passphrase');
    return;
  }
  const preset = presets[name];
  Object.entries(preset).forEach(([key, value]) => {
    if (key === 'length') el('length').value = value;
    else el(key).checked = value;
  });
  syncLabels();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('service-worker.js');
}

el('cryptoWarning').classList.toggle('hidden', hasCrypto());
applySettings(loadSettings());
renderHistory();
create();
registerServiceWorker();

el('length').addEventListener('input', () => { el('preset').value = 'custom'; syncLabels(); create(); saveSettings(); });
el('wordCount').addEventListener('input', () => { syncLabels(); create('passphrase'); saveSettings(); });
['upper','lower','numbers','symbols','excludeAmbiguous'].forEach((id) => el(id).addEventListener('change', () => { el('preset').value = 'custom'; create(); saveSettings(); }));
['separator','phraseNumber','phraseSymbol','wordList','saveHistory'].forEach((id) => el(id).addEventListener('change', () => { create(el('preset').value === 'passphrase' ? 'passphrase' : 'password'); saveSettings(); }));
el('preset').addEventListener('change', (event) => { applyPreset(event.target.value); create(); saveSettings(); });
el('generateBtn').addEventListener('click', () => { create(); saveSettings(); });
el('passphraseBtn').addEventListener('click', () => { el('preset').value = 'passphrase'; applyPreset('passphrase'); saveSettings(); });
el('copyBtn').addEventListener('click', () => copyText(el('password').value));
el('clearPasswordBtn').addEventListener('click', () => { el('password').value = ''; paintScore(0, 'Нет данных', 0, []); });
el('clearHistoryBtn').addEventListener('click', () => { localStorage.removeItem(historyKey); renderHistory(); });
el('toggleHistoryBtn').addEventListener('click', () => {
  const hidden = el('history').classList.toggle('hidden');
  el('toggleHistoryBtn').textContent = hidden ? 'Показать' : 'Скрыть';
});
el('themeBtn').addEventListener('click', () => {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  saveSettings();
});
