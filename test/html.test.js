import test from 'node:test';
import assert from 'node:assert/strict';
import { read, load, core } from './load.js';

const html = read('index.html');
const C = core();
const { MESSAGES, t } = load('js/messages.js').BaseXXMessages;
const { parseVars } = load('js/i18n.js').BaseXXI18n;
const SCRIPTS = ['script.js', 'js/basexx-core.js', 'js/messages.js', 'js/i18n.js', 'js/theme.js', 'js/theme-init.js'];
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const TABS = ['overview', 'convert', 'length', 'misread', 'base91'];

test('CSP はスクリプト・スタイルを同じ場所のファイルだけに限り、unsafe-inline と外部の通信を許さない', () => {
  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)[1];
  assert.equal(csp, "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
    + "connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
  assert.match(html, /<link rel="icon" href="data:,">/);
  assert.match(html, /<noscript>/);
});

test('HTML に style 属性・インラインのスクリプト・イベントハンドラーがない。外部リンクは noopener noreferrer', () => {
  assert.doesNotMatch(html, /\sstyle=/);
  assert.doesNotMatch(html, /\son[a-z]+=/i);
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ['js/theme-init.js', 'js/basexx-core.js', 'js/messages.js', 'js/i18n.js', 'js/theme.js', 'script.js']);
  assert.equal((html.match(/<script/g) || []).length, scripts.length);
  for (const a of html.match(/<a [^>]*>/g)) assert.match(a, /target="_blank" rel="noopener noreferrer"/, a);
});

test('タブは WAI-ARIA の形（tablist の中はタブだけ、aria-controls の先が実在、最初のタブだけ選択）', () => {
  const nav = html.match(/<nav class="tabs" role="tablist"[\s\S]*?<\/nav>/)[0];
  assert.equal((nav.match(/<button/g) || []).length, TABS.length);
  const tabs = [...nav.matchAll(/role="tab" id="(tab-[a-z0-9]+)" data-tab="([a-z0-9]+)" aria-controls="(panel-[a-z0-9]+)" aria-selected="(true|false)"/g)];
  assert.deepEqual(tabs.map((m) => [m[2], m[4]]), TABS.map((k, i) => [k, i === 0 ? 'true' : 'false']));
  for (const [, id, , panel, selected] of tabs) {
    const tag = html.match(new RegExp(`<section [^>]*id="${panel}"[^>]*>`))[0];
    assert.match(tag, new RegExp(`role="tabpanel" aria-labelledby="${id}"`), panel);
    assert.equal(/\shidden/.test(tag), selected === 'false', panel);
  }
});

test('ボタンは type="button"。入力欄は label の for か、label で囲んで名前を付ける', () => {
  for (const b of html.match(/<button[^>]*>/g)) assert.match(b, /type="button"/, b);
  for (const m of html.matchAll(/<(input|textarea) [^>]*id="([^"]+)"/g)) {
    const named = new RegExp(`<label [^>]*for="${m[2]}"`).test(html) || new RegExp(`<label class="choice"><input [^>]*id="${m[2]}"`).test(html);
    assert.ok(named, m[2]);
  }
});

test('方式を選ぶボタンは aria-pressed を持ち、最初の1つだけ押されている', () => {
  for (const attr of ['data-kind', 'data-pattern']) {
    const states = [...html.matchAll(new RegExp(`class="chip"? ?[a-z ]*" ${attr}="[^"]+" aria-pressed="(true|false)"`, 'g'))].map((m) => m[1]);
    assert.deepEqual(states, ['true', ...Array(states.length - 1).fill('false')], attr);
    assert.ok(states.length >= 4, attr);
  }
});

