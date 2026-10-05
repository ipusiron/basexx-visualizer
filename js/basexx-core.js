// BaseXX Visualizer - 変換の計算部（DOM を使わない）。globalThis.BaseXXCore に置く
// バイト列は Uint8Array。デコードは { ok: true, bytes, skipped, loose } か { ok: false, error, pos, ch } を返す（例外を投げない）
(() => {
  'use strict';

  const KINDS = ['base64', 'base32', 'base58', 'base91'];

  // 字母（使う文字）。Base64・Base32 は RFC 4648、Base58 は Bitcoin、basE91 は原作（base91-0.6.0 の enctab）
  const ALPHABETS = {
    base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    base32: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
    base58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
    base91: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"'
  };

  // RFC 4648 §3.4 が紛らわしいと挙げる文字（0 と O、1 と l と I）
  const CONFUSABLE = ['0', 'O', '1', 'l', 'I'];

  const MAX_BYTES = 4096; // エンコードするバイト数の上限
  const MAX_CHARS = 8192; // デコードする文字数の上限

  const SPACE = /^[ \t\r\n]$/;
  const INDEX = Object.fromEntries(KINDS.map((k) => [k, new Map([...ALPHABETS[k]].map((c, i) => [c, i]))]));

  const fail = (error, pos, ch) => ({ ok: false, error, pos, ch });

  // ===== Base64・Base32（ビットを bits ずつ区切って字母の文字にする） =====
  // block は = で埋めるときの文字数の単位（Base64 は4、Base32 は8）
  function encodeBits(bytes, alphabet, bits, block, pad) {
    const mask = (1 << bits) - 1;
    let out = '';
    let acc = 0;
    let n = 0;
    for (const b of bytes) {
      acc = (acc << 8) | b;
      n += 8;
      while (n >= bits) {
        n -= bits;
        out += alphabet[(acc >> n) & mask];
      }
      acc &= (1 << n) - 1;
    }
    if (n > 0) out += alphabet[(acc << (bits - n)) & mask];
    if (pad) while (out.length % block) out += '=';
    return out;
  }

  // 余りの文字数 r で最後のバイトが作れるか（Base64 は1文字、Base32 は1・3・6文字の余りがありえない）
  const validRemainder = (r, bits) => r === 0 || (r * bits >= 8 && (r * bits) % 8 < bits);

  // 字母にない文字は位置を付けてエラーにする。空白と改行は skipSpace のときだけ読み飛ばす。
  // 末尾の = は省いてもよいが、付けるなら数をそろえる。余りのビットが0でないもの（RFC 4648 §3.5）は loose で知らせる
  function decodeBits(text, kind, bits, block, opts) {
    const skipSpace = !opts || opts.skipSpace !== false;
    const fold = kind === 'base32';
    const map = INDEX[kind];
    const values = [];
    let pads = 0;
    let skipped = 0;
    let pos = 0;
    for (const raw of String(text)) {
      pos++;
      if (skipSpace && SPACE.test(raw)) {
        skipped++;
        continue;
      }
      if (raw === '=') {
        pads++;
        continue;
      }
      const v = map.get(fold ? raw.toUpperCase() : raw);
      if (v === undefined) return fail('char', pos, raw);
      if (pads) return fail('padding', pos, raw);
      values.push(v);
    }
    if (!values.length && !pads) return fail('empty');
    const rem = values.length % block;
    if (!validRemainder(rem, bits)) return fail('length', values.length);
    if (pads && (rem === 0 || pads !== block - rem)) return fail('padding');
    const out = [];
    let acc = 0;
    let n = 0;
    for (const v of values) {
      acc = (acc << bits) | v;
      n += bits;
      if (n >= 8) {
        n -= 8;
        out.push((acc >> n) & 255);
      }
      acc &= (1 << n) - 1;
    }
    return { ok: true, bytes: Uint8Array.from(out), skipped, loose: acc !== 0 };
  }

  const encodeBase64 = (bytes, pad = true) => encodeBits(bytes, ALPHABETS.base64, 6, 4, pad);
  const encodeBase32 = (bytes, pad = true) => encodeBits(bytes, ALPHABETS.base32, 5, 8, pad);
  const decodeBase64 = (text, opts) => decodeBits(text, 'base64', 6, 4, opts);
  const decodeBase32 = (text, opts) => decodeBits(text, 'base32', 5, 8, opts);

  // ===== Base58（バイト列を1つの大きな数として58進に直す。先頭の 00 は1バイトごとに「1」） =====
  function encodeBase58(bytes) {
    const A = ALPHABETS.base58;
    let zeros = 0;
    while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
    const digits = []; // 58進の各桁（下の桁から）
    for (let i = zeros; i < bytes.length; i++) {
      let carry = bytes[i];
      for (let j = 0; j < digits.length; j++) {
        carry += digits[j] * 256;
        digits[j] = carry % 58;
        carry = Math.floor(carry / 58);
      }
      while (carry) {
        digits.push(carry % 58);
        carry = Math.floor(carry / 58);
      }
    }
    return A[0].repeat(zeros) + digits.reverse().map((d) => A[d]).join('');
  }

  // 文字を検査して字母の番号の列にする（Base58・basE91 で共通。= も字母にない文字として扱う）
  function readSymbols(text, kind, opts) {
    const skipSpace = !opts || opts.skipSpace !== false;
    const map = INDEX[kind];
    const values = [];
    let skipped = 0;
    let pos = 0;
    for (const ch of String(text)) {
      pos++;
      if (skipSpace && SPACE.test(ch)) {
        skipped++;
        continue;
      }
      const v = map.get(ch);
      if (v === undefined) return fail('char', pos, ch);
      values.push(v);
    }
    if (!values.length) return fail('empty');
    return { ok: true, values, skipped };
  }

  function decodeBase58(text, opts) {
    const r = readSymbols(text, 'base58', opts);
    if (!r.ok) return r;
    let zeros = 0;
    while (zeros < r.values.length && r.values[zeros] === 0) zeros++;
    const bytes = []; // 256進の各桁（下の桁から）
    for (let i = zeros; i < r.values.length; i++) {
      let carry = r.values[i];
      for (let j = 0; j < bytes.length; j++) {
        carry += bytes[j] * 58;
        bytes[j] = carry & 255;
        carry >>= 8;
      }
      while (carry) {
        bytes.push(carry & 255);
        carry >>= 8;
      }
    }
    return { ok: true, bytes: Uint8Array.from([...new Array(zeros).fill(0), ...bytes.reverse()]), skipped: r.skipped, loose: false };
  }

  // ===== basE91（原作 base91.c と同じ手順。13ビットか14ビットを2文字で表す） =====
  // 下13ビットの値 v が 88 より大きければ13ビット、88 以下なら14ビットを取る（91×91＝8281 通りに収まる）
  // 組ごとの内訳（13ビットの組・14ビットの組の数、最後の1〜2文字）も返す
  function base91Steps(bytes) {
    const A = ALPHABETS.base91;
    let q = 0;
    let n = 0;
    let text = '';
    let pairs13 = 0;
    let pairs14 = 0;
    for (const b of bytes) {
      q |= b << n;
      n += 8;
      if (n > 13) {
        let v = q & 8191;
        if (v > 88) {
          q >>= 13;
          n -= 13;
          pairs13++;
        } else {
          v = q & 16383;
          q >>= 14;
          n -= 14;
          pairs14++;
        }
        text += A[v % 91] + A[Math.floor(v / 91)];
      }
    }
    let tail = 0;
    if (n) {
      text += A[q % 91];
      tail = 1;
      if (n > 7 || q > 90) {
        text += A[Math.floor(q / 91)];
        tail = 2;
      }
    }
    return { text, pairs13, pairs14, tail };
  }

  const encodeBase91 = (bytes) => base91Steps(bytes).text;

  // 原作の復号は字母にない文字をすべて読み飛ばす。ここでは空白と改行だけを読み飛ばし、ほかはエラーにする
  function decodeBase91(text, opts) {
    const r = readSymbols(text, 'base91', opts);
    if (!r.ok) return r;
    const out = [];
    let v = -1;
    let q = 0;
    let n = 0;
    for (const d of r.values) {
      if (v === -1) {
        v = d;
        continue;
      }
      v += d * 91;
      q |= v << n;
      n += (v & 8191) > 88 ? 13 : 14;
      do {
        out.push(q & 255);
        q >>= 8;
        n -= 8;
      } while (n > 7);
      v = -1;
    }
    if (v !== -1) out.push((q | (v << n)) & 255);
    return { ok: true, bytes: Uint8Array.from(out), skipped: r.skipped, loose: false };
  }

  // ===== まとめて呼ぶ =====
  function encode(kind, bytes, pad = true) {
    switch (kind) {
      case 'base64': return encodeBase64(bytes, pad);
      case 'base32': return encodeBase32(bytes, pad);
      case 'base58': return encodeBase58(bytes);
      case 'base91': return encodeBase91(bytes);
      default: throw new Error(`unknown kind: ${kind}`);
    }
  }

  function decode(kind, text, opts) {
    if ([...String(text)].length > MAX_CHARS) return fail('long', MAX_CHARS);
    switch (kind) {
      case 'base64': return decodeBase64(text, opts);
      case 'base32': return decodeBase32(text, opts);
      case 'base58': return decodeBase58(text, opts);
      case 'base91': return decodeBase91(text, opts);
      default: throw new Error(`unknown kind: ${kind}`);
    }
  }

  // 文字列だけでは方式を決められないので、4つの方式で読んだ結果を並べる
  const decodeAll = (text, opts) => KINDS.map((kind) => ({ kind, ...decode(kind, text, opts) }));

  // ===== 入力と表示の補助 =====
  const utf8 = (text) => new TextEncoder().encode(String(text));

  // 制御文字（タブと改行を除く）
  const isControl = (ch) => {
    const c = ch.codePointAt(0);
    return (c < 32 && c !== 9 && c !== 10) || c === 127;
  };

  // UTF-8 として正しく、制御文字を含まなければ文字列、そうでなければ null
  function readUtf8(bytes) {
    try {
      const s = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return [...s].some(isControl) ? null : s;
    } catch {
      return null;
    }
  }

  // 16進の文字列を読む。区切りの空白・改行・コロンは読み飛ばす。それ以外の文字と、奇数の桁はエラー
  function parseHex(text) {
    const digits = [];
    let pos = 0;
    for (const ch of String(text)) {
      pos++;
      if (SPACE.test(ch) || ch === ':') continue;
      if (!/^[0-9A-Fa-f]$/.test(ch)) return fail('char', pos, ch);
      digits.push(ch);
    }
    if (digits.length % 2) return fail('odd', digits.length);
    const bytes = new Uint8Array(digits.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(digits[2 * i] + digits[2 * i + 1], 16);
    return { ok: true, bytes };
  }

  const toHex = (bytes, sep = ' ') => [...bytes].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(sep);

  const sameBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  // ===== 長さと効率 =====
  // Base64・Base32 の長さは式で決まる（= で埋めるときは単位の倍数に切り上げる）
  function bitsLength(kind, n, pad = true) {
    const [bits, block] = kind === 'base64' ? [6, 4] : [5, 8];
    if (pad) return Math.ceil((n * 8) / (bits * block)) * block;
    return Math.ceil((n * 8) / bits);
  }

  // 元のバイト数に掛ける倍率の目安。basE91 は14ビットの組だけなら最小、13ビットの組だけなら最大
  const RATIOS = {
    base64: 8 / 6,
    base32: 8 / 5,
    base58: 8 / Math.log2(58),
    base91: [16 / 14, 16 / 13]
  };

  // 効率の比較に使うデータ。乱数は毎回同じ列（xorshift32、種は固定）にして、画面と README とテストで同じ値にする
  function sampleBytes(kind, n) {
    const out = new Uint8Array(n);
    if (kind === 'zero') return out;
    if (kind === 'ff') return out.fill(255);
    let x = 0x2545f491;
    for (let i = 0; i < n; i++) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      out[i] = x & 255;
    }
    return out;
  }

  // 実際にエンコードした長さ
  const lengths = (bytes, pad = true) => Object.fromEntries(KINDS.map((k) => [k, encode(k, bytes, pad).length]));

  globalThis.BaseXXCore = {
    KINDS,
    ALPHABETS,
    CONFUSABLE,
    MAX_BYTES,
    MAX_CHARS,
    RATIOS,
    encodeBits,
    encodeBase64,
    encodeBase32,
    encodeBase58,
    encodeBase91,
    base91Steps,
    decodeBase64,
    decodeBase32,
    decodeBase58,
    decodeBase91,
    encode,
    decode,
    decodeAll,
    utf8,
    readUtf8,
    parseHex,
    toHex,
    sameBytes,
    bitsLength,
    sampleBytes,
    lengths
  };
})();
