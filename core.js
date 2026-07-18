export const DEFAULT_SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>/?';
export const AMBIGUOUS = 'O0Il1';
export const DEFAULT_CHARS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnopqrstuvwxyz',
  numbers: '23456789',
  symbols: DEFAULT_SYMBOLS
};
export const DEFAULT_COMMON_PATTERNS = ['1234', 'qwerty', 'password', 'admin', 'letmein', '1111', '0000', 'пароль'];
export const WORD_LISTS = {
  en: ['neon', 'rocket', 'pixel', 'orbit', 'cipher', 'shadow', 'matrix', 'aurora', 'hyper', 'forest', 'silver', 'planet', 'harbor', 'velvet', 'signal', 'summit', 'ember', 'cobalt', 'meadow', 'quartz', 'falcon', 'river', 'castle', 'lantern', 'canyon', 'violet', 'winter', 'summer', 'spring', 'autumn', 'anchor', 'breeze'],
  ru: ['север', 'искра', 'орбита', 'шифр', 'пиксель', 'радуга', 'ветер', 'сокол', 'берег', 'космос', 'маяк', 'тайга', 'звезда', 'волна', 'камень', 'молния', 'пламя', 'луна', 'солнце', 'ручей', 'город', 'лес', 'поле', 'облако', 'роса', 'мороз', 'гроза', 'парус', 'мост', 'ключ', 'сад', 'путь']
};
export const PRESETS = {
  maximum: { mode: 'password', length: 32, upper: true, lower: true, numbers: true, symbols: true, excludeAmbiguous: false, customSymbols: DEFAULT_SYMBOLS, minNumbers: 1, minSymbols: 1 },
  readable: { mode: 'password', length: 24, upper: true, lower: true, numbers: true, symbols: true, excludeAmbiguous: true, customSymbols: DEFAULT_SYMBOLS, minNumbers: 1, minSymbols: 1 },
  limited: { mode: 'password', length: 20, upper: true, lower: true, numbers: true, symbols: false, excludeAmbiguous: true, customSymbols: '!@#$%+-_', minNumbers: 1, minSymbols: 0 },
  alnum: { mode: 'password', length: 24, upper: true, lower: true, numbers: true, symbols: false, excludeAmbiguous: false, customSymbols: '', minNumbers: 1, minSymbols: 0 },
  passphrase: { mode: 'passphrase' }
};

export function hasCrypto(cryptoRef = globalThis.crypto) {
  return Boolean(cryptoRef?.getRandomValues);
}

export function randomInt(max, cryptoRef = globalThis.crypto) {
  if (!Number.isSafeInteger(max) || max < 1) throw new Error('Некорректная верхняя граница генератора случайных чисел');
  if (!hasCrypto(cryptoRef)) throw new Error('Web Crypto API недоступен');
  const range = 0x100000000;
  const limit = range - (range % max);
  const a = new Uint32Array(1);
  do cryptoRef.getRandomValues(a); while (a[0] >= limit);
  return a[0] % max;
}

