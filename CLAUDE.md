# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BaseXX Visualizer is an educational web tool for comparing Base32, Base58, Base64, and Base91 encoding schemes. The application demonstrates encoding differences, readability issues, and efficiency comparisons, with Base64 as the reference standard.

## Architecture

Single-page application (SPA) with vanilla JavaScript:
- **index.html**: Main HTML structure with tabbed interface (基本/体験/長さと効率/誤読デモ/Base91)
- **script.js**: Tab navigation, UI interactions, and placeholder encoding/decoding logic
- **style.css**: Dark theme with custom CSS variables and responsive grid layouts

No build tools or package managers are used - this is a static site that runs directly in the browser.

## Development Commands

```bash
# Run locally with Python's built-in server
python3 -m http.server 8000
# Then navigate to http://localhost:8000

# Or use any other static server
npx serve .
# Or
open index.html  # Direct browser opening
```

## Security Considerations

The application includes the following security measures:
- Content Security Policy (CSP) headers to prevent XSS attacks
- Input validation with length limits (10,000 chars for text, 5,000 bytes for HEX)
- All user content rendered with `textContent` (never `innerHTML`)
- External links use `rel="noopener noreferrer"`
- Clipboard API includes size limits and sanitization

## Key Implementation Notes

### Current State
- UI framework complete with tab navigation and interactive elements
- Encoding/decoding functions are placeholders (dummy implementations marked with comments)
- The actual Base32/58/64/91 encoding libraries need to be implemented

### UI Components
- Tab-based navigation system with 5 sections
- Character set visualization with chip selectors
- Input/output cards with copy functionality
- Efficiency comparison bars (Base64 as 100% baseline)
- Error demonstration interface for showing common misreading issues

## Deployment

The site is configured for GitHub Pages deployment:
- URL: https://ipusiron.github.io/basexx-visualizer/
- No build step required - push to main branch auto-deploys

## Important Context

- Part of the "生成AIで作るセキュリティツール100" (100 Security Tools with Generative AI) series
- Focus is on educational visualization rather than production encoding/decoding
- Base64 is used as the reference standard for all comparisons
- Error demonstrations highlight why Base32/58 were designed to avoid common misreading issues (O/0, I/l/1, +/space, etc.)