import { App, Modal, setIcon, TFile } from "obsidian";
import { SpacedRepetitionService } from "../services/srs/SpacedRepetitionService";

interface DueQuestionCard {
  file: TFile;
  topicTitle: string;
  question: string;
  answer: string;
  summary: string;
}

export class ActiveRecallReviewModal extends Modal {
  private srsService: SpacedRepetitionService;
  private queue: DueQuestionCard[] = [];
  private currentIndex = 0;
  private isAnswerRevealed = false;

  constructor(app: App, srsService: SpacedRepetitionService) {
    super(app);
    this.srsService = srsService;
  }

  async onOpen() {
    this.modalEl.addClass("smart-lookup-review-modal");
    await this.loadDueQueue();
    this.render();
  }

  private async loadDueQueue(): Promise<void> {
    const dueFiles = this.srsService.getDueStudyNotes();
    this.queue = [];

    for (const file of dueFiles) {
      try {
        const text = await this.app.vault.read(file);
        // Extract FAQs from callouts (> [!question]- 1. Question\n> Answer)
        const faqRegex = />\s*\[!question\]-\s*(?:\d+\.\s*)?([^\n]+)\n>\s*([^\n>]+)/g;
        let match;
        let foundQuestions = false;

        // Extract Summary
        const sumMatch = text.match(/>\s*\[!abstract\][^\n]*\n>\s*([^\n]+)/);
        const summary = sumMatch ? sumMatch[1] : "";

        while ((match = faqRegex.exec(text)) !== null) {
          foundQuestions = true;
          this.queue.push({
            file,
            topicTitle: file.basename.replace(/^🧠\s*/, ""),
            question: match[1].trim(),
            answer: match[2].trim(),
            summary,
          });
        }

        // If no questions in callout format, create a general recall question
        if (!foundQuestions && summary) {
          this.queue.push({
            file,
            topicTitle: file.basename.replace(/^🧠\s*/, ""),
            question: `What is the core premise and key mechanisms of ${file.basename}?`,
            answer: summary,
            summary,
          });
        }
      } catch {
        // ignore
      }
    }
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    // 1. Header with Progress Counter & Streak
    const header = contentEl.createDiv({ cls: "smart-lookup-review-header" });
    const titleWrap = header.createDiv({ cls: "smart-lookup-review-title-wrap" });

    const iconSpan = titleWrap.createSpan({ cls: "smart-lookup-review-icon" });
    setIcon(iconSpan, "brain");
    titleWrap.createEl("h2", { text: "Active Recall Spaced Repetition" });

    const streakCount = this.srsService.getReviewStreak();
    header.createSpan({
      cls: "smart-lookup-streak-badge",
      text: `🔥 ${streakCount} Day Streak`,
    });

    if (this.queue.length > 1) {
      header.createSpan({
        cls: "smart-lookup-interleaved-badge",
        text: `🔀 Interleaved`,
        attr: { title: "Cognitive Interleaving active: due topics are mixed to boost flexible classification & retention" },
      });
    }

    header.createSpan({
      cls: "smart-lookup-review-badge",
      text: this.queue.length > 0 ? `Card ${this.currentIndex + 1} of ${this.queue.length}` : "Completed",
    });

    // 2. Main Flashcard Container
    const mainBody = contentEl.createDiv({ cls: "smart-lookup-review-body" });

    if (this.queue.length === 0) {
      this.srsService.recordReviewCompletion();
      const emptyState = mainBody.createDiv({ cls: "smart-lookup-review-empty" });
      const party = emptyState.createSpan({ cls: "smart-lookup-party-icon" });
      setIcon(party, "sparkles");
      emptyState.createEl("h3", { text: "All Caught Up!" });
      emptyState.createEl("p", {
        text: `You completed all reviews for today! Current retention streak: 🔥 ${streakCount || 1} Days.`,
      });

      const closeBtn = emptyState.createEl("button", {
        cls: "smart-lookup-btn smart-lookup-btn-primary",
        text: "Close Session",
      });
      closeBtn.onclick = () => this.close();
      return;
    }

    const currentCard = this.queue[this.currentIndex];

    // Card Box
    const cardBox = mainBody.createDiv({ cls: "smart-lookup-review-card" });
    const topicTag = cardBox.createDiv({ cls: "smart-lookup-review-topic-tag" });
    topicTag.createSpan({ text: `Topic: ${currentCard.topicTitle}` });

    // Question
    const qBox = cardBox.createDiv({ cls: "smart-lookup-review-question-box" });
    qBox.createEl("h3", { text: currentCard.question, cls: "smart-lookup-review-question" });

    // Answer (Hidden until clicked)
    if (this.isAnswerRevealed) {
      const ansBox = cardBox.createDiv({ cls: "smart-lookup-review-answer-box" });
      ansBox.createEl("strong", { text: "Answer & Explanation:" });
      ansBox.createEl("p", { text: currentCard.answer, cls: "smart-lookup-review-answer" });

      if (currentCard.summary && currentCard.summary !== currentCard.answer) {
        ansBox.createEl("p", { text: `Context: ${currentCard.summary}`, cls: "smart-lookup-review-summary-hint" });
      }

      // Rating Action Bar (SM-2 updates)
      const actionRow = cardBox.createDiv({ cls: "smart-lookup-review-actions" });

      const hardBtn = actionRow.createEl("button", {
        cls: "smart-lookup-btn smart-lookup-btn-rating smart-lookup-btn-hard",
        text: "🔴 Hard (1d)",
      });
      hardBtn.onclick = async () => this.recordAndNext(currentCard.file, "hard");

      const goodBtn = actionRow.createEl("button", {
        cls: "smart-lookup-btn smart-lookup-btn-rating smart-lookup-btn-good",
        text: "🟢 Good (Review Later)",
      });
      goodBtn.onclick = async () => this.recordAndNext(currentCard.file, "good");

      const easyBtn = actionRow.createEl("button", {
        cls: "smart-lookup-btn smart-lookup-btn-rating smart-lookup-btn-easy",
        text: "⚡ Easy (Long Interval)",
      });
      easyBtn.onclick = async () => this.recordAndNext(currentCard.file, "easy");
    } else {
      const revealBtn = cardBox.createEl("button", {
        cls: "smart-lookup-btn smart-lookup-btn-primary smart-lookup-reveal-btn",
        text: "💡 Reveal Answer (Spacebar)",
      });
      revealBtn.onclick = () => {
        this.isAnswerRevealed = true;
        this.render();
      };
    }
  }

  private async recordAndNext(file: TFile, rating: "hard" | "good" | "easy"): Promise<void> {
    await this.srsService.recordReview(file, rating);
    this.isAnswerRevealed = false;
    this.currentIndex++;

    if (this.currentIndex >= this.queue.length) {
      this.queue = [];
    }

    this.render();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
