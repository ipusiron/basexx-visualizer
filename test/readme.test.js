import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { read, core } from './load.js';

const C = core();
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const DOCS = {
  ja: {
    file: 'README.md', switcher: '[English](README.en.md) · 日本語', day: '**Day052 - 生成AIで作るセキュリティツール100**',
    shots: /^assets\/screenshot\d*\.png$/,
    sec: { tech: '🔬 技術的な説明', limits: '⚠️ 注意と限界', refs: '🔗 参考', tree: '📁 ディレクトリー構造', about: '🛠️ このツールについて', uses: '🎯 ユースケース' },
    head: { encode: '| 入力 | Base64 |', length: '| 元のバイト数 |', misread: '| 取り違え |' },
    hexTag: '（16進）',
    names: { 'JWTのヘッダー': '{"alg":"HS256","typ":"JWT"}', 'Sample Text': 'Sample Text', 'Hello>': 'Hello>', 'Hello?World': 'Hello?World' },
    space: '空白',
    verdict: {
      changed: () => 'エラーにならず、別のデータになる',
      error: (p) => `${p}文字目でエラー`,
      skipOnly: (x, p) => `空白を読み飛ばすとエラーにならず「${x}」になる。読み飛ばさなければ${p}文字目でエラー`
    },
    zero: (b58, b91) => `Base58は${b58}文字（すべて「1」）、basE91は${b91}文字`,
    limits: (bytes, chars) => `入力は${bytes}バイトまで、デコードは${chars}文字まで`,
    ratio: (r) => `約${r}倍`,
    forbidden: /おまけ|雑学|完全実装|自動判定|ブラウザ(?!ー)|Base91/
  },
  en: {
    file: 'README.en.md', switcher: 'English · [日本語](README.md)', day: '**Day052 - 100 Security Tools with Generative AI**',
    shots: /^assets\/en\/screenshot\d*\.png$/,
    sec: { tech: '🔬 Technical notes', limits: '⚠️ Notes and limitations', refs: '🔗 References', tree: '📁 Directory structure', about: '🛠️ About this tool',
      uses: '🎯 Use cases' },
    head: { encode: '| Input | Base64 |', length: '| Original bytes |', misread: '| Mix-up |' },
    hexTag: ' (hex)',
    names: { 'A JWT header': '{"alg":"HS256","typ":"JWT"}', 'Sample Text': 'Sample Text', 'Hello>': 'Hello>', 'Hello?World': 'Hello?World' },
    space: 'space',
    verdict: {
      changed: () => 'Different data without an error',
      error: (p) => `Error at character ${p}`,
      skipOnly: (x, p) => `When spaces are skipped, "${x}" without an error; otherwise an error at character ${p}`
    },
    zero: (b58, b91) => `Base58 gives ${b58} characters (all "1") and basE91 gives ${b91} characters`,
    limits: (bytes, chars) => `Input is limited to ${bytes} bytes, and decoding to ${chars} characters`,
    ratio: (r) => `about ${r} times`,
    forbidden: /[Bb]onus|[Tt]rivia|[Aa]uto-detect|[Ff]ully implemented|Base91/
  }
};
for (const d of Object.values(DOCS)) d.text = read(d.file);

function section(text, heading) {
  const i = text.indexOf(`\n## ${heading}`);
  assert.ok(i >= 0, heading);
  const rest = text.slice(i + 1);
  const end = rest.indexOf('\n## ', 3);
  return end < 0 ? rest : rest.slice(0, end);
}

// 表の行をセルに分ける（コードの中の \| はセルの区切りではない）
function table(text, firstHeader) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(firstHeader));
  assert.ok(start >= 0, firstHeader);
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    rows.push(lines[i].replace(/^\| | \|$/g, '').split(/ (?<!\\)\| /).map((c) => c.trim().replace(/\\\|/g, '|')));
  }
  return rows;
}

