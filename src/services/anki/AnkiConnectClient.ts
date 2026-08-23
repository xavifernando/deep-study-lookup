import { requestUrl } from "obsidian";
import { DictionaryEntry, ImageResult, PluginSettings, StudyNoteResult } from "../../types";

export interface AnkiCardPayload {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
  audio?: {
    url: string;
    filename: string;
    fields: string[];
  }[];
  picture?: {
    url: string;
    filename: string;
    fields: string[];
  }[];
}

interface AnkiResponse<T = unknown> {
  error?: string | null;
  result?: T;
}

export class AnkiConnectClient {
  private settings: PluginSettings;

  constructor(settings: PluginSettings) {
    this.settings = settings;
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }

  private async invoke<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    try {
      const response = await requestUrl({
        url: this.settings.ankiConnectUrl || "http://127.0.0.1:8765",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          version: 6,
          params,
        }),
      });

      const res = response.json as AnkiResponse<T> | undefined;
      if (response.status !== 200 || !res) {
        throw new Error(`AnkiConnect HTTP ${response.status}`);
      }

      if (res.error) {
        throw new Error(`Anki Error: ${res.error}`);
      }

      return res.result as T;
    } catch (err: unknown) {
      const msg = (err as Error)?.message || String(err);
      if (msg.includes("Failed to fetch") || msg.includes("ECONNREFUSED") || msg.includes("404")) {
        throw new Error("Anki is not running or AnkiConnect add-on is not installed on port 8765.");
      }
      throw err;
    }
  }

  async getDeckNames(): Promise<string[]> {
    const result = await this.invoke<string[]>("deckNames");
    return Array.isArray(result) ? result : [];
  }

  async getDueCardsCount(deckName?: string): Promise<number> {
    try {
      const targetDeck = deckName || this.settings.ankiDeckName || "Obsidian Vocabulary";
      const cardIds = await this.invoke<number[]>("findCards", {
        query: `deck:"${targetDeck}" is:due`,
      });
      return Array.isArray(cardIds) ? cardIds.length : 0;
    } catch {
      return 0;
    }
  }

  async createDeck(deckName: string): Promise<boolean> {
    await this.invoke("createDeck", { deck: deckName.trim() });
    return true;
  }

  async createDeckIfNotExists(deckName: string): Promise<void> {
    try {
      await this.invoke("createDeck", { deck: deckName.trim() });
    } catch {
      // Ignore if already exists
    }
  }

  async addVocabularyCard(
    entry: DictionaryEntry,
    options: {
      deckName?: string;
      translation?: string;
      image?: ImageResult | null;
      contextSentence?: string;
      activeNoteTitle?: string;
    } = {}
  ): Promise<number> {
    const deckName = options.deckName || this.settings.ankiDeckName || "Obsidian Vocabulary";
    await this.createDeckIfNotExists(deckName);

    const firstMeaning = entry.meanings[0];
    const firstDef = firstMeaning?.definitions[0];
    const useCloze = this.settings.ankiClozeFormat && options.contextSentence;

    const tags = (this.settings.ankiTags || "obsidian, smart-lookup")
      .split(",")
      .map((t) => t.trim().replace(/\s+/g, "_"))
      .filter(Boolean);

    if (options.activeNoteTitle) {
      const noteTag = options.activeNoteTitle.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
      if (noteTag) tags.push(noteTag);
    }

    let modelName = this.settings.ankiNoteType || "Basic";
    const fields: Record<string, string> = {};

    const mnemonicHtml = entry.mnemonic ? `<details style="margin-top: 10px; padding: 6px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px;"><summary style="cursor: pointer; color: #b45309; font-weight: bold; font-size: 12px;">🧠 Memory Hook / Mnemonic</summary><div style="font-size: 13px; color: #78350f; margin-top: 4px;">${entry.mnemonic}</div></details>` : "";

    if (useCloze && options.contextSentence) {
      modelName = "Cloze";
      const regex = new RegExp(`\\b${entry.word}\\b`, "i");
      const clozeText = options.contextSentence.replace(regex, `{{c1::${entry.word}}}`);
      fields["Text"] = `<div style="font-size: 18px;">${clozeText}</div>`;
      fields["Extra"] = `<div><strong>${entry.word}</strong> <i>${entry.phonetic || ""}</i> (${firstMeaning?.partOfSpeech || ""})</div><div>${firstDef?.definition || entry.extract || ""}</div>${options.translation ? `<div style="color: #059669;">Translation: ${options.translation}</div>` : ""}${mnemonicHtml}`;
    } else {
      let frontHtml = `<div style="font-size: 22px; font-weight: bold; color: #3b82f6;">${entry.word}</div>`;
      if (entry.phonetic) {
        frontHtml += `<div style="font-size: 14px; color: #888; margin-top: 4px;"><i>${entry.phonetic}</i></div>`;
      }
      if (options.contextSentence) {
        frontHtml += `<div style="font-size: 13px; color: #666; margin-top: 8px; font-style: italic;">“${options.contextSentence}”</div>`;
      }

      let backHtml = `<div style="text-align: left; font-size: 15px;">`;
      if (firstMeaning?.partOfSpeech) {
        backHtml += `<span style="background: #e2e8f0; color: #334155; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: bold;">${firstMeaning.partOfSpeech}</span><br><br>`;
      }
      backHtml += `<div><strong>Definition:</strong> ${firstDef?.definition || entry.extract || "N/A"}</div>`;

      if (firstDef?.example) {
        backHtml += `<div style="margin-top: 6px; color: #555;"><strong>Example:</strong> <i>“${firstDef.example}”</i></div>`;
      }

      if (options.translation) {
        backHtml += `<div style="margin-top: 8px; color: #059669;"><strong>Translation:</strong> ${options.translation}</div>`;
      }

      if (firstMeaning?.synonyms && firstMeaning.synonyms.length > 0) {
        backHtml += `<div style="margin-top: 6px; font-size: 13px; color: #777;"><strong>Synonyms:</strong> ${firstMeaning.synonyms.slice(0, 4).join(", ")}</div>`;
      }

      backHtml += `${mnemonicHtml}</div>`;

      fields["Front"] = frontHtml;
      fields["Back"] = backHtml;
    }

    const notePayload: AnkiCardPayload = {
      deckName,
      modelName,
      fields,
      tags,
    };

    if (this.settings.ankiIncludeAudio) {
      const audioPhonetic = entry.phonetics?.find((p) => p.audio);
      if (audioPhonetic?.audio) {
        notePayload.audio = [
          {
            url: audioPhonetic.audio,
            filename: `smart_lookup_${entry.word.replace(/\s+/g, "_")}.mp3`,
            fields: [useCloze ? "Text" : "Front"],
          },
        ];
      }
    }

    if (this.settings.ankiIncludeImage && options.image?.url) {
      notePayload.picture = [
        {
          url: options.image.url,
          filename: `smart_lookup_${entry.word.replace(/\s+/g, "_")}.jpg`,
          fields: [useCloze ? "Extra" : "Back"],
        },
      ];
    }

    const noteId = await this.invoke<number>("addNote", { note: notePayload });
    return noteId;
  }

  async addClozeCard(
    sentence: string,
    targetWord: string,
    extraDetails: string,
    deckName?: string
  ): Promise<number> {
    const targetDeck = deckName || this.settings.ankiDeckName || "Obsidian Vocabulary";
    await this.createDeckIfNotExists(targetDeck);

    const regex = new RegExp(`\\b${targetWord}\\b`, "i");
    const clozeText = sentence.includes("{{c1::")
      ? sentence
      : sentence.replace(regex, `{{c1::${targetWord}}}`);

    const payload: AnkiCardPayload = {
      deckName: targetDeck,
      modelName: "Cloze",
      fields: {
        Text: `<div style="font-size: 18px; line-height: 1.6;">${clozeText}</div>`,
        Extra: `<div style="margin-top: 10px; font-size: 15px;">${extraDetails}</div>`,
        "Back Extra": `<div style="margin-top: 10px; font-size: 15px;">${extraDetails}</div>`,
      },
      tags: ["smart-lookup", "cloze", "active-recall"],
    };

    const noteId = await this.invoke("addNote", { note: payload });
    return typeof noteId === "number" ? noteId : 1;
  }

  async addStudyCards(
    studyPack: StudyNoteResult,
    options: {
      deckName?: string;
      activeNoteTitle?: string;
    } = {}
  ): Promise<number> {
    const deckName = options.deckName || this.settings.ankiDeckName || "Obsidian Vocabulary";
    await this.createDeckIfNotExists(deckName);

    const tags = (this.settings.ankiTags || "obsidian, study-note, active-recall")
      .split(",")
      .map((t) => t.trim().replace(/\s+/g, "_"))
      .filter(Boolean);

    if (options.activeNoteTitle) {
      const noteTag = options.activeNoteTitle.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
      if (noteTag) tags.push(noteTag);
    }

    let addedCount = 0;
    for (const q of studyPack.cueQuestions) {
      const notePayload: AnkiCardPayload = {
        deckName,
        modelName: "Basic",
        fields: {
          Front: `<div style="font-size: 14px; color: #888;">[Active Recall: ${studyPack.title}]</div><div style="font-size: 20px; font-weight: bold; margin-top: 8px; color: #1e293b;">${q.question}</div>`,
          Back: `<div style="font-size: 16px; color: #334155; text-align: left;">${q.answer}</div><hr><div style="font-size: 12px; color: #64748b;">Summary: ${studyPack.summary}</div>`,
        },
        tags,
      };

      try {
        await this.invoke("addNote", { note: notePayload });
        addedCount++;
      } catch (err) {
        console.warn("[SmartLookup] Could not add FAQ to Anki:", err);
      }
    }

    return addedCount;
  }
}
