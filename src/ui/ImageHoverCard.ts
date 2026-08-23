import { ImageResult } from "../types";

export class ImageHoverCard {
  private el: HTMLElement;
  private currentImage: ImageResult | null = null;
  private hideTimeout: number | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.addClass("smart-lookup-image-hover-card");
    this.el.style.display = "none";
    document.body.appendChild(this.el);

    this.el.addEventListener("mouseenter", () => {
      if (this.hideTimeout) {
        window.clearTimeout(this.hideTimeout);
        this.hideTimeout = null;
      }
    });

    this.el.addEventListener("mouseleave", () => {
      this.hide();
    });
  }

  show(image: ImageResult, targetRect: DOMRect): void {
    if (this.hideTimeout) {
      window.clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    this.currentImage = image;
    this.el.empty();

    const imgContainer = this.el.createDiv({ cls: "smart-lookup-hover-img-wrap" });
    const img = imgContainer.createEl("img", {
      attr: {
        src: image.url,
        alt: image.title,
      },
    });

    const info = this.el.createDiv({ cls: "smart-lookup-hover-info" });
    info.createEl("div", { cls: "smart-lookup-hover-title", text: image.title });
    
    if (image.author || image.source) {
      const meta = info.createEl("div", { cls: "smart-lookup-hover-meta" });
      if (image.author) {
        meta.createSpan({ text: `By ${image.author} • ` });
      }
      meta.createSpan({ text: `Source: ${image.source}` });
    }

    this.el.style.display = "flex";

    // Position adjacent to thumbnail
    const cardWidth = 300;
    const cardHeight = 240;
    let left = targetRect.left;
    let top = targetRect.top - cardHeight - 12;

    if (top < 16) {
      top = targetRect.bottom + 12;
    }
    if (left + cardWidth > window.innerWidth - 16) {
      left = window.innerWidth - cardWidth - 16;
    }
    if (left < 16) left = 16;

    this.el.style.left = `${Math.round(left)}px`;
    this.el.style.top = `${Math.round(top)}px`;
  }

  scheduleHide(delay = 150): void {
    if (this.hideTimeout) window.clearTimeout(this.hideTimeout);
    this.hideTimeout = window.setTimeout(() => {
      this.hide();
    }, delay);
  }

  hide(): void {
    this.el.style.display = "none";
    this.currentImage = null;
  }

  destroy(): void {
    if (this.hideTimeout) window.clearTimeout(this.hideTimeout);
    this.el.remove();
  }
}