const code = (cell) => {
  const m = cell.match(/^`([^`]*)`$/);
  assert.ok(m, cell);
  return m[1];
};
const noCode = (md) => md.replace(/```[\s\S]*?```/g, '');
const h2 = (md) => noCode(md).split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3));
const headings = (md) => noCode(md).split('\n').filter((l) => /^#{1,4} /.test(l));

// 画面の読み違いのデモと同じ取り違え（script.js の PATTERNS と同じ）
const BS = String.fromCharCode(92);
const MIX = { 'O→0': ['O', '0'], 'I→l': ['I', 'l'], 'I→1': ['I', '1'], '+→': ['+', ' '], '/→\\': ['/', BS] };

test('YAML メタデータの構造（キーの順、ブロック形式のリスト、固定の値）。YAML は README.md だけに置く', () => {
  const m = DOCS.ja.text.match(/^<!--\n---\n([\s\S]*?)\n---\n-->\n/);
  assert.ok(m, 'YAML block');
  const keys = [...m[1].matchAll(/^([a-z_]+):/gm)].map((x) => x[1]);
  assert.deepEqual(keys, ['id', 'slug', 'title', 'subtitle_ja', 'subtitle_en', 'description_ja', 'description_en', 'category_ja', 'category_en',
    'difficulty', 'tags', 'repo_url', 'demo_url', 'hub']);
  for (const k of ['category_ja', 'category_en', 'tags']) assert.match(m[1], new RegExp(`^${k}:\\n  - `, 'm'), k);
  assert.match(m[1], /^id: day052$/m);
  assert.match(m[1], /^slug: basexx-visualizer$/m);
  assert.match(m[1], /^repo_url: "https:\/\/github.com\/ipusiron\/basexx-visualizer"$/m);
  assert.match(m[1], /^demo_url: "https:\/\/ipusiron.github.io\/basexx-visualizer\/"$/m);
  assert.match(m[1], /^hub: true$/m);
  assert.doesNotMatch(DOCS.en.text, /^<!--/);
});

test('日英の README は同じ見出しを同じ順に持つ（階層と絵文字がそろう）', () => {
  const ja = headings(DOCS.ja.text);
  const en = headings(DOCS.en.text);
  assert.equal(en.length, ja.length);
  assert.ok(ja.length >= 25, String(ja.length));
  ja.forEach((h, i) => {
    assert.equal(en[i].match(/^#+/)[0], h.match(/^#+/)[0], `${h} / ${en[i]}`);
    const first = [...h.replace(/^#+ /, '')][0];
    if (/\p{Extended_Pictographic}/u.test(first)) assert.equal([...en[i].replace(/^#+ /, '')][0], first, `${h} / ${en[i]}`);
  });
});

for (const [lang, d] of Object.entries(DOCS)) {
  test(`${d.file}: シリーズ標準の構成（前半と後半の見出しの順、Day の表記、言語の切り替え、プロジェクトのリンク）と、古い記述がないこと`, () => {
    const heads = h2(d.text);
    assert.ok(d.text.includes(d.switcher));
    assert.match(d.text, /\n# BaseXX Visualizer - .+\n/);
    assert.ok(d.text.includes(d.day));
    assert.ok(heads[0].startsWith('🌐'));
    assert.ok(heads[1].startsWith('📸'));
    assert.deepEqual(heads.slice(-4).map((h) => [...h][0]), ['📁', '💻', '📄', '🛠']);
    for (const icon of ['✨', '📖', '🎯', '🔒', '⚠', '🧪', '🔬', '🔗']) assert.ok(heads.some((h) => h.startsWith(icon)), icon);
    assert.match(section(d.text, d.sec.about), /https:\/\/akademeia\.info\/\?page_id=42163/);
    for (const b of ['stars', 'forks', 'last-commit', 'license']) assert.ok(d.text.includes(`img.shields.io/github/${b}/ipusiron/basexx-visualizer`), b);
    assert.doesNotMatch(d.text.replace(/<!--[\s\S]*?-->/, ''), d.forbidden);
  });

  test(`${d.file}: 強調は1節に2か所まで、箇条書きの項目名を太字にしない、文末にコロンを置かない`, () => {
    for (const h of h2(d.text)) {
      const n = (section(d.text, h).match(/\*\*[^*\n]+\*\*/g) || []).length;
      assert.ok(n <= 2, `${h}: ${n}`);
    }
    assert.doesNotMatch(d.text, /^\s*- \*\*/m);
    if (lang === 'ja') assert.doesNotMatch(noCode(d.text).replace(/<!--[\s\S]*?-->/, ''), /[：:]$/m);
  });

  test(`${d.file}: エンコードの例の表は、計算部でエンコードし直した値と同じ`, () => {
    const rows = table(section(d.text, d.sec.tech), d.head.encode);
    assert.equal(rows.length, 4);
    for (const [input, ...cells] of rows) {
      const bytes = input.endsWith(d.hexTag) ? C.parseHex(input.slice(0, -d.hexTag.length)).bytes : C.utf8(input);
      assert.deepEqual(cells.map(code), C.KINDS.map((k) => C.encode(k, bytes)), input);
    }
  });

  test(`${d.file}: 長さの表と、すべて00のときの文字数は、実際にエンコードした長さと同じ`, () => {
    const rows = table(section(d.text, d.sec.tech), d.head.length);
    assert.deepEqual(rows.map((r) => r[0]), ['16', '32', '64', '256']);
    for (const [n, ...cells] of rows) {
      const lens = C.lengths(C.sampleBytes('random', Number(n)));
      assert.deepEqual(cells.map(Number), C.KINDS.map((k) => lens[k]), n);
    }
    const zero = C.lengths(C.sampleBytes('zero', 256));
    assert.ok(d.text.includes(d.zero(zero.base58, zero.base91)));
    assert.ok(section(d.text, d.sec.uses).includes(d.ratio((4 / 3).toFixed(2))));
  });

  test(`${d.file}: 読み違いの表は、計算部で取り違えを起こして読み直した結果と同じ`, () => {
    const rows = table(section(d.text, d.sec.tech), d.head.misread);
    assert.equal(rows.length, 5);
    for (const [mix, name, result] of rows) {
      const key = Object.keys(MIX).find((k) => mix.startsWith(k));
      assert.ok(key, mix);
      const [from, to] = MIX[key];
      if (to === ' ') assert.equal(mix, `+→${d.space}`);
      const text = d.names[name];
      assert.ok(text, name);
      assert.ok(read('script.js').includes(`text: '${text}', from: '${from === BS ? BS + BS : from}'`), name);
      const bytes = C.utf8(text);
      const changed = C.encodeBase64(bytes).split(from).join(to);
      const [skip, strict] = [true, false].map((s) => C.decodeBase64(changed, { skipSpace: s }));
      let expected;
      if (skip.ok && strict.ok) {
        assert.ok(!C.sameBytes(skip.bytes, bytes) && C.sameBytes(skip.bytes, strict.bytes), mix);
        expected = d.verdict.changed();
      } else if (!skip.ok && !strict.ok) {
        assert.equal(skip.pos, strict.pos);
        expected = d.verdict.error(skip.pos);
      } else {
        assert.ok(skip.ok && !strict.ok, mix);
        expected = d.verdict.skipOnly(C.readUtf8(skip.bytes), strict.pos);
      }
      assert.equal(result, expected, mix);
    }
  });

  test(`${d.file}: 注意と限界に書いた上限は、計算部の上限と同じ`, () => {
    assert.ok(section(d.text, d.sec.limits).includes(d.limits(C.MAX_BYTES, C.MAX_CHARS)));
  });

  test(`${d.file}: ディレクトリー構造にすべてのファイルとディレクトリーが載り、全行に説明がある`, () => {
    const block = section(d.text, d.sec.tree).match(/```\n([\s\S]*?)```/)[1];
    const lines = block.split('\n').filter((l) => l.trim()).slice(1);
    const listed = new Set();
    for (const line of lines) {
      const m = line.match(/[├└]── ([^\s#]+)\s+# \S/);
      assert.ok(m, `説明のない行: ${line}`);
      listed.add(m[1].replace(/\/$/, ''));
    }
    const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
      .filter((x) => !['.git', 'node_modules', '.claude'].includes(x.name))
      .flatMap((x) => (x.isDirectory() ? [x.name, ...walk(path.join(dir, x.name))] : [x.name]));
    const all = walk('.');
    for (const name of all) assert.ok(listed.has(name), `ツリーにない: ${name}`);
    for (const name of listed) assert.ok(all.includes(name), `実在しない: ${name}`);
  });
}

test('参考文献の URL は日英で同じ', () => {
  const urls = (d) => [...section(d.text, d.sec.refs).matchAll(/\]\((https:\/\/[^)\s]+)\)/g)].map((m) => m[1]);
  assert.deepEqual(urls(DOCS.en), urls(DOCS.ja));
  assert.equal(urls(DOCS.ja).length, 10);
});

test('画像: 参照はすべて実在する。スクリーンショットは日本語版が assets/、英語版が assets/en/ の6枚。どこからも参照しない画像は置かない', () => {
  const refs = {};
  for (const [lang, d] of Object.entries(DOCS)) {
    refs[lang] = [...d.text.matchAll(/!\[[^\]]*\]\((assets\/[^)]+)\)/g)].map((m) => m[1]);
    for (const r of refs[lang]) assert.ok(fs.existsSync(path.join(ROOT, r)), r);
    const shots = refs[lang].filter((r) => /screenshot/.test(r));
    assert.equal(shots.length, 6, lang);
    for (const r of shots) {
      assert.match(r, d.shots, r);
      assert.ok(fs.statSync(path.join(ROOT, r)).size <= 300 * 1024, r);
    }
  }
  const used = new Set([...refs.ja, ...refs.en]);
  const files = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => /\.(png|jpg)$/.test(f)).map((f) => `${dir}/${f}`);
  for (const f of [...files('assets'), ...files('assets/en')]) assert.ok(used.has(f), `参照していない画像: ${f}`);
});