// 文言の太字（**）と改行（\n）は HTML の strong と br に当たる。HTML 側のタグを外して比べる
const plain = (s) => s.replace(/\n\s*/g, '').replace(/<br>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim();
const fromDict = (s) => s.replace(/\*\*/g, '');

test('data-i18n のキーは辞書にあり、HTML に書いた日本語は辞書の日本語と同じ', () => {
  let n = 0;
  for (const m of html.matchAll(/<([a-z0-9]+)([^>]*?)data-i18n="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const key = m[3];
    assert.ok(MESSAGES.ja[key] !== undefined, key);
    const vars = parseVars(((m[2] + m[4]).match(/data-i18n-vars="([^"]*)"/) || [])[1]);
    assert.equal(plain(m[5]), fromDict(t(key, vars, 'ja')), key);
    n++;
  }
  assert.ok(n >= 90, String(n));
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const pair of m[1].split(';')) assert.ok(MESSAGES.ja[pair.split(':')[1]] !== undefined, pair);
  }
});

test('画面のスクリプトが参照する id は、すべて HTML にある（方式ごとに組み立てる id も）', () => {
  const src = read('script.js');
  const used = [...src.matchAll(/\$\('([a-z0-9-]+)'\)/g)].map((m) => m[1]);
  assert.ok(used.length >= 15, String(used.length));
  for (const id of used) assert.ok(ids.has(id), id);
  for (const m of src.matchAll(/\$\(id\)|for \(const id of \[([^\]]+)\]\)/g)) {
    if (m[1]) for (const id of m[1].match(/'([a-z0-9-]+)'/g).map((s) => s.slice(1, -1))) assert.ok(ids.has(id), id);
  }
  for (const k of C.KINDS) for (const part of ['out', 'meta', 'copy', 'bar', 'bar-text']) assert.ok(ids.has(`${part}-${k}`), `${part}-${k}`);
});

test('JS は innerHTML・eval を使わず、style を書き換えない。document 全体の keydown を拾わない', () => {
  for (const f of SCRIPTS) {
    const src = read(f);
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|\beval\(|new Function|document\.write/, f);
    assert.doesNotMatch(src, /\.style\b|setAttribute\('style'|cssText/, f);
    assert.doesNotMatch(src, /console\.(log|debug|info)/, f);
    assert.doesNotMatch(src, /document\.addEventListener\('keydown'/, f);
  }
});

test('localStorage は try で囲んで読み書きする（使えない環境でも画面が止まらない）', () => {
  for (const f of SCRIPTS) {
    const src = read(f);
    const uses = (src.match(/localStorage\./g) || []).length;
    const guarded = [...src.matchAll(/try \{\s*(?:const [a-z]+ = |return )?localStorage\./g)].length;
    assert.equal(guarded, uses, f);
  }
});

test('倍率の表の数値は、計算部の倍率と同じ（小数3桁）', () => {
  const table = html.match(/<table class="ratio-table">[\s\S]*?<\/table>/)[0];
  const cells = [...table.matchAll(/<td class="mono nowrap">([^<]+)<\/td>/g)].map((m) => m[1]);
  const f = (x) => x.toFixed(3);
  assert.deepEqual(cells, [
    `4/3 ≈ ${f(C.RATIOS.base64)}`,
    `8/5 = ${f(C.RATIOS.base32)}`,
    `8/log₂58 ≈ ${f(C.RATIOS.base58)}`,
    `16/14〜16/13 ≈ ${f(C.RATIOS.base91[0])}〜${f(C.RATIOS.base91[1])}`
  ]);
});

test('例のボタンの文字列は読める（エンコードの16進の例は16進として、デコードの例は少なくとも1つの方式で）', () => {
  const enc = [...html.matchAll(/data-enc-sample="([a-z]+)">([^<]+)</g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(enc.map((e) => e[0]), ['hello', 'jp', 'deadbeef', 'zeros']);
  for (const [, v] of enc.slice(2)) assert.ok(C.parseHex(v).ok, v);
  const dec = [...html.matchAll(/data-dec-sample="([^"]+)"/g)].map((m) => m[1].replace(/&gt;/g, '>'));
  assert.equal(dec.length, 4);
  for (const v of dec) assert.ok(C.decodeAll(v).some((r) => r.ok), v);
  assert.equal(C.readUtf8(C.decodeBase58('2NEpo7TZRRrLZSi2U').bytes), 'Hello World!');
  assert.equal(C.readUtf8(C.decodeBase91('TPwJh>A').bytes), 'hello');
});
