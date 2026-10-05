// BaseXX Visualizer - 第2弾の計算部（DOM を使わない）。globalThis.BaseXXExtras に置く
// しくみの説明（ビットの区切り・58での割り算・basE91 の組）、変種（Base64url・Base32hex・Crockford Base32）、
// 誤りの検出（検査文字・Base58Check）、TOTP の鍵（otpauth://）。js/basexx-core.js のあとに読み込む
(() => {
  'use strict';

  const C = globalThis.BaseXXCore;
  const { fail, SPACE } = C;

  // ===== 変種の字母 =====
  // Base64url と Base32hex は RFC 4648 §5・§7、Crockford は crockford.com/base32（I L O U を除く）
  const VARIANTS = {
    base64url: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
    base32hex: '0123456789ABCDEFGHIJKLMNOPQRSTUV',
    crockford: '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  };
  // 検査文字だけに使う5文字（値32〜36）を足した37文字
  const CROCKFORD_CHECK = `${VARIANTS.crockford}*~$=U`;
  // Crockford の復号で読み替える文字（大文字にしたあと）
  const CROCKFORD_READ = { O: '0', I: '1', L: '1' };

  const EXPLAIN_MAX = 12; // しくみを見せる入力のバイト数の上限
  const DETECT_MAX = 32; // 誤りの検出を試す入力のバイト数の上限

  // ===== Base64url・Base32hex =====
  const encodeBase64url = (bytes, pad = false) => C.encodeBits(bytes, VARIANTS.base64url, 6, 4, pad);
  const decodeBase64url = (text, opts) => C.decodeBits(text, VARIANTS.base64url, 6, 4, opts);
  const encodeBase32hex = (bytes, pad = true) => C.encodeBits(bytes, VARIANTS.base32hex, 5, 8, pad);
  const decodeBase32hex = (text, opts) => C.decodeBits(text, VARIANTS.base32hex, 5, 8, { ...opts, fold: true });

  // ===== Crockford Base32（数の表記） =====
  const toBig = (bytes) => [...bytes].reduce((n, b) => (n << 8n) | BigInt(b), 0n);

  function fromBig(n, len) {
    const out = new Uint8Array(len);
    for (let i = len - 1; i >= 0; i--) {
      out[i] = Number(n & 255n);
      n >>= 8n;
    }
    return out;
  }

  // 8n ビットの数の上位に0を足して5の倍数にし、5ビットずつ字母の文字にする（RFC の Base32 は下位に0を足す）。
  // check なら、数を37で割った余りの検査文字を最後に付ける
  function encodeCrockford(bytes, check = false) {
    if (!bytes.length) return '';
    const n = toBig(bytes);
    const k = Math.ceil((bytes.length * 8) / 5);
    let s = '';
    for (let i = k - 1; i >= 0; i--) s += VARIANTS.crockford[Number((n >> BigInt(5 * i)) & 31n)];
    return check ? s + CROCKFORD_CHECK[Number(n % 37n)] : s;
  }

  // 大文字・小文字を問わず、O を0、I と L を1と読み、ハイフンを無視する。読み替えた位置は replaced で返す。
  // 文字数 k から決まるバイト数は floor(5k/8)。上位に足した0の位置に1があれば range、検査文字が合わなければ check
  function decodeCrockford(text, opts) {
    const check = !!(opts && opts.check);
    const skipSpace = !opts || opts.skipSpace !== false;
    const symbols = [];
    const replaced = [];
    let hyphens = 0;
    let skipped = 0;
    let pos = 0;
    for (const raw of String(text)) {
      pos++;
      if (raw === '-') {
        hyphens++;
      } else if (skipSpace && SPACE.test(raw)) {
        skipped++;
      } else {
        const up = raw.toUpperCase();
        const read = CROCKFORD_READ[up] || up;
        if (CROCKFORD_READ[up]) replaced.push({ pos, from: raw, to: read });
        symbols.push({ raw, read, pos });
      }
    }
    if (!symbols.length || (check && symbols.length < 2)) return fail('empty');
    const data = check ? symbols.slice(0, -1) : symbols;
    let n = 0n;
    for (const s of data) {
      const v = VARIANTS.crockford.indexOf(s.read);
      if (v < 0) return fail('char', s.pos, s.raw);
      n = (n << 5n) | BigInt(v);
    }
    const len = Math.floor((data.length * 5) / 8);
    if (!len) return fail('length', data.length);
    if (n >> BigInt(len * 8)) return fail('range', data[0].pos, data[0].raw);
    let normalized = data.map((s) => s.read).join('');
    if (check) {
      const last = symbols[symbols.length - 1];
      const v = CROCKFORD_CHECK.indexOf(last.read);
      if (v < 0) return fail('char', last.pos, last.raw);
      const want = Number(n % 37n);
      if (v !== want) return { ...fail('check', last.pos, last.raw), expected: CROCKFORD_CHECK[want] };
      normalized += last.read;
    }
    return { ok: true, bytes: fromBig(n, len), skipped, hyphens, replaced, normalized, loose: false };
  }

  // ===== SHA-256（FIPS 180-4）。Base58Check の検査値に使う =====
  // 定数は素数の立方根・平方根の小数部の先頭32ビット（整数演算で出した値）
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  function sha256(bytes) {
    const len = bytes.length;
    const total = Math.ceil((len + 9) / 64) * 64;
    const m = new Uint8Array(total);
    m.set(bytes);
    m[len] = 0x80;
    const view = new DataView(m.buffer);
    view.setUint32(total - 8, Math.floor(len / 0x20000000));
    view.setUint32(total - 4, (len * 8) >>> 0);
    const h = H0.slice();
    const w = new Uint32Array(64);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        hh = g;
        g = f;
        f = e;
        e = (d + t1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) >>> 0;
      }
      [a, b, c, d, e, f, g, hh].forEach((x, i) => {
        h[i] = (h[i] + x) >>> 0;
      });
    }
    const out = new Uint8Array(32);
    const ov = new DataView(out.buffer);
    h.forEach((x, i) => ov.setUint32(i * 4, x));
    return out;
  }

  // ===== Base58Check（Bitcoin の EncodeBase58Check。SHA-256 を2回かけた先頭4バイトを後ろに付ける） =====
  const checksum4 = (payload) => sha256(sha256(payload)).slice(0, 4);

  const encodeBase58Check = (payload) => C.encodeBase58(Uint8Array.from([...payload, ...checksum4(payload)]));

  function decodeBase58Check(text, opts) {
    const r = C.decodeBase58(text, opts);
    if (!r.ok) return r;
    if (r.bytes.length < 4) return fail('length', r.bytes.length);
    const payload = r.bytes.slice(0, -4);
    if (!C.sameBytes(checksum4(payload), r.bytes.slice(-4))) return fail('check');
    return { ok: true, bytes: payload, skipped: r.skipped, loose: false };
  }

  // ===== 誤りの検出（1文字の置き換えと隣どうしの入れ替えを全部試す） =====
  const FORMATS = {
    base32: {
      encode: (b) => C.encodeBase32(b, false),
      decode: (s) => C.decodeBase32(s, { skipSpace: false }),
      symbols: () => C.ALPHABETS.base32
    },
    crockford: {
      encode: (b) => encodeCrockford(b, false),
      decode: (s) => decodeCrockford(s, { skipSpace: false }),
      symbols: () => VARIANTS.crockford
    },
    crockfordCheck: {
      encode: (b) => encodeCrockford(b, true),
      decode: (s) => decodeCrockford(s, { check: true, skipSpace: false }),
      symbols: (i, n) => (i === n - 1 ? CROCKFORD_CHECK : VARIANTS.crockford)
    },
    base58: {
      encode: (b) => C.encodeBase58(b),
      decode: (s) => C.decodeBase58(s, { skipSpace: false }),
      symbols: () => C.ALPHABETS.base58
    },
    base58check: {
      encode: encodeBase58Check,
      decode: (s) => decodeBase58Check(s, { skipSpace: false }),
      symbols: () => C.ALPHABETS.base58
    }
  };
  const FORMAT_NAMES = Object.keys(FORMATS);

  // 置き換えは、その位置に来うる字母のほかの文字すべて。入れ替えは、違う文字が隣り合う所すべて。
  // デコードが失敗した（字母にない・範囲外・検査が合わないなど）ものを「検出」と数える
  function detection(format, text) {
    const f = FORMATS[format];
    const chars = [...text];
    const n = chars.length;
    const subs = { total: 0, detected: 0 };
    const swaps = { total: 0, detected: 0 };
    for (let i = 0; i < n; i++) {
      for (const c of f.symbols(i, n)) {
        if (c === chars[i]) continue;
        const t = chars.slice();
        t[i] = c;
        subs.total++;
        if (!f.decode(t.join('')).ok) subs.detected++;
      }
    }
    for (let i = 0; i + 1 < n; i++) {
      if (chars[i] === chars[i + 1]) continue;
      const t = chars.slice();
      [t[i], t[i + 1]] = [t[i + 1], t[i]];
      swaps.total++;
      if (!f.decode(t.join('')).ok) swaps.detected++;
    }
    return { length: n, subs, swaps };
  }

  // ===== しくみの説明 =====
  const bin = (x, width) => x.toString(2).padStart(width, '0');

  // Base64・Base32 など: 元のビット列を bits ずつ区切る。最後の組に足した0の数と、= で埋める数も返す
  function explainBits(bytes, alphabet, bits, block, pad) {
    const all = [...bytes].map((b) => bin(b, 8)).join('');
    const groups = [];
    for (let i = 0; i < all.length; i += bits) {
      const chunk = all.slice(i, i + bits);
      const value = parseInt(chunk.padEnd(bits, '0'), 2);
      groups.push({ bits: chunk, added: bits - chunk.length, value, char: alphabet[value] });
    }
    const padChars = pad && groups.length % block ? block - (groups.length % block) : 0;
    return { bytes: [...bytes].map((b) => bin(b, 8)), groups, padChars };
  }

  // Base58: 先頭の 00 を数えたあと、残りを1つの数として58で割り続ける（余りを下の桁から並べる）
  function explainBase58(bytes) {
    let zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
    let n = toBig(bytes.slice(zeros));
    const number = n.toString();
    const steps = [];
    while (n > 0n) {
      const r = Number(n % 58n);
      steps.push({ n: n.toString(), q: (n / 58n).toString(), r, char: C.ALPHABETS.base58[r] });
      n /= 58n;
    }
    return { zeros, number, steps };
  }

  // basE91: 原作と同じ手順で、組ごとの大きさ（13・14ビット）と値、2文字への分け方を記録する
  function explainBase91(bytes) {
    const A = C.ALPHABETS.base91;
    const groups = [];
    let q = 0;
    let n = 0;
    for (const b of bytes) {
      q |= b << n;
      n += 8;
      if (n > 13) {
        let v = q & 8191;
        let size = 13;
        if (v <= 88) {
          v = q & 16383;
          size = 14;
        }
        q >>= size;
        n -= size;
        groups.push({ size, value: v, bits: bin(v, size), lo: v % 91, hi: Math.floor(v / 91), chars: A[v % 91] + A[Math.floor(v / 91)] });
      }
    }
    let tail = null;
    if (n) {
      const two = n > 7 || q > 90;
      tail = { size: n, value: q, bits: bin(q, n), lo: q % 91, hi: two ? Math.floor(q / 91) : null, chars: A[q % 91] + (two ? A[Math.floor(q / 91)] : '') };
    }
    return { groups, tail };
  }

  // ===== TOTP の鍵（Google Authenticator の Key Uri Format） =====
  // RFC 6238 §5.1: 鍵は HMAC の出力と同じ長さにするのがよい（SHA1 は20、SHA256 は32、SHA512 は64バイト）
  const HMAC_BYTES = { SHA1: 20, SHA256: 32, SHA512: 64 };

  // 鍵（Base32）を読み、長さと注意を返す。RFC 4226 R6: 128ビット以上が必須、160ビットを推奨
  function inspectSecret(secret, algorithm) {
    const r = C.decodeBase32(secret, { skipSpace: true });
    if (!r.ok) return { ...r, error: `secret.${r.error}` };
    const warnings = [];
    if (secret.includes('=')) warnings.push('padding');
    const bits = r.bytes.length * 8;
    if (bits < 128) warnings.push('short');
    else if (bits < 160) warnings.push('recommend');
    const want = HMAC_BYTES[algorithm];
    if (want && r.bytes.length !== want) warnings.push('hmac');
    return { ok: true, key: r.bytes, bits, warnings, hmacBytes: want };
  }

  // otpauth:// の URI か、Base32 の鍵だけを読む。ラベルは「発行者:アカウント名」（コロンは %3A でもよい）
  function parseOtpauth(input) {
    const text = String(input).trim();
    if (!text) return fail('empty');
    if (!/^otpauth:/i.test(text)) return { kind: 'secret', algorithm: 'SHA1', ...inspectSecret(text, 'SHA1') };
    let url;
    let label;
    try {
      url = new URL(text);
      label = decodeURIComponent(url.pathname.replace(/^\//, ''));
    } catch {
      return fail('uri');
    }
    const type = url.host.toLowerCase();
    if (type !== 'totp' && type !== 'hotp') return fail('type');
    const p = url.searchParams;
    const secret = p.get('secret');
    if (!secret) return fail('secret.missing');
    const colon = label.indexOf(':');
    const labelIssuer = colon >= 0 ? label.slice(0, colon) : null;
    const account = colon >= 0 ? label.slice(colon + 1).replace(/^ +/, '') : label;
    const algorithm = (p.get('algorithm') || 'SHA1').toUpperCase();
    const res = {
      kind: 'uri',
      type,
      account,
      labelIssuer,
      issuer: p.get('issuer'),
      algorithm,
      algorithmDefault: !p.get('algorithm'),
      digits: p.get('digits') || '6',
      digitsDefault: !p.get('digits'),
      period: type === 'totp' ? p.get('period') || '30' : null,
      periodDefault: !p.get('period'),
      counter: type === 'hotp' ? p.get('counter') : null,
      ...inspectSecret(secret, algorithm)
    };
    if (res.ok && labelIssuer && res.issuer && labelIssuer !== res.issuer) res.warnings.push('issuer');
    return res;
  }

  globalThis.BaseXXExtras = {
    VARIANTS,
    CROCKFORD_CHECK,
    EXPLAIN_MAX,
    DETECT_MAX,
    FORMAT_NAMES,
    HMAC_BYTES,
    encodeBase64url,
    decodeBase64url,
    encodeBase32hex,
    decodeBase32hex,
    encodeCrockford,
    decodeCrockford,
    sha256,
    encodeBase58Check,
    decodeBase58Check,
    encodeFormat: (format, bytes) => FORMATS[format].encode(bytes),
    decodeFormat: (format, text) => FORMATS[format].decode(text),
    detection,
    explainBits,
    explainBase58,
    explainBase91,
    inspectSecret,
    parseOtpauth
  };
})();
