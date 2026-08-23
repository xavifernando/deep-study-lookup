import { App, Editor, Notice, Platform, setCssStyles, setIcon } from "obsidian";
import {
  AIExplanationResult,
  DictionaryEntry,
  ImageResult,
  InsertFormatType,
  PluginSettings,
  RESEARCH_ENGINES,
  StudyNoteResult,
  SUPPORTED_LANGUAGES,
  TranslationResult,
} from "../types";
import { AudioPlayer } from "../utils/audio";
import { positionElementNear, RectBounds } from "../utils/dom";
import { formatDefinitionByStyle, formatImageMarkdown } from "../utils/markdown";
import { ImageHoverCard } from "./ImageHoverCard";
import { ImageLightboxModal } from "./ImageLightboxModal";
import { AnkiDeckModal } from "./AnkiDeckModal";
import { AnkiConnectClient } from "../services/anki/AnkiConnectClient";
import { WolframResult } from "../types";

export interface PopoverCallbacks {
  onAskAI?: (word: string, contextSentence?: string) => Promise<AIExplanationResult | null>;
  onAskAIWithComplexity?: (word: string, contextSentence?: string, level?: "eli5" | "practical" | "expert") => Promise<AIExplanationResult | null>;
  onTranslate?: (word: string, targetLang: string) => Promise<TranslationResult | null>;
  onGenerateStudyPack?: (word: string, contextSentence?: string) => Promise<StudyNoteResult>;
  onCreateStudyNote?: (studyPack: StudyNoteResult, contextSentence?: string) => Promise<string>;
  onCompare?: (conceptA: string, conceptB: string) => Promise<string>;
  onGenerateQuiz?: (term: string) => Promise<string>;
  onFindVaultMentions?: (term: string) => Promise<{ basename: string; path: string }[]>;
  onAddToAnki?: (entry: DictionaryEntry, translation?: string, image?: ImageResult | null, contextSentence?: string, deckName?: string) => Promise<number | void>;
  onAddStudyCardsToAnki?: (studyPack: StudyNoteResult) => Promise<number>;
  onSaveToVocabLog?: (entry: DictionaryEntry, translation?: string, contextSentence?: string) => Promise<void>;
  onAppendSummaryToNote?: (summaryMd: string) => void;
  onInsertMarkdown?: (markdown: string, replaceSelection?: boolean) => void;
  onNavigateWord?: (word: string) => void;
  onOpenWebReader?: (query: string) => void;
  onOpenVideoPlayer?: (query: string) => void;
  onOpenDeepResearch?: (engine: string, query: string) => void;
  onCreateCanvas?: (studyPack: StudyNoteResult) => Promise<string>;
  onSolveWolfram?: (query: string) => Promise<WolframResult>;
  onOpenWolframSolver?: (query: string) => void;
  onOpenChat?: (topic: string, contextSentence?: string) => void;
  onOpenYouTubeSummary?: (queryOrUrl: string) => void;
  onHide?: () => void;
}

export class LookupPopover {
  private app: App;
  private el: HTMLElement;
  private imageHoverCard: ImageHoverCard;
  private lightboxModal: ImageLightboxModal;
  private settings: PluginSettings;
  private isVisible = false;
  private isResearchDrawerOpen = false;
  private currentEntry: DictionaryEntry | null = null;
  private currentImages: ImageResult[] = [];
  private currentAiResult: AIExplanationResult | null = null;
  private currentStudyPack: StudyNoteResult | null = null;
  private currentTranslation: TranslationResult | null = null;
  private callbacks: PopoverCallbacks;
  private activeEditor: Editor | null = null;
  private contextSentence: string = "";
  private currentTerm: string = "";
  private lastAnchorRect: RectBounds | null = null;
  private selectedTargetLang: string;
  private history: string[] = [];
  private boundDocClick: (e: MouseEvent) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private popoverStartX = 0;
  private popoverStartY = 0;

  private ankiClient?: AnkiConnectClient;
  private selectedAnkiDeck = "";

  constructor(app: App, settings: PluginSettings, callbacks: PopoverCallbacks, ankiClient?: AnkiConnectClient) {
    this.app = app;
    this.settings = settings;
    this.callbacks = callbacks;
    this.ankiClient = ankiClient;
    this.imageHoverCard = new ImageHoverCard();
    this.lightboxModal = new ImageLightboxModal();
    this.selectedTargetLang = settings.defaultTargetLanguage || "es";
    this.selectedAnkiDeck = settings.ankiDeckName || "Default";

    this.boundDocClick = this.handleDocumentClick.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);

    this.el = document.body.createDiv({ cls: "smart-lookup-popover is-hidden" });
    this.el.setAttribute("role", "dialog");
    this.el.setAttribute("aria-label", "Smart Lookup Definition");
    if (Platform.isMobile) {
      this.el.addClass("smart-lookup-mobile-popover");
    }