export function shuffle(value, rng = randomInt) {
  const arr = [...value];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

export function selectedSets(settings, chars = DEFAULT_CHARS) {
  return ['upper', 'lower', 'numbers', 'symbols']
    .filter((id) => settings[id])
    .map((id) => id === 'symbols' && settings.customSymbols !== undefined ? settings.customSymbols : chars[id])
    .filter(Boolean);
}

export function buildPool(settings, chars = DEFAULT_CHARS) {
  const selected = selectedSets(settings, chars);
  if (!selected.length) return '';
  let pool = selected.join('');
  if (!settings.excludeAmbiguous) pool += AMBIGUOUS;
  return [...new Set([...pool])].join('');
}

function pickRequiredCharacters(settings, rng) {
  const sets = selectedSets(settings);
  const required = sets.map((set) => set[rng(set.length)]);
  const minNumbers = Math.max(0, Number(settings.minNumbers || 0));
  const minSymbols = Math.max(0, Number(settings.minSymbols || 0));
  for (let i = required.filter((char) => /\d/.test(char)).length; i < minNumbers; i++) required.push(DEFAULT_CHARS.numbers[rng(DEFAULT_CHARS.numbers.length)]);
  const symbols = settings.customSymbols || DEFAULT_CHARS.symbols;
  for (let i = required.filter((char) => /[^A-Za-zА-Яа-яЁё0-9]/.test(char)).length; i < minSymbols; i++) required.push(symbols[rng(symbols.length)]);
  return required;
}

export function generatePassword(settings, rng = randomInt) {
  const len = Number(settings.length);
  const pool = buildPool(settings);
  if (!pool) return 'Выберите хотя бы один набор символов';
  const requiredChars = pickRequiredCharacters(settings, rng);
  if (requiredChars.length > len) return 'Длина меньше количества обязательных символов';
  const randomChars = Array.from({ length: len - requiredChars.length }, () => pool[rng(pool.length)]);
  return shuffle([...requiredChars, ...randomChars].join(''), rng);
}

export function generatePassphrase(settings, rng = randomInt, wordLists = WORD_LISTS) {
  const words = wordLists[settings.wordList] || wordLists.en;
  const count = Number(settings.wordCount || 4);
  const separator = settings.separator ?? '-';
  const picked = Array.from({ length: count }, () => words[rng(words.length)]);
  if (settings.caseMode === 'title') picked[0] = picked[0][0].toUpperCase() + picked[0].slice(1);
  if (settings.caseMode === 'upper') picked.forEach((word, index) => { picked[index] = word.toUpperCase(); });
  let phrase = picked.join(separator);
  if (settings.phraseNumber) phrase += `${separator}${rng(90) + 10}`;
  if (settings.phraseSymbol) phrase += DEFAULT_SYMBOLS[rng(DEFAULT_SYMBOLS.length)];
  return phrase;
}

export function passphraseEntropy(settings, wordLists = WORD_LISTS) {
  const words = wordLists[settings.wordList] || wordLists.en;
  let bits = Number(settings.wordCount || 4) * Math.log2(words.length);
  if (settings.phraseNumber) bits += Math.log2(90);
  if (settings.phraseSymbol) bits += Math.log2(DEFAULT_SYMBOLS.length);
  return Math.round(bits);
}

export function hasCommonPattern(value, patterns = DEFAULT_COMMON_PATTERNS) {
  const normalized = value.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
}

export function policyChecks(value, mode = 'password') {
  const lengthLimit = mode === 'passphrase' ? value.length >= 12 && value.length <= 128 : value.length >= 12 && value.length <= 64;
  return [
    { label: mode === 'passphrase' ? '12–128 символов' : '12–64 символа', pass: lengthLimit },
    { label: 'Есть A–Z/А–Я', pass: /[A-ZА-ЯЁ]/.test(value) },
    { label: 'Есть a–z/а–я', pass: /[a-zа-яё]/.test(value) },
    { label: 'Есть цифра', pass: /\d/.test(value) },
    { label: 'Есть спецсимвол', pass: /[^A-Za-zА-Яа-яЁё0-9]/.test(value) },
    { label: 'Нет явных шаблонов', pass: !hasCommonPattern(value) && !/(.)\1{2,}/.test(value) }
  ];
}

export function estimateEntropy(value, settings = {}) {
  if (settings.mode === 'passphrase') return passphraseEntropy(settings);
  let poolSize = 0;
  if (/[A-ZА-ЯЁ]/.test(value)) poolSize += 59;
  if (/[a-zа-яё]/.test(value)) poolSize += 59;
  if (/\d/.test(value)) poolSize += 10;
  if (/[^A-Za-zА-Яа-яЁё0-9]/.test(value)) poolSize += (settings.customSymbols || DEFAULT_SYMBOLS).length + 4;
  return poolSize ? Math.round(value.length * Math.log2(poolSize)) : 0;
}

export function scorePassword(value, settings = {}) {
  if (!value || value.includes('Выберите') || value.includes('Длина') || value.includes('недоступен')) return {score: 0, label: 'Нет данных', entropy: 0, checks: []};
  const checks = policyChecks(value, settings.mode || 'password');
  const entropy = estimateEntropy(value, settings);
  let score = Math.min(100, Math.round((entropy / 120) * 100));
  score -= checks.filter((check) => !check.pass).length * 8;
  score = Math.max(0, Math.min(100, score));
  const label = score < 45 ? 'Слабый' : score < 75 ? 'Средний' : score < 90 ? 'Сильный' : 'Очень сильный';
  return { score, label, entropy, checks };
}

export function weakSettingsMessage(settings) {
  if (settings.mode === 'passphrase') {
    if (Number(settings.wordCount || 4) < 4) return 'Предупреждение: для passphrase лучше использовать минимум 4 слова.';
    return '';
  }
  const sets = selectedSets(settings).length;
  if (sets === 1) return 'Предупреждение: выбран только один набор символов — такой пароль проще перебрать.';
  if (Number(settings.length) < 16) return 'Предупреждение: для важных аккаунтов лучше использовать 16+ символов.';
  if (!settings.symbols) return 'Подсказка: спецсимволы обычно повышают устойчивость пароля.';
  return '';
}
