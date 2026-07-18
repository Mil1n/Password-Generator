import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SYMBOLS,
  generatePassword,
  generatePassphrase,
  passphraseEntropy,
  scorePassword,
  weakSettingsMessage
} from './core.js';

function sequenceRng() {
  let value = 0;
  return (max) => value++ % max;
}

const baseSettings = {
  mode: 'password',
  length: 20,
  upper: true,
  lower: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: true,
  customSymbols: DEFAULT_SYMBOLS,
  minNumbers: 1,
  minSymbols: 1
};

test('generatePassword respects length and required character classes', () => {
  const password = generatePassword(baseSettings, sequenceRng());
  assert.equal(password.length, 20);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[a-z]/);
  assert.match(password, /\d/);
  assert.match(password, /[^A-Za-z0-9]/);
});

test('generatePassword honors custom symbol requirements', () => {
  const password = generatePassword({ ...baseSettings, customSymbols: '#', minSymbols: 3 }, sequenceRng());
  assert.ok([...password].filter((char) => char === '#').length >= 3);
});

test('generatePassphrase uses word count and extras', () => {
  const phrase = generatePassphrase({ wordCount: 4, separator: '-', phraseNumber: true, phraseSymbol: true, wordList: 'en', caseMode: 'title' }, sequenceRng());
  assert.match(phrase, /^[A-Z][a-z]+-[a-z]+-[a-z]+-[a-z]+-\d{2}[^A-Za-z0-9]$/);
});

test('passphraseEntropy is based on dictionary size, not rendered length', () => {
  const entropy = passphraseEntropy({ wordCount: 4, phraseNumber: true, phraseSymbol: true, wordList: 'en' });
  assert.ok(entropy > 30);
  assert.equal(scorePassword('Neon-rocket-pixel-orbit-12!', { mode: 'passphrase', wordCount: 4, phraseNumber: true, phraseSymbol: true, wordList: 'en' }).entropy, entropy);
});

test('weakSettingsMessage warns about weak settings', () => {
  assert.match(weakSettingsMessage({ ...baseSettings, upper: true, lower: false, numbers: false, symbols: false }), /один набор/);
  assert.match(weakSettingsMessage({ ...baseSettings, length: 12 }), /16\+/);
});
