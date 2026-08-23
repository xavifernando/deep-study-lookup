import { App, normalizePath, Notice, TFile } from "obsidian";
import { PluginSettings, StudyNoteResult } from "../../types";

export class SpacedRepetitionService {
  private app: App;
  private settings: PluginSettings;

  constructor(app: App, settings: PluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }

  /**
   * Creates a dedicated Deep-Dive Study Note with SM-2 Frontmatter and embedded illustrations
   */
  async createStudyNote(
    studyPack: StudyNoteResult,
    options: {
      parentNoteTitle?: string;
      contextSentence?: string;
    } = {}
  ): Promise<{ file: TFile; linkMarkdown: string }> {
    const rawFolder = (this.settings.studyNotesFolder || "Study Notes").trim().replace(/\/+$/, "");
    const folder = normalizePath(rawFolder);

    // Ensure folder exists
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder).catch(() => {});
    }

    const sanitizedTitle = studyPack.title.replace(/[\\/:*?"<>|]/g, " ").trim();
    const filePath = normalizePath(`${folder}/${sanitizedTitle}.md`);

    // Tomorrow is first review date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDateStr = tomorrow.toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];

    const domainTag = this.detectDomainTag(studyPack.title, studyPack.summary);

    let content = `---
tags:
  - deep-dive-note
  - study-note
  - active-recall
  - spaced-repetition
  - ${domainTag}
created: ${todayStr}
review_due: ${dueDateStr}
interval_days: 1
reps: 0
ease_factor: 2.5
${studyPack.sourceBadge ? `source_engine: "${studyPack.sourceBadge}"\n` : ""}${options.parentNoteTitle ? `source_note: "[[${options.parentNoteTitle}]]"\n` : ""}---

# 🧠 Deep-Dive Study Note: ${studyPack.title}

> [!abstract] 📌 Simple Definition${studyPack.sourceBadge ? ` *(${studyPack.sourceBadge})*` : ""}
> ${studyPack.simpleDefinition || studyPack.summary}

## 📋 Key Rules & Core Features
${(studyPack.keyRules && studyPack.keyRules.length > 0 ? studyPack.keyRules : [studyPack.summary]).map((r) => `- ${r}`).join("\n")}

## 💡 Real-World Example & Use Case
> [!example] ${studyPack.title} in Action
> ${studyPack.realWorldExample || `In real-world applications, ${studyPack.title} governs fundamental operational throughput and ensures system stability.`}

${studyPack.visualDiagram ? `## 📊 Visual Mechanism & Flow\n\`\`\`mermaid\n${studyPack.visualDiagram}\n\`\`\`\n\n` : ""}
${this.settings.includeImagesInStudyNote && studyPack.images && studyPack.images.length > 0 ? `## 🖼️ Visual Illustrations\n` + studyPack.images.slice(0, 2).map((img, idx) => `![${img.title}](${img.url})\n*Figure ${idx + 1}: ${img.title}*\n\n`).join("") : ""}

## 🎯 Why It Matters & Significance
> ${studyPack.whyItMatters || `Mastering ${studyPack.title} is essential for predicting system behavior, diagnosing edge cases, and applying the concept in practice.`}

## 🧠 Memory Mastery & Retention Toolkit
> [!tip] 🧙‍♂️ Vivid Visual Mnemonic Hook
> ${studyPack.mnemonicHook || `Picture a giant, glowing symbol of ${studyPack.title} actively transforming its inputs into results.`}

${studyPack.analogicalBridge ? `> [!quote] 🌉 Everyday Analogical Bridge\n> ${studyPack.analogicalBridge}\n\n` : ""}
${studyPack.etymologyRoots ? `> [!note] 🧩 Root Words & Etymology\n> ${studyPack.etymologyRoots}\n\n` : ""}
${studyPack.acronymOrPeg ? `> [!info] 🪝 Acronym & Memory Peg\n> ${studyPack.acronymOrPeg}\n\n` : ""}
### 🏛️ Method of Loci: 5-Room Memory Palace Route
${typeof studyPack.memoryPalaceRoute === "object" && studyPack.memoryPalaceRoute !== null ? `
- 🚪 **Room 1 (Front Door)**: ${studyPack.memoryPalaceRoute.frontDoor}
- 🛋️ **Room 2 (Living Room Couch)**: ${studyPack.memoryPalaceRoute.livingRoom}
- 🍳 **Room 3 (Kitchen Counter)**: ${studyPack.memoryPalaceRoute.kitchen}
- 🚪 **Room 4 (Hallway Caution)**: ${studyPack.memoryPalaceRoute.hallway}
- 🛏️ **Room 5 (Bedroom Mastery)**: ${studyPack.memoryPalaceRoute.bedroom}
` : `- 🚪 **Front Door $\\rightarrow$ Bedroom Route**: Place ${studyPack.title} on your front door, its core rules on your living room couch, real-world action in the kitchen, warning traps in the hallway, and key takeaway in your bedroom.`}

## ⚠️ Common Traps & Misconceptions to Avoid
> [!warning] Traps to Watch Out For
> ${studyPack.commonTraps || `Avoid assuming ${studyPack.title} acts in isolation; always account for governing rate limits, constraints, and dependencies.`}

## 🔗 Bidirectional Links & Knowledge Graph
${options.parentNoteTitle ? `- 📄 **Source Document / Parent Note**: [[${options.parentNoteTitle}]]` : ""}
${options.contextSentence ? `- 🎯 **Context in Note**: *“${options.contextSentence}”*` : ""}
- 🌐 **Related Concepts**: ${(studyPack.quickLinks && studyPack.quickLinks.length > 0 ? studyPack.quickLinks : ["System Fundamentals", "Domain Principles"]).map((l) => `[[${l}]]`).join(", ")}
- 🏷️ **Domain Tags**: \`#study-note\` \`#deep-dive\` \`#active-recall\` \`#memory-palace\` \`#spaced-repetition\` \`#${domainTag}\`
${studyPack.webSourceUrl ? `- 🌍 **External Reference**: [Wikipedia / Research Source](${studyPack.webSourceUrl})` : ""}`;

    let file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      file = await this.app.vault.create(filePath, content);
    }

    const linkMarkdown = `[[${filePath}|🧠 ${studyPack.title} (Deep-Dive Note)]]`;
    return { file: file as TFile, linkMarkdown };
  }

  /**
   * Check if a note opened by the user is due for Spaced Repetition Active Recall
   */
  async checkNoteRecallDue(file: TFile): Promise<boolean> {
    try {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;
      if (!frontmatter || !frontmatter.review_due) return false;

      const today = new Date().toISOString().split("T")[0];
      if (frontmatter.review_due <= today) {
        new Notice(
          `🧠 Spaced Repetition Due Today for "${file.basename}"! Review your Active Recall FAQs.`,
          8000
        );
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }

  /**
   * Update SM-2 schedule after user reviews a note
   */
  async recordReview(file: TFile, rating: "hard" | "good" | "easy"): Promise<void> {
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    if (!frontmatter) return;

    let reps = Number(frontmatter.reps || 0);
    let interval = Number(frontmatter.interval_days || 1);
    let ease = Number(frontmatter.ease_factor || 2.5);

    if (rating === "hard") {
      reps = 0;
      interval = 1;
      ease = Math.max(1.3, ease - 0.2);
    } else if (rating === "good") {
      reps++;
      if (reps === 1) interval = 1;
      else if (reps === 2) interval = 3;
      else interval = Math.round(interval * ease);
    } else if (rating === "easy") {
      reps++;
      if (reps === 1) interval = 3;
      else if (reps === 2) interval = 7;
      else interval = Math.round(interval * ease * 1.3);
      ease += 0.15;
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);
    const nextDueStr = nextDate.toISOString().split("T")[0];

    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.review_due = nextDueStr;
      fm.interval_days = interval;
      fm.reps = reps;
      fm.ease_factor = parseFloat(ease.toFixed(2));
      fm.last_reviewed = new Date().toISOString().split("T")[0];
    });

    new Notice(`Recorded! Next review in ${interval} day${interval === 1 ? "" : "s"} (${nextDueStr}).`);
  }

  /**
   * Get all notes in vault due for active recall review today (Interleaved across domains)
   */
  getDueStudyNotes(): TFile[] {
    const today = new Date().toISOString().split("T")[0];
    const files = this.app.vault.getMarkdownFiles();
    const dueFiles = files.filter((f) => {
      const cache = this.app.metadataCache.getFileCache(f);
      const fm = cache?.frontmatter;
      return fm && fm.review_due && fm.review_due <= today;
    });

    // Cognitive Interleaving: Shuffle due cards to prevent blocked domain fatigue
    for (let i = dueFiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dueFiles[i], dueFiles[j]] = [dueFiles[j], dueFiles[i]];
    }

    return dueFiles;
  }

  /**
   * Get current review streak
   */
  getReviewStreak(): number {
    return this.settings.reviewStreak || 0;
  }

  /**
   * Update daily retention streak
   */
  async recordReviewCompletion(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    if (this.settings.lastReviewDate === today) {
      return this.settings.reviewStreak || 1;
    }

    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    if (this.settings.lastReviewDate === yesterday) {
      this.settings.reviewStreak = (this.settings.reviewStreak || 0) + 1;
    } else {
      this.settings.reviewStreak = 1;
    }

    this.settings.lastReviewDate = today;
    return this.settings.reviewStreak;
  }

  private detectDomainTag(title: string, summary: string): string {
    const text = (title + " " + summary).toLowerCase();
    if (text.includes("protein") || text.includes("cell") || text.includes("acid") || text.includes("enzyme") || text.includes("hormone") || text.includes("gene") || text.includes("creatine") || text.includes("atp") || text.includes("organ") || text.includes("muscle") || text.includes("neuron") || text.includes("brain")) {
      return "biology-medicine";
    }
    if (text.includes("algorithm") || text.includes("data") || text.includes("code") || text.includes("network") || text.includes("comput") || text.includes("thread") || text.includes("software") || text.includes("memory") || text.includes("concurrency") || text.includes("api")) {
      return "computer-science";
    }
    if (text.includes("law") || text.includes("court") || text.includes("right") || text.includes("contract") || text.includes("statute") || text.includes("doctrine") || text.includes("tort") || text.includes("legal")) {
      return "law-jurisprudence";
    }
    if (text.includes("market") || text.includes("price") || text.includes("cost") || text.includes("econom") || text.includes("capital") || text.includes("trade") || text.includes("finance") || text.includes("money")) {
      return "economics-finance";
    }
    if (text.includes("physics") || text.includes("quantum") || text.includes("thermodynamic") || text.includes("gravity") || text.includes("energy") || text.includes("wave") || text.includes("atom")) {
      return "physics-engineering";
    }
    if (text.includes("philosophy") || text.includes("epistem") || text.includes("ethic") || text.includes("logic") || text.includes("moral")) {
      return "philosophy";
    }
    return "academic-concept";
  }

  private formatClozeAnswer(answer: string, title: string): string {
    const words = title.trim().split(/\s+/).filter((w) => w.length > 2);
    let formatted = answer;

    // First check exact title match
    const titleEscaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const titleRegex = new RegExp(`\\b(${titleEscaped})\\b`, "i");
    if (titleRegex.test(formatted)) {
      return formatted.replace(titleRegex, "{{c1::$1}}");
    }

    // Otherwise wrap main key term
    for (const word of words) {
      const wEscaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wRegex = new RegExp(`\\b(${wEscaped})\\b`, "i");
      if (wRegex.test(formatted)) {
        formatted = formatted.replace(wRegex, "{{c1::$1}}");
        break;
      }
    }
    return formatted;
  }

  async generateRetentionDashboardMarkdown(): Promise<string> {
    const dueNotes = await this.getDueStudyNotes();
    const allFiles = this.app.vault.getMarkdownFiles();
    const studyNotes = allFiles.filter((f) => f.path.startsWith(this.settings.studyNotesFolder || "Study Notes"));

    const domainCounts: Record<string, { total: number; mastered: number }> = {};
    let totalReps = 0;
    let totalMastered = 0;

    for (const file of studyNotes) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;
      const domain = (fm?.tags as string[])?.find((t) => t !== "deep-dive-note" && t !== "flashcard") || "general-knowledge";
      if (!domainCounts[domain]) {
        domainCounts[domain] = { total: 0, mastered: 0 };
      }
      domainCounts[domain].total++;

      const interval = typeof fm?.srsInterval === "number" ? fm.srsInterval : 1;
      const reps = typeof fm?.srsRepetitions === "number" ? fm.srsRepetitions : 0;
      totalReps += reps;
      if (interval >= 21) {
        domainCounts[domain].mastered++;
        totalMastered++;
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    let md = `# 📊 Lifelong Memory & Retention Dashboard\n\n`;
    md += `*Generated automatically by Smart Lookup on ${todayStr}*\n\n`;
    md += `> [!summary] 🧠 Vault Memory Overview\n`;
    md += `> - **Total Deep-Dive Notes**: ${studyNotes.length}\n`;
    md += `> - **Mastered Long-Term Concepts (Interval ≥ 21d)**: ${totalMastered} (${studyNotes.length > 0 ? Math.round((totalMastered / studyNotes.length) * 100) : 0}%)\n`;
    md += `> - **Total Spaced Repetitions Completed**: ${totalReps}\n`;
    md += `> - **Active Recall Queue Today**: ${dueNotes.length} notes due\n\n`;

    md += `## 🌐 Domain Mastery Breakdown\n\n`;
    md += `| Domain / Discipline | Total Notes | Mastered (21d+) | Retention Rate | Status |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;

    if (Object.keys(domainCounts).length === 0) {
      md += `| *No study notes yet* | 0 | 0 | 0% | ⚪ Getting Started |\n`;
    } else {
      for (const [dom, stats] of Object.entries(domainCounts)) {
        const rate = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
        const badge = rate >= 80 ? "🟢 Mastered" : rate >= 50 ? "🟡 Consolidating" : "🔴 Developing";
        md += `| **${dom}** | ${stats.total} | ${stats.mastered} | ${rate}% | ${badge} |\n`;
      }
    }
    md += `\n`;

    md += `## ⏰ Spaced Repetition Due Queue\n\n`;
    if (dueNotes.length === 0) {
      md += `> [!success] 🎉 All caught up!\n> There are no active recall flashcards due today. Enjoy your day or create new deep-dive notes.\n\n`;
    } else {
      md += `| Concept Note | Interval | Reps | Action |\n`;
      md += `| :--- | :--- | :--- | :--- |\n`;
      dueNotes.slice(0, 20).forEach((n) => {
        md += `| [[${n.file.basename}]] | ${n.interval}d | ${n.repetitions} reps | [Open Note](obsidian://open?file=${encodeURIComponent(n.file.path)}) |\n`;
      });
      md += `\n`;
    }

    md += `## 🚀 Active Recall Review Shortcut\n\n`;
    md += `- Press <kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd> to launch the **Interactive Daily Flashcard Review Modal**.\n`;
    md += `- Press <kbd>Ctrl/Cmd</kbd> + <kbd>P</kbd> $\\rightarrow$ **Smart Lookup: Review Active Recall Flashcards Due Today**.\n`;

    return md;
  }
}