    document.addEventListener("mousedown", this.boundDocClick);
    document.addEventListener("keydown", this.boundKeyDown);
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
    this.selectedTargetLang = settings.defaultTargetLanguage || "es";
  }

  private handleDocumentClick(e: MouseEvent): void {
    if (!this.isVisible || this.isDragging) return;
    const target = e.target as HTMLElement;
    if (this.el.contains(target)) return;

    // Do NOT close lookup popover if user is interacting with any modal or sub-window
    if (
      target.closest(
        ".modal-container, .modal-bg, .modal, .smart-lookup-wolfram-modal, .smart-lookup-youtube-modal, .smart-lookup-anki-modal, .smart-lookup-paragraph-modal, .smart-lookup-pdf-modal, .smart-lookup-floating-pill, .smart-lookup-image-hover-card, .smart-lookup-insert-menu, .smart-lookup-pdf-float-menu"
      )
    ) {
      return;
    }

    this.hide();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible) return;

    if (e.key === "Escape") {
      e.preventDefault();
      this.hide();
      return;
    }

    const hasModifier = (e.ctrlKey || e.metaKey) && e.shiftKey;
    if (!hasModifier) return;

    const key = e.key.toLowerCase();
    if (key === "a") {
      e.preventDefault();
      const ankiBtn = this.el.querySelector(".smart-lookup-btn-anki") as HTMLButtonElement;
      ankiBtn?.click();
    } else if (key === "l") {
      e.preventDefault();
      const logBtn = this.el.querySelector(".smart-lookup-btn-log") as HTMLButtonElement;
      logBtn?.click();
    } else if (key === "i") {
      e.preventDefault();
      const insertBtn = this.el.querySelector(".smart-lookup-btn-primary") as HTMLButtonElement;
      if (insertBtn && this.currentEntry) {
        this.openInsertMenu(insertBtn, this.currentEntry);
      }
    } else if (key === "w") {
      e.preventDefault();
      if (this.currentTerm && this.callbacks.onOpenWolframSolver) {
        this.callbacks.onOpenWolframSolver(this.currentTerm);
      }
    } else if (key === "s") {
      e.preventDefault();
      const studyBtn = this.el.querySelector(".smart-lookup-study-btn") as HTMLButtonElement;
      studyBtn?.click();
    }
  }

  showLoading(word: string, anchorRect: RectBounds): void {
    this.isVisible = true;
    this.lastAnchorRect = anchorRect;
    this.currentTerm = word;
    this.currentAiResult = null;
    this.currentStudyPack = null;
    this.currentTranslation = null;
    this.el.empty();
    this.el.removeClass("is-hidden");

    const header = this.el.createDiv({ cls: "smart-lookup-header" });
    this.initDragHandling(header);
    header.createEl("h3", { text: word, cls: "smart-lookup-word-title" });

    const closeBtn = header.createEl("button", { cls: "smart-lookup-icon-btn smart-lookup-close-btn" });
    setIcon(closeBtn, "x");
    closeBtn.onclick = () => this.hide();

    const loadingDiv = this.el.createDiv({ cls: "smart-lookup-loading" });
    const spinner = loadingDiv.createSpan({ cls: "smart-lookup-spinner" });
    setIcon(spinner, "loader");
    loadingDiv.createSpan({ text: "Searching definition & visuals...", cls: "smart-lookup-loading-text" });

    positionElementNear(this.el, anchorRect, { offset: 8, preferBelow: true });
  }

  private activeTab: "meaning" | "flowchart" | "visual" = "meaning";

  render(
    entry: DictionaryEntry | null,
    images: ImageResult[],
    anchorRect: RectBounds,
    editor?: Editor,
    contextSentence = ""
  ): void {
    this.lastAnchorRect = anchorRect;
    this.activeEditor = editor || null;
    this.contextSentence = contextSentence;
    this.currentEntry = entry;
    this.currentImages = images;
    this.currentAiResult = null;
    this.currentStudyPack = null;
    this.currentTranslation = null;
    this.isVisible = true;

    const currentWord = entry?.word || this.currentTerm;
    if (currentWord && (!this.history.length || this.history[this.history.length - 1] !== currentWord)) {
      this.history.push(currentWord);
    }

    this.el.empty();
    this.el.removeClass("is-hidden");

    // 1. Header (Title, Phonetics, Socratic Chat, Wolfram, Audio, Close)
    this.renderHeader(entry);

    // 2. Image Thumbnails Bar
    if (this.settings.showImages && images.length > 0) {
      this.renderImageBar(images);
    }

    // 3. Scrollable Main Body (Definitions, Web Research with Wolfram & YouTube, Translator, Study Notes, Vault Mentions)
    const body = this.el.createDiv({ cls: "smart-lookup-body" });
    this.renderActiveTabContent(body, entry, images);

    // 4. Sticky Pinned Action Footer (Log, Dropdown Anki, Insert Formats, Copy)
    this.renderFooter(this.el, entry || {
      word: this.currentTerm,
      phonetics: [],
      meanings: [{ partOfSpeech: "concept", definitions: [{ definition: `Concept: ${this.currentTerm}`, synonyms: [], antonyms: [] }], synonyms: [], antonyms: [] }]
    });

    // Dynamic Viewport Repositioning
    positionElementNear(this.el, anchorRect, { offset: 8, preferBelow: true });

    // Auto-play audio if configured
    if (this.settings.autoPlayAudio && entry?.phonetics) {
      this.playAudio();
    }
  }

  private renderHeader(entry: DictionaryEntry | null): void {
    const header = this.el.createDiv({ cls: "smart-lookup-header" });
    this.initDragHandling(header);
    const titleWrap = header.createDiv({ cls: "smart-lookup-title-wrap" });

    // Drag Grip Icon
    const dragGrip = titleWrap.createSpan({ cls: "smart-lookup-drag-handle", attr: { title: "Drag to move" } });
    setIcon(dragGrip, "grip-vertical");

    if (this.history.length > 1) {
      const backBtn = titleWrap.createEl("button", {
        cls: "smart-lookup-icon-btn smart-lookup-back-btn",
        attr: { title: "Back to previous word" },
      });
      setIcon(backBtn, "arrow-left");
      backBtn.onclick = () => {
        this.history.pop();
        const prev = this.history.pop();
        if (prev && this.callbacks.onNavigateWord) {
          this.callbacks.onNavigateWord(prev);
        }
      };
    }

    const word = entry?.word || this.currentTerm || "Lookup";
    titleWrap.createEl("h3", { text: word, cls: "smart-lookup-word-title" });

    if (entry?.phonetic) {
      titleWrap.createSpan({ text: entry.phonetic, cls: "smart-lookup-phonetic" });
    }

    if (entry?.difficultyLevel) {
      titleWrap.createSpan({
        text: entry.difficultyLevel,
        cls: "smart-lookup-difficulty-badge",
      });
    }

    const actionsWrap = header.createDiv({ cls: "smart-lookup-header-actions" });

    // Pronunciation Audio Button
    const audioBtn = actionsWrap.createEl("button", {
      cls: "smart-lookup-icon-btn",
      attr: { title: "Listen (Spacebar)" },
    });
    setIcon(audioBtn, "volume-2");
    audioBtn.onclick = () => this.playAudio();

    // Close Button
    const closeBtn = actionsWrap.createEl("button", {
      cls: "smart-lookup-icon-btn smart-lookup-close-btn",
      attr: { title: "Close (Esc)" },
    });
    setIcon(closeBtn, "x");
    closeBtn.onclick = () => this.hide();
  }

  private renderActiveTabContent(body: HTMLElement, entry: DictionaryEntry | null, images: ImageResult[]): void {
    const term = entry?.word || this.currentTerm;

    // 1. Definitions & Meanings
    if (entry && entry.meanings && entry.meanings.length > 0) {
      this.renderDefinitions(body, entry);
    } else {
      const notFound = body.createDiv({ cls: "smart-lookup-not-found" });
      notFound.createEl("p", { text: `Concept analysis for "${term}"` });
    }

    // 2. Multi-Engine Web Research Quick-Bar (Perplexity, Wikipedia, ScienceDirect, PubMed, Scholar, YouTube, Reddit)
    if (this.settings.enableResearchBar) {
      this.renderResearchBar(body, term);
    }

    // 3. Multi-Language Translator Section
    if (this.settings.enableTranslation) {
      this.renderTranslatorSection(body, term);
    }

    // 4. Deep-Dive Study Notes & FAQs Section (Feynman, Cue Questions, Canvas, Note creation)
    if (this.settings.enableStudyNotes) {
      this.renderStudyNoteSection(body, term);
    }

    // 5. In-Vault Backlinks & Mentions Explorer
    this.renderVaultMentions(body, term);
  }

  private playAudio(): void {
    const audioPhonetic = this.currentEntry?.phonetics?.find((p) => p.audio);
    const text = this.currentEntry?.word || this.currentTerm;
    AudioPlayer.playOrSpeak(text, audioPhonetic?.audio, this.settings.accentDialect);
  }

  private renderImageBar(images: ImageResult[]): void {
    const bar = this.el.createDiv({ cls: "smart-lookup-image-bar" });

    images.forEach((img) => {
      const item = bar.createDiv({ cls: "smart-lookup-image-thumb" });
      item.createEl("img", {
        attr: {
          src: img.thumbUrl || img.url,
          alt: img.title,
          loading: "lazy",
        },
      });

      item.addEventListener("mouseenter", () => {
        const rect = item.getBoundingClientRect();
        this.imageHoverCard.show(img, rect);
      });

      item.addEventListener("mouseleave", () => {
        this.imageHoverCard.hide();
      });

      item.onclick = () => {
        this.imageHoverCard.hide();
        this.lightboxModal.show(img, (template) => {
          const md = formatImageMarkdown(img, template || this.settings.imageInsertTemplate);
          this.insertOrCopyMarkdown(md, `Inserted image "${img.title}"`);
        });
      };
    });
  }

  private renderDefinitions(container: HTMLElement, entry: DictionaryEntry): void {
    const section = container.createDiv({ cls: "smart-lookup-section smart-lookup-meanings" });

    entry.meanings.forEach((meaning) => {
      const meaningBlock = section.createDiv({ cls: "smart-lookup-meaning-block" });

      const posHeader = meaningBlock.createDiv({ cls: "smart-lookup-pos-header" });
      posHeader.createSpan({ cls: "smart-lookup-pos-badge", text: meaning.partOfSpeech });

      meaning.definitions.slice(0, 3).forEach((def, index) => {
        const defRow = meaningBlock.createDiv({ cls: "smart-lookup-def-row" });
        defRow.createEl("span", { cls: "smart-lookup-def-num", text: `${index + 1}.` });

        const textWrap = defRow.createDiv({ cls: "smart-lookup-def-text-wrap" });
        textWrap.createSpan({ cls: "smart-lookup-def-text", text: def.definition });

        if (def.example) {
          const eg = textWrap.createDiv({ cls: "smart-lookup-def-example" });
          eg.createSpan({ text: `“${def.example}”` });
        }
      });

      if (meaning.synonyms && meaning.synonyms.length > 0) {
        const synWrap = meaningBlock.createDiv({ cls: "smart-lookup-synonyms-wrap" });
        synWrap.createSpan({ text: "Synonyms: ", cls: "smart-lookup-syn-label" });

        meaning.synonyms.slice(0, 6).forEach((syn) => {
          const chip = synWrap.createSpan({ text: syn, cls: "smart-lookup-syn-chip" });
          chip.onclick = () => {
            if (this.callbacks.onNavigateWord) {
              this.callbacks.onNavigateWord(syn);
            }
          };
        });
      }
    });
  }

  // --- Minimalist Research Icon Ribbon (Wolfram, YouTube, Perplexity, Wikipedia, ScienceDirect, PubMed, Scholar, Reddit) ---
  private renderResearchBar(container: HTMLElement, term: string): void {
    if (!this.settings.enableResearchBar) return;

    const row = container.createDiv({ cls: "smart-lookup-research-ribbon" });
    
    const titleWrap = row.createDiv({ cls: "smart-lookup-ribbon-label" });
    const compIcon = titleWrap.createSpan({ cls: "smart-lookup-ribbon-compass" });
    setIcon(compIcon, "globe");
    titleWrap.createSpan({ text: "Web Research:" });

    const iconsWrap = row.createDiv({ cls: "smart-lookup-ribbon-icons" });

    RESEARCH_ENGINES.forEach((eng) => {
      const btn = iconsWrap.createEl("button", {
        cls: "smart-lookup-ribbon-btn",
        attr: { title: `Search / Compute in ${eng.name}` },
      });
      const iconSpan = btn.createSpan({ cls: "smart-lookup-ribbon-icon-inner" });
      setIcon(iconSpan, eng.icon);

      btn.onclick = () => {
        if (eng.id === "wolfram") {
          if (this.callbacks.onOpenWolframSolver) {
            this.callbacks.onOpenWolframSolver(term);
          } else {
            this.displayWolframSolver(container, term);
          }
        } else if (eng.id === "youtube") {
          if (this.callbacks.onOpenVideoPlayer) {
            this.callbacks.onOpenVideoPlayer(term);
          } else {
            const url = eng.urlTemplate.replace("{{query}}", encodeURIComponent(term));
            window.open(url, "_blank");
          }
        } else {
          const url = eng.urlTemplate.replace("{{query}}", encodeURIComponent(term));
          window.open(url, "_blank");
        }
      };
    });
  }

  public async displayWolframSolver(container: HTMLElement, query: string): Promise<void> {
    const existing = container.querySelector(".smart-lookup-wolfram-box");
    if (existing) existing.remove();

    const wolframBox = container.createDiv({ cls: "smart-lookup-wolfram-box" });
    const header = wolframBox.createDiv({ cls: "smart-lookup-ai-header" });
    const titleSpan = header.createSpan({ cls: "smart-lookup-ai-title" });
    const calcIcon = titleSpan.createSpan({ cls: "smart-lookup-ai-icon" });
    setIcon(calcIcon, "calculator");
    titleSpan.createSpan({ text: `Wolfram|Alpha Problem Solver: ${query}` });

    const contentBox = wolframBox.createDiv({ cls: "smart-lookup-ai-content" });
    contentBox.createSpan({ text: "Computing solution and step-by-step breakdown...", cls: "smart-lookup-trans-loading" });

    try {
      if (this.callbacks.onSolveWolfram) {
        const res = await this.callbacks.onSolveWolfram(query);
        contentBox.empty();

        const solP = contentBox.createEl("p", { cls: "smart-lookup-wolfram-solution" });
        solP.createEl("strong", { text: "Solution: " });
        solP.createSpan({ text: res.solution });

        if (res.steps && res.steps.length > 0) {
          const stepsDiv = contentBox.createDiv({ cls: "smart-lookup-wolfram-steps" });
          stepsDiv.createEl("h5", { text: "🪜 Step-by-Step Breakdown:" });
          const ol = stepsDiv.createEl("ol");
          res.steps.forEach((s) => ol.createEl("li", { text: s }));
        }

        const actionRow = contentBox.createDiv({ cls: "smart-lookup-study-action-row" });

        const insertBtn = actionRow.createEl("button", {
          cls: "smart-lookup-btn smart-lookup-btn-primary",
          text: "📥 Insert in Note",
        });
        setIcon(insertBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "file-plus");
        insertBtn.onclick = () => {
          if (this.callbacks.onInsertMarkdown) {
            this.callbacks.onInsertMarkdown(res.markdownFormatted, false);
            new Notice("Inserted Wolfram solution into note!");
          }
        };

        const studyBtn = actionRow.createEl("button", {
          cls: "smart-lookup-btn",
          text: "📚 Add to Study Note",
        });
        setIcon(studyBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "book-open");
        studyBtn.onclick = () => {
          if (this.callbacks.onAppendSummaryToNote) {
            this.callbacks.onAppendSummaryToNote(`\n\n### 🧮 Wolfram Solution: ${res.query}\n> **Direct Answer**: ${res.solution}\n\n${res.markdownFormatted}\n`);
            new Notice("Added Wolfram solution to Study Note!");
          }
        };

        const webBtn = actionRow.createEl("button", {
          cls: "smart-lookup-btn",
          text: "🌐 Open in Web",
        });
        webBtn.onclick = () => {
          window.open(`https://www.wolframalpha.com/input?i=${encodeURIComponent(query)}`, "_blank");
        };
      }
    } catch (err) {
      contentBox.setText(`Wolfram solver error: ${(err as Error).message}`);
    }
  }

  // --- Translator Section ---
  private renderTranslatorSection(container: HTMLElement, textToTranslate: string): void {
    const transBox = container.createDiv({ cls: "smart-lookup-trans-box" });
    const transHeader = transBox.createDiv({ cls: "smart-lookup-trans-header" });

    const titleSpan = transHeader.createSpan({ cls: "smart-lookup-trans-title" });
    const globeIcon = titleSpan.createSpan({ cls: "smart-lookup-trans-icon" });
    setIcon(globeIcon, "languages");
    titleSpan.createSpan({ text: "Translate" });

    const select = transHeader.createEl("select", { cls: "smart-lookup-lang-select" });
    SUPPORTED_LANGUAGES.forEach((lang) => {
      const opt = select.createEl("option", { text: lang.name, value: lang.code });
      if (lang.code === this.selectedTargetLang) {
        opt.selected = true;
      }
    });

    const transContent = transBox.createDiv({ cls: "smart-lookup-trans-content" });

    const doTranslate = async (langCode: string) => {
      this.selectedTargetLang = langCode;
      transContent.empty();
      transContent.createSpan({ text: "Translating...", cls: "smart-lookup-trans-loading" });

      if (this.callbacks.onTranslate) {
        const res = await this.callbacks.onTranslate(textToTranslate, langCode);
        transContent.empty();
        if (res && res.translatedText) {
          this.currentTranslation = res;
          const resultRow = transContent.createDiv({ cls: "smart-lookup-trans-result-row" });
          resultRow.createSpan({ text: res.translatedText, cls: "smart-lookup-trans-text" });
          const actionsWrap = resultRow.createDiv({ cls: "smart-lookup-trans-actions" });

          const audioBtn = actionsWrap.createEl("button", {
            cls: "smart-lookup-icon-btn",
            attr: { title: "Listen to pronunciation in target language" },
          });
          setIcon(audioBtn, "volume-2");
          audioBtn.onclick = () => {
            AudioPlayer.playOrSpeak(res.translatedText, undefined, langCode);
          };

          const copyBtn = actionsWrap.createEl("button", {
            cls: "smart-lookup-icon-btn",
            attr: { title: "Copy translation" },
          });
          setIcon(copyBtn, "copy");
          copyBtn.onclick = async () => {
            await navigator.clipboard.writeText(res.translatedText);
            new Notice("Translation copied!");
          };
        } else {
          transContent.createSpan({ text: "Could not translate.", cls: "smart-lookup-text-muted" });
        }
      }
    };

    select.onchange = () => {
      doTranslate(select.value);
    };

    doTranslate(this.selectedTargetLang);
  }

  // --- Deep-Dive Study Notes ---
  private renderStudyNoteSection(container: HTMLElement, term: string): void {
    const studyBox = container.createDiv({ cls: "smart-lookup-study-box" });
    const studyHeader = studyBox.createDiv({ cls: "smart-lookup-study-header" });

    const titleSpan = studyHeader.createSpan({ cls: "smart-lookup-study-title" });
    const bookIcon = titleSpan.createSpan({ cls: "smart-lookup-study-icon" });
    setIcon(bookIcon, "book-open");
    titleSpan.createSpan({ text: "Deep-Dive Study Note" });

    const contentDiv = studyBox.createDiv({ cls: "smart-lookup-study-content" });

    if (this.currentStudyPack) {
      this.displayStudyResult(contentDiv, this.currentStudyPack);
      return;
    }

    const genBtn = contentDiv.createEl("button", {
      cls: "smart-lookup-study-btn",
      text: "⚡ Generate Deep-Dive Synthesis",
    });

    genBtn.onclick = async () => {
      genBtn.disabled = true;
      genBtn.setText("Synthesizing concept (< 1s)...");
      try {
        if (this.callbacks.onGenerateStudyPack) {
          const res = await this.callbacks.onGenerateStudyPack(term, this.contextSentence);
          res.images = this.currentImages;
          this.currentStudyPack = res;
          contentDiv.empty();
          this.displayStudyResult(contentDiv, res);
          if (this.lastAnchorRect) {
            positionElementNear(this.el, this.lastAnchorRect, { offset: 8, preferBelow: true });
          }
        }
      } catch (err) {
        genBtn.disabled = false;
        genBtn.setText("⚡ Generate Deep-Dive Synthesis");
        new Notice(`Generation notice: ${(err as Error).message}`);
      }
    };
  }

  private displayStudyResult(container: HTMLElement, studyPack: StudyNoteResult): void {
    // 1. Summary Block with Definition and Source Badge
    const sumBlock = container.createDiv({ cls: "smart-lookup-study-summary-card" });
    
    const defHeader = sumBlock.createDiv({ cls: "smart-lookup-def-badge-header" });
    defHeader.createEl("h5", { text: "📌 Simple Definition", cls: "smart-lookup-feynman-label" });
    if (studyPack.sourceBadge) {
      defHeader.createSpan({ cls: "smart-lookup-source-badge", text: studyPack.sourceBadge });
    }

    sumBlock.createEl("p", { text: studyPack.simpleDefinition || studyPack.summary, cls: "smart-lookup-study-summary-text" });

    // 2. Action Buttons (Clean & Focused)
    const sumActionRow = sumBlock.createDiv({ cls: "smart-lookup-study-action-row" });

    // 📑 Create Study Note
    const createNoteBtn = sumActionRow.createEl("button", {
      cls: "smart-lookup-btn smart-lookup-btn-deepdive",
      text: "📑 Create Study Note",
      attr: { title: `Creates a structured study note in "${this.settings.studyNotesFolder || "Study Notes"}/"` },
    });
    setIcon(createNoteBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "file-text");
    createNoteBtn.onclick = async () => {
      createNoteBtn.disabled = true;
      createNoteBtn.setText("Creating note...");
      try {
        if (this.callbacks.onCreateStudyNote) {
          studyPack.images = this.currentImages;
          const linkMd = await this.callbacks.onCreateStudyNote(studyPack, this.contextSentence);
          if (this.callbacks.onInsertMarkdown) {
            this.callbacks.onInsertMarkdown(linkMd, false);
          }
          createNoteBtn.disabled = false;
          createNoteBtn.setText("✓ Note Created");
          new Notice(`Created Deep-Dive Study Note: ${studyPack.title}!`);
        }
      } catch (err) {
        createNoteBtn.disabled = false;
        createNoteBtn.setText("📑 Create Study Note");
        new Notice(`Error creating note: ${(err as Error).message}`);
      }
    };

    // 🗂️ Create Concept Canvas
    const createCanvasBtn = sumActionRow.createEl("button", {
      cls: "smart-lookup-btn smart-lookup-btn-canvas",
      text: "🗂️ Concept Canvas",
      attr: { title: "Generates an interactive visual Obsidian whiteboard Canvas" },
    });
    setIcon(createCanvasBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "layout-grid");
    createCanvasBtn.onclick = async () => {
      createCanvasBtn.disabled = true;
      createCanvasBtn.setText("Generating Canvas...");
      try {
        if (this.callbacks.onCreateCanvas) {
          studyPack.images = this.currentImages;
          const linkMd = await this.callbacks.onCreateCanvas(studyPack);
          if (this.callbacks.onInsertMarkdown) {
            this.callbacks.onInsertMarkdown(linkMd, false);
          }
          createCanvasBtn.disabled = false;
          createCanvasBtn.setText("✓ Canvas Created");
          new Notice(`Generated Visual Concept Canvas for "${studyPack.title}"!`);
        }
      } catch (err) {
        createCanvasBtn.disabled = false;
        createCanvasBtn.setText("🗂️ Concept Canvas");
        new Notice(`Canvas Error: ${(err as Error).message}`);
      }
    };

    // 📥 Append Summary to Active Note
    const appendBtn = sumActionRow.createEl("button", {
      cls: "smart-lookup-btn smart-lookup-btn-primary",
      text: "📥 Insert in Note",
    });
    setIcon(appendBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "arrow-down-to-line");
    appendBtn.onclick = () => {
      const heading = this.settings.studySummaryHeading || "## 📌 Key Synthesis & Takeaways";
      const md = `\n\n${heading}\n> ${studyPack.simpleDefinition || studyPack.summary}\n`;
      if (this.callbacks.onAppendSummaryToNote) {
        this.callbacks.onAppendSummaryToNote(md);
      }
      appendBtn.setText("✓ Inserted");
      new Notice("Summary inserted into note!");
    };

    // 3. Key Rules & Traits Preview
    if (studyPack.keyRules && studyPack.keyRules.length > 0) {
      const keyBlock = container.createDiv({ cls: "smart-lookup-para-bullets" });
      keyBlock.createEl("h5", { text: "📋 Key Rules & Traits" });
      const ul = keyBlock.createEl("ul");
      studyPack.keyRules.forEach((pt) => ul.createEl("li", { text: pt }));
    }

    // 4. Real Example Preview
    if (studyPack.realWorldExample) {
      const exBlock = container.createDiv({ cls: "smart-lookup-para-explain" });
      exBlock.createEl("strong", { text: "💡 Real Example: " });
      exBlock.createSpan({ text: studyPack.realWorldExample });
    }

    // 5. Common Traps Preview
    if (studyPack.commonTraps) {
      const trapBlock = container.createDiv({ cls: "smart-lookup-para-takeaway" });
      trapBlock.createEl("strong", { text: "⚠️ Common Traps: " });
      trapBlock.createSpan({ text: studyPack.commonTraps });
    }
  }

  // --- AI Explainer Section ---
  private activeComplexity: "eli5" | "practical" | "expert" = "practical";

  private renderAISection(container: HTMLElement, word: string): void {
    const aiBox = container.createDiv({ cls: "smart-lookup-ai-box" });
    const aiHeader = aiBox.createDiv({ cls: "smart-lookup-ai-header" });

    const titleSpan = aiHeader.createSpan({ cls: "smart-lookup-ai-title" });
    const sparkle = titleSpan.createSpan({ cls: "smart-lookup-ai-icon" });
    setIcon(sparkle, "sparkles");
    titleSpan.createSpan({ text: "AI Context Explainer" });

    // Interactive Complexity Tier Selector
    const tierWrap = aiHeader.createDiv({ cls: "smart-lookup-complexity-wrap" });
    const tiers: { id: "eli5" | "practical" | "expert"; label: string; icon: string }[] = [
      { id: "eli5", label: "👶 ELI5", icon: "smile" },
      { id: "practical", label: "💼 Practical", icon: "briefcase" },
      { id: "expert", label: "🎓 Academic", icon: "graduation-cap" },
    ];

    const aiContent = aiBox.createDiv({ cls: "smart-lookup-ai-content" });

    const fetchTier = async (level: "eli5" | "practical" | "expert") => {
      this.activeComplexity = level;
      aiContent.empty();
      aiContent.createSpan({ text: `Synthesizing ${level.toUpperCase()} explanation...`, cls: "smart-lookup-trans-loading" });

      try {
        if (this.callbacks.onAskAIWithComplexity) {
          const res = await this.callbacks.onAskAIWithComplexity(word, this.contextSentence, level);
          if (res) {
            this.currentAiResult = res;
            aiContent.empty();
            this.displayAIResult(aiContent, res);
            if (this.lastAnchorRect) {
              positionElementNear(this.el, this.lastAnchorRect, { offset: 8, preferBelow: true });
            }
          }
        }
      } catch (err) {
        aiContent.empty();
        aiContent.createSpan({ text: `AI Notice: ${(err as Error).message}`, cls: "smart-lookup-text-muted" });
      }
    };

    tiers.forEach((t) => {
      const btn = tierWrap.createEl("button", {
        cls: `smart-lookup-tier-btn ${this.activeComplexity === t.id ? "is-active" : ""}`,
        text: t.label,
        attr: { title: `Switch to ${t.id.toUpperCase()} level depth` },
      });
      btn.onclick = () => {
        tierWrap.querySelectorAll(".smart-lookup-tier-btn").forEach((b) => b.removeClass("is-active"));
        btn.addClass("is-active");
        fetchTier(t.id);
      };
    });

    if (this.currentAiResult) {
      this.displayAIResult(aiContent, this.currentAiResult);
      return;
    }

    const askBtn = aiContent.createEl("button", {
      cls: "smart-lookup-ai-btn",
      text: "⚡ Explain concept & context",
    });

    askBtn.onclick = () => {
      fetchTier(this.activeComplexity);
    };
  }

  private displayAIResult(container: HTMLElement, res: AIExplanationResult): void {
    if (res.sourceBadge) {
      container.createDiv({ cls: "smart-lookup-source-badge", text: res.sourceBadge });
    }
    if (res.summary) {
      container.createEl("p", { cls: "smart-lookup-ai-summary", text: res.summary });
    }
    if (res.simpleExplanation) {
      const row = container.createDiv({ cls: "smart-lookup-ai-row" });
      row.createEl("strong", { text: `${this.activeComplexity === "eli5" ? "👶 Simple:" : this.activeComplexity === "expert" ? "🎓 Academic:" : "💡 Meaning:"} ` });
      row.createSpan({ text: res.simpleExplanation });
    }
    if (res.etymology) {
      const row = container.createDiv({ cls: "smart-lookup-ai-row" });
      row.createEl("strong", { text: "Origin: " });
      row.createSpan({ text: res.etymology });
    }
    if (res.analogicalBridge) {
      const row = container.createDiv({ cls: "smart-lookup-ai-row" });
      row.createEl("strong", { text: "🌉 Analogy: " });
      row.createSpan({ text: res.analogicalBridge });
    }
    if (res.mnemonic) {
      const row = container.createDiv({ cls: "smart-lookup-ai-row smart-lookup-ai-mnemonic" });
      row.createEl("strong", { text: "🧠 Memory Hook: " });
      row.createSpan({ text: res.mnemonic });
    }
  }

  // --- Sticky Pinned Footer ---
  private renderFooter(rootEl: HTMLElement, entry: DictionaryEntry | null): void {
    const footer = rootEl.createDiv({ cls: "smart-lookup-footer" });

    if (entry) {
      // 📚 Save to Vocab Log Note (Hotkey: L)
      if (this.settings.enableVocabLog) {
        const logBtn = footer.createEl("button", {
          cls: "smart-lookup-btn smart-lookup-btn-log",
          attr: { title: `Save to Log (Hotkey: Ctrl+Shift+L)` },
        });
        const logIcon = logBtn.createSpan({ cls: "smart-lookup-btn-icon" });
        setIcon(logIcon, "bookmark");
        logBtn.createSpan({ text: "Log " });
        logBtn.createEl("kbd", { cls: "smart-lookup-key-badge", text: "Ctrl+Shift+L" });

        logBtn.onclick = async () => {
          logBtn.disabled = true;
          try {
            if (this.callbacks.onSaveToVocabLog) {
              await this.callbacks.onSaveToVocabLog(
                entry,
                this.currentTranslation?.translatedText,
                this.contextSentence
              );
              logBtn.setText("Saved ✓");
              new Notice(`Saved to ${this.settings.vocabLogPath || "Vocabulary Log.md"}`);
            }
          } catch (err) {
            logBtn.disabled = false;
            logBtn.setText("Log");
            new Notice(`Log error: ${(err as Error).message}`);
          }
        };
      }

      // 🎴 Add to Anki Button with Deck Selector & Creator (Hotkey: Ctrl+Shift+A)
      if (this.settings.enableAnki) {
        const ankiWrap = footer.createDiv({ cls: "smart-lookup-anki-button-group" });

        const currentDeck = this.selectedAnkiDeck || this.settings.ankiDeckName || "Default";

        const ankiBtn = ankiWrap.createEl("button", {
          cls: "smart-lookup-btn smart-lookup-btn-anki",
          attr: { title: `Add to Anki deck "${currentDeck}" (Hotkey: Ctrl+Shift+A)` },
        });
        const ankiIcon = ankiBtn.createSpan({ cls: "smart-lookup-btn-icon" });
        setIcon(ankiIcon, "layers");
        const ankiLabel = ankiBtn.createSpan({ text: `Anki (${currentDeck}) ` });
        ankiBtn.createEl("kbd", { cls: "smart-lookup-key-badge", text: "Ctrl+Shift+A" });

        ankiBtn.onclick = async () => {
          ankiBtn.disabled = true;
          ankiBtn.setText("Sending...");
          try {
            if (this.callbacks.onAddToAnki) {
              const img = this.currentImages.length > 0 ? this.currentImages[0] : null;
              const targetDeck = this.selectedAnkiDeck || this.settings.ankiDeckName || "Default";
              await this.callbacks.onAddToAnki(
                entry,
                this.currentTranslation?.translatedText,
                img,
                this.contextSentence,
                targetDeck
              );
              ankiBtn.setText("Added ✓");
              new Notice(`Card added to Anki deck "${targetDeck}"!`);
            }
          } catch (err) {
            ankiBtn.disabled = false;
            ankiLabel.setText(`Anki (${currentDeck}) `);
            new Notice(`Anki Notice: ${(err as Error).message}`);
          }
        };

        if (this.ankiClient) {
          const pickerBtn = ankiWrap.createEl("button", {
            cls: "smart-lookup-btn smart-lookup-btn-anki-picker",
            attr: { title: "Choose or Create Anki Deck" },
          });
          setIcon(pickerBtn, "chevron-down");

          pickerBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.ankiClient) {
              new AnkiDeckModal(this.app, this.ankiClient, currentDeck, (newDeck) => {
                this.selectedAnkiDeck = newDeck;
                this.settings.ankiDeckName = newDeck;
                ankiLabel.setText(`Anki (${newDeck}) `);
                ankiBtn.setAttribute("title", `Add to Anki deck "${newDeck}" (Hotkey: Ctrl+Shift+A)`);
              }).open();
            }
          };
        }
      }

      // Insert Dropdown Button (Hotkey: Ctrl+Shift+I)
      const insertBtn = footer.createEl("button", {
        cls: "smart-lookup-btn smart-lookup-btn-primary",
        attr: { title: "Insert into note (Hotkey: Ctrl+Shift+I)" },
      });
      insertBtn.createSpan({ text: "Insert " });
      insertBtn.createEl("kbd", { cls: "smart-lookup-key-badge", text: "Ctrl+Shift+I" });
      setIcon(insertBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "file-plus");

      insertBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      insertBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openInsertMenu(insertBtn, entry);
      };

      // Copy Definition Button
      const copyBtn = footer.createEl("button", {
        cls: "smart-lookup-btn",
        attr: { title: "Copy definition" },
      });
      copyBtn.createSpan({ text: "Copy " });
      setIcon(copyBtn.createSpan({ cls: "smart-lookup-btn-icon" }), "copy");

      copyBtn.onclick = async () => {
        const md = formatDefinitionByStyle(entry, this.settings.defaultInsertFormat, this.settings.insertTemplate);
        await navigator.clipboard.writeText(md);
        new Notice("Definition copied to clipboard!");
      };
    }
  }

  private openInsertMenu(triggerEl: HTMLElement, entry: DictionaryEntry): void {
    const existing = document.querySelector(".smart-lookup-insert-menu");
    if (existing) {
      existing.remove();
      return;
    }

    const menu = document.body.createDiv({ cls: "smart-lookup-insert-menu" });

    const addItem = (label: string, desc: string, style: InsertFormatType, replace = false) => {
      const item = menu.createDiv({ cls: "smart-lookup-menu-item" });
      item.createEl("div", { text: label, cls: "smart-lookup-menu-title" });
      item.createEl("div", { text: desc, cls: "smart-lookup-menu-desc" });

      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const md = formatDefinitionByStyle(entry, style, this.settings.insertTemplate);
        this.insertOrCopyMarkdown(md, `Inserted as ${label}`, replace);
        menu.remove();
      });
    };

    addItem("Callout Box", "> [!info] popup box in note", "callout", false);
    addItem("Hover Tooltip", "<abbr> tag (shows popup on hover)", "tooltip_abbr", true);
    addItem("Footnote", "[^word] note footnote", "footnote", true);
    addItem("Inline Bracket", "word [meaning]", "inline_bracket", true);

    const rect = triggerEl.getBoundingClientRect();
    const menuWidth = 230;
    const menuHeight = 180;
    let left = rect.left - 40;
    if (left + menuWidth > window.innerWidth - 16) {
      left = window.innerWidth - menuWidth - 16;
    }
    if (left < 16) left = 16;

    let top = rect.top - menuHeight - 6;
    if (top < 16) {
      top = rect.bottom + 6;
    }

    setCssStyles(menu, {
      position: "fixed",
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
    });
  }

  private insertOrCopyMarkdown(markdown: string, successNotice: string, replaceSelection = false): void {
    if (this.callbacks.onInsertMarkdown) {
      this.callbacks.onInsertMarkdown(markdown, replaceSelection);
      new Notice(successNotice);
    } else if (this.activeEditor) {
      if (replaceSelection && this.activeEditor.getSelection()) {
        this.activeEditor.replaceSelection(markdown);
      } else {
        const cursor = this.activeEditor.getCursor();
        this.activeEditor.replaceRange(`\n\n${markdown}\n\n`, cursor);
      }
      new Notice(successNotice);
    } else {
      navigator.clipboard.writeText(markdown);
      new Notice("Copied to clipboard!");
    }
  }

  private initDragHandling(headerEl: HTMLElement): void {
    headerEl.addClass("smart-lookup-draggable-header");

    headerEl.addEventListener("mousedown", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("select") || target.closest("input") || target.closest("a")) {
        return;
      }

      e.preventDefault();
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      const rect = this.el.getBoundingClientRect();
      this.popoverStartX = rect.left;
      this.popoverStartY = rect.top;

      this.el.addClass("smart-lookup-is-dragging");

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!this.isDragging) return;
        const dx = moveEvent.clientX - this.dragStartX;
        const dy = moveEvent.clientY - this.dragStartY;

        let newLeft = this.popoverStartX + dx;
        let newTop = this.popoverStartY + dy;

        const maxLeft = window.innerWidth - this.el.offsetWidth - 10;
        const maxTop = window.innerHeight - this.el.offsetHeight - 10;
        newLeft = Math.max(10, Math.min(maxLeft, newLeft));
        newTop = Math.max(10, Math.min(maxTop, newTop));

        setCssStyles(this.el, {
          left: `${Math.round(newLeft)}px`,
          top: `${Math.round(newTop)}px`,
        });
      };

      const onMouseUp = () => {
        this.isDragging = false;
        this.el.removeClass("smart-lookup-is-dragging");
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }

  private async renderVaultMentions(container: HTMLElement, term: string): Promise<void> {
    if (!this.callbacks.onFindVaultMentions) return;
    try {
      const mentions = await this.callbacks.onFindVaultMentions(term);
      if (mentions && mentions.length > 0) {
        const wrap = container.createDiv({ cls: "smart-lookup-vault-mentions" });
        const iconSpan = wrap.createSpan({ cls: "smart-lookup-mention-icon" });
        setIcon(iconSpan, "link");
        wrap.createSpan({ text: "Vault Mentions: ", cls: "smart-lookup-mention-label" });

        mentions.forEach((m, idx) => {
          const chip = wrap.createSpan({ text: m.basename, cls: "smart-lookup-mention-chip" });
          chip.onclick = () => {
            if (this.callbacks.onInsertMarkdown) {
              this.callbacks.onInsertMarkdown(`[[${m.basename}]]`, false);
              new Notice(`Linked [[${m.basename}]] into active note!`);
            }
          };
          if (idx < mentions.length - 1) {
            wrap.createSpan({ text: ", " });
          }
        });
      }
    } catch {
      // ignore
    }
  }

  hide(): void {
    this.isVisible = false;
    this.el.addClass("is-hidden");
    this.imageHoverCard.hide();
    this.lightboxModal?.hide();
    document.querySelector(".smart-lookup-insert-menu")?.remove();
    if (this.callbacks.onHide) {
      this.callbacks.onHide();
    }
  }

  destroy(): void {
    this.hide();
    document.removeEventListener("mousedown", this.boundDocClick);
    document.removeEventListener("keydown", this.boundKeyDown);
    this.imageHoverCard.destroy();
    this.lightboxModal?.destroy();
    this.el.remove();
  }
}
