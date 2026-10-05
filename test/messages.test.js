import test from 'node:test';
import assert from 'node:assert/strict';
import { read, load, core } from './load.js';

const { MESSAGES, t } = load('js/messages.js').BaseXXMessages;
const C = core();
// かな・カタカナ・漢字・全角の記号
const JAPANESE = new RegExp('[' + [[0x3000, 0x303f], [0x3040, 0x30ff], [0x3400, 0x9fff], [0xff00, 0xffef]]
  .map(([a, b]) => String.fromCharCode(a) + '-' + String.fromCharCode(b)).join('') + ']');

const placeholders = (s) => [...s.matchAll(/\{([a-z0-9]+)\}/g)].map((m) => m[1]).sort();

test('日本語と英語の辞書は同じキーを持ち、置き場所 {name} と太字の数もそろう', () => {
  assert.deepEqual(Object.keys(MESSAGES.en).sort(), Object.keys(MESSAGES.ja).sort());
  for (const k of Object.keys(MESSAGES.ja)) {
    assert.deepEqual(placeholders(MESSAGES.en[k]), placeholders(MESSAGES.ja[k]), k);
    for (const lang of ['ja', 'en']) assert.equal((MESSAGES[lang][k].match(/\*\*/g) || []).length % 2, 0, `${lang} ${k}`);
  }
});

test('英語の辞書に日本語の文字がない（言語の切り替えボタンの「日本語」を除く）', () => {
  for (const [k, v] of Object.entries(MESSAGES.en)) {
    if (k === 'ui.langButton' || k === 'ui.langLabel') continue;
    assert.doesNotMatch(v, JAPANESE, k);
  }
});

test('日本語の文言は、日本語と英数字のあいだに半角空白を入れない。「ブラウザ」でなく「ブラウザー」', () => {
  const bad = new RegExp(`(${JAPANESE.source} [A-Za-z0-9(])|([A-Za-z0-9)] ${JAPANESE.source})`);
  for (const [k, v] of Object.entries(MESSAGES.ja)) {
    assert.doesNotMatch(v, bad, k);
    assert.doesNotMatch(v, /ブラウザ(?!ー)/, k);
  }
});

test('画面のスクリプトが使うキーは、すべて辞書にある（組み立てるキーも含む）', () => {
  const src = ['script.js', 'js/theme.js'].map(read).join('\n');
  const keys = [...src.matchAll(/\bt\('([a-z0-9]+\.[A-Za-z0-9.]+)'/g)].map((m) => m[1]);
  assert.ok(keys.length >= 25, String(keys.length));
  for (const k of keys) assert.ok(MESSAGES.ja[k] !== undefined, k);
  for (const e of ['char', 'length', 'padding', 'empty', 'long']) assert.ok(MESSAGES.ja[`dec.err.${e}`], e);
  for (const e of ['char', 'odd']) assert.ok(MESSAGES.ja[`enc.err.${e}`], e);
  for (const k of C.KINDS) assert.ok(MESSAGES.ja[`alphabet.${k}`], k);
  const patterns = [...read('script.js').match(/const PATTERNS = \{([\s\S]*?)\n {2}\};/)[1].matchAll(/^ {4}([A-Za-z0-9]+):/gm)].map((m) => m[1]);
  assert.deepEqual(patterns, ['O0', 'Il', 'I1', 'plus', 'slash']);
  for (const p of patterns) for (const k of [`misread.desc.${p}`, `misread.btn.${p}`]) assert.ok(MESSAGES.ja[k], k);
});

test('画面のスクリプトに日本語の文字列を直接書かない（文言は辞書に置く）', () => {
  for (const f of ['script.js', 'js/basexx-core.js', 'js/theme.js', 'js/i18n.js']) {
    const code = read(f).split('\n').filter((line) => !/^\s*\/\//.test(line)).map((line) => line.replace(/\s\/\/.*$/, '')).join('\n');
    for (const m of code.matchAll(/'[^'\n]*'|`[^`\n]*`/g)) assert.doesNotMatch(m[0], JAPANESE, `${f}: ${m[0]}`);
  }
});

test('t は置き場所を値で埋め、未知のキーはキーのまま返す', () => {
  assert.equal(t('dec.err.char', { pos: 3, ch: '0' }, 'ja'), '3文字目の「0」は、この方式の字母にありません。');
  assert.equal(t('dec.err.char', { pos: 3, ch: '0' }, 'en'), 'Character 3 ("0") is not in this alphabet.');
  assert.equal(t('no.such.key', {}, 'ja'), 'no.such.key');
});

test('文言の中の数値は計算から出したものと同じ（basE91 の組の数、余分の割合、Base58 のビット数）', () => {
  const pct = (r) => Math.round((r - 1) * 100);
  assert.equal(91 * 91, 8281);
  const spare = 91 * 91 - 2 ** 13;
  assert.match(MESSAGES.ja['b91.how1'], new RegExp(`91×91＝${91 * 91}通り.*13ビット（${2 ** 13}通り）を表しても${spare}通り余ります`));
  assert.match(MESSAGES.ja['b91.how2'], new RegExp(`値が${spare - 1}以下.*0〜${spare - 1}と${2 ** 13}〜${2 ** 13 + spare - 1}の${2 * spare}通り.*${spare}以上`));
  assert.match(MESSAGES.en['b91.how2'], new RegExp(`${spare - 1} or less.*0–${spare - 1} and ${2 ** 13}–${2 ** 13 + spare - 1}, ${2 * spare} values`));
  const [lo, hi, b64] = [pct(C.RATIOS.base91[0]), pct(C.RATIOS.base91[1]), pct(C.RATIOS.base64)];
  assert.match(MESSAGES.ja['b91.how3'], new RegExp(`約${hi}%（16/13）.*約${lo}%（16/14）.*Base64は約${b64}%`));
  assert.match(MESSAGES.en['b91.how3'], new RegExp(`about ${hi}% \\(16/13\\).*about ${lo}% \\(16/14\\).*about ${b64}%`));
  const b58 = Math.log2(58).toFixed(2);
  for (const k of ['alphabet.base58', 'compare.b58.bits', 'ratio.b58']) {
    assert.ok(MESSAGES.ja[k].includes(`約${b58}ビット`), k);
    assert.ok(MESSAGES.en[k].toLowerCase().includes(`about ${b58} bits`), k);
  }
});
