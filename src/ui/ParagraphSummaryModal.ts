import { App, Modal, Notice, setIcon } from "obsidian";
import { ParagraphAIService, ParagraphAnalysisResult } from "../services/ai/ParagraphAIService";

export interface ParagraphModalCallbacks {
  onInsertFootnote: (summaryText: string) => void;
  onInsertSummary?: (summaryText: string) => void;
}

export class ParagraphSummaryModal extends Modal {
  private rawText: string;
  private paragraphService: ParagraphAIService;
  private callbacks: ParagraphModalCallbacks;
  private onCloseCallback?: () => void;

  constructor(
    app: App,
    paragraphService: ParagraphAIService,
    rawText: string,
    callbacks: ParagraphModalCallbacks,
    onCloseCallback?: () => void
  ) {
    super(app);
    this.paragraphService = paragraphService;
    this.rawText = rawText;
    this.callbacks = callbacks;
    this.onCloseCallback = onCloseCallback;
  }

  async onOpen() {
    this.modalEl.addClass("smart-lookup-paragraph-modal");
    const { contentEl } = this;
    contentEl.empty();

    const header = contentEl.createDiv({ cls: "smart-lookup-paragraph-header" });
    const titleWrap = header.createDiv({ cls: "smart-lookup-review-title-wrap" });
    const iconSpan = titleWrap.createSpan({ cls: "smart-lookup-paragraph-icon" });
    setIcon(iconSpan, "sparkles");
    titleWrap.createEl("h2", { text: "Paragraph Summary & Footnote" });

    // Backdrop click dismisses modal
    this.containerEl.addEventListener("mousedown", (e) => {
      if (e.target === this.containerEl || (e.target as HTMLElement).classList.contains("modal-bg")) {
        this.close();
      }
    });

    const loadingEl = contentEl.createDiv({ cls: "smart-lookup-loading-box", text: "Synthesizing paragraph summary..." });

    try {
      const res: ParagraphAnalysisResult = await this.paragraphService.analyzeParagraph(this.rawText);
      loadingEl.remove();

      // Scrollable content body
      const scrollBody = contentEl.createDiv({ cls: "smart-lookup-paragraph-scroll-body" });

      // Title & Key Summary Card
      const summaryCard = scrollBody.createDiv({ cls: "smart-lookup-para-title-card" });
      summaryCard.createEl("h3", { text: `📌 ${res.title}` });

      if (res.sourceBadge) {
        summaryCard.createDiv({ cls: "smart-lookup-source-badge", text: res.sourceBadge });
      }

      if (res.summaryBulletPoints && res.summaryBulletPoints.length > 0) {
        const bulletBox = scrollBody.createDiv({ cls: "smart-lookup-para-bullets" });
        bulletBox.createEl("h4", { text: "Key Points:" });
        const ul = bulletBox.createEl("ul");
        res.summaryBulletPoints.forEach((b) => {
          ul.createEl("li", { text: b });
        });
      }

      if (res.simplifiedExplanation) {
        const explainBox = scrollBody.createDiv({ cls: "smart-lookup-para-explain" });
        explainBox.createEl("strong", { text: "Plain Explanation: " });
        explainBox.createSpan({ text: res.simplifiedExplanation });
      }

      if (res.actionableTakeaway) {
        const takeawayCard = scrollBody.createDiv({ cls: "smart-lookup-para-takeaway" });
        takeawayCard.createEl("strong", { text: "🎯 Core Takeaway: " });
        takeawayCard.createSpan({ text: res.actionableTakeaway });
      }

      // Action Buttons
      const btnRow = contentEl.createDiv({ cls: "smart-lookup-paragraph-actions" });

      const footnoteBtn = btnRow.createEl("button", {
        cls: "smart-lookup-btn smart-lookup-btn-primary",
        text: "🔖 Insert Footnote",
      });
      setIcon(footnoteBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "link");
      footnoteBtn.onclick = () => {
        const summaryText = res.actionableTakeaway || res.summaryBulletPoints?.[0] || res.simplifiedExplanation;
        this.callbacks.onInsertFootnote(summaryText);
        footnoteBtn.setText("✓ Footnote Inserted");
        new Notice("Inserted summary as numbered footnote!");
      };

      if (this.callbacks.onInsertSummary) {
        const insertNoteBtn = btnRow.createEl("button", {
          cls: "smart-lookup-btn",
          text: "📥 Insert in Note",
        });
        insertNoteBtn.onclick = () => {
          const bullets = res.summaryBulletPoints?.map((b) => `- ${b}`).join("\n") || "";
          const fullMd = `> [!abstract] 📌 ${res.title}\n${bullets}\n>\n> **Takeaway**: ${res.actionableTakeaway}`;
          this.callbacks.onInsertSummary!(fullMd);
          insertNoteBtn.setText("✓ Inserted");
        };
      }

      const copyBtn = btnRow.createEl("button", {
        cls: "smart-lookup-btn",
        text: "📋 Copy",
      });
      copyBtn.onclick = () => {
        const bullets = res.summaryBulletPoints?.map((b) => `- ${b}`).join("\n") || "";
        const fullMd = `> [!abstract] 📌 ${res.title}\n${bullets}\n>\n> **Takeaway**: ${res.actionableTakeaway}`;
        navigator.clipboard.writeText(fullMd);
        new Notice("Copied summary to clipboard!");
      };

      const exitBtn = btnRow.createEl("button", {
        cls: "smart-lookup-btn",
        text: "✕ Close",
      });
      exitBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      };
    } catch (err) {
      loadingEl.setText(`Summary error: ${(err as Error).message}`);
    }
  }

  onClose() {
    this.contentEl.empty();
    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
    if (this.containerEl && this.containerEl.parentElement) {
      this.containerEl.remove();
    }
  }
}
