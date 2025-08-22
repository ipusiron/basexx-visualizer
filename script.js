/* BaseXX Visualizer - 初期版スクリプト
 * 目的：タブ切替、UIひな形、ダミーの計算/表示
 * NOTE: エンコード/デコード実装は後続コミットで追加
 */

// --- エンコード実装 ---
// Base64 は標準 API で実装
function encodeBase64(bytes, withPadding = true) {
  let bin = String.fromCharCode(...bytes);
  let b64 = btoa(bin);
  if (!withPadding) {
    b64 = b64.replace(/=+$/, '');
  }
  return b64;
}
function decodeBase64(str) {
  try {
    let bin = atob(str);
    return new Uint8Array([...bin].map(c => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

// Base32 (RFC4648)
const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function encodeBase32(bytes, withPadding = true) {
  let bits = 0, value = 0, output = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += base32Alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += base32Alphabet[(value << (5 - bits)) & 31];
  }
  if (withPadding) {
    while (output.length % 8 !== 0) output += '=';
  }
  return output;
}
function decodeBase32(str) {
  str = str.replace(/=+$/, '').toUpperCase();
  let bits = 0, value = 0, output = [];
  for (let c of str) {
    let idx = base32Alphabet.indexOf(c);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xFF);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

// Base58 (Bitcoin)
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encodeBase58(bytes) {
  let intVal = BigInt('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join(''));
  if (intVal === 0n) return "1";
  let result = '';
  while (intVal > 0) {
    let div = intVal / 58n;
    let rem = Number(intVal % 58n);
    result = base58Alphabet[rem] + result;
    intVal = div;
  }
  // leading zeros
  for (let b of bytes) {
    if (b === 0) result = '1' + result;
    else break;
  }
  return result;
}
function decodeBase58(str) {
  let intVal = 0n;
  for (let c of str) {
    let idx = base58Alphabet.indexOf(c);
    if (idx === -1) return null;
    intVal = intVal * 58n + BigInt(idx);
  }
  let hex = intVal.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  let bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i*2, i*2+2), 16);
  }
  // leading zeros
  let leadingZeros = 0;
  for (let c of str) {
    if (c === '1') leadingZeros++;
    else break;
  }
  if (leadingZeros > 0) {
    bytes = new Uint8Array([...Array(leadingZeros).fill(0), ...bytes]);
  }
  return bytes;
}

// Base91 (Joe's original impl, simplified)
const base91Alphabet = (() => {
  let chars = [];
  for (let i = 33; i <= 126; i++) chars.push(String.fromCharCode(i));
  return chars.join('');
})();
const base91Table = Object.fromEntries([...base91Alphabet].map((c,i)=>[c,i]));
function encodeBase91(bytes) {
  let b = 0, n = 0, out = '';
  for (let i=0;i<bytes.length;i++){
    b |= bytes[i] << n;
    n += 8;
    if(n>13){
      let v = b & 8191;
      if(v>88){
        b >>= 13; n -= 13;
      }else{
        v = b & 16383;
        b >>= 14; n -= 14;
      }
      out += base91Alphabet[v % 91] + base91Alphabet[Math.floor(v/91)];
    }
  }
  if(n){
    out += base91Alphabet[b % 91];
    if(n>7 || b>90) out += base91Alphabet[Math.floor(b/91)];
  }
  return out;
}
function decodeBase91(str) {
  let v=-1, b=0, n=0, out=[];
  for (let c of str){
    if(!(c in base91Table)) return null;
    if(v<0) v=base91Table[c];
    else{
      v+=base91Table[c]*91;
      b |= v << n;
      n += (v&8191)>88 ? 13:14;
      do{
        out.push(b & 255);
        b >>= 8;
        n -= 8;
      }while(n>7);
      v=-1;
    }
  }
  if(v+1){
    out.push((b | v<<n)&255);
  }
  return new Uint8Array(out);
}

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

  // コピー（セキュリティ強化）
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.copyTarget;
      const node = document.getElementById(id);
      if (!node) return;
      
      // コピーするテキストのサニタイズ
      const textToCopy = node.textContent.trim();
      if (textToCopy.length === 0) {
        return;
      }
      
      // コピーサイズ制限
      if (textToCopy.length > 100000) {
        alert('コピーするデータが大きすぎます');
        return;
      }
      
      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = btn.textContent;
        btn.textContent = 'コピー済';
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 900);
      } catch (err) {
        console.error('Copy failed:', err);
        alert('コピーに失敗しました');
      }
    });
  });

  // HEXバリデーション（セキュリティ強化）
  const parseHex = (hexStr) => {
    // 入力長制限
    if (hexStr.length > 10000) {
      console.warn('Input too long');
      return null;
    }
    
    // ホワイトスペースと区切り文字を許可しつつ、不正文字を除去
    const clean = hexStr.replace(/[^0-9a-fA-F]/g, '');
    if (clean.length === 0 || clean.length % 2 !== 0) return null;
    
    // バイト数制限
    if (clean.length / 2 > 5000) {
      console.warn('Output size too large');
      return null;
    }
    
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i/2] = parseInt(clean.slice(i, i+2), 16);
    }
    return bytes;
  };

  // ダミー実装は削除（実際のエンコード関数を使用）

  const getInputBytes = () => {
    inputError.hidden = true;
    
    // 入力長制限
    if (inputArea.value.length > 10000) {
      inputError.hidden = false;
      inputError.textContent = '入力が長すぎます（10000文字以内）';
      return null;
    }
    
    if (modeHex.checked) {
      const bytes = parseHex(inputArea.value);
      if (!bytes) {
        inputError.hidden = false;
        inputError.textContent = 'HEX入力が無効です（偶数桁の16進で入力してください）';
        return null;
      }
      return bytes;
    } else {
      const encoded = new TextEncoder().encode(inputArea.value);
      // エンコード後のサイズ制限
      if (encoded.length > 5000) {
        inputError.hidden = false;
        inputError.textContent = '入力データが大きすぎます';
        return null;
      }
      return encoded;
    }
  };


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

  // --- Errors demo: pattern-based comparison ---
  const patternData = {
    'O0': {
      title: 'O ↔ 0 の混同パターン',
      description: 'Base64文字列に含まれるオー（O）が、手入力時にゼロ（0）と誤読される例です。',
      original: 'OGVsbG8gV29ybGQ=', // "8ello World" contains 'O'
      apply: (str) => str.replaceAll('O', '0')
    },
    'Il': {
      title: 'I ↔ l の混同パターン',
      description: 'Base64文字列に含まれるアイ大文字（I）が、手入力時にエル小文字（l）と誤読される例です。',
      original: 'U2FtcGxlIFRleHQ=', // "Sample Text" contains 'I'
      apply: (str) => str.replaceAll('I', 'l')
    },
    'I1': {
      title: 'I ↔ 1 の混同パターン',
      description: 'JWTトークンなどでよく見られる、Base64文字列に含まれるアイ大文字（I）が手入力時にイチ（1）と誤読される例です。',
      original: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // JWT header: {"alg":"HS256","typ":"JWT"}
      apply: (str) => str.replaceAll('I', '1')
    },
    'plus': {
      title: '+ ↔ スペース の混同パターン',
      description: 'Base64文字列に含まれるプラス（+）が、手入力時にスペースと誤読される例です。',
      original: 'aGVsbG8+d29ybGQ+dGVzdA==', // "hello>world>test" contains '+' 
      apply: (str) => str.replaceAll('+', ' ')
    },
    'slash': {
      title: '/ ↔ \\ の混同パターン',
      description: 'Base64文字列に含まれるスラッシュ（/）が、手入力時にバックスラッシュと誤読される例です。',
      original: 'SGVsbG8/V29ybGQ=', // "Hello?World" contains '/'
      apply: (str) => str.replaceAll('/', '\\\\')
    }
  };

  const patternButtons = document.querySelectorAll('.pattern-btn');
  const demoResults = document.getElementById('demoResults');
  
  // 文字をハイライト表示する関数
  const highlightCharacters = (text, targetChar, replacementChar, isOriginal = true) => {
    const className = isOriginal ? 'char-original' : 'char-corrupted';
    const charToHighlight = isOriginal ? targetChar : replacementChar;
    
    return text.split('').map(char => {
      if (char === charToHighlight) {
        // スペースの場合は視覚化
        const displayChar = char === ' ' ? '␣' : char;
        return `<span class="char-highlight ${className}">${displayChar}</span>`;
      }
      return char;
    }).join('');
  };
  
  // パターンごとの文字マッピング
  const charMappings = {
    'O0': { original: 'O', replacement: '0' },
    'Il': { original: 'I', replacement: 'l' },
    'I1': { original: 'I', replacement: '1' },
    'plus': { original: '+', replacement: ' ' },
    'slash': { original: '/', replacement: '\\' }
  };
  
  patternButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const pattern = btn.getAttribute('data-pattern');
      const data = patternData[pattern];
      const mapping = charMappings[pattern];
      
      if (!data || !mapping) return;
      
      // ボタンのアクティブ状態更新
      patternButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // 結果エリアを表示
      demoResults.style.display = 'block';
      
      // パターン情報更新
      document.getElementById('currentPattern').textContent = data.title;
      document.getElementById('patternDescription').textContent = data.description;
      
      // レジェンドを更新
      const legend = document.querySelector('.highlight-legend');
      const originalChar = mapping.original === ' ' ? '␣' : mapping.original;
      const replacementChar = mapping.replacement === ' ' ? '␣' : mapping.replacement;
      legend.innerHTML = `
        <div class="legend-item">
          <span class="char-highlight char-original">${originalChar}</span> 元の文字（正しい）
        </div>
        <div class="legend-item">
          <span class="char-highlight char-corrupted">${replacementChar}</span> 誤読された文字（問題）
        </div>
      `;
      
      // 元のBase64の表示とデコード（ハイライト付き）
      const originalHighlighted = highlightCharacters(data.original, mapping.original, mapping.replacement, true);
      document.getElementById('originalB64').innerHTML = originalHighlighted;
      
      try {
        const originalDecoded = decodeBase64(data.original);
        document.getElementById('originalDecoded').textContent = originalDecoded ? 
          new TextDecoder().decode(originalDecoded) : 'デコードエラー';
      } catch {
        document.getElementById('originalDecoded').textContent = 'デコードエラー';
      }
      
      // 誤読を適用
      const corruptedB64 = data.apply(data.original);
      
      // 誤読後のBase64の表示とデコード（ハイライト付き）
      const corruptedHighlighted = highlightCharacters(corruptedB64, mapping.original, mapping.replacement, false);
      document.getElementById('corruptedB64').innerHTML = corruptedHighlighted;
      
      try {
        const corruptedDecoded = decodeBase64(corruptedB64);
        if (corruptedDecoded) {
          const decodedText = new TextDecoder().decode(corruptedDecoded);
          document.getElementById('corruptedDecoded').textContent = decodedText;
          document.getElementById('corruptedDecoded').className = 'result-text decoded';
        } else {
          document.getElementById('corruptedDecoded').textContent = 'デコードエラー';
          document.getElementById('corruptedDecoded').className = 'result-text decoded error-text';
        }
      } catch {
        document.getElementById('corruptedDecoded').textContent = 'デコードエラー';
        document.getElementById('corruptedDecoded').className = 'result-text decoded error-text';
      }
    });
  });

  // --- UIボタンに組み込み ---
  btnEncode.addEventListener('click', () => {
    const bytes = getInputBytes();
    if (!bytes) return;

    const withPadding = togglePadding.checked;

    const out64 = encodeBase64(bytes, withPadding);
    const out32 = encodeBase32(bytes, withPadding);
    const out58 = encodeBase58(bytes);
    const out91 = encodeBase91(bytes);

    const outputs = { '64': out64, '32': out32, '58': out58, '91': out91 };
    Object.entries(outputs).forEach(([k, text]) => {
      out[k].text.textContent = text;
      out[k].len.textContent = `長さ: ${text.length}`;
      out[k].rate.textContent = `膨張率: ${Math.round(text.length/bytes.length*100)}%`;
    });
  });

  btnDecode.addEventListener('click', () => {
    const str = inputArea.value.trim();
    if (!str) return;
    let dec = null;
    if (/^[A-Za-z0-9+/=]+$/.test(str)) dec = decodeBase64(str);
    if (!dec && /^[A-Z2-7]+=*$/.test(str)) dec = decodeBase32(str);
    if (!dec && /^[1-9A-HJ-NP-Za-km-z]+$/.test(str)) dec = decodeBase58(str);
    if (!dec) dec = decodeBase91(str);

    if (!dec) {
      inputError.hidden = false;
      inputError.textContent = 'デコード失敗しました';
      return;
    }
    inputArea.value = new TextDecoder().decode(dec);
  });
});
