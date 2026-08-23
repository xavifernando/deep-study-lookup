import { App, Modal, Notice, setIcon } from "obsidian";
import { WolframResult, WolframService } from "../services/wolfram/WolframService";

export interface WolframModalCallbacks {
  onInsertMarkdown?: (md: string) => void;
  onAppendToStudyNote?: (title: string, md: string) => Promise<void>;
}

export class WolframSolverModal extends Modal {
  private service: WolframService;
  private currentQuery: string;
  private currentResult: WolframResult | null = null;
  private isLoading = false;
  private callbacks: WolframModalCallbacks;

  constructor(app: App, service: WolframService, initialQuery: string, callbacks: WolframModalCallbacks = {}) {
    super(app);
    this.service = service;
    this.currentQuery = initialQuery;
    this.callbacks = callbacks;
  }

  async onOpen() {
    this.modalEl.addClass("smart-lookup-wolfram-modal");

    if (this.currentQuery) {
      await this.doSolve(this.currentQuery);
    } else {
      this.render();
    }
  }

  private async doSolve(query: string): Promise<void> {
    this.isLoading = true;
    this.currentQuery = query;
    this.render();
    try {
      this.currentResult = await this.service.solve(query);
    } catch (err) {
      new Notice(`Wolfram notice: ${(err as Error).message}`);
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    // 1. Header
    const header = contentEl.createDiv({ cls: "smart-lookup-paragraph-header" });
    const titleWrap = header.createDiv({ cls: "smart-lookup-review-title-wrap" });
    const iconSpan = titleWrap.createSpan({ cls: "smart-lookup-paragraph-icon" });
    setIcon(iconSpan, "calculator");
    titleWrap.createEl("h2", { text: "🧮 Wolfram|Alpha Computational Problem Solver" });

    // 2. Input Search Bar
    const searchRow = header.createDiv({ cls: "smart-lookup-yt-search-row" });

    const input = searchRow.createEl("input", {
      type: "text",
      value: this.currentQuery,
      placeholder: "e.g. x^2 - 5x + 6 = 0, d/dx (x^3 - 4x), 100 km/h to m/s, sqrt(256) + 4^3...",
      cls: "smart-lookup-yt-search-input",
    });

    const solveBtn = searchRow.createEl("button", {
      text: "Solve Problem",
      cls: "smart-lookup-btn smart-lookup-btn-primary",
    });
    setIcon(solveBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "sparkles");

    const triggerSolve = () => {
      const q = input.value.trim();
      if (q) {
        void this.doSolve(q);
      }
    };

    solveBtn.onclick = triggerSolve;
    input.onkeydown = (e) => {
      if (e.key === "Enter") triggerSolve();
    };

    // 3. Scrollable Result Body
    const body = contentEl.createDiv({ cls: "smart-lookup-paragraph-scroll-body" });

    if (this.isLoading) {
      const loading = body.createDiv({ cls: "smart-lookup-loading-box" });
      const spinner = loading.createSpan({ cls: "smart-lookup-spinner" });
      setIcon(spinner, "loader");
      loading.createSpan({ text: `Computing mathematical solution for "${this.currentQuery}"...` });
      return;
    }

    if (!this.currentResult) {
      const empty = body.createDiv({ cls: "smart-lookup-para-bullets" });
      empty.createEl("h4", { text: "💡 Enter a Problem to Compute" });
      empty.createEl("p", {
        text: "Type any equation (quadratic, polynomial, linear), derivative, integral, unit conversion, or scientific calculation above to generate step-by-step breakdown.",
      });
      return;
    }

    // Direct Answer Card
    const resCard = body.createDiv({ cls: "smart-lookup-para-title-card" });
    resCard.createEl("h4", { text: "🎯 Direct Solution" });
    const ansP = resCard.createEl("p", { cls: "smart-lookup-study-summary-text smart-lookup-wolfram-answer" });
    ansP.setText(this.currentResult.solution);

    // Step-by-Step Breakdown
    if (this.currentResult.steps && this.currentResult.steps.length > 0) {
      const stepCard = body.createDiv({ cls: "smart-lookup-para-bullets" });
      stepCard.createEl("h4", { text: "🪜 Step-by-Step Mathematical Derivation" });
      const ol = stepCard.createEl("ol");
      this.currentResult.steps.forEach((st) => {
        ol.createEl("li", { text: st });
      });
    }

    // Action Buttons Row
    const actionRow = contentEl.createDiv({ cls: "smart-lookup-paragraph-actions" });
    const leftActions = actionRow.createDiv({ cls: "smart-lookup-actions-group" });

    // 📥 Insert into Note
    const insertBtn = leftActions.createEl("button", {
      cls: "smart-lookup-btn smart-lookup-btn-primary",
      text: "📥 Insert into Active Note",
    });
    setIcon(insertBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "file-plus");
    insertBtn.onclick = () => {
      if (this.callbacks.onInsertMarkdown && this.currentResult) {
        this.callbacks.onInsertMarkdown(this.currentResult.markdownFormatted);
        new Notice("Inserted Wolfram solution into active note!");
        this.close();
      }
    };

    // 📚 Add to Study Note
    const studyBtn = leftActions.createEl("button", {
      cls: "smart-lookup-btn",
      text: "📚 Add to Study Note",
    });
    setIcon(studyBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "book-open");
    studyBtn.onclick = async () => {
      if (this.callbacks.onAppendToStudyNote && this.currentResult) {
        await this.callbacks.onAppendToStudyNote(this.currentResult.query, this.currentResult.markdownFormatted);
        new Notice("Added Wolfram solution to Study Note!");
      }
    };

    // 🌐 Open in Wolfram Web
    const webBtn = leftActions.createEl("button", {
      cls: "smart-lookup-btn",
      text: "🌐 Open in Web",
    });
    webBtn.onclick = () => {
      window.open(`https://www.wolframalpha.com/input?i=${encodeURIComponent(this.currentQuery)}`, "_blank");
    };

    // ✕ Close Button
    const closeBtn = actionRow.createEl("button", {
      cls: "smart-lookup-btn",
      text: "✕ Close",
    });
    closeBtn.onclick = () => this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}
