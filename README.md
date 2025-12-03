<!--
---
id: day052
slug: basexx-visualizer

title: "BaseXX Visualizer"

subtitle_ja: "Base32/58/64/91比較ツール"
subtitle_en: "Base32/58/64/91 Encoding Comparison Tool"

description_ja: "Base64を基準にBase32・Base58・Base91の違いを体験的に学べる教育用ビジュアライザー。誤読デモやエンコード効率の比較機能を搭載。"
description_en: "Educational visualizer to compare Base32, Base58, Base64, and Base91 encodings. Features human error demos and encoding efficiency comparisons."

category_ja:
  - エンコーディング
  - 表現変換
category_en:
  - Encoding
  - Representation Conversion

difficulty: 3

tags:
  - base32
  - base58
  - base64
  - base91
  - encoding
  - visualization
  - TOTP

repo_url: "https://github.com/ipusiron/basexx-visualizer"
demo_url: "https://ipusiron.github.io/basexx-visualizer/"

hub: true
---
-->

# BaseXX Visualizer - Base32/58/64/91比較ツール

![GitHub Repo stars](https://img.shields.io/github/stars/ipusiron/basexx-visualizer?style=social)  
![GitHub forks](https://img.shields.io/github/forks/ipusiron/basexx-visualizer?style=social)  
![GitHub last commit](https://img.shields.io/github/last-commit/ipusiron/basexx-visualizer)  
![GitHub license](https://img.shields.io/github/license/ipusiron/basexx-visualizer)  
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue?logo=github)](https://ipusiron.github.io/basexx-visualizer/)


**Day052 - 生成AIで作るセキュリティツール100**

**BaseXX Visualizer**は、**Base64を基準**に Base32・Base58・Base91を比較できる教育用ビジュアライザーです。  

特に、Base64の課題（誤読しやすさ）を具体例で示し、Base32/58がどのように改善しているかを体験できます。

---

## 🔑 実用的な背景

通常のデータ交換では**コピー&ペースト**により誤読問題を回避できますが、以下の場面では手動入力が避けられません：

- **二要素認証（TOTP）のシークレットキー設定**: QRコードが読み取れない環境
- **異なるデバイス間での認証情報移行**: スマートフォン ⇄ PC間の手動入力  
- **紙媒体からの入力**: 印刷されたバックアップコードの手動入力
- **音声での伝達**: 電話等での口頭による文字列伝達

このような場面でBase32/Base58の採用により、**O（オー）と0（ゼロ）**、**I（アイ）とl（エル）と1（イチ）**などの混同による設定失敗を防げます。

Base91は、おまけとして雑学的に解説します。

---

## 🌐 デモページ

👉 **[https://ipusiron.github.io/basexx-visualizer/](https://ipusiron.github.io/basexx-visualizer/)**

ブラウザーで直接お試しいただけます。

---

## 📸 スクリーンショット

>!["hello"のエンコード結果](assets/screenshot.png)
>
>*"hello"のエンコード結果*

---

## ⚙️ 機能仕様

### 🗂️ タブ構成

#### 1. 基本（Overview）
- 各方式の概要（文字集合・用途・特徴）を比較表で表示
- 文字集合をボタン切り替えで確認可能（Base64/Base32/Base58/Base91）
- Base64を基準とした設計思想の解説
- 実用的な背景：二要素認証での手動入力の重要性

#### 2. 体験（Playground）
- **完全実装済み**のエンコード/デコード機能
- 入力形式：テキスト（UTF-8）またはHEX選択
- 同時エンコード：Base32/Base58/Base64/Base91に一括変換
- リアルタイム表示：各方式の文字数・膨張率を自動計算
- ワンクリックコピー：各出力結果の個別コピー機能
- 自動デコード：入力文字列の形式を自動判定してデコード

#### 3. 長さと効率（Size/Efficiency）
- インタラクティブスライダー：原データ長（1-256バイト）を可変調整
- リアルタイム計算：各方式のエンコード長と膨張率を即座に表示
- 視覚的比較：棒グラフでBase64を100%基準とした相対比較
- グラデーション効果：各方式を色分けして視覚的に区別

#### 4. 誤読デモ（Human Errors）
- **5つの誤読パターン**を個別ボタンで体験：
  - `O`（オー） ↔ `0`（ゼロ）
  - `I`（アイ） ↔ `l`（エル小文字）  
  - `I`（アイ） ↔ `1`（イチ）
  - `+`（プラス） ↔ スペース
  - `/`（スラッシュ） ↔ `\`（バックスラッシュ）
- **実用的な例**：JWTトークンなど実際のWeb開発で遭遇する文字列
- **ビフォーアフター比較**：正しい文字列と誤読後の結果を並列表示
- **文字ハイライト**：問題となる文字を視覚的に強調（色分け・アニメーション）
- **動的レジェンド**：各パターンに応じた説明と見本を自動更新

#### 5. Base91（おまけ）
- Base91の文字集合と特徴の解説
- 効率性の紹介（Base64より短くなる場合）
- 実用上の課題（特殊文字の多さ・互換性の難しさ）

---

## 📌 実装仕様
- **完全動作する**Base32/Base58/Base64/Base91エンコード・デコード
- **セキュリティ対策**：入力サイズ制限、XSS防止、CSPヘッダー
- **入力検証**：HEX形式の厳密な検証、エラーハンドリング
- **レスポンシブデザイン**：モバイル対応の完全レスポンシブUI
- **アクセシビリティ**：ARIAラベル、キーボード操作、画面読み上げ対応
- **パフォーマンス**：ライブラリ不要のvanilla JavaScript実装

---

## 📁 ディレクトリー構成

```
basexx-visualizer/
├── index.html          # メインHTMLファイル（タブベースのSPA構造）
├── script.js           # JavaScript（Base32/58/64/91エンコード実装 + UI制御）
├── style.css           # CSSスタイル（ライトモード、レスポンシブデザイン）
├── README.md           # このファイル（プロジェクト説明）
├── LICENSE             # MITライセンス
├── CLAUDE.md           # Claude Code用の開発ガイド
└── assets/
    └── screenshot.png  # デモ画面のスクリーンショット
```

---

## 🏗️ アーキテクチャ

- **単一ページアプリケーション（SPA）**: vanilla JavaScript、ビルドツール不要
- **タブベースUI**: 5つのセクション（基本/体験/効率/誤読デモ/Base91）
- **静的サイト**: GitHub Pages対応、コピー&ペーストですぐに動作

---

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) をご覧ください。

---

## 🛠 このツールについて

本ツールは、「生成AIで作るセキュリティツール100」プロジェクトの一環として開発されました。  
このプロジェクトでは、AIの支援を活用しながら、セキュリティに関連するさまざまなツールを100日間にわたり制作・公開していく取り組みを行っています。

プロジェクトの詳細や他のツールについては、以下のページをご覧ください。  

🔗 [https://akademeia.info/?page_id=42163](https://akademeia.info/?page_id=42163)
