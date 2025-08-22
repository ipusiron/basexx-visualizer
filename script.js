/* BaseXX Visualizer - 初期版スクリプト
 * 目的：タブ切替、UIひな形、ダミーの計算/表示
 * NOTE: エンコード/デコード実装は後続コミットで追加
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Tabs ---
  const tabButtons = document.querySelectorAll('.tab-button');
  const panels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const to = btn.dataset.tab;
      tabButtons.forEach(b => b.classList.toggle('active', b === btn));
      panels.forEach(p => p.classList.toggle('active', p.id === `panel-${to}`));
    });
  });

  // --- Overview: alphabets ---
  const alphabets = {
    base64: 'A–Z a–z 0–9 + / （URL-safe では - _）',
    base32: 'A–Z 2–7（計32文字、可読性重視・大文字のみ）',
    base58: 'Base64 から 0 O I l + / を除いた58文字（誤読低減）',
    base91: '印字可能ASCIIの広範囲（91文字、特殊記号多め）'
  };
  const alphabetBox = document.getElementById('alphabetBox');
  const chipButtons = document.querySelectorAll('.chip-select');
  const setAlphabet = key => {
    alphabetBox.textContent = alphabets[key] || '';
    chipButtons.forEach(c => c.classList.toggle('active', c.dataset.alphabet === key));
  };
  chipButtons.forEach(c => c.addEventListener('click', () => setAlphabet(c.dataset.alphabet)));
  setAlphabet('base64');

  // --- Playground ---
  const inputArea = document.getElementById('inputArea');
  const inputError = document.getElementById('inputError');
  const modeHex = document.getElementById('modeHex');
  const togglePadding = document.getElementById('togglePadding');

  const btnDemoHello = document.getElementById('btnDemoHello');
  const btnDemoJP = document.getElementById('btnDemoJP');
  const btnDemoHex = document.getElementById('btnDemoHex');
  const btnEncode = document.getElementById('btnEncode');
  const btnDecode = document.getElementById('btnDecode');

  const out = {
    '64': { text: document.getElementById('out64'), len: document.getElementById('len64'), rate: document.getElementById('rate64') },
    '32': { text: document.getElementById('out32'), len: document.getElementById('len32'), rate: document.getElementById('rate32') },
    '58': { text: document.getElementById('out58'), len: document.getElementById('len58'), rate: document.getElementById('rate58') },
    '91': { text: document.getElementById('out91'), len: document.getElementById('len91'), rate: document.getElementById('rate91') }
  };

  // デモセット
  btnDemoHello.addEventListener('click', () => {
    modeHex.checked = false;
    inputArea.value = 'hello';
    inputArea.focus();
  });
  btnDemoJP.addEventListener('click', () => {
    modeHex.checked = false;
    inputArea.value = 'こんにちは';
    inputArea.focus();
  });
  btnDemoHex.addEventListener('click', () => {
    modeHex.checked = true;
    inputArea.value = 'DE AD BE EF';
    inputArea.focus();
  });

  // コピー
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.copyTarget;
      const node = document.getElementById(id);
      if (!node) return;
      try {
        await navigator.clipboard.writeText(node.textContent);
        btn.textContent = 'コピー済';
        setTimeout(() => (btn.textContent = 'コピー'), 900);
      } catch {
        alert('コピーに失敗しました');
      }
    });
  });

  // HEXバリデーション
  const parseHex = (hexStr) => {
    const clean = hexStr.replace(/[^0-9a-fA-F]/g, '');
    if (clean.length === 0 || clean.length % 2 !== 0) return null;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i/2] = parseInt(clean.slice(i, i+2), 16);
    }
    return bytes;
  };

  // ダミーencode/decode（UI動作確認用）
  const dummyEncodeAll = (dataBytes) => {
    // まだ実装しないので、長さだけ反映して出力は占位文字列
    const baseLen = dataBytes.length;
    const make = (label, factor) => ({
      text: `${label}_ENCODED(${baseLen}B)…`, // 占位
      len: Math.round(baseLen * factor),
      rate: `${Math.round(factor * 100)}%`
    });

    // 簡易な理論上の膨張率（ざっくり）
    // Base64 ≈ 4/3, Base32 ≈ 8/5 = 1.6, Base58 ≈ 4/3 相当、Base91 ≈ 1.23 目安
    return {
      '64': make('BASE64', 4/3),
      '32': make('BASE32', 8/5),
      '58': make('BASE58', 4/3),
      '91': make('BASE91', 1.23)
    };
  };

  const setOutputs = (resultMap) => {
    ['64','32','58','91'].forEach(k => {
      out[k].text.textContent = resultMap[k].text;
      out[k].len.textContent = `長さ: ${resultMap[k].len}`;
      out[k].rate.textContent = `膨張率: ${resultMap[k].rate}`;
    });
  };

  const getInputBytes = () => {
    inputError.hidden = true;
    if (modeHex.checked) {
      const bytes = parseHex(inputArea.value);
      if (!bytes) {
        inputError.hidden = false;
        inputError.textContent = 'HEX入力が無効です（偶数桁の16進で入力してください）';
        return null;
      }
      return bytes;
    } else {
      return new TextEncoder().encode(inputArea.value);
    }
  };

  btnEncode.addEventListener('click', () => {
    const bytes = getInputBytes();
    if (!bytes) return;
    const res = dummyEncodeAll(bytes);
    // パディングトグルは現状ダミーに反映しない（実装時に使用）
    setOutputs(res);
  });

  btnDecode.addEventListener('click', () => {
    // 初期版は未実装。UIのみ保持。
    alert('デコードは後続コミットで実装予定です。');
  });

  // --- Efficiency: relative bars (Base64=100%) ---
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeValue = document.getElementById('sizeValue');

  const barMap = {
    '64': { el: document.getElementById('bar64'), text: document.getElementById('bar64Text') },
    '32': { el: document.getElementById('bar32'), text: document.getElementById('bar32Text') },
    '58': { el: document.getElementById('bar58'), text: document.getElementById('bar58Text') },
    '91': { el: document.getElementById('bar91'), text: document.getElementById('bar91Text') }
  };

  const estimateEncodedLen = (rawLen) => {
    // 端数やパディングは無視した簡易推定（初期版）
    const base64 = Math.ceil(rawLen * 4 / 3);
    const base32 = Math.ceil(rawLen * 8 / 5);
    const base58 = Math.ceil(rawLen * 4 / 3); // 近似
    const base91 = Math.ceil(rawLen * 1.23);  // 近似
    return { base64, base32, base58, base91 };
    // TODO: 後続で端数/パディングを考慮して厳密化
  };

  const renderBars = () => {
    const raw = Number(sizeSlider.value);
    sizeValue.textContent = raw;

    const { base64, base32, base58, base91 } = estimateEncodedLen(raw);
    const toPercent = (v) => Math.max(2, Math.min(100, Math.round(v / base64 * 100)));

    const set = (k, len) => {
      barMap[k].el.style.width = toPercent(len) + '%';
      barMap[k].text.textContent = `${len} chars  /  ${Math.round(len/raw*100)}%`;
    };

    set('64', base64);
    set('32', base32);
    set('58', base58);
    set('91', base91);
  };

  sizeSlider.addEventListener('input', renderBars);
  renderBars();

  // --- Errors demo: apply swaps (UI only) ---
  const errSource = document.getElementById('errSource');
  const errResult = document.getElementById('errResult');
  const btnApplyErrors = document.getElementById('btnApplyErrors');
  btnApplyErrors.addEventListener('click', () => {
    let s = errSource.value;
    document.querySelectorAll('input[type="checkbox"][data-swap]').forEach(cb => {
      if (!cb.checked) return;
      const key = cb.getAttribute('data-swap');
      // 簡易トグル：前者→後者への置換（双方向ではなく片方向デモ）
      if (key === 'O0') s = s.replaceAll('O', '0');
      if (key === 'Il') s = s.replaceAll('I', 'l');
      if (key === 'I1') s = s.replaceAll('I', '1');
      if (key === '+ ') s = s.replaceAll('+', ' ');
    });
    errResult.textContent = s;
  });
});
