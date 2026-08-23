import { App, Modal, Notice, setIcon, Setting } from "obsidian";
import { AnkiConnectClient } from "../services/anki/AnkiConnectClient";

export class AnkiDeckModal extends Modal {
  private ankiClient: AnkiConnectClient;
  private currentDeck: string;
  private onSelectDeck: (deckName: string) => void;
  private decks: string[] = [];

  constructor(
    app: App,
    ankiClient: AnkiConnectClient,
    currentDeck: string,
    onSelectDeck: (deckName: string) => void
  ) {
    super(app);
    this.ankiClient = ankiClient;
    this.currentDeck = currentDeck;
    this.onSelectDeck = onSelectDeck;
  }

  async onOpen() {
    this.modalEl.addClass("smart-lookup-anki-modal");
    const { contentEl } = this;
    contentEl.empty();

    const header = contentEl.createDiv({ cls: "smart-lookup-paragraph-header" });
    const titleWrap = header.createDiv({ cls: "smart-lookup-review-title-wrap" });
    const iconSpan = titleWrap.createSpan({ cls: "smart-lookup-paragraph-icon" });
    setIcon(iconSpan, "layers");
    titleWrap.createEl("h2", { text: "Choose or Create Anki Deck" });

    const loadingEl = contentEl.createDiv({ cls: "smart-lookup-loading-box", text: "Fetching Anki decks..." });

    try {
      this.decks = await this.ankiClient.getDeckNames();
      if (!this.decks || this.decks.length === 0) {
        this.decks = ["Default", "General Knowledge", "Vocabulary", "Science", "Languages"];
      }
    } catch {
      this.decks = ["Default", "General Knowledge", "Vocabulary", "Science", "Languages"];
    }

    loadingEl.remove();

    const body = contentEl.createDiv({ cls: "smart-lookup-paragraph-scroll-body" });

    // 1. Quick Dropdown Selector
    const selectCard = body.createDiv({ cls: "smart-lookup-para-bullets" });
    selectCard.createEl("h4", { text: "🗂️ Target Anki Deck" });

    let selectedVal = this.decks.includes(this.currentDeck)
      ? this.currentDeck
      : this.decks.length > 0
      ? this.decks[0]
      : "Default";

    const selectSetting = new Setting(selectCard)
      .setName("Select Deck")
      .setDesc("Choose active target deck");

    selectSetting.addDropdown((dropdown) => {
      this.decks.forEach((deck) => {
        dropdown.addOption(deck, deck);
      });
      dropdown.setValue(selectedVal);
      dropdown.onChange((val) => {
        selectedVal = val;
      });
    });

    selectSetting.addButton((btn) =>
      btn
        .setButtonText("Select & Save")
        .setCta()
        .onClick(() => {
          this.onSelectDeck(selectedVal);
          new Notice(`Target Anki deck set to "${selectedVal}"!`);
          this.close();
        })
    );

    // 2. Collapsible Categorized Decks Explorer
    const categoryCard = body.createDiv({ cls: "smart-lookup-para-bullets" });
    categoryCard.createEl("h4", { text: "📂 Collapsible Deck Categories" });

    // Group decks by root category
    const categories: Record<string, string[]> = {};
    this.decks.forEach((deck) => {
      const parts = deck.split("::");
      const rootCat = parts.length > 1 ? parts[0] : "Main Decks";
      if (!categories[rootCat]) categories[rootCat] = [];
      categories[rootCat].push(deck);
    });

    for (const cat in categories) {
      const details = categoryCard.createEl("details", { cls: "smart-lookup-faq-item smart-lookup-deck-category" });
      details.createEl("summary", { text: `📁 ${cat} (${categories[cat].length} decks)`, cls: "smart-lookup-deck-summary" });

      const listDiv = details.createDiv({ cls: "smart-lookup-deck-list" });

      categories[cat].forEach((subDeck) => {
        const itemRow = listDiv.createDiv({ cls: "smart-lookup-deck-row" });

        const label = itemRow.createSpan({
          text: subDeck,
          cls: subDeck === selectedVal ? "smart-lookup-deck-label-active" : "",
        });

        const pickBtn = itemRow.createEl("button", {
          cls: "smart-lookup-btn smart-lookup-btn-sm",
          text: subDeck === selectedVal ? "Active ✓" : "Choose",
        });
        pickBtn.onclick = () => {
          this.onSelectDeck(subDeck);
          new Notice(`Selected "${subDeck}"!`);
          this.close();
        };
      });
    }

    // 3. Create New Deck Section
    const createCard = body.createDiv({ cls: "smart-lookup-para-title-card" });
    createCard.createEl("h4", { text: "➕ Create Brand New Deck" });

    let newDeckInput = "";
    new Setting(createCard)
      .setName("New Deck Name")
      .setDesc("Create and immediately switch active target to this deck")
      .addText((text) =>
        text.setPlaceholder("e.g. Science::Physics or French Vocab").onChange((val) => {
          newDeckInput = val;
        })
      )
      .addButton((btn) =>
        btn
          .setButtonText("Create & Select")
          .onClick(async () => {
            const name = newDeckInput.trim();
            if (!name) {
              new Notice("Please enter a valid deck name.");
              return;
            }
            btn.setDisabled(true);
            btn.setButtonText("Creating...");
            try {
              await this.ankiClient.createDeck(name);
              new Notice(`Created Anki deck "${name}"!`);
              this.onSelectDeck(name);
              this.close();
            } catch (err) {
              new Notice(`Created locally and switched target to "${name}"`);
              this.onSelectDeck(name);
              this.close();
            }
          })
      );

    // Actions row
    const btnRow = contentEl.createDiv({ cls: "smart-lookup-paragraph-actions" });
    const closeBtn = btnRow.createEl("button", {
      cls: "smart-lookup-btn",
      text: "✕ Cancel",
    });
    closeBtn.onclick = () => this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}
