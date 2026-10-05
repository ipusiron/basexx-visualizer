import test from 'node:test';
import assert from 'node:assert/strict';
import { core } from './load.js';

const C = core();
const u = (s) => C.utf8(s);
const hex = (s) => Uint8Array.from(s.match(/../g) || [], (h) => parseInt(h, 16));
const bytesOf = (r) => {
  assert.ok(r.ok, JSON.stringify(r));
  return [...r.bytes];
};

test('字母は64・32・58・91文字で重複がない。Base58 は Base64 の英数字から 0 O I l を除き、basE91 は印字可能な ASCII から - \\ \' を除く', () => {
  const sizes = Object.fromEntries(C.KINDS.map((k) => [k, C.ALPHABETS[k].length]));
  assert.deepEqual(sizes, { base64: 64, base32: 32, base58: 58, base91: 91 });
  for (const k of C.KINDS) assert.equal(new Set(C.ALPHABETS[k]).size, C.ALPHABETS[k].length, k);
  const alnum = [...C.ALPHABETS.base64.slice(0, 62)];
  assert.equal(C.ALPHABETS.base58, alnum.filter((c) => !'0OIl'.includes(c)).sort().join(''));
  const printable = Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i));
  assert.deepEqual([...C.ALPHABETS.base91].sort(), printable.filter((c) => !['-', '\\', "'"].includes(c)).sort());
  assert.equal(C.ALPHABETS.base91[90], '"');
});

test('RFC 4648 §10 の試験値（Base64・Base32、= で埋める・埋めない）', () => {
  const v = [
    ['', '', ''],
    ['f', 'Zg==', 'MY======'],
    ['fo', 'Zm8=', 'MZXQ===='],
    ['foo', 'Zm9v', 'MZXW6==='],
    ['foob', 'Zm9vYg==', 'MZXW6YQ='],
    ['fooba', 'Zm9vYmE=', 'MZXW6YTB'],
    ['foobar', 'Zm9vYmFy', 'MZXW6YTBOI======']
  ];
  for (const [s, b64, b32] of v) {
    assert.equal(C.encodeBase64(u(s)), b64, s);
    assert.equal(C.encodeBase32(u(s)), b32, s);
    assert.equal(C.encodeBase64(u(s), false), b64.replace(/=+$/, ''), s);
    assert.equal(C.encodeBase32(u(s), false), b32.replace(/=+$/, ''), s);
    if (s) {
      assert.deepEqual(bytesOf(C.decodeBase64(b64)), [...u(s)], b64);
      assert.deepEqual(bytesOf(C.decodeBase32(b32)), [...u(s)], b32);
      assert.deepEqual(bytesOf(C.decodeBase32(b32.replace(/=+$/, '').toLowerCase())), [...u(s)], b32);
    }
  }
});

test('draft-msporny-base58-03 の試験値と、先頭の 00 の扱い', () => {
  assert.equal(C.encodeBase58(u('Hello World!')), '2NEpo7TZRRrLZSi2U');
  assert.equal(C.encodeBase58(u('The quick brown fox jumps over the lazy dog.')), 'USm3fpXnKG5EUBx2ndxBDMPVciP5hGey2Jh4NDv6gmeo1LkMeiKrLJUUBk6Z');
  assert.equal(C.encodeBase58(hex('0000287fb4cd')), '11233QC4');
  assert.deepEqual(bytesOf(C.decodeBase58('11233QC4')), [...hex('0000287fb4cd')]);
  assert.equal(C.encodeBase58(new Uint8Array(0)), '');
  assert.equal(C.encodeBase58(new Uint8Array(2)), '11');
  assert.deepEqual(bytesOf(C.decodeBase58('11')), [0, 0]);
  assert.deepEqual(bytesOf(C.decodeBase58('1')), [0]);
});

// 既知解答は、原作 base91-0.6.0 の base91.c を忠実に移した実装で計算した（原作の test.sh の cksum を再現する移植）
test('basE91 の既知解答（原作と同じ字母・同じ手順）', () => {
  const v = [
    ['test', 'fPNKd'],
    ['hello', 'TPwJh>A'],
    ['Hello, world!', '>OwJh>}A"=r@@Y?F'],
    ['こんにちは', 'cFs@CCLU=(Py|QE@4rF']
  ];
  for (const [s, e] of v) {
    assert.equal(C.encodeBase91(u(s)), e, s);
    assert.deepEqual(bytesOf(C.decodeBase91(e)), [...u(s)], e);
  }
  assert.equal(C.encodeBase91(new Uint8Array(4)), 'AAAAA');
  assert.equal(C.encodeBase91(hex('deadbeef')), 'BnZ_7');
  assert.equal(C.encodeBase91(new Uint8Array(0)), '');
});

