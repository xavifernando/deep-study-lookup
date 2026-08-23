import { Editor, MarkdownView, Menu, normalizePath, Notice, Plugin, TFile } from "obsidian";
import { AIManager } from "./services/ai/AIManager";
import { ParagraphAIService } from "./services/ai/ParagraphAIService";
import { StudyNoteAIService } from "./services/ai/StudyNoteAIService";
import { AnkiConnectClient } from "./services/anki/AnkiConnectClient";
import { LookupCache } from "./services/cache/LookupCache";
import { CanvasService } from "./services/canvas/CanvasService";
import { DictionaryManager } from "./services/dictionary/DictionaryManager";
import { ImageManager } from "./services/image/ImageManager";
import { SpacedRepetitionService } from "./services/srs/SpacedRepetitionService";
import { TranslatorManager } from "./services/translator/TranslatorManager";
import { VaultMentionService } from "./services/vault/VaultMentionService";
import { VocabLogService } from "./services/vocab/VocabLogService";
import { WolframService } from "./services/wolfram/WolframService";
import { GlossaryService } from "./services/glossary/GlossaryService";
import { DEFAULT_SETTINGS, DictionaryEntry, ImageResult, PluginSettings, StudyNoteResult } from "./types";
import { ActiveRecallReviewModal } from "./ui/ActiveRecallReviewModal";
import { FloatingPill } from "./ui/FloatingPill";
import { LookupPopover } from "./ui/LookupPopover";
import { ParagraphSummaryModal } from "./ui/ParagraphSummaryModal";
import { SmartLookupSettingTab } from "./ui/SettingsTab";
import { WolframSolverModal } from "./ui/WolframSolverModal";
import { YouTubePlayerModal } from "./ui/YouTubePlayerModal";
import { getSelectionCoordinates, RectBounds } from "./utils/dom";

export default class SmartLookupPlugin extends Plugin {
  public settings!: PluginSettings;
  private cache!: LookupCache;
  private dictManager!: DictionaryManager;
  private imgManager!: ImageManager;
  private aiManager!: AIManager;
  private studyNoteService!: StudyNoteAIService;
  private paragraphService!: ParagraphAIService;
  private vaultMentionService!: VaultMentionService;
  private srsService!: SpacedRepetitionService;
  private canvasService!: CanvasService;
  private translatorManager!: TranslatorManager;
  public ankiClient!: AnkiConnectClient;
  private vocabLogService!: VocabLogService;
  private wolframService!: WolframService;
  private glossaryService!: GlossaryService;
  private popover!: LookupPopover;
  private floatingPill!: FloatingPill;
  private statusBarItem: HTMLElement | null = null;
  private selectionDebounceTimer: number | null = null;
  private activeAbortController: AbortController | null = null;
  private activeParagraphModal: ParagraphSummaryModal | null = null;
  private isSelectionSuspended = false;

