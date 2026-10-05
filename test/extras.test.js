import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { core, load } from './load.js';

const C = core();
const X = load('js/basexx-extras.js').BaseXXExtras;
const u = (s) => C.utf8(s);
const hex = (s) => Uint8Array.from(Buffer.from(s, 'hex'));
const toHex = (b) => Buffer.from(b).toString('hex');
const bytesOf = (r) => {
  assert.ok(r.ok, JSON.stringify(r));
  return [...r.bytes];
};

test('Base64url（RFC 4648 §5）は + / の代わりに - _ を使い、既定では = を付けない', () => {
  assert.equal(X.encodeBase64url(hex('fbff')), '-_8');
  assert.equal(X.encodeBase64url(hex('fbff'), true), '-_8=');
  assert.equal(C.encodeBase64(hex('fbff')), '+/8=');
  assert.equal(X.encodeBase64url(u('hello?>'), true), 'aGVsbG8_Pg==');
  assert.deepEqual(bytesOf(X.decodeBase64url('-_8')), [0xfb, 0xff]);
  assert.equal(X.decodeBase64url('+/8=').error, 'char');
  assert.equal(C.decodeBase64('-_8=').error, 'char');
  assert.equal(X.VARIANTS.base64url.length, 64);
});

test('Base32hex（RFC 4648 §7）の試験値。小文字も読み、元のバイト列の大小の順が文字列の順と同じになる', () => {
  const v = ['CO======', 'CPNG====', 'CPNMU===', 'CPNMUOG=', 'CPNMUOJ1', 'CPNMUOJ1E8======'];
  ['f', 'fo', 'foo', 'foob', 'fooba', 'foobar'].forEach((s, i) => {
    assert.equal(X.encodeBase32hex(u(s)), v[i], s);
    assert.deepEqual(bytesOf(X.decodeBase32hex(v[i].toLowerCase())), [...u(s)], s);
  });
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const data = Array.from({ length: 200 }, (_, i) => C.sampleBytes('random', 7 + (i % 4)).map((b) => (b * (i + 1)) & 255).slice(0, 5));
  let rfcBroken = 0;
  for (let i = 0; i + 1 < data.length; i++) {
    const order = cmp(toHex(data[i]), toHex(data[i + 1]));
    assert.equal(cmp(X.encodeBase32hex(data[i]), X.encodeBase32hex(data[i + 1])), order, String(i));
    if (cmp(C.encodeBase32(data[i]), C.encodeBase32(data[i + 1])) !== order) rfcBroken++;
  }
  assert.ok(rfcBroken > 0, 'RFC の Base32 では順が崩れる例がある');
});

// 既知解答は ref の phase2_ref.py（Python の整数で、8n ビットの数を上位に0を足して5ビットずつ）で計算した
test('Crockford Base32 の既知解答（数の表記、検査文字は法37）', () => {
  const v = [['hello', 'D1JPRV3F', 'D1JPRV3FJ'], ['f', '36', '36W'], ['Hello!', '28CNP6RVS1', '28CNP6RVS1P']];
  for (const [s, plain, checked] of v) {
    assert.equal(X.encodeCrockford(u(s)), plain, s);
    assert.equal(X.encodeCrockford(u(s), true), checked, s);
  }
  assert.equal(X.encodeCrockford(hex('deadbeef'), true), '3FAVFQF5');
  assert.equal(X.encodeCrockford(hex('0000'), true), '00000');
  assert.equal(X.CROCKFORD_CHECK, '0123456789ABCDEFGHJKMNPQRSTVWXYZ*~$=U');
  for (const ch of 'ILOU') assert.ok(!X.VARIANTS.crockford.includes(ch), ch);
});

test('Crockford の復号は O を0、I と L を1と読み、小文字とハイフンも受け付ける（読み替えた位置を返す）', () => {
  const r = X.decodeCrockford('d1-jprv-3f');
  assert.deepEqual(bytesOf(r), [...u('hello')]);
  assert.equal(r.hyphens, 2);
  const m = X.decodeCrockford('DIJPRV3F');
  assert.deepEqual(bytesOf(m), [...u('hello')]);
  assert.deepEqual(m.replaced, [{ pos: 2, from: 'I', to: '1' }]);
  assert.deepEqual(X.decodeCrockford('dljprv3f').replaced, [{ pos: 2, from: 'l', to: '1' }]);
  assert.deepEqual(bytesOf(X.decodeCrockford('3FAVFQF5', { check: true })), [0xde, 0xad, 0xbe, 0xef]);
  assert.deepEqual(X.decodeCrockford('3FAVFQF6', { check: true }), { ok: false, error: 'check', pos: 8, ch: '6', expected: '5' });
  assert.deepEqual(X.decodeCrockford('D1JPRV3U'), { ok: false, error: 'char', pos: 8, ch: 'U' });
  assert.deepEqual(X.decodeCrockford('ZZ'), { ok: false, error: 'range', pos: 1, ch: 'Z' });
  assert.equal(X.decodeCrockford('D').error, 'length');
  assert.equal(X.decodeCrockford('--').error, 'empty');
});

