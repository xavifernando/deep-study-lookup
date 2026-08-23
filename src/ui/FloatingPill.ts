import { Platform, setIcon } from "obsidian";
import { positionElementNear, RectBounds } from "../utils/dom";

export interface FloatingPillCallbacks {
  onLookup: (text: string, rect: RectBounds) => void;
  onSolve: (text: string) => void;
  onSummarize: (text: string) => void;
  onSearchWeb: (text: string) => void;
}

export class FloatingPill {
  private el: HTMLElement;
  private callbacks: FloatingPillCallbacks;
  private isVisible = false;
  private currentText = "";
  private currentRect: RectBounds | null = null;

  constructor(callbacks: FloatingPillCallbacks) {
    this.callbacks = callbacks;
    this.el = document.body.createDiv({ cls: "smart-lookup-floating-pill is-hidden" });
    this.el.setAttribute("role", "toolbar");
    this.el.setAttribute("aria-label", "Smart Lookup Quick Actions");
    if (Platform.isMobile) {
      this.el.addClass("smart-lookup-mobile-pill");
    }
  }

  show(text: string, rect: RectBounds): void {
    this.currentText = text.trim();
    this.currentRect = rect;
    this.el.empty();
    this.el.removeClass("is-hidden");
    this.isVisible = true;

    const isEquation = this.detectIfEquation(this.currentText);
    const wordCount = this.currentText.split(/\s+/).length;

    if (isEquation) {
      // 1. Math / Scientific Equation detected
      this.createPillBtn("calculator", "🧮 Solve", () => {
        this.callbacks.onSolve(this.currentText);
        this.hide();
      }, true);

      this.createPillBtn("search", "🔍 Lookup", () => {
        this.callbacks.onLookup(this.currentText, rect);
        this.hide();
      });
    } else if (wordCount > 6 || this.currentText.includes("\n")) {
      // 2. Paragraph or Multi-sentence passage detected
      this.createPillBtn("sparkles", "📌 Summarize", () => {
        this.callbacks.onSummarize(this.currentText);
        this.hide();
      }, true);

      this.createPillBtn("search", "🌐 Google", () => {
        this.callbacks.onSearchWeb(this.currentText);
        this.hide();
      });

      this.createPillBtn("book-open", "🔍 Lookup", () => {
        this.callbacks.onLookup(this.currentText, rect);
        this.hide();
      });
    } else {
      // 3. Concept / Vocabulary Word
      this.createPillBtn("search", "🔍 Smart Lookup", () => {
        this.callbacks.onLookup(this.currentText, rect);
        this.hide();
      }, true);

      if (/[0-9+\-*^=/]/.test(this.currentText)) {
        this.createPillBtn("calculator", "🧮 Solve", () => {
          this.callbacks.onSolve(this.currentText);
          this.hide();
        });
      }
    }

    positionElementNear(this.el, rect, { offset: 6, preferBelow: true });
  }

  private createPillBtn(iconName: string, label: string, onClick: () => void, isPrimary = false): HTMLElement {
    const btn = this.el.createEl("button", {
      cls: `smart-lookup-btn smart-lookup-btn-sm smart-lookup-pill-action-btn ${isPrimary ? "smart-lookup-pill-btn-accent" : ""}`,
    });
    btn.setAttribute("role", "button");
    btn.setAttribute("aria-label", label);

    const iconSpan = btn.createSpan({ cls: "smart-lookup-pill-icon" });
    setIcon(iconSpan, iconName);
    btn.createSpan({ text: label });

    const handleAction = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    };

    btn.addEventListener("mousedown", handleAction);
    btn.addEventListener("touchend", handleAction);

    return btn;
  }

  private detectIfEquation(text: string): boolean {
    const t = text.trim();
    if (/([+-]?\d*\.?\d*)\s*\*?\s*x\^2/i.test(t)) return true;
    if (/[=><]\s*0/i.test(t)) return true;
    if (/(d\/dx|derivative|integral|integrate|∫|sqrt\()/i.test(t)) return true;
    if (/^\s*[\d.()+\-*/^\s]+\s*$/.test(t) && /[+\-*/^]/.test(t)) return true;
    if (/(km\/h|miles to km|m\/s|molar mass|pH of)/i.test(t)) return true;
    return false;
  }

  hide(): void {
    if (!this.isVisible) return;
    this.el.addClass("is-hidden");
    this.isVisible = false;
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }

  destroy(): void {
    this.el.remove();
  }
}
