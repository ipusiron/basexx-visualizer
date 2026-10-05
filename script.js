// BaseXX Visualizer - 画面の処理（DOM）。計算は js/basexx-core.js と js/basexx-extras.js、文言は js/messages.js に置く
// 各部分は状態を持ち、render() で状態から画面を描き直す（言語を切り替えたときも同じ関数で描き直す）
(() => {
  'use strict';

  const C = globalThis.BaseXXCore;
  const X = globalThis.BaseXXExtras;
  const I18n = globalThis.BaseXXI18n;
  const Theme = globalThis.BaseXXTheme;
  const t = (key, vars) => globalThis.BaseXXMessages.t(key, vars);
  const $ = (id) => document.getElementById(id);
  const renders = [];
  const NAMES = { base64: 'Base64', base32: 'Base32', base58: 'Base58', base91: 'basE91' };

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // 元のバイト数に対する倍率（小数2桁）
  const ratioText = (len, n) => (len / n).toFixed(2);

  // 見えない文字を言葉にする（エラーの位置の表示用）
  function visible(ch) {
    if (ch === ' ') return t('char.space');
    if (ch === '\n' || ch === '\r') return t('char.newline');
    if (ch === '\t') return t('char.tab');
    return ch === undefined ? '' : ch;
  }

  // デコードの誤り（char・length・padding・empty・long）を文にする
  const reason = (r) => t(`dec.err.${r.error}`, { pos: r.pos, ch: visible(r.ch) });

  // バイト列を、UTF-8 の文字列として読めればその文字列、読めなければ16進で見せる
  const shown = (bytes) => {
    const s = C.readUtf8(bytes);
    return s === null ? C.toHex(bytes) : s;
  };

  // ===== タブ（矢印キー・Home・End で移動、選んだタブだけ tabindex=0） =====
  const tabs = [...document.querySelectorAll('.tab-btn')];

  function selectTab(tab, focus) {
    for (const b of tabs) {
      const on = b === tab;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      $(b.getAttribute('aria-controls')).hidden = !on;
    }
    if (focus) tab.focus();
  }

  tabs.forEach((b, i) => {
    b.addEventListener('click', () => selectTab(b, false));
    b.addEventListener('keydown', (e) => {
      const target = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (target === undefined) return;
      e.preventDefault();
      selectTab(tabs[(target + tabs.length) % tabs.length], true);
    });
  });

  // ===== 基本: 字母の早見 =====
  const alphabet = { kind: 'base64' };
  const kindChips = [...document.querySelectorAll('.chip[data-kind]')];

  function renderAlphabet() {
    const k = alphabet.kind;
    for (const c of kindChips) c.setAttribute('aria-pressed', c.dataset.kind === k ? 'true' : 'false');
    $('alphabet-summary').textContent = t(`alphabet.${k}`);
    const marks = C.confusablesIn(k);
    const grid = $('alphabet-grid');
    grid.setAttribute('aria-label', t('alphabet.gridLabel', { name: NAMES[k] }));
    grid.replaceChildren(...[...C.ALPHABETS[k]].map((ch, i) => {
      const cell = el('div', marks.includes(ch) ? 'glyph confusable' : 'glyph');
      cell.setAttribute('role', 'listitem');
      cell.append(el('span', 'glyph-char', ch), el('span', 'glyph-index', String(i)));
      return cell;
    }));
    $('alphabet-pairs').textContent = marks.length ? t('alphabet.pairs', { list: marks.join(' ') }) : t('alphabet.noPairs');
  }

  for (const c of kindChips) {
    c.addEventListener('click', () => {
      alphabet.kind = c.dataset.kind;
      renderAlphabet();
    });
  }
  renders.push(renderAlphabet);

  // ===== 変換: エンコード（4つの方式を並べる） =====
  const encInput = $('enc-input');
  const encText = {};

  // 入力を読んでバイト列にする。読めなければ文言を返す
  function readEncInput() {
    let bytes;
    if ($('enc-mode-hex').checked) {
      const r = C.parseHex(encInput.value);
      if (!r.ok) return { ok: false, message: t(`enc.err.${r.error}`, { pos: r.pos, ch: visible(r.ch) }) };
      bytes = r.bytes;
    } else {
      bytes = C.utf8(encInput.value);
    }
    if (bytes.length > C.MAX_BYTES) return { ok: false, message: t('enc.err.long', { max: C.MAX_BYTES, n: bytes.length }) };
    return { ok: true, bytes };
  }

  function renderEncode() {
    const r = readEncInput();
    const status = $('enc-status');
    status.classList.toggle('error', !r.ok);
    status.textContent = r.ok ? t('enc.bytes', { n: r.bytes.length }) : r.message;
    const pad = $('enc-pad').checked;
    for (const k of C.KINDS) {
      const text = r.ok ? C.encode(k, r.bytes, pad) : '';
      encText[k] = text;
      $(`out-${k}`).textContent = text || (r.ok ? t('enc.empty') : '');
      let meta = '';
      if (r.ok) meta = r.bytes.length ? t('enc.meta', { len: text.length, ratio: ratioText(text.length, r.bytes.length) }) : t('enc.metaEmpty');
      $(`meta-${k}`).textContent = meta;
      const copy = $(`copy-${k}`);
      copy.disabled = !text;
      copy.setAttribute('aria-label', t('enc.copyLabel', { name: NAMES[k] }));
    }
  }

  // 例のボタンは、ボタンの文字そのものを入れる（16進の例は入力の種類も切り替える）
  const HEX_SAMPLES = ['deadbeef', 'zeros'];
  for (const b of document.querySelectorAll('[data-enc-sample]')) {
    b.addEventListener('click', () => {
      const hex = HEX_SAMPLES.includes(b.dataset.encSample);
      $(hex ? 'enc-mode-hex' : 'enc-mode-text').checked = true;
      encInput.value = b.textContent;
      renderEncode();
    });
  }
  for (const id of ['enc-input', 'enc-mode-text', 'enc-mode-hex', 'enc-pad']) $(id).addEventListener('input', renderEncode);

  for (const b of document.querySelectorAll('[data-copy]')) {
    b.addEventListener('click', async () => {
      const k = b.dataset.copy;
      try {
        if (!navigator.clipboard) throw new Error('clipboard');
        await navigator.clipboard.writeText(encText[k]);
        $('copy-status').textContent = t('enc.copied', { name: NAMES[k] });
      } catch {
        $('copy-status').textContent = t('enc.copyFailed');
      }
    });
  }
  renders.push(renderEncode);

  // ===== 変換: デコード（読める方式をすべて並べる。入力欄は書き換えない） =====
  function candidate(r) {
    const card = el('article', `cand ${r.kind}`);
    const head = el('h4');
    head.append(el('span', '', NAMES[r.kind]), el('span', r.ok ? 'pill ok' : 'pill ng', t(r.ok ? 'dec.ok' : 'dec.ng')));
    card.append(head);
    if (!r.ok) {
      card.append(el('p', 'reason', reason(r)));
      return card;
    }
    const s = C.readUtf8(r.bytes);
    const dl = el('dl');
    dl.append(el('dt', '', t('dec.hex', { n: r.bytes.length })), el('dd', 'mono', C.toHex(r.bytes)));
    dl.append(el('dt', '', t('dec.text')), s === null ? el('dd', '', t('dec.notText')) : el('dd', 'mono pre', s));
    card.append(dl);
    if (r.skipped) card.append(el('p', 'extra', t('dec.skipped', { n: r.skipped })));
    if (r.loose) card.append(el('p', 'extra', t('dec.loose')));
    return card;
  }

  function renderDecode() {
    const text = $('dec-input').value;
    const status = $('dec-status');
    if (!text.trim()) {
      status.textContent = t('dec.prompt');
      $('dec-results').replaceChildren();
      return;
    }
    const results = C.decodeAll(text, { skipSpace: $('dec-skip').checked });
    const n = results.filter((r) => r.ok).length;
    status.textContent = n ? t('dec.summary', { n }) : t('dec.none');
    $('dec-results').replaceChildren(...results.map(candidate));
  }

  for (const b of document.querySelectorAll('[data-dec-sample]')) {
    b.addEventListener('click', () => {
      $('dec-input').value = b.dataset.decSample;
      renderDecode();
    });
  }
  for (const id of ['dec-input', 'dec-skip']) $(id).addEventListener('input', renderDecode);
  renders.push(renderDecode);

  // ===== 長さと効率（選んだデータを実際にエンコードして、いちばん長い方式を100%で描く） =====
  function renderLength() {
    const n = Number($('len-size').value);
    $('len-size-out').textContent = String(n);
    const kind = document.querySelector('input[name="len-data"]:checked').value;
    const data = C.sampleBytes(kind, n);
    const lens = C.lengths(data, $('len-pad').checked);
    const max = Math.max(...Object.values(lens));
    for (const k of C.KINDS) {
      $(`bar-${k}`).setAttribute('width', String((lens[k] / max) * 100));
      $(`bar-text-${k}`).textContent = t('length.bar', { len: lens[k], ratio: ratioText(lens[k], n) });
    }
    const s = C.base91Steps(data);
    const lines = [t('length.b91', { a: s.pairs13, b: s.pairs14, c: s.tail })];
    if (kind === 'zero') lines.push(t('length.b58zero'));
    $('len-detail').textContent = lines.join(I18n.lang === 'ja' ? '' : ' ');
  }

  for (const id of ['len-size', 'len-data-random', 'len-data-zero', 'len-data-ff', 'len-pad']) $(id).addEventListener('input', renderLength);
  renders.push(renderLength);

  // ===== 読み違い（Base64 の文字を取り違えて読む。ほかの方式でも同じ取り違えを試す） =====
  const PATTERNS = {
    O0: { text: '{"alg":"HS256","typ":"JWT"}', from: 'O', to: '0' },
    Il: { text: 'Sample Text', from: 'I', to: 'l' },
    I1: { text: '{"alg":"HS256","typ":"JWT"}', from: 'I', to: '1' },
    plus: { text: 'Hello>', from: '+', to: ' ' },
    slash: { text: 'Hello?World', from: '/', to: '\\' }
  };
  const mis = { pattern: 'O0' };
  const patternChips = [...document.querySelectorAll('.chip[data-pattern]')];

  // 取り違えた位置に印を付けて、文字列を要素で組み立てる（空白は ␣ で見せる）
  function marked(text, positions, cls) {
    const frag = document.createDocumentFragment();
    [...text].forEach((c, i) => {
      if (positions.has(i)) frag.append(el('span', cls, c === ' ' ? '␣' : c));
      else frag.append(c);
    });
    return frag;
  }

  // 取り違えたあとの文字列を読んだ結果を、元と同じ・別のデータ・エラーの3つに分ける
  function outcome(kind, original, changed, skip) {
    const r = C.decode(kind, changed, { skipSpace: skip });
    if (!r.ok) return { cls: 'error', text: t('misread.error'), r };
    if (C.sameBytes(r.bytes, original)) return { cls: 'ok', text: t('misread.same'), r };
    return { cls: 'warn', text: t('misread.changed'), r };
  }

  function renderMisread() {
    const p = PATTERNS[mis.pattern];
    for (const c of patternChips) c.setAttribute('aria-pressed', c.dataset.pattern === mis.pattern ? 'true' : 'false');
    $('mis-desc').textContent = t(`misread.desc.${mis.pattern}`);
    const skip = $('mis-skip').checked;
    const bytes = C.utf8(p.text);
    const before = C.encodeBase64(bytes);
    const after = before.split(p.from).join(p.to);
    const positions = new Set([...before].flatMap((c, i) => (c === p.from ? [i] : [])));
    $('mis-before').replaceChildren(marked(before, positions, 'hl-before'));
    $('mis-after').replaceChildren(marked(after, positions, 'hl-after'));
    $('mis-before-result').textContent = t('misread.decoded', { value: shown(bytes) });
    const o = outcome('base64', bytes, after, skip);
    $('mis-after-result').textContent = o.r.ok ? t('misread.decoded', { value: shown(o.r.bytes) }) : reason(o.r);
    const verdict = $('mis-verdict');
    verdict.className = `verdict ${o.cls}`;
    verdict.textContent = o.text;

    $('mis-others').replaceChildren(...['base32', 'base58', 'base91'].map((k) => {
      const s = C.encode(k, bytes);
      const th = el('th', '', NAMES[k]);
      th.scope = 'row';
      const td = el('td');
      if (!C.ALPHABETS[k].includes(p.from)) {
        td.textContent = t('misread.notInAlphabet', { ch: visible(p.from) });
      } else if (!s.includes(p.from)) {
        td.textContent = t('misread.notInString', { ch: visible(p.from) });
      } else {
        const r = outcome(k, bytes, s.split(p.from).join(p.to), skip);
        td.append(el('span', `outcome ${r.cls}`, r.text), ' ', r.r.ok ? t('misread.decoded', { value: shown(r.r.bytes) }) : reason(r.r));
      }
      const tr = el('tr');
      tr.append(th, el('td', 'mono', s), td);
      return tr;
    }));
  }

  for (const c of patternChips) {
    c.addEventListener('click', () => {
      mis.pattern = c.dataset.pattern;
      renderMisread();
    });
  }
  $('mis-skip').addEventListener('input', renderMisread);
  renders.push(renderMisread);

  // ===== basE91: 原作と同じ結果になる例 =====
  const B91_EXAMPLES = [['text', 'test'], ['text', 'hello'], ['hex', 'DE AD BE EF'], ['hex', '00 00 00 00']];

  function renderBase91() {
    $('b91-examples').replaceChildren(...B91_EXAMPLES.map(([mode, value]) => {
      const bytes = mode === 'hex' ? C.parseHex(value).bytes : C.utf8(value);
      const s = C.base91Steps(bytes);
      const tr = el('tr');
      tr.append(el('td', 'mono', mode === 'hex' ? value : `"${value}"`), el('td', 'mono', s.text),
        el('td', '', t('b91.steps', { a: s.pairs13, b: s.pairs14, c: s.tail })));
      return tr;
    }));
  }
  renders.push(renderBase91);

  // ===== 変換: TOTP の鍵（otpauth:// の URI か Base32 の鍵を読む。ワンタイムパスワードは計算しない） =====
  const sentences = (parts) => parts.filter(Boolean).join(I18n.lang === 'ja' ? '' : ' ');

  function addRow(dl, label, value, cls) {
    dl.append(el('dt', '', label), el('dd', cls, value));
  }

  function renderOtp() {
    const box = $('otp-result');
    const r = X.parseOtpauth($('otp-input').value);
    if (!r.ok) {
      const secretError = r.error && r.error.startsWith('secret.') && r.error !== 'secret.missing';
      box.replaceChildren(el('p', 'verdict error', secretError ? `secret: ${reason({ ...r, error: r.error.slice(7) })}` : t(`otp.err.${r.error}`)));
      return;
    }
    const dl = el('dl', 'otp-list');
    const withDefault = (value, isDefault) => (isDefault ? t('otp.default', { value }) : value);
    if (r.kind === 'uri') {
      addRow(dl, t('otp.type'), r.type);
      addRow(dl, t('otp.issuer'), r.issuer || r.labelIssuer || t('otp.none'));
      addRow(dl, t('otp.account'), r.account || t('otp.none'));
      addRow(dl, t('otp.algorithm'), withDefault(r.algorithm, r.algorithmDefault));
      addRow(dl, t('otp.digits'), withDefault(r.digits, r.digitsDefault));
      if (r.type === 'totp') addRow(dl, t('otp.period'), withDefault(r.period, r.periodDefault));
      else addRow(dl, t('otp.counter'), r.counter === null ? t('otp.none') : r.counter);
    } else {
      addRow(dl, t('otp.type'), t('otp.secretOnly'));
    }
    addRow(dl, t('otp.key'), C.toHex(r.key), 'mono');
    addRow(dl, t('otp.length'), t('otp.lengthValue', { bytes: r.key.length, bits: r.bits }));
    const level = r.warnings.includes('short') ? 'error' : r.warnings.length ? 'warn' : 'ok';
    const verdict = el('div', `verdict ${level}`);
    if (r.warnings.length) {
      const list = el('ul', 'bullets');
      const vars = { algorithm: r.algorithm, want: r.hmacBytes, label: r.labelIssuer, param: r.issuer };
      list.append(...r.warnings.map((w) => el('li', '', t(`otp.warn.${w}`, vars))));
      verdict.append(list);
    } else {
      verdict.textContent = t('otp.ok');
    }
    box.replaceChildren(dl, verdict);
  }

  for (const b of document.querySelectorAll('[data-otp-sample]')) {
    b.addEventListener('click', () => {
      $('otp-input').value = b.dataset.otpSample;
      renderOtp();
    });
  }
  $('otp-input').addEventListener('input', renderOtp);
  renders.push(renderOtp);

  // ===== しくみ（ビットの区切り・58での割り算・basE91 の組を1段ずつ見せる） =====
  const bits = { kind: 'base64' };
  const bitsChips = [...document.querySelectorAll('[data-bits-kind]')];
  const BITS_SPEC = { base64: [C.ALPHABETS.base64, 6, 4], base32: [C.ALPHABETS.base32, 5, 8] };

  function headRow(labels) {
    const tr = el('tr');
    for (const label of labels) {
      const th = el('th', '', label);
      th.scope = 'col';
      tr.append(th);
    }
    return tr;
  }

  // セルは文字列か要素。文字列は等幅にしない（数や記号は呼び出し側で mono を付けた要素にする）
  function bodyRow(cells) {
    const tr = el('tr');
    for (const c of cells) {
      const td = el('td');
      td.append(c);
      tr.append(td);
    }
    return tr;
  }

  const mono = (text) => el('span', 'mono', String(text));

  function renderBits() {
    for (const c of bitsChips) c.setAttribute('aria-pressed', c.dataset.bitsKind === bits.kind ? 'true' : 'false');
    const bytes = C.utf8($('bits-input').value);
    const status = $('bits-status');
    const result = $('bits-result');
    const bad = !bytes.length || bytes.length > X.EXPLAIN_MAX;
    status.classList.toggle('error', bytes.length > X.EXPLAIN_MAX);
    status.textContent = !bytes.length ? t('bits.empty') : bad ? t('bits.long', { max: X.EXPLAIN_MAX, n: bytes.length }) : '';
    result.hidden = bad;
    if (bad) {
      for (const id of ['bits-head', 'bits-body', 'bits-bytes']) $(id).replaceChildren();
      $('bits-note').textContent = '';
      return;
    }
    $('bits-bytes').replaceChildren(...[...bytes].map((b) => {
      const box = el('span', 'byte');
      box.append(el('span', 'byte-hex mono', b.toString(16).toUpperCase().padStart(2, '0')), el('span', 'byte-bin mono', b.toString(2).padStart(8, '0')));
      return box;
    }));
    const k = bits.kind;
    let head;
    let rows;
    if (BITS_SPEC[k]) {
      const [alphabet, size, block] = BITS_SPEC[k];
      const e = X.explainBits(bytes, alphabet, size, block, true);
      $('bits-note').textContent = t(`bits.note.${k}`);
      head = [t('bits.col.index'), t('bits.col.bits'), t('bits.col.value'), t('bits.col.char')];
      rows = e.groups.map((g, i) => {
        const b = mono(g.bits);
        if (g.added) b.append(el('span', 'bit-added', '0'.repeat(g.added)));
        return [String(i + 1), b, mono(g.value), mono(g.char)];
      });
      if (e.padChars) rows.push(['', '', '', mono('='.repeat(e.padChars))]);
    } else if (k === 'base58') {
      const e = X.explainBase58(bytes);
      $('bits-note').textContent = sentences([t('bits.note.base58', { number: e.number }), e.zeros ? t('bits.note.base58zero', { n: e.zeros }) : '']);
      head = [t('bits.col.n'), t('bits.col.q'), t('bits.col.r'), t('bits.col.char')];
      rows = e.steps.map((s) => [mono(s.n), mono(s.q), mono(s.r), mono(s.char)]);
    } else {
      const e = X.explainBase91(bytes);
      $('bits-note').textContent = t('bits.note.base91');
      head = [t('bits.col.index'), t('bits.col.size'), t('bits.col.bits'), t('bits.col.value'), t('bits.col.lo'), t('bits.col.hi'), t('bits.col.chars')];
      rows = e.groups.map((g, i) => [String(i + 1), mono(g.size), mono(g.bits), mono(g.value), mono(g.lo), mono(g.hi), mono(g.chars)]);
      if (e.tail) {
        const g = e.tail;
        rows.push([t('bits.tail'), mono(g.size), mono(g.bits), mono(g.value), mono(g.lo), mono(g.hi === null ? '-' : g.hi), mono(g.chars)]);
      }
    }
    $('bits-head').replaceChildren(headRow(head));
    $('bits-body').replaceChildren(...rows.map(bodyRow));
    result.textContent = t('bits.result', { text: C.encode(k, bytes) });
  }

  for (const c of bitsChips) {
    c.addEventListener('click', () => {
      bits.kind = c.dataset.bitsKind;
      renderBits();
    });
  }
  $('bits-input').addEventListener('input', renderBits);
  renders.push(renderBits);

  // ===== 変種と検査 =====
  const VAR_ROWS = [
    ['base64', 'Base64'], ['base64url', 'Base64url'], ['base32', 'Base32'], ['base32hex', 'Base32hex'],
    ['crockford', 'Crockford Base32'], ['crockfordCheck', null], ['base58', 'Base58'], ['base58check', 'Base58Check']
  ];
  const VAR_ENCODE = {
    base64: (b) => C.encodeBase64(b),
    base64url: (b) => X.encodeBase64url(b),
    base32: (b) => C.encodeBase32(b),
    base32hex: (b) => X.encodeBase32hex(b),
    crockford: (b) => X.encodeCrockford(b),
    crockfordCheck: (b) => X.encodeCrockford(b, true),
    base58: (b) => C.encodeBase58(b),
    base58check: (b) => X.encodeBase58Check(b)
  };
  const detect = { format: 'crockfordCheck', edited: false };
  const detectChips = [...document.querySelectorAll('[data-detect-format]')];

  function readVarInput() {
    const bytes = C.utf8($('var-input').value);
    if (!bytes.length) return { ok: false, message: t('var.empty') };
    if (bytes.length > X.DETECT_MAX) return { ok: false, message: t('var.long', { max: X.DETECT_MAX, n: bytes.length }) };
    return { ok: true, bytes };
  }

  const percent = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0);

  function renderVariants() {
    const r = readVarInput();
    const status = $('var-status');
    status.classList.toggle('error', !r.ok && !!$('var-input').value);
    status.textContent = r.ok ? '' : r.message;
    if (!r.ok) {
      $('var-body').replaceChildren();
      $('detect-body').replaceChildren();
    } else {
      $('var-body').replaceChildren(...VAR_ROWS.map(([key, name]) => {
        const th = el('th', '', name || t(`detect.f.${key}`));
        th.scope = 'row';
        const tr = el('tr');
        tr.append(th, el('td', 'mono', VAR_ENCODE[key](r.bytes)), el('td', '', t(`var.diff.${key}`)));
        return tr;
      }));
      $('detect-body').replaceChildren(...X.FORMAT_NAMES.map((f) => {
        const s = X.encodeFormat(f, r.bytes);
        const d = X.detection(f, s);
        const th = el('th', '', t(`detect.f.${f}`));
        th.scope = 'row';
        const count = (c) => t('detect.count', { total: c.total, detected: c.detected, pct: percent(c.detected, c.total) });
        const tr = el('tr');
        tr.append(th, el('td', 'mono', s), el('td', '', count(d.subs)), el('td', '', count(d.swaps)));
        return tr;
      }));
    }
    renderDetectTry();
  }

  // 書き換えた文字列を、選んだ形式で読む。書き換える前（edited が false）なら、元の文字列を入れ直す
  function renderDetectTry() {
    for (const c of detectChips) c.setAttribute('aria-pressed', c.dataset.detectFormat === detect.format ? 'true' : 'false');
    const r = readVarInput();
    const input = $('detect-input');
    const out = $('detect-result');
    if (!r.ok) {
      input.value = '';
      out.className = 'verdict';
      out.textContent = '';
      return;
    }
    if (!detect.edited) input.value = X.encodeFormat(detect.format, r.bytes);
    const d = X.decodeFormat(detect.format, input.value);
    if (!d.ok) {
      out.className = 'verdict error';
      out.textContent = t('detect.tryError', { reason: reason(d) });
    } else if (C.sameBytes(d.bytes, r.bytes)) {
      out.className = 'verdict ok';
      out.textContent = t('detect.trySame');
    } else {
      out.className = 'verdict warn';
      out.textContent = t('detect.tryOk', { value: shown(d.bytes) });
    }
  }

  $('var-input').addEventListener('input', () => {
    detect.edited = false;
    renderVariants();
  });
  for (const c of detectChips) {
    c.addEventListener('click', () => {
      detect.format = c.dataset.detectFormat;
      detect.edited = false;
      renderDetectTry();
    });
  }
  $('detect-input').addEventListener('input', () => {
    detect.edited = true;
    renderDetectTry();
  });
  renders.push(renderVariants);

  // Crockford の読み替え: 読み替えた文字に印を付けて、読み替えたあとの文字列を組み立てる
  function renderCrock() {
    const text = $('crock-input').value;
    const check = $('crock-check').checked;
    const r = X.decodeCrockford(text, { check });
    const out = $('crock-normalized');
    const res = $('crock-result');
    const frag = document.createDocumentFragment();
    const replaced = new Set((r.replaced || []).map((x) => x.pos));
    [...text].forEach((ch, i) => {
      if (ch === '-' || /^[ \t\r\n]$/.test(ch)) return;
      const up = ch.toUpperCase();
      if (replaced.has(i + 1)) frag.append(el('span', 'hl-before', up === 'O' ? '0' : '1'));
      else frag.append(up);
    });
    out.replaceChildren(frag);
    if (!r.ok) {
      res.className = 'verdict error';
      res.textContent = reason(r);
      return;
    }
    res.className = 'verdict ok';
    res.textContent = sentences([t('crock.replaced', { n: r.replaced.length, h: r.hyphens }), check ? t('crock.checkOk') : '',
      t('misread.decoded', { value: shown(r.bytes) })]);
  }

  for (const id of ['crock-input', 'crock-check']) $(id).addEventListener('input', renderCrock);
  renders.push(renderCrock);

  // ===== テーマ・言語・初期表示 =====
  const themeBtn = $('btn-theme');
  themeBtn.addEventListener('click', () => Theme.toggle(themeBtn));

  function applyLanguage() {
    I18n.applyStaticText();
    Theme.refresh(themeBtn);
    for (const render of renders) render();
  }

  // 切り替えたら、URL に ?lang= があればそれも書き換える（再読み込みで元の言語に戻らないように）
  $('btn-lang').addEventListener('click', () => {
    I18n.set(I18n.lang === 'ja' ? 'en' : 'ja');
    const url = new URL(location.href);
    if (url.searchParams.has('lang')) {
      url.searchParams.set('lang', I18n.lang);
      history.replaceState(null, '', url);
    }
    applyLanguage();
  });

  I18n.init();
  applyLanguage();
})();