test('Crockford の往復（1〜40バイト、検査文字あり・なし）', () => {
  for (let n = 1; n <= 40; n++) {
    for (const kind of ['random', 'zero', 'ff']) {
      const data = C.sampleBytes(kind, n);
      for (const check of [false, true]) {
        const r = X.decodeCrockford(X.encodeCrockford(data, check), { check });
        assert.ok(r.ok && C.sameBytes(r.bytes, data), `${kind} ${n} ${check}`);
      }
    }
  }
});

test('SHA-256 は Node の crypto と同じ（0〜300バイト）。FIPS 180 の abc の値', () => {
  for (let n = 0; n <= 300; n++) {
    const b = C.sampleBytes('random', n + 1).slice(1);
    assert.equal(toHex(X.sha256(b)), crypto.createHash('sha256').update(b).digest('hex'), String(n));
  }
  assert.equal(toHex(X.sha256(u('abc'))), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('Base58Check（Bitcoin の genesis ブロックのアドレス）と、検査値が合わない・短すぎる場合', () => {
  const payload = hex('0062e907b15cbf27d5425399ebf6f0fb50ebb88f18');
  assert.equal(X.encodeBase58Check(payload), '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
  assert.deepEqual(bytesOf(X.decodeBase58Check('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')), [...payload]);
  assert.equal(X.decodeBase58Check('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb').error, 'check');
  assert.equal(X.decodeBase58Check('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfN0').error, 'char');
  assert.equal(X.decodeBase58Check('2').error, 'length');
});

test('誤りの検出: 検査のない形式は0件、検査文字と Base58Check は1文字の置き換えと隣どうしの入れ替えを全件検出する', () => {
  const r = Object.fromEntries(X.FORMAT_NAMES.map((f) => [f, X.detection(f, X.encodeFormat(f, u('hello')))]));
  assert.deepEqual(r.base32, { length: 8, subs: { total: 248, detected: 0 }, swaps: { total: 7, detected: 0 } });
  assert.deepEqual(r.crockford, { length: 8, subs: { total: 248, detected: 0 }, swaps: { total: 7, detected: 0 } });
  assert.deepEqual(r.crockfordCheck, { length: 9, subs: { total: 284, detected: 284 }, swaps: { total: 8, detected: 8 } });
  assert.deepEqual(r.base58, { length: 7, subs: { total: 399, detected: 0 }, swaps: { total: 6, detected: 0 } });
  assert.deepEqual(r.base58check, { length: 13, subs: { total: 741, detected: 741 }, swaps: { total: 12, detected: 12 } });
  // 法37は32より大きい素数なので、1文字の置き換えと隣どうしの入れ替えは必ず検出できる（いろいろな長さで確かめる）
  for (let n = 1; n <= 12; n++) {
    const d = X.detection('crockfordCheck', X.encodeCrockford(C.sampleBytes('random', n), true));
    assert.equal(d.subs.detected, d.subs.total, String(n));
    assert.equal(d.swaps.detected, d.swaps.total, String(n));
  }
});

test('しくみ: ビットの区切りをつなぐと、エンコードした文字列になる（Base64・Base32・Base64url・Base32hex）', () => {
  const kinds = [[C.ALPHABETS.base64, 6, 4, C.encodeBase64], [C.ALPHABETS.base32, 5, 8, C.encodeBase32],
    [X.VARIANTS.base64url, 6, 4, (b) => X.encodeBase64url(b, true)], [X.VARIANTS.base32hex, 5, 8, X.encodeBase32hex]];
  for (let n = 1; n <= X.EXPLAIN_MAX; n++) {
    const data = C.sampleBytes('random', n);
    for (const [alphabet, bits, block, enc] of kinds) {
      const e = X.explainBits(data, alphabet, bits, block, true);
      assert.equal(e.groups.map((g) => g.char).join('') + '='.repeat(e.padChars), enc(data), `${bits} ${n}`);
      assert.equal(e.groups.map((g) => g.bits).join(''), e.bytes.join(''));
    }
  }
  assert.deepEqual(X.explainBits(u('hi'), C.ALPHABETS.base64, 6, 4, true).groups.map((g) => [g.bits, g.added, g.value, g.char]),
    [['011010', 0, 26, 'a'], ['000110', 0, 6, 'G'], ['1001', 2, 36, 'k']]);
});

test('しくみ: Base58 の割り算の余りを下から読むと、先頭の「1」のあとに続く文字列になる', () => {
  const e = X.explainBase58(hex('0000287fb4cd'));
  assert.equal(e.zeros, 2);
  assert.equal(e.number, String(0x287fb4cd));
  assert.equal('1'.repeat(e.zeros) + e.steps.map((s) => s.char).reverse().join(''), '11233QC4');
  for (let n = 1; n <= X.EXPLAIN_MAX; n++) {
    const data = C.sampleBytes('random', n);
    const x = X.explainBase58(data);
    assert.equal('1'.repeat(x.zeros) + x.steps.map((s) => s.char).reverse().join(''), C.encodeBase58(data));
    for (const s of x.steps) assert.equal(BigInt(s.n), BigInt(s.q) * 58n + BigInt(s.r));
  }
});

test('しくみ: basE91 の組をつなぐと、エンコードした文字列になる（組の数も計算部と同じ）', () => {
  const e = X.explainBase91(u('hello'));
  assert.deepEqual(e.groups.map((g) => [g.size, g.value, g.chars]), [[13, 1384, 'TP'], [13, 867, 'wJ'], [13, 7131, 'h>']]);
  assert.deepEqual(e.tail, { size: 1, value: 0, bits: '0', lo: 0, hi: null, chars: 'A' });
  for (let n = 1; n <= X.EXPLAIN_MAX; n++) {
    for (const kind of ['random', 'zero', 'ff']) {
      const data = C.sampleBytes(kind, n);
      const x = X.explainBase91(data);
      const s = C.base91Steps(data);
      assert.equal(x.groups.map((g) => g.chars).join('') + (x.tail ? x.tail.chars : ''), s.text, `${kind} ${n}`);
      assert.deepEqual([x.groups.filter((g) => g.size === 13).length, x.groups.filter((g) => g.size === 14).length], [s.pairs13, s.pairs14]);
      for (const g of x.groups) assert.equal(g.lo + 91 * g.hi, g.value);
    }
  }
});

test('TOTP の鍵: Key Uri Format の例を読む（例の鍵は80ビットで、RFC 4226 の128ビットに届かない）', () => {
  const a = X.parseOtpauth('otpauth://totp/Example:alice@google.com?secret=JBSWY3DPEHPK3PXP&issuer=Example');
  assert.equal(a.ok, true);
  assert.deepEqual([a.type, a.labelIssuer, a.account, a.issuer], ['totp', 'Example', 'alice@google.com', 'Example']);
  assert.deepEqual([a.algorithm, a.digits, a.period, a.algorithmDefault], ['SHA1', '6', '30', true]);
  assert.equal(toHex(a.key), toHex(Buffer.concat([Buffer.from('Hello!'), hex('deadbeef')])));
  assert.equal(a.bits, 80);
  assert.deepEqual(a.warnings, ['short', 'hmac']);
  const b = X.parseOtpauth('otpauth://totp/ACME%20Co:john.doe@email.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ'
    + '&issuer=ACME%20Co&algorithm=SHA1&digits=6&period=30');
  assert.deepEqual([b.labelIssuer, b.account, b.issuer, b.bits, b.warnings, b.algorithmDefault],
    ['ACME Co', 'john.doe@email.com', 'ACME Co', 160, [], false]);
});

test('TOTP の鍵: コロンの %3A、鍵だけの入力、= の付いた鍵、発行者の食い違い、SHA256、hotp、読めない入力', () => {
  const c = X.parseOtpauth('otpauth://totp/Big%20Corporation%3A%20alice%40bigco.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ');
  assert.deepEqual([c.labelIssuer, c.account, c.issuer], ['Big Corporation', 'alice@bigco.com', null]);
  const s = X.parseOtpauth('JBSW Y3DP EHPK 3PXP');
  assert.deepEqual([s.kind, s.ok, s.bits], ['secret', true, 80]);
  assert.deepEqual(X.parseOtpauth('otpauth://totp/x?secret=MZXW6YTBOI======').warnings, ['padding', 'short', 'hmac']);
  assert.ok(X.parseOtpauth('otpauth://totp/A:x?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=B').warnings.includes('issuer'));
  const sha256 = X.parseOtpauth('otpauth://totp/x?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&algorithm=SHA256');
  assert.deepEqual([sha256.hmacBytes, sha256.warnings], [32, ['hmac']]);
  const h = X.parseOtpauth('otpauth://hotp/x?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&counter=5');
  assert.deepEqual([h.type, h.counter, h.period], ['hotp', '5', null]);
  assert.equal(X.parseOtpauth('otpauth://totp/x?secret=JBSWY3DPEHPK3PX0').error, 'secret.char');
  assert.equal(X.parseOtpauth('otpauth://totp/x').error, 'secret.missing');
  assert.equal(X.parseOtpauth('otpauth://foo/x?secret=AA').error, 'type');
  assert.equal(X.parseOtpauth('otpauth://totp/%E0%A4%A?secret=AA').error, 'uri');
  assert.equal(X.parseOtpauth('  ').error, 'empty');
});
