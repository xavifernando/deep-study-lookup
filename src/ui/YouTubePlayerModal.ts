import { App, Modal, Notice, setIcon } from "obsidian";
import { YouTubeService, YouTubeVideoResult } from "../services/video/YouTubeService";

export class YouTubePlayerModal extends Modal {
  private service: YouTubeService;
  private currentQuery: string;
  private videos: YouTubeVideoResult[] = [];
  private activeVideo: YouTubeVideoResult | null = null;
  private isLoading = false;
  private onInsertMarkdown: (md: string) => void;

  constructor(app: App, initialQuery: string, onInsertMarkdown: (md: string) => void) {
    super(app);
    this.currentQuery = initialQuery;
    this.onInsertMarkdown = onInsertMarkdown;
    this.service = new YouTubeService();
  }

  onOpen() {
    this.modalEl.addClass("smart-lookup-youtube-modal");
    this.render();
    if (this.currentQuery) {
      this.doSearch(this.currentQuery);
    }
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    // 1. Header with Search Input
    const header = contentEl.createDiv({ cls: "smart-lookup-yt-header" });
    const titleRow = header.createDiv({ cls: "smart-lookup-yt-title-row" });

    const ytIcon = titleRow.createSpan({ cls: "smart-lookup-yt-icon" });
    setIcon(ytIcon, "video");
    titleRow.createEl("h2", { text: "Video Tutorials & Explainers" });

    const searchRow = header.createDiv({ cls: "smart-lookup-yt-search-row" });
    const input = searchRow.createEl("input", {
      type: "text",
      value: this.currentQuery,
      placeholder: "Search tutorials, medical lectures, animations...",
      cls: "smart-lookup-yt-search-input",
    });

    const searchBtn = searchRow.createEl("button", {
      text: "Search Videos",
      cls: "smart-lookup-btn smart-lookup-btn-primary",
    });
    setIcon(searchBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "search");

    const triggerSearch = () => {
      const q = input.value.trim();
      if (q) {
        this.currentQuery = q;
        this.activeVideo = null;
        this.doSearch(q);
      }
    };

    searchBtn.onclick = triggerSearch;
    input.onkeydown = (e) => {
      if (e.key === "Enter") triggerSearch();
    };

    // 2. Main Scrollable Container
    const mainBody = contentEl.createDiv({ cls: "smart-lookup-yt-main-body" });

    if (this.isLoading) {
      const loading = mainBody.createDiv({ cls: "smart-lookup-yt-loading" });
      const spinner = loading.createSpan({ cls: "smart-lookup-spinner" });
      setIcon(spinner, "loader");
      loading.createSpan({ text: "Finding top tutorial videos and animations..." });
      return;
    }

    // 3. Active Embedded Player (if a video is selected)
    if (this.activeVideo) {
      this.renderPlayerSection(mainBody, this.activeVideo);
    }

    // 4. Video Recommendations Grid
    this.renderVideoGrid(mainBody);
  }

  private async doSearch(query: string): Promise<void> {
    this.isLoading = true;
    this.render();
    try {
      this.videos = await this.service.searchVideos(query);
      if (this.videos.length > 0 && !this.activeVideo) {
        this.activeVideo = this.videos[0];
      }
    } catch (err) {
      new Notice(`Video search notice: ${(err as Error).message}`);
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  private renderPlayerSection(container: HTMLElement, video: YouTubeVideoResult): void {
    const playerBox = container.createDiv({ cls: "smart-lookup-yt-player-box" });

    // Embedded Responsive IFrame
    const iframeWrap = playerBox.createDiv({ cls: "smart-lookup-yt-iframe-wrap" });
    const iframe = iframeWrap.createEl("iframe", {
      attr: {
        src: `https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0`,
        title: video.title,
        frameborder: "0",
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
        allowfullscreen: "true",
      },
    });

    // Video Info & Note Insertion Actions
    const playerFooter = playerBox.createDiv({ cls: "smart-lookup-yt-player-footer" });
    const metaWrap = playerFooter.createDiv({ cls: "smart-lookup-yt-player-meta" });

    metaWrap.createEl("h3", { text: video.title, cls: "smart-lookup-yt-player-title" });
    const subLine = metaWrap.createDiv({ cls: "smart-lookup-yt-player-sub" });
    subLine.createSpan({ text: `Channel: ${video.channelName}` });
    if (video.viewCount) subLine.createSpan({ text: ` • ${video.viewCount}` });
    if (video.duration) subLine.createSpan({ text: ` • ${video.duration}` });

    const actionsWrap = playerFooter.createDiv({ cls: "smart-lookup-yt-player-actions" });

    // 1. Embed in Active Note
    const embedBtn = actionsWrap.createEl("button", {
      cls: "smart-lookup-btn smart-lookup-btn-primary",
      text: "Embed Video in Note",
    });
    setIcon(embedBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "file-plus");
    embedBtn.onclick = () => {
      const md = `\n\n### 📺 Tutorial: ${video.title}\n<iframe width="100%" height="340" src="https://www.youtube-nocookie.com/embed/${video.videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>\n*Source: [${video.channelName} on YouTube](https://www.youtube.com/watch?v=${video.videoId})*\n\n`;
      this.onInsertMarkdown(md);
      new Notice(`Embedded "${video.title}" into active note!`);
    };

    // 2. Copy Video Link
    const copyBtn = actionsWrap.createEl("button", {
      cls: "smart-lookup-btn",
      text: "Copy Video Link",
    });
    setIcon(copyBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "copy");
    copyBtn.onclick = async () => {
      const url = `https://www.youtube.com/watch?v=${video.videoId}`;
      await navigator.clipboard.writeText(url);
      new Notice("YouTube URL copied to clipboard!");
    };
  }

  private renderVideoGrid(container: HTMLElement): void {
    if (this.videos.length === 0 && !this.isLoading) {
      const empty = container.createDiv({ cls: "smart-lookup-yt-empty" });
      empty.createEl("p", { text: "No videos found. Try searching for a specific topic, concept or lecture keyword." });
      return;
    }

    const sectionTitle = container.createDiv({ cls: "smart-lookup-yt-grid-title" });
    sectionTitle.createEl("h4", { text: "Related Tutorial Videos & Animations:" });

    const grid = container.createDiv({ cls: "smart-lookup-yt-video-grid" });

    this.videos.forEach((v) => {
      const isCurrent = this.activeVideo?.videoId === v.videoId;
      const card = grid.createDiv({ cls: `smart-lookup-yt-card ${isCurrent ? "is-active" : ""}` });

      const thumbWrap = card.createDiv({ cls: "smart-lookup-yt-thumb-wrap" });
      thumbWrap.createEl("img", {
        attr: {
          src: v.thumbnailUrl,
          alt: v.title,
          loading: "lazy",
        },
      });

      if (v.duration) {
        thumbWrap.createSpan({ text: v.duration, cls: "smart-lookup-yt-duration-badge" });
      }

      const cardInfo = card.createDiv({ cls: "smart-lookup-yt-card-info" });
      cardInfo.createEl("h5", { text: v.title, cls: "smart-lookup-yt-card-title" });
      cardInfo.createEl("p", { text: v.channelName, cls: "smart-lookup-yt-card-channel" });

      card.onclick = () => {
        this.activeVideo = v;
        this.render();
      };
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