test('どの方式も、エンコードしてデコードすると元に戻る（0〜300バイト、乱数・00・FF、= あり・なし）', () => {
  for (let n = 0; n <= 300; n += n < 40 ? 1 : 13) {
    for (const kind of ['random', 'zero', 'ff']) {
      const data = C.sampleBytes(kind, n);
      for (const k of C.KINDS) {
        for (const pad of [true, false]) {
          const text = C.encode(k, data, pad);
          const r = C.decode(k, text);
          if (n === 0) {
            assert.equal(text, '', `${k} empty`);
            continue;
          }
          assert.ok(r.ok, `${k} ${kind} ${n} ${pad}`);
          assert.ok(C.sameBytes(r.bytes, data), `${k} ${kind} ${n} ${pad}`);
          assert.equal(r.loose, false, k);
        }
      }
    }
  }
  const text = 'A𝄞あ\n';
  for (const k of C.KINDS) assert.equal(C.readUtf8(C.decode(k, C.encode(k, u(text))).bytes), text, k);
});

test('Base64・Base32 の誤りは種類と位置を返す（字母にない文字・余りの文字数・= の位置と数）', () => {
  assert.deepEqual(C.decodeBase64('Zm9v!'), { ok: false, error: 'char', pos: 5, ch: '!' });
  assert.deepEqual(C.decodeBase64('Zm9v-_'), { ok: false, error: 'char', pos: 5, ch: '-' });
  assert.equal(C.decodeBase64('Zm9vY').error, 'length');
  assert.equal(C.decodeBase64('Zg=').error, 'padding');
  assert.equal(C.decodeBase64('Zm9v====').error, 'padding');
  assert.deepEqual(C.decodeBase64('Zg==Zg=='), { ok: false, error: 'padding', pos: 5, ch: 'Z' });
  assert.equal(C.decodeBase64('').error, 'empty');
  assert.equal(C.decodeBase64(' \n ').error, 'empty');
  assert.equal(C.decodeBase32('MY0').error, 'char');
  assert.equal(C.decodeBase32('MY0').pos, 3);
  for (const s of ['M', 'MZX', 'MZXW6Y']) assert.equal(C.decodeBase32(s).error, 'length', s);
  assert.equal(C.decodeBase32('MY=').error, 'padding');
});

test('空白と改行は、選んだときだけ読み飛ばす（読み飛ばした数を返す）', () => {
  const r = C.decodeBase32('JBSW Y3DP\nEHPK 3PXP');
  assert.deepEqual(bytesOf(r), [...u('Hello!'), 0xde, 0xad, 0xbe, 0xef]);
  assert.equal(r.skipped, 3);
  assert.deepEqual(C.decodeBase32('JBSW Y3DP', { skipSpace: false }), { ok: false, error: 'char', pos: 5, ch: ' ' });
  assert.deepEqual(bytesOf(C.decodeBase91('fP NKd')), [...u('test')]);
  assert.equal(C.decodeBase58('2NEpo 7TZRRrLZSi2U', { skipSpace: false }).error, 'char');
});

test('余りのビットが0でない文字列は読めるが loose で知らせる（Zh== も f になる）', () => {
  assert.deepEqual(bytesOf(C.decodeBase64('Zh==')), [0x66]);
  assert.equal(C.decodeBase64('Zh==').loose, true);
  assert.equal(C.decodeBase64('Zg==').loose, false);
  assert.equal(C.decodeBase32('MZ======').loose, true);
});

test('Base58 は 0 O I l と記号を、basE91 は - \\ \' と全角文字を、字母にない文字として位置つきで拒む', () => {
  for (const ch of ['0', 'O', 'I', 'l', '+', '/', '=']) {
    assert.deepEqual(C.decodeBase58(`2NE${ch}`), { ok: false, error: 'char', pos: 4, ch }, ch);
  }
  for (const ch of ['-', '\\', "'", 'あ']) assert.deepEqual(C.decodeBase91(`fP${ch}`), { ok: false, error: 'char', pos: 3, ch }, ch);
  assert.deepEqual(C.decodeBase91('𝄞-'), { ok: false, error: 'char', pos: 1, ch: '𝄞' });
});

test('長すぎる文字列は読まずに long を返す', () => {
  for (const k of C.KINDS) assert.equal(C.decode(k, 'A'.repeat(C.MAX_CHARS + 1)).error, 'long', k);
  assert.ok(C.decode('base91', 'A'.repeat(C.MAX_CHARS)).ok);
});

