import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type SmartLookupPlugin from "../main";
import { AccentDialectType, AIProviderType, InsertFormatType, MODEL_PRESETS, RESEARCH_ENGINES, SUPPORTED_LANGUAGES, TriggerMode } from "../types";

export class SmartLookupSettingTab extends PluginSettingTab {
  plugin: SmartLookupPlugin;

  constructor(app: App, plugin: SmartLookupPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Smart Visual, Translation & Anki Lookup" });

    // --- Activation & Triggers ---
    containerEl.createEl("h3", { text: "Activation & Pronunciation" });

    new Setting(containerEl)
      .setName("Trigger Mode")
      .setDesc("How lookup activates when text is selected in your notes")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("selection_pill", "Floating Pill (Recommended)")
          .addOption("auto_popup", "Instant Popover on selection")
          .addOption("manual_only", "Manual Hotkey / Context Menu only")
          .setValue(this.plugin.settings.triggerMode)
          .onChange(async (val) => {
            this.plugin.settings.triggerMode = val as TriggerMode;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Pronunciation Dialect / Accent")
      .setDesc("Preferred English dialect for audio speech synthesis")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("us", "American (US 🇺🇸)")
          .addOption("uk", "British (UK 🇬🇧)")
          .addOption("au", "Australian (AU 🇦🇺)")
          .setValue(this.plugin.settings.accentDialect)
          .onChange(async (val) => {
            this.plugin.settings.accentDialect = val as AccentDialectType;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Auto-play Pronunciation")
      .setDesc("Automatically play audio pronunciation when popup opens (if audio available)")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoPlayAudio).onChange(async (val) => {
          this.plugin.settings.autoPlayAudio = val;
          await this.plugin.saveSettings();
        })
      );

    // --- Web Research Quick-Bar ---
    containerEl.createEl("h3", { text: "Web Research Ribbon" });

    new Setting(containerEl)
      .setName("Enable Web Research Ribbon")
      .setDesc("Displays a minimalist 1-click icon ribbon for Wolfram|Alpha, Perplexity, Wikipedia, ScienceDirect, PubMed, Scholar, YouTube, and Reddit.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableResearchBar).onChange(async (val) => {
          this.plugin.settings.enableResearchBar = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Wolfram|Alpha App ID (Optional)")
      .setDesc("Enter your Wolfram|Alpha Full Results API AppID for expanded computation pods and steps (leave blank for automatic solver)")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("e.g. 26X8... (Optional)")
          .setValue(this.plugin.settings.wolframAppId || "")
          .onChange(async (val) => {
            this.plugin.settings.wolframAppId = val.trim();
            await this.plugin.saveSettings();
          });
      });

    // --- Deep-Dive Study Notes & Spaced Repetition ---
    containerEl.createEl("h3", { text: "Deep-Dive Study Notes & Spaced Repetition" });

    new Setting(containerEl)
      .setName("Study Notes Vault Folder")
      .setDesc("Folder where dedicated Deep-Dive study notes are stored")
      .addText((text) =>
        text
          .setPlaceholder("Study Notes")
          .setValue(this.plugin.settings.studyNotesFolder)
          .onChange(async (val) => {
            this.plugin.settings.studyNotesFolder = val.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Include Illustrations & Diagrams in Study Notes")
      .setDesc("Automatically embeds concept illustrations and diagrams into generated study notes")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeImagesInStudyNote).onChange(async (val) => {
          this.plugin.settings.includeImagesInStudyNote = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Enable Spaced Repetition Due Reminders")
      .setDesc("Shows an Active Recall reminder notice when opening a note whose review is due")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableSRS).onChange(async (val) => {
          this.plugin.settings.enableSRS = val;
          await this.plugin.saveSettings();
        })
      );

    // --- Vocabulary Log & Status Bar ---
    containerEl.createEl("h3", { text: "Vocabulary Vault & Status Bar" });

    new Setting(containerEl)
      .setName("Enable Vocabulary Logging")
      .setDesc("Enables logging discovered words to a dedicated markdown vault note")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableVocabLog).onChange(async (val) => {
          this.plugin.settings.enableVocabLog = val;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.enableVocabLog) {
      new Setting(containerEl)
        .setName("Vocabulary Log File Path")
        .setDesc("Target note path in your vault")
        .addText((text) =>
          text
            .setPlaceholder("Vocabulary Log.md")
            .setValue(this.plugin.settings.vocabLogPath)
            .onChange(async (val) => {
              this.plugin.settings.vocabLogPath = val.trim();
              await this.plugin.saveSettings();
            })
        );
    }

    new Setting(containerEl)
      .setName("Show Daily Word Counter in Status Bar")
      .setDesc("Displays '📚 X words logged today' in Obsidian's status bar")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableStatusBar).onChange(async (val) => {
          this.plugin.settings.enableStatusBar = val;
          await this.plugin.saveSettings();
          this.plugin.updateStatusBar();
        })
      );

    // --- Multi-Language Translation ---
    containerEl.createEl("h3", { text: "Multi-Language Translation" });

    new Setting(containerEl)
      .setName("Enable Translation")
      .setDesc("Show instant translation bar inside the lookup card")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableTranslation).onChange(async (val) => {
          this.plugin.settings.enableTranslation = val;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.enableTranslation) {
      new Setting(containerEl)
        .setName("Default Target Language")
        .setDesc("Language to translate terms into automatically")
        .addDropdown((dropdown) => {
          SUPPORTED_LANGUAGES.forEach((lang) => {
            dropdown.addOption(lang.code, lang.name);
          });
          dropdown.setValue(this.plugin.settings.defaultTargetLanguage);
          dropdown.onChange(async (val) => {
            this.plugin.settings.defaultTargetLanguage = val;
            await this.plugin.saveSettings();
          });
        });
    }

    // --- Anki Flashcards Integration ---
    containerEl.createEl("h3", { text: "Anki Flashcards Integration" });

    new Setting(containerEl)
      .setName("Enable Anki Sync")
      .setDesc("Enables 1-click vocabulary flashcard creation via AnkiConnect")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableAnki).onChange(async (val) => {
          this.plugin.settings.enableAnki = val;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.enableAnki) {
      new Setting(containerEl)
        .setName("Target Anki Deck")
        .setDesc("Target deck where cards will be saved")
        .addText((text) =>
          text
            .setPlaceholder("e.g. Obsidian Vocabulary")
            .setValue(this.plugin.settings.ankiDeckName)
            .onChange(async (val) => {
              this.plugin.settings.ankiDeckName = val.trim();
              await this.plugin.saveSettings();
            })
        )
        .addButton((btn) =>
          btn.setButtonText("Fetch Decks").onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText("Checking...");
            try {
              const decks = await this.plugin.ankiClient.getDeckNames();
              if (decks.length > 0) {
                new Notice(`Connected to Anki! Available Decks:\n${decks.join(", ")}`);
              } else {
                new Notice("Connected to Anki, but no decks found.");
              }
            } catch (err) {
              new Notice(`Connection Notice: ${(err as Error).message}`);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText("Fetch Decks");
            }
          })
        );

      let newDeckNameInput = "";
      new Setting(containerEl)
        .setName("Create New Anki Deck")
        .setDesc("Create a new deck directly in Anki and set it as active target")
        .addText((text) =>
          text.setPlaceholder("e.g. Medicine::Cardiology").onChange((val) => {
            newDeckNameInput = val;
          })
        )
        .addButton((btn) =>
          btn
            .setButtonText("Create Deck")
            .setCta()
            .onClick(async () => {
              const name = newDeckNameInput.trim();
              if (!name) {
                new Notice("Please enter a valid deck name.");
                return;
              }
              btn.setDisabled(true);
              btn.setButtonText("Creating...");
              try {
                await this.plugin.ankiClient.createDeck(name);
                this.plugin.settings.ankiDeckName = name;
                await this.plugin.saveSettings();
                new Notice(`Created and selected Anki deck "${name}"!`);
                this.display();
              } catch (err) {
                new Notice(`Could not create deck: ${(err as Error).message}`);
              } finally {
                btn.setDisabled(false);
                btn.setButtonText("Create Deck");
              }
            })
        );

      new Setting(containerEl)
        .setName("Create Cloze Deletion Cards")
        .setDesc("Wraps selected word in {{c1::word}} inside the context sentence")
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.ankiClozeFormat).onChange(async (val) => {
            this.plugin.settings.ankiClozeFormat = val;
            await this.plugin.saveSettings();
          })
        );

      new Setting(containerEl)
        .setName("Include Pronunciation Audio in Anki")
        .setDesc("Attaches audio pronunciation files to the flashcard")
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.ankiIncludeAudio).onChange(async (val) => {
            this.plugin.settings.ankiIncludeAudio = val;
            await this.plugin.saveSettings();
          })
        );

      new Setting(containerEl)
        .setName("Include Visual Image in Anki")
        .setDesc("Attaches the looked-up image illustration to the flashcard")
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.ankiIncludeImage).onChange(async (val) => {
            this.plugin.settings.ankiIncludeImage = val;
            await this.plugin.saveSettings();
          })
        );
    }

    // --- Insertion Options ---
    containerEl.createEl("h3", { text: "Note Insertion Formats" });

    new Setting(containerEl)
      .setName("Default Insert Format")
      .setDesc("Format applied when clicking the Insert button")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("callout", "Callout Box (> [!info] Word)")
          .addOption("tooltip_abbr", "Hover Tooltip (<abbr> tag popup)")
          .addOption("footnote", "Markdown Footnote ([^word])")
          .addOption("inline_bracket", "Inline Bracket (word [meaning])")
          .addOption("quote_block", "Custom Blockquote")
          .setValue(this.plugin.settings.defaultInsertFormat)
          .onChange(async (val) => {
            this.plugin.settings.defaultInsertFormat = val as InsertFormatType;
            await this.plugin.saveSettings();
          })
      );

    // --- Visuals & Images ---
    containerEl.createEl("h3", { text: "Visuals & Hover Preview" });

    new Setting(containerEl)
      .setName("Enable Stock Image Search")
      .setDesc("Search and display hoverable image previews for selected words")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showImages).onChange(async (val) => {
          this.plugin.settings.showImages = val;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    // --- AI Explainer Backend ---
    containerEl.createEl("h3", { text: "AI Context Explainer & Mnemonics (Optional)" });

    new Setting(containerEl)
      .setName("Enable AI Explanations")
      .setDesc("Enable contextual AI explanations, simple ELI5 summaries, and memory mnemonics")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableAI).onChange(async (val) => {
          this.plugin.settings.enableAI = val;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.enableAI) {
      new Setting(containerEl)
        .setName("AI Engine / Provider")
        .setDesc("Choose your AI provider")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("gemini", "Google Gemini (Free tier available)")
            .addOption("openai", "OpenAI (ChatGPT)")
            .addOption("anthropic", "Anthropic Claude")
            .addOption("ollama", "Local Ollama (100% Offline & Free)")
            .addOption("custom", "Custom OpenAI-compatible endpoint")
            .setValue(this.plugin.settings.aiProvider)
            .onChange(async (val) => {
              this.plugin.settings.aiProvider = val as AIProviderType;
              const presets = MODEL_PRESETS[this.plugin.settings.aiProvider] || [];
              if (presets.length > 0 && presets[0].id !== "custom") {
                this.plugin.settings.aiModel = presets[0].id;
              }
              await this.plugin.saveSettings();
              this.display();
            })
        );

      const presets = MODEL_PRESETS[this.plugin.settings.aiProvider] || [];
      const isPreset = presets.some((p) => p.id === this.plugin.settings.aiModel);
      const selectedModelValue = isPreset ? this.plugin.settings.aiModel : "custom";

      new Setting(containerEl)
        .setName("AI Model Selection")
        .setDesc("Select the specific model version to use")
        .addDropdown((dropdown) => {
          presets.forEach((p) => {
            dropdown.addOption(p.id, p.name);
          });
          dropdown.setValue(selectedModelValue);
          dropdown.onChange(async (val) => {
            if (val !== "custom") {
              this.plugin.settings.aiModel = val;
            }
            await this.plugin.saveSettings();
            this.display();
          });
        });

      if (selectedModelValue === "custom" || this.plugin.settings.aiProvider === "custom") {
        new Setting(containerEl)
          .setName("Custom Model Name")
          .setDesc("Enter exact model ID (e.g., gemini-2.0-flash, gpt-4o, llama3.2:1b)")
          .addText((text) =>
            text
              .setPlaceholder("model-id")
              .setValue(this.plugin.settings.aiModel)
              .onChange(async (val) => {
                this.plugin.settings.aiModel = val.trim();
                await this.plugin.saveSettings();
              })
          );
      }

      if (this.plugin.settings.aiProvider !== "ollama") {
        new Setting(containerEl)
          .setName("API Key")
          .setDesc("API Key for the chosen provider")
          .addText((text) => {
            text.inputEl.type = "password";
            text
              .setPlaceholder("Paste API Key here...")
              .setValue(this.plugin.settings.aiApiKey)
              .onChange(async (val) => {
                this.plugin.settings.aiApiKey = val.trim();
                await this.plugin.saveSettings();
              });
          });
      }

      new Setting(containerEl)
        .setName("AI Request Timeout (Seconds)")
        .setDesc("Maximum seconds to wait for AI response before falling back to factual encyclopedia extracts (recommended: 30s for local Ollama / detailed JSON)")
        .addSlider((slider) =>
          slider
            .setLimits(5, 60, 5)
            .setValue(this.plugin.settings.aiTimeoutSeconds || 30)
            .setDynamicTooltip()
            .onChange(async (val) => {
              this.plugin.settings.aiTimeoutSeconds = val;
              await this.plugin.saveSettings();
            })
        );
    }
  }
}
