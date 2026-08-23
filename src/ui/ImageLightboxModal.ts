import { Notice, setIcon } from "obsidian";
import { ImageResult } from "../types";

export class ImageLightboxModal {
  private overlayEl: HTMLElement;
  private cardEl: HTMLElement;
  private currentImage: ImageResult | null = null;
  private onInsertCallback?: (image: ImageResult) => void;

  constructor() {
    this.overlayEl = document.createElement("div");
    this.overlayEl.addClass("smart-lookup-lightbox-overlay");
    this.overlayEl.style.display = "none";

    this.cardEl = this.overlayEl.createDiv({ cls: "smart-lookup-lightbox-card" });
    document.body.appendChild(this.overlayEl);

    this.overlayEl.addEventListener("click", (e) => {
      if (e.target === this.overlayEl) {
        this.hide();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (this.overlayEl.style.display !== "none" && e.key === "Escape") {
        this.hide();
      }
    });
  }

  show(image: ImageResult, onInsert?: (image: ImageResult) => void): void {
    this.currentImage = image;
    this.onInsertCallback = onInsert;
    this.cardEl.empty();

    // 1. Header with Title and Close
    const header = this.cardEl.createDiv({ cls: "smart-lookup-lightbox-header" });
    header.createEl("h3", { text: image.title || "Image Preview", cls: "smart-lookup-lightbox-title" });

    const closeBtn = header.createEl("button", { cls: "smart-lookup-icon-btn smart-lookup-lightbox-close" });
    setIcon(closeBtn, "x");
    closeBtn.onclick = () => this.hide();

    // 2. Large Image View Container
    const imgWrap = this.cardEl.createDiv({ cls: "smart-lookup-lightbox-img-wrap" });
    const imgEl = imgWrap.createEl("img", {
      attr: {
        src: image.url,
        alt: image.title,
      },
    });

    // 3. Metadata & Action Bar
    const footer = this.cardEl.createDiv({ cls: "smart-lookup-lightbox-footer" });
    const metaWrap = footer.createDiv({ cls: "smart-lookup-lightbox-meta" });
    if (image.author) {
      metaWrap.createSpan({ text: `Author: ${image.author} • ` });
    }
    metaWrap.createSpan({ text: `Source: ${image.source || "Web"}` });

    const actionsWrap = footer.createDiv({ cls: "smart-lookup-lightbox-actions" });

    // Insert Button
    const insertBtn = actionsWrap.createEl("button", {
      cls: "smart-lookup-btn smart-lookup-btn-primary",
      text: "Insert into Note",
    });
    setIcon(insertBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "file-plus");
    insertBtn.onclick = () => {
      if (this.onInsertCallback && this.currentImage) {
        this.onInsertCallback(this.currentImage);
        new Notice(`Inserted image "${this.currentImage.title}"`);
        this.hide();
      }
    };

    // Copy Link Button
    const copyBtn = actionsWrap.createEl("button", {
      cls: "smart-lookup-btn",
      text: "Copy Markdown",
    });
    setIcon(copyBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "copy");
    copyBtn.onclick = async () => {
      if (this.currentImage) {
        const md = `![${this.currentImage.title}](${this.currentImage.url})`;
        await navigator.clipboard.writeText(md);
        new Notice("Image markdown copied to clipboard!");
      }
    };

    this.overlayEl.style.display = "flex";
  }

  hide(): void {
    this.overlayEl.style.display = "none";
    this.currentImage = null;
  }

  destroy(): void {
    this.hide();
    this.overlayEl.remove();
  }
}