test('同じ文字列が複数の方式で読めることがある（NBSWY3DP は4方式とも読める。Base32 なら hello）', () => {
  const all = C.decodeAll('NBSWY3DP');
  assert.deepEqual(all.map((r) => [r.kind, r.ok]), C.KINDS.map((k) => [k, true]));
  assert.equal(C.readUtf8(all.find((r) => r.kind === 'base32').bytes), 'hello');
  // basE91 の test（fPNKd）は、Base64 では5文字（余り1）で読めないが、Base32（小文字も読む）と Base58 では別のバイト列として読める
  assert.deepEqual(C.decodeAll('fPNKd').map((r) => r.ok), [false, true, true, true]);
  assert.equal(C.readUtf8(C.decodeBase91('fPNKd').bytes), 'test');
});

test('16進の入力は空白・改行・コロンで区切ってよい。奇数の桁と16進でない文字は拒む', () => {
  assert.deepEqual(bytesOf(C.parseHex('DE AD\nbe:ef')), [0xde, 0xad, 0xbe, 0xef]);
  assert.deepEqual(bytesOf(C.parseHex('')), []);
  assert.deepEqual(C.parseHex('DEA'), { ok: false, error: 'odd', pos: 3, ch: undefined });
  assert.deepEqual(C.parseHex('DG'), { ok: false, error: 'char', pos: 2, ch: 'G' });
  assert.equal(C.toHex(hex('00ff10')), '00 FF 10');
});

test('UTF-8 として読めないもの、制御文字を含むものは文字列にしない（タブ・改行は可）', () => {
  assert.equal(C.readUtf8(u('こんにちは')), 'こんにちは');
  assert.equal(C.readUtf8(hex('deadbeef')), null);
  assert.equal(C.readUtf8(hex('41014')), null);
  assert.equal(C.readUtf8(hex('41000a')), null);
  assert.equal(C.readUtf8(u('a\tb\nc')), 'a\tb\nc');
});

test('Base64・Base32 の長さの式は、実際にエンコードした長さと同じ（0〜64バイト、= あり・なし）', () => {
  for (let n = 0; n <= 64; n++) {
    for (const pad of [true, false]) {
      const data = C.sampleBytes('random', n);
      assert.equal(C.bitsLength('base64', n, pad), C.encodeBase64(data, pad).length, `64 ${n} ${pad}`);
      assert.equal(C.bitsLength('base32', n, pad), C.encodeBase32(data, pad).length, `32 ${n} ${pad}`);
    }
  }
});

test('basE91 の組の内訳は文字数と合い、00 だけなら14ビットの組だけ、FF だけなら13ビットの組だけになる', () => {
  for (let n = 1; n <= 256; n++) {
    for (const kind of ['random', 'zero', 'ff']) {
      const s = C.base91Steps(C.sampleBytes(kind, n));
      assert.equal(s.text.length, 2 * (s.pairs13 + s.pairs14) + s.tail, `${kind} ${n}`);
      const used = 13 * s.pairs13 + 14 * s.pairs14;
      assert.ok(used <= 8 * n && 8 * n - used <= 13, `${kind} ${n}`);
      if (kind === 'zero') assert.equal(s.pairs13, 0, `${n}`);
      if (kind === 'ff') assert.equal(s.pairs14, 0, `${n}`);
      assert.ok(s.text.length >= Math.floor(n * C.RATIOS.base91[0]) && s.text.length <= Math.ceil(n * C.RATIOS.base91[1]) + 1, `${kind} ${n}`);
    }
  }
});

test('乱数のデータは毎回同じ列。256バイトの長さは Base64 344・Base32 416・Base58 350・basE91 315 文字', () => {
  assert.equal(C.toHex(C.sampleBytes('random', 8)), '3A AB AC 26 AF 23 1A 71');
  assert.deepEqual(C.lengths(C.sampleBytes('random', 256)), { base64: 344, base32: 416, base58: 350, base91: 315 });
  assert.equal(Math.ceil(256 * C.RATIOS.base58), 350);
  assert.deepEqual(C.lengths(C.sampleBytes('zero', 256)), { base64: 344, base32: 416, base58: 256, base91: 293 });
});

test('紛らわしい組（0 と O、1 と l と I）の相手がそろっているのは Base64 と basE91 だけ', () => {
  assert.deepEqual(C.confusablesIn('base64'), ['0', 'O', '1', 'l', 'I']);
  assert.deepEqual(C.confusablesIn('base91'), ['0', 'O', '1', 'l', 'I']);
  assert.deepEqual(C.confusablesIn('base32'), []);
  assert.deepEqual(C.confusablesIn('base58'), []);
  assert.ok(C.ALPHABETS.base32.includes('O') && !C.ALPHABETS.base32.includes('0'));
  assert.ok(C.ALPHABETS.base58.includes('1') && !C.ALPHABETS.base58.includes('l') && !C.ALPHABETS.base58.includes('I'));
});
