# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BaseXX Visualizer is an educational web tool for comparing Base32, Base58, Base64, and Base91 encoding schemes. The application demonstrates encoding differences, readability issues, and efficiency comparisons, with Base64 as the reference standard. Part of the "生成AIで作るセキュリティツール100" (100 Security Tools with Generative AI) series.

## Architecture

Single-page application (SPA) with vanilla JavaScript:
- **index.html**: Main HTML structure with tabbed interface (基本/体験/長さと効率/誤読デモ/Base91)
- **script.js**: Complete encoding/decoding implementations for Base32/58/64/91 + UI interactions
- **style.css**: Dark theme with custom CSS variables and responsive grid layouts

No build tools or package managers - static site runs directly in the browser.

### Encoding Implementations (script.js)

All encoding functions are fully implemented:
- **Base64**: Uses native `btoa()`/`atob()` APIs
- **Base32**: RFC4648 implementation with custom alphabet (`ABCDEFGHIJKLMNOPQRSTUVWXYZ234567`)
- **Base58**: Bitcoin-style using BigInt arithmetic (excludes `0OIl+/`)
- **Base91**: Joe's original algorithm using printable ASCII (91 chars)

Each encoding has corresponding `encode*()` and `decode*()` functions that work with `Uint8Array`.

## Development Commands

```bash
# Run locally with Python's built-in server
python3 -m http.server 8000
# Then navigate to http://localhost:8000

# Or use any other static server
npx serve .
```

## Security Considerations

- Content Security Policy (CSP) meta tag prevents XSS attacks
- Input validation: 10,000 char limit for text, 5,000 bytes for HEX
- All user content rendered with `textContent` (never `innerHTML`, except for controlled highlight spans)
- External links use `rel="noopener noreferrer"`
- Clipboard API includes size limits (100KB max)

## Key Design Decisions

- Base64 as the reference standard for all comparisons
- Error demonstrations highlight why Base32/58 were designed to avoid common misreading issues (O/0, I/l/1, +/space, etc.)
- TOTP/2FA context emphasized as practical use case for Base32
- Efficiency comparisons show relative sizes with Base64=100%

## Deployment

GitHub Pages: https://ipusiron.github.io/basexx-visualizer/
- Auto-deploys on push to main branch
- `.nojekyll` file present to bypass Jekyll processing
