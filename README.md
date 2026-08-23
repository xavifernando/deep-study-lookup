# Deep Study and Visual Lookup for Obsidian

An intelligent, multi-modal research and learning assistant for Obsidian. Look up definitions, synthesize pedagogical study notes with mnemonics, solve equations, sync cards to Anki, and research across Markdown notes and PDFs.

---

## Features

- **Instant Selection Trigger**: Highlight any word, concept, or equation in Markdown notes or native Obsidian PDF tabs to trigger a floating pill or popover.
- **Multi-Source Dictionary & Offline Lexicon**: Instant definitions, phonetics, parts of speech, and synonyms via Free Dictionary, Wikipedia, and offline morphological root analysis.
- **Pedagogical Deep-Dive Study Notes**: Synthesize 8-part structured study notes with core mechanisms, concrete real-world examples, common traps to avoid, and Mermaid visual diagrams.
- **Memory Mastery & Method of Loci**: Automated mnemonic hooks, 5-room Memory Palace routes (Front Door, Living Room, Kitchen, Hallway, Bedroom), root-word breakdowns, and acronyms for permanent retention.
- **AnkiConnect Flashcard Sync**: 1-click sync with cloze deletion, phonetic audio, and collapsible mnemonic hint revealers directly into your chosen Anki deck.
- **Wolfram|Alpha Problem Solver**: Solve algebra, calculus, derivatives, integrals, and arithmetic step-by-step with LaTeX and markdown formatting.
- **Paragraph & Whole-Page Summarizer**: Extract key takeaways, core mechanisms, and format footnotes (`[^1]`) from long passages or full-page documents.
- **1-Click Auto-Glossary**: Scan an active note or chapter, extract key technical terms, and append an alphabetical markdown glossary table.
- **Native PDF Selection**: Select text in native Obsidian PDF tabs with automatic page number detection and deep linking (`[[Document.pdf#page=14]]`).
- **Interactive Multi-Language Translation**: Real-time multi-language translation supporting single words and full-page text with zero length limits.

---

## Installation

### From Community Plugins (Once Approved)
1. Open **Settings** $\rightarrow$ **Community plugins**.
2. Search for **Deep Study and Visual Lookup**.
3. Click **Install**, then **Enable**.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest GitHub release](https://github.com/xaviersethu/obsidian-smart-lookup/releases).
2. Place them into your vault folder: `<Your-Vault>/.obsidian/plugins/deep-study-lookup/`.
3. Open Obsidian $\rightarrow$ **Settings** $\rightarrow$ **Community plugins** $\rightarrow$ Enable **Deep Study & Visual Lookup**.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Mod + Shift + D` | Trigger Smart Lookup for selected text |
| `Mod + Shift + S` | Summarize selected paragraph / document |
| `Ctrl + Shift + I` | Open Insert Definition menu |
| `Ctrl + Shift + L` | Save term to Vocabulary Log note |
| `Ctrl + Shift + A` | Sync card to Anki |
| `Ctrl + Shift + S` | Synthesize deep-dive study note |
| `Ctrl + Shift + W` | Open Wolfram|Alpha problem solver |
| `Escape` | Close popover |

---

## Author & License

Created by **[xavifernando](https://github.com/xavifernando)**.

Licensed under the [MIT License](LICENSE).
