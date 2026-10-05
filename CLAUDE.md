# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BaseXX Visualizer is an educational tool that compares Base32, Base58 and basE91 with Base64: alphabets, lengths and resistance to human misreading. Part of the "生成AIで作るセキュリティツール100" (100 Security Tools with Generative AI) project, Day052.

**Live demo**: https://ipusiron.github.io/basexx-visualizer/

## Development Commands

Static site with no build process and no dependencies.

```bash
npm test                    # node --test (Node.js 22+), no dependencies
python -m http.server 8000  # serve locally (index.html also works from file://)
```

## Code Architecture

- `index.html` - 5 tab panels (overview / convert / length / misread / base91). No `style` attributes, no inline scripts or handlers. Static text has `data-i18n` keys whose Japanese text must equal the dictionary (tested). Length bars are SVG `rect` elements whose `width` attribute is set from script (no style writes)
- `script.js` - DOM layer only. Each part keeps its state and redraws with a `render` function; `renders` are all re-run on language switch. Decoding never overwrites the input
- `js/basexx-core.js` - pure logic (`globalThis.BaseXXCore`, no DOM):
  - `ALPHABETS` (Base64/Base32 per RFC 4648, Base58 Bitcoin, basE91 = the original `enctab` of base91-0.6.0, 91 chars without `-` `\` `'`), `CONFUSABLE_GROUPS` (RFC 4648 §3.4: 0/O, 1/l/I) and `confusablesIn(kind)`
  - `encodeBits` (generic bit grouping) → `encodeBase64`, `encodeBase32`; `encodeBase58` (leading 00 → `1`, empty → empty); `base91Steps` (text plus counts of 13-bit and 14-bit groups) → `encodeBase91`
  - decoders return `{ ok: true, bytes, skipped, loose }` or `{ ok: false, error, pos, ch }` with `error` in `char` / `length` / `padding` / `empty` / `long`. Spaces and line breaks are skipped only with `skipSpace` (default true); every other non-alphabet character is an error with its 1-based code point position. Base32 accepts lowercase. `loose` marks non-zero leftover bits (e.g. `Zh==`)
  - `decodeAll` (all four schemes; a string alone does not identify the scheme), `parseHex` (whitespace and `:` allowed), `toHex`, `utf8`, `readUtf8` (null for invalid UTF-8 or control characters other than tab/LF), `bitsLength`, `RATIOS`, `sampleBytes` (xorshift32 with a fixed seed, so the page, README and tests agree), `lengths`, `MAX_BYTES` 4096, `MAX_CHARS` 8192
- `js/messages.js` - Japanese and English dictionaries with the same keys (`BaseXXMessages.t(key, vars, lang)`)
- `js/i18n.js` - language detection (`?lang=` → saved → browser) and `data-i18n` replacement
- `js/theme-init.js` / `js/theme.js` - theme follows the OS until toggled; localStorage access is always in `try`
- `style.css` - color tokens on `:root`, dark via `prefers-color-scheme` and `[data-theme="dark"]` (same values). The body font starts with a Latin font because Japanese fonts draw the backslash as a yen sign

### basE91

Encoding and decoding follow `base91.c` of the original (Joachim Henke, BSD). Known answers in the tests were computed with a faithful port that reproduces the original `test.sh` checksum. The original decoder skips every non-alphabet character; this tool deliberately rejects them (except spaces and line breaks), following the rejection rule of RFC 4648 §3.3. Keep the original alphabet; do not switch back to all 94 printable characters.

### Misreading demo

`PATTERNS` in `script.js` (O→0 and I→1 on a JWT header, I→l on "Sample Text", + → space on "Hello>", / → \ on "Hello?World") are recomputed live and in `test/readme.test.js`. The + → space case gives "Hello" without an error when spaces are skipped and an error at character 8 otherwise.

## Security Considerations

- CSP in `<meta>`: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'` (no `unsafe-inline`)
- All output is built with DOM APIs and `textContent` (no `innerHTML`; tested)
- External links use `rel="noopener noreferrer"`; referrer policy is `no-referrer`

## Tests

- `test/core.test.js` - RFC 4648 vectors, draft-msporny-base58-03 vectors, basE91 known answers, round trips (0–300 bytes, random/00/FF, padding on/off, UTF-8 incl. surrogate pairs), error kinds and positions, whitespace handling, loose bits, length formulas, basE91 group counts
- `test/html.test.js` - CSP, tab ARIA, labels, `aria-pressed`, dictionary agreement, ids used by script.js, no innerHTML/style writes, guarded localStorage, ratio table, sample buttons
- `test/contrast.test.js` - text 4.5:1, field borders and scheme colors 3:1 in light and dark, 44px controls, 16px inputs, Latin-first font
- `test/messages.test.js`, `test/i18n.test.js` - dictionaries, notation, numbers in the text, language selection
- `test/readme.test.js` - both READMEs (same headings), YAML structure, encoding/length/misreading tables recomputed from the core, limits, directory tree, images (6 screenshots each)
- `test/format.test.js` - line length, LF, no control characters

README numbers are recomputed by tests — update them from the core, not by hand. README states only what is true for the current version. Screenshots are taken with `business/research/try100_audit/impl/shots/day052_shots.py` in the ipusiron-work repository.

## Deployment

GitHub Pages from the `main` branch root: https://ipusiron.github.io/basexx-visualizer/ (`.nojekyll` disables Jekyll).