  async onload() {
    await this.loadSettings();

    // Status bar item & Quick Action Menu
    if (this.settings.enableStatusBar) {
      this.statusBarItem = this.addStatusBarItem();
      this.statusBarItem.addClass("smart-lookup-status-bar");
      this.statusBarItem.onclick = (evt: MouseEvent) => {
        const menu = new Menu();

        menu.addItem((item) =>
          item
            .setTitle("🎬 Open Video Tutorials & Player")
            .setIcon("video")
            .onClick(() => {
              const view = this.app.workspace.getActiveViewOfType(MarkdownView);
              const selection = view?.editor.getSelection().trim() || window.getSelection()?.toString().trim() || "";
              this.openYouTubePlayer(selection);
            })
        );

        menu.addItem((item) =>
          item
            .setTitle("🎯 Start Active Recall Flashcard Session")
            .setIcon("brain")
            .onClick(() => {
              new ActiveRecallReviewModal(this.app, this.srsService).open();
            })
        );

        menu.addItem((item) =>
          item
            .setTitle("📊 Open Mastery & Retention Dashboard")
            .setIcon("bar-chart-2")
            .onClick(async () => {
              const md = this.srsService.generateRetentionDashboardMarkdown();
              const path = normalizePath("📊 Learning Dashboard.md");
              const existing = this.app.vault.getAbstractFileByPath(path);
              let file: TFile;
              if (existing instanceof TFile) {
                file = existing;
                await this.app.vault.modify(existing, md);
              } else {
                file = await this.app.vault.create(path, md);
              }
              await this.app.workspace.getLeaf(false).openFile(file);
            })
        );

        menu.addItem((item) =>
          item
            .setTitle("📚 Open Vocabulary Log")
            .setIcon("book-open")
            .onClick(async () => {
              const rawPath = this.settings.vocabLogPath || "Vocabulary Log.md";
              const filePath = normalizePath(rawPath);
              const file = this.app.vault.getAbstractFileByPath(filePath);
              if (file instanceof TFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
              }
            })
        );

        menu.showAtMouseEvent(evt);
      };
    }

    // Initialize core services
    this.cache = new LookupCache(this.settings.cacheTtlMinutes);
    this.dictManager = new DictionaryManager(this.cache, this.settings);
    this.imgManager = new ImageManager(this.cache, this.settings);
    this.aiManager = new AIManager(this.cache, this.settings);
    this.studyNoteService = new StudyNoteAIService(this.settings);
    this.paragraphService = new ParagraphAIService(this.settings);
    this.vaultMentionService = new VaultMentionService(this.app);
    this.srsService = new SpacedRepetitionService(this.app, this.settings);
    this.canvasService = new CanvasService(this.app, this.settings);
    this.translatorManager = new TranslatorManager(this.cache, this.settings);
    this.ankiClient = new AnkiConnectClient(this.settings);
    this.wolframService = new WolframService(this.settings);
    this.glossaryService = new GlossaryService(this.app, this.dictManager, this.settings);
    this.vocabLogService = new VocabLogService(this.app, this.settings, (count) => {
      void this.updateStatusBar(count);
    });

    void this.updateStatusBar(this.vocabLogService.getDailyCount());

    // Ribbon Icon: Smart Lookup & Dictionary
    this.addRibbonIcon("search", "Smart Lookup Definition & Research", () => {
      this.triggerLookupFromCurrentSelection();
    });

    // Ribbon Icon: Daily Active Recall Spaced Repetition Session
    this.addRibbonIcon("brain", "Active Recall Flashcard Review Session", () => {
      new ActiveRecallReviewModal(this.app, this.srsService).open();
    });

    // Register Plugin Settings Tab
    this.addSettingTab(new SmartLookupSettingTab(this.app, this));

    // Initialize UI components
    this.popover = new LookupPopover(
      this.app,
      this.settings,
      {
        onAskAI: async (word: string, contextSentence?: string) => {
          return await this.aiManager.explain({
            word,
            contextSentence,
            targetLanguage: this.settings.defaultTargetLanguage,
          });
        },
        onAskAIWithComplexity: async (word: string, contextSentence?: string, level?: "eli5" | "practical" | "expert") => {
          return await this.aiManager.explain({
            word,
            contextSentence,
            targetLanguage: this.settings.defaultTargetLanguage,
            complexityLevel: level,
          });
        },
        onTranslate: async (word: string, targetLang: string) => {
          return await this.translatorManager.translate(word, targetLang);
        },
        onGenerateStudyPack: async (word: string, contextSentence?: string) => {
          return await this.studyNoteService.generateStudyPack(word, contextSentence);
        },
        onCreateStudyNote: async (studyPack: StudyNoteResult, contextSentence?: string) => {
          const activeFile = this.app.workspace.getActiveFile();
          let parentTitle = activeFile?.basename || "";

          // PDF Page Detection: If viewing PDF, include exact page deep link (e.g. [[Lecture.pdf#page=14]])
          if (activeFile?.extension === "pdf") {
            const pageNum = this.getPdfActivePageNumber();
            if (pageNum && activeFile.name) {
              parentTitle = `${activeFile.name}#page=${pageNum}`;
            } else if (activeFile.name) {
              parentTitle = activeFile.name;
            }
          }

          const result = await this.srsService.createStudyNote(studyPack, {
            parentNoteTitle: parentTitle,
            contextSentence: contextSentence,
          });

          // Bidirectional backlinking: replace selected text in markdown editor if available
          const activeMarkdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (activeMarkdownView) {
            const editor = activeMarkdownView.editor;
            if (editor.somethingSelected()) {
              const selected = editor.getSelection();
              editor.replaceSelection(`[[${result.file.path}|${selected}]]`);
            } else {
              const cursor = editor.getCursor();
              editor.replaceRange(`\n\n> [!info] 📑 Study Note: [[${result.file.path}|${studyPack.title}]]\n`, cursor);
            }
          }

          return result.linkMarkdown;
        },
        onCreateCanvas: async (studyPack: StudyNoteResult) => {
          const file = await this.canvasService.createConceptCanvas(studyPack);
          const leaf = this.app.workspace.getLeaf(true);
          await leaf.openFile(file);
          return `[[${file.path}]]`;
        },
        onSolveWolfram: async (query: string) => {
          return await this.wolframService.solve(query);
        },
        onOpenWolframSolver: (query: string) => {
          this.openWolframSolver(query);
        },
        onOpenVideoPlayer: (query: string) => {
          this.openYouTubePlayer(query);
        },
        onFindVaultMentions: (term: string) => {
          return this.vaultMentionService.findMentions(term);
        },
        onNavigateWord: (word: string) => {
          const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
          let editor: Editor | undefined = undefined;
          let bounds: RectBounds = { top: 150, left: 150, bottom: 170, right: 250, width: 100, height: 20 };
          if (activeView) {
            editor = activeView.editor;
            const coords = getSelectionCoordinates(editor);
            if (coords) bounds = coords;
          }
          void this.executeLookup(word, bounds, editor);
        },
        onInsertMarkdown: (markdown: string, replaceSelection = false) => {
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          const editor = view?.editor;
          if (!editor) return;

          if (replaceSelection && editor.somethingSelected()) {
            editor.replaceSelection(markdown);
          } else {
            const cursor = editor.getCursor();
            const line = editor.getLine(cursor.line);
            editor.replaceRange(`\n\n${markdown}\n\n`, { line: cursor.line, ch: line.length });
          }
        },
        onAppendSummaryToNote: (markdown: string) => {
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          const editor = view?.editor;
          if (!editor) return;
          const lastLine = editor.lineCount() - 1;
          const lastLineLength = editor.getLine(lastLine).length;
          editor.replaceRange(`\n\n${markdown}\n`, { line: lastLine, ch: lastLineLength });
        },
        onSaveToVocabLog: async (entry: DictionaryEntry, translation?: string, context?: string) => {
          await this.vocabLogService.logWord(entry, translation, context);
        },
        onAddToAnki: async (entry: DictionaryEntry, translation?: string, image?: ImageResult | null, context?: string, targetDeck?: string) => {
          if (!this.settings.enableAnki) return;
          const deckName = targetDeck || this.settings.ankiDeckName;
          await this.ankiClient.createCard(entry, {
            deckName,
            translation,
            image,
            contextSentence: context,
          });
        },
      },
      this.ankiClient
    );

    this.floatingPill = new FloatingPill({
      onLookup: (selectedText, bounds) => {
        const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const editor = mdView?.editor;
        void this.executeLookup(selectedText, bounds, editor);
      },
      onSolve: (query) => {
        this.openWolframSolver(query);
      },
      onSummarize: (text) => {
        const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const editor = mdView?.editor;
        this.openParagraphModal(text, editor);
      },
      onSearchWeb: (query) => {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
      },
    });

    // Register Commands (Works seamlessly in Markdown and Native PDF view)
    this.addCommand({
      id: "lookup-selection",
      name: "Lookup definition for selected text",
      checkCallback: (checking: boolean) => {
        if (checking) return true;
        this.triggerLookupFromCurrentSelection();
        return true;
      },
    });

    this.addCommand({
      id: "active-recall-review",
      name: "Start active recall spaced repetition review",
      callback: () => {
        new ActiveRecallReviewModal(this.app, this.srsService).open();
      },
    });

    this.addCommand({
      id: "summarize-paragraph",
      name: "Summarize and explain selected text",
      checkCallback: (checking: boolean) => {
        const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
        let selected = "";
        let editor: Editor | undefined = undefined;
        if (mdView) {
          editor = mdView.editor;
          selected = editor.getSelection().trim();
        } else {
          selected = window.getSelection()?.toString().trim() || "";
        }
        if (!selected) {
          if (!checking) new Notice("Please select text to summarize.");
          return false;
        }
        if (checking) return true;
        this.openParagraphModal(selected, editor);
        return true;
      },
    });

    this.addCommand({
      id: "solve-wolfram",
      name: "Solve problem with WolframAlpha",
      checkCallback: (checking: boolean) => {
        const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
        let selected = "";
        if (mdView) {
          selected = mdView.editor.getSelection().trim();
        } else {
          selected = window.getSelection()?.toString().trim() || "";
        }
        if (!selected) {
          if (!checking) new Notice("Please select an equation or problem to solve.");
          return false;
        }
        if (checking) return true;
        this.openWolframSolver(selected);
        return true;
      },
    });

    this.addCommand({
      id: "open-youtube-player",
      name: "Open video tutorials and player",
      editorCallback: (editor: Editor) => {
        const selected = editor.getSelection().trim();
        this.openYouTubePlayer(selected);
      },
    });

    this.addCommand({
      id: "generate-retention-dashboard",
      name: "Generate spaced repetition retention dashboard",
      callback: async () => {
        const md = this.srsService.generateRetentionDashboardMarkdown();
        const path = normalizePath("📊 Learning Dashboard.md");
        const existing = this.app.vault.getAbstractFileByPath(path);
        let file: TFile;
        if (existing instanceof TFile) {
          file = existing;
          await this.app.vault.modify(existing, md);
        } else {
          file = await this.app.vault.create(path, md);
        }
        await this.app.workspace.getLeaf(false).openFile(file);
        new Notice("Generated spaced repetition dashboard.");
      },
    });

    this.addCommand({
      id: "generate-glossary",
      name: "Generate auto-glossary for active note",
      editorCallback: async (editor: Editor) => {
        const text = editor.getValue();
        if (!text.trim()) {
          new Notice("Active note is empty.");
          return;
        }
        new Notice("Scanning note and generating glossary...");
        const entries = await this.glossaryService.generateGlossary(text, 10);
        if (entries.length === 0) {
          new Notice("No distinct technical terms found to glossary.");
          return;
        }
        const md = this.glossaryService.formatGlossaryMarkdown(entries);
        const lastLine = editor.lineCount() - 1;
        const lastLineLength = editor.getLine(lastLine).length;
        editor.replaceRange(md, { line: lastLine, ch: lastLineLength });
        new Notice(`Added glossary with ${entries.length} terms to note.`);
      },
    });

    // Active Spaced Repetition Review Banner on Open
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (!file || !(file instanceof TFile) || file.extension !== "md") return;
        this.checkAndInjectReviewBanner(file);
      })
    );

    // Auto-clean deleted study note links in parent notes
    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        const deletedPath = file.path;
        const deletedBasename = file.basename;
        const mdFiles = this.app.vault.getMarkdownFiles();

        const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const linkWithAliasRegex = new RegExp(`\\[\\[(?:${escapeRegex(deletedPath)}|${escapeRegex(deletedBasename)})\\|([^\\]]+)\\]\\]`, "g");
        const bareLinkRegex = new RegExp(`\\[\\[(?:${escapeRegex(deletedPath)}|${escapeRegex(deletedBasename)})\\]\\]`, "g");
        const calloutLineRegex = new RegExp(`\\n?>\\s*\\[!info\\]\\s*📑\\s*Study\\s*Note:\\s*\\[\\[(?:${escapeRegex(deletedPath)}|${escapeRegex(deletedBasename)})[^\\]]*\\]\\]\\n?`, "g");

        for (const mdFile of mdFiles) {
          if (mdFile.path === deletedPath) continue;
          try {
            const content = await this.app.vault.read(mdFile);
            let updated = content;
            if (calloutLineRegex.test(updated)) {
              updated = updated.replace(calloutLineRegex, "\n");
            }
            if (linkWithAliasRegex.test(updated)) {
              updated = updated.replace(linkWithAliasRegex, "$1");
            }
            if (bareLinkRegex.test(updated)) {
              updated = updated.replace(bareLinkRegex, deletedBasename);
            }
            if (updated !== content) {
              await this.app.vault.modify(mdFile, updated);
            }
          } catch {
            // ignore
          }
        }
      })
    );

    // Register Document-level selection listeners on mouseup / touchend / keyup
    this.registerDomEvent(document, "mouseup", (evt: MouseEvent) => {
      if (evt.button !== 0) return;
      const target = evt.target as HTMLElement;
      if (target?.closest?.(".modal-container, .modal-bg, .modal, .smart-lookup-paragraph-modal, .smart-lookup-popover, .smart-lookup-floating-pill, .smart-lookup-youtube-modal, .smart-lookup-insert-menu")) {
        return;
      }
      this.handleSelectionChange();
    });

    this.registerDomEvent(document, "touchend", (evt: TouchEvent) => {
      const target = evt.target as HTMLElement;
      if (target?.closest?.(".modal-container, .modal-bg, .modal, .smart-lookup-paragraph-modal, .smart-lookup-popover, .smart-lookup-floating-pill, .smart-lookup-youtube-modal, .smart-lookup-insert-menu")) {
        return;
      }
      // Small delay on mobile to let selection range settle
      window.setTimeout(() => {
        this.handleSelectionChange();
      }, 50);
    });

    this.registerDomEvent(document, "keyup", (evt: KeyboardEvent) => {
      if (
        (evt.shiftKey && (evt.key.startsWith("Arrow") || evt.key === "Home" || evt.key === "End")) ||
        ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === "a")
      ) {
        this.handleSelectionChange();
      }
    });
  }

  private checkAndInjectReviewBanner(file: TFile): void {
    const existing = document.querySelector(".smart-lookup-srs-banner");
    if (existing) existing.remove();

    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (!fm || !fm.review_due) return;

    const today = new Date().toISOString().split("T")[0];
    if (fm.review_due > today) return;

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;

    const container = activeView.contentEl;
    const banner = container.createDiv({ cls: "smart-lookup-srs-banner" });

    const left = banner.createDiv({ cls: "smart-lookup-srs-banner-left" });
    left.createEl("strong", { text: "🧠 Active Recall Due Today" });
    const reps = typeof fm.reps === "number" ? fm.reps : 0;
    const ease = typeof fm.ease_factor === "number" ? fm.ease_factor : 2.5;
    left.createSpan({ text: ` (Repetition ${reps}, Ease: ${ease})` });

    const right = banner.createDiv({ cls: "smart-lookup-srs-banner-right" });

    const makeRateBtn = (label: string, rating: "hard" | "good" | "easy", colorClass: string) => {
      const btn = right.createEl("button", { cls: `smart-lookup-btn smart-lookup-btn-sm ${colorClass}`, text: label });
      btn.onclick = async () => {
        await this.srsService.recordReview(file, rating);
        banner.remove();
      };
    };

    makeRateBtn("🔴 Hard", "hard", "");
    makeRateBtn("🟡 Good", "good", "smart-lookup-btn-primary");
    makeRateBtn("🟢 Easy", "easy", "");

    const closeBtn = right.createEl("button", { cls: "smart-lookup-icon-btn", text: "✕" });
    closeBtn.onclick = () => banner.remove();

    container.prepend(banner);
  }

  openYouTubePlayer(query: string): void {
    new YouTubePlayerModal(this.app, query, (md) => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      const editor = view?.editor;
      if (editor) {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        editor.replaceRange(`\n\n${md}\n\n`, { line: cursor.line, ch: line.length });
      }
    }).open();
  }

  openWolframSolver(query: string): void {
    new WolframSolverModal(this.app, this.wolframService, query, {
      onInsertMarkdown: (md) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const editor = view?.editor;
        if (editor) {
          const cursor = editor.getCursor();
          const line = editor.getLine(cursor.line);
          editor.replaceRange(`\n\n${md}\n\n`, { line: cursor.line, ch: line.length });
        }
      },
      onAppendToStudyNote: async (title, md) => {
        const studyPack = await this.studyNoteService.generateStudyPack(title, md);
        await this.srsService.createStudyNote(studyPack);
      },
    }).open();
  }

  private getPdfActivePageNumber(): number | undefined {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const node = sel.getRangeAt(0).startContainer.parentElement;
        const pageEl = node?.closest("[data-page-number]") as HTMLElement;
        if (pageEl) {
          const num = parseInt(pageEl.getAttribute("data-page-number") || "", 10);
          if (!isNaN(num) && num > 0) return num;
        }
      }
      const activePageEl = document.querySelector(".pdf-container .page.active, .pdf-viewer .page.active, [data-page-number].is-selected") as HTMLElement;
      if (activePageEl) {
        const num = parseInt(activePageEl.getAttribute("data-page-number") || "", 10);
        if (!isNaN(num) && num > 0) return num;
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  async updateStatusBar(count?: number): Promise<void> {
    if (!this.statusBarItem || !this.settings.enableStatusBar) {
      if (this.statusBarItem) this.statusBarItem.setText("");
      return;
    }
    const dailyCount = count !== undefined ? count : (this.vocabLogService ? this.vocabLogService.getDailyCount() : 0);
    let text = `📚 ${dailyCount} words logged`;

    if (this.settings.enableAnki && this.ankiClient) {
      try {
        const dueCount = await this.ankiClient.getDueCardsCount(this.settings.ankiDeckName);
        if (dueCount > 0) {
          text += ` | 🎴 ${dueCount} Anki due`;
        }
      } catch {
        // ignore if Anki not reachable
      }
    }

    this.statusBarItem.setText(text);
    this.statusBarItem.setAttribute("title", `Smart Lookup: ${dailyCount} terms logged today. Click for review actions.`);
  }

  private handleSelectionChange(): void {
    if (this.isSelectionSuspended) return;

    if (this.selectionDebounceTimer !== null) {
      window.clearTimeout(this.selectionDebounceTimer);
    }

    this.selectionDebounceTimer = window.setTimeout(() => {
      this.selectionDebounceTimer = null;
      if (this.isSelectionSuspended) return;

      const activeMdView = this.app.workspace.getActiveViewOfType(MarkdownView);
      let selectedText = "";
      let coords: RectBounds | null = null;
      let editor: Editor | undefined = undefined;

      // Branch 1: Markdown Editor View
      if (activeMdView) {
        editor = activeMdView.editor;
        selectedText = editor.getSelection().trim();
        if (selectedText) {
          coords = getSelectionCoordinates(editor);
        }
      }
      // Branch 2: Native PDF View or any other document viewer leaf in Obsidian
      else {
        const domSelection = window.getSelection();
        selectedText = domSelection?.toString().trim() || "";
        if (selectedText && domSelection && domSelection.rangeCount > 0) {
          const range = domSelection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            coords = {
              top: rect.top,
              left: rect.left,
              bottom: rect.bottom,
              right: rect.right,
              width: rect.width,
              height: rect.height,
            };
          }
        }
      }

      if (!selectedText || !coords) {
        this.floatingPill.hide();
        return;
      }

      const isParagraph = selectedText.split(/\s+/).length >= 7 || selectedText.includes("\n") || selectedText.length > 60;

      if (this.settings.triggerMode === "auto_popup") {
        if (isParagraph) {
          this.openParagraphModal(selectedText, editor);
        } else {
          void this.executeLookup(selectedText, coords, editor);
        }
      } else if (this.settings.triggerMode === "selection_pill") {
        this.floatingPill.show(selectedText, coords);
      }
    }, 150);
  }

  private triggerLookupFromCurrentSelection(): void {
    const activeMdView = this.app.workspace.getActiveViewOfType(MarkdownView);
    let selected = "";
    let coords: RectBounds | null = null;
    let editor: Editor | undefined = undefined;

    if (activeMdView) {
      editor = activeMdView.editor;
      selected = editor.getSelection().trim();
      if (selected) {
        coords = getSelectionCoordinates(editor);
      }
    } else {
      const domSelection = window.getSelection();
      selected = domSelection?.toString().trim() || "";
      if (selected && domSelection && domSelection.rangeCount > 0) {
        const range = domSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0) {
          coords = {
            top: rect.top,
            left: rect.left,
            bottom: rect.bottom,
            right: rect.right,
            width: rect.width,
            height: rect.height,
          };
        }
      }
    }

    if (!selected) {
      new Notice("Please select text to look up.");
      return;
    }

    const isParagraph = selected.split(/\s+/).length >= 7 || selected.includes("\n") || selected.length > 60;
    if (isParagraph) {
      this.openParagraphModal(selected, editor);
      return;
    }

    coords = coords || {
      top: window.innerHeight / 3,
      left: window.innerWidth / 3,
      bottom: window.innerHeight / 3 + 20,
      right: window.innerWidth / 3 + 100,
      width: 100,
      height: 20,
    };

    void this.executeLookup(selected, coords, editor);
  }

  async executeLookup(term: string, anchorRect: RectBounds, editor?: Editor): Promise<void> {
    const cleanTerm = term.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, "");
    if (!cleanTerm) return;

    this.floatingPill.hide();

    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    this.activeAbortController = new AbortController();

    this.popover.showLoading(cleanTerm, anchorRect);

    let contextSentence = "";
    if (editor) {
      try {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        contextSentence = line.trim();
      } catch {
        // ignore
      }
    }

    try {
      const [entry, images] = await Promise.all([
        this.dictManager.lookup(cleanTerm),
        this.settings.showImages ? this.imgManager.searchImages(cleanTerm) : Promise.resolve([]),
      ]);

      if (this.activeAbortController.signal.aborted) return;

      this.popover.render(entry, images, anchorRect, editor, contextSentence);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      this.popover.render(null, [], anchorRect, editor, contextSentence);
    }
  }

  openParagraphModal(text: string, editor?: Editor): void {
    if (this.activeParagraphModal) {
      this.activeParagraphModal.close();
      this.activeParagraphModal = null;
    }

    const modal = new ParagraphSummaryModal(
      this.app,
      this.paragraphService,
      text,
      {
        onInsertSummary: (summary) => {
          if (!editor) {
            void navigator.clipboard.writeText(summary);
            new Notice("Summary copied to clipboard! (Cannot insert directly into PDF)");
            return;
          }
          const cursor = editor.getCursor();
          const line = editor.getLine(cursor.line);
          editor.replaceRange(`\n\n${summary}\n\n`, { line: cursor.line, ch: line.length });
          new Notice("Inserted paragraph summary!");
        },
        onInsertFootnote: (takeaway) => {
          if (!editor) {
            void navigator.clipboard.writeText(takeaway);
            new Notice("Footnote copied to clipboard! (Cannot insert directly into PDF)");
            return;
          }
          this.insertFootnote(editor, takeaway);
        },
      }
    );

    this.activeParagraphModal = modal;
    modal.open();
  }

  private insertFootnote(editor: Editor, footnoteText: string): void {
    const noteContent = editor.getValue();
    const footnoteRegex = /\[\^(\d+)\]/g;
    let maxNum = 0;
    let match;
    while ((match = footnoteRegex.exec(noteContent)) !== null) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
    const nextNum = maxNum + 1;

    if (editor.somethingSelected()) {
      const to = editor.getCursor("to");
      editor.replaceRange(`[^${nextNum}]`, to);
    } else {
      const cursor = editor.getCursor();
      editor.replaceRange(`[^${nextNum}]`, cursor);
    }

    const cleanTakeaway = footnoteText.trim().replace(/\n+/g, " ");
    const footnoteDef = `\n[^${nextNum}]: ${cleanTakeaway}`;
    const lastLine = editor.lineCount() - 1;
    const lastLineLength = editor.getLine(lastLine).length;
    editor.replaceRange(footnoteDef, { line: lastLine, ch: lastLineLength });

    new Notice(`Added footnote [^${nextNum}] to note!`);
  }

  onunload() {
    if (this.selectionDebounceTimer) {
      window.clearTimeout(this.selectionDebounceTimer);
    }
    document.querySelectorAll(".smart-lookup-srs-banner, .smart-lookup-popover, .smart-lookup-floating-pill, .smart-lookup-image-hover-card, .smart-lookup-lightbox-overlay").forEach((el) => el.remove());
    this.popover?.destroy();
    this.floatingPill?.destroy();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<PluginSettings>);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.popover?.updateSettings(this.settings);
    this.dictManager?.updateSettings(this.settings);
    this.imgManager?.updateSettings(this.settings);
    this.aiManager?.updateSettings(this.settings);
    this.studyNoteService?.updateSettings(this.settings);
    this.srsService?.updateSettings(this.settings);
    this.translatorManager?.updateSettings(this.settings);
    this.ankiClient?.updateSettings(this.settings);
    this.wolframService?.updateSettings(this.settings);
    this.vocabLogService?.updateSettings(this.settings);
    this.glossaryService?.updateSettings(this.settings);
    await this.updateStatusBar();
  }
}
