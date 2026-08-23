import { App, normalizePath, TFile } from "obsidian";
import { DictionaryEntry, PluginSettings } from "../../types";

export class VocabLogService {
  private app: App;
  private settings: PluginSettings;
  private dailyCount = 0;
  private lastDate = "";
  private onCountChange?: (count: number) => void;

  constructor(app: App, settings: PluginSettings, onCountChange?: (count: number) => void) {
    this.app = app;
    this.settings = settings;
    this.onCountChange = onCountChange;
    this.initDailyCount();
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }

  private async initDailyCount(): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    const rawPath = (this.settings.vocabLogPath || "Vocabulary Log.md").trim();
    const filePath = normalizePath(rawPath);
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      try {
        const content = await this.app.vault.read(file);
        const matches = content.match(new RegExp(`\\|\\s*${today}`, "g"));
        this.dailyCount = matches ? matches.length : 0;
        this.lastDate = today;
        this.notifyCount();
        return;
      } catch {
        // ignore
      }
    }
    this.dailyCount = 0;
    this.lastDate = today;
    this.notifyCount();
  }

  private incrementCount(): void {
    const today = new Date().toISOString().split("T")[0];
    if (this.lastDate !== today) {
      this.dailyCount = 1;
      this.lastDate = today;
    } else {
      this.dailyCount++;
    }
    this.notifyCount();
  }

  private notifyCount(): void {
    if (this.onCountChange) {
      this.onCountChange(this.dailyCount);
    }
  }

  getDailyCount(): number {
    return this.dailyCount;
  }

  async logWord(
    entry: DictionaryEntry,
    options: {
      translation?: string;
      contextSentence?: string;
      activeNoteTitle?: string;
    } = {}
  ): Promise<void> {
    if (!this.settings.enableVocabLog) return;

    const rawPath = (this.settings.vocabLogPath || "Vocabulary Log.md").trim();
    const filePath = normalizePath(rawPath);
    const firstMeaning = entry.meanings[0];
    const firstDef = firstMeaning?.definitions[0]?.definition || entry.extract || "No definition";
    const pos = firstMeaning?.partOfSpeech ? `*(${firstMeaning.partOfSpeech})*` : "";
    const phonetic = entry.phonetic ? `/${entry.phonetic}/` : "";
    const dateStr = new Date().toISOString().split("T")[0];

    let entryMd = `\n### [[${entry.word}]] ${phonetic} ${pos}\n`;
    entryMd += `- **Date**: ${dateStr}\n`;
    if (options.activeNoteTitle) {
      entryMd += `- **Source Note**: [[${options.activeNoteTitle}]]\n`;
    }
    entryMd += `- **Meaning**: ${firstDef}\n`;
    if (options.translation) {
      entryMd += `- **Translation**: ${options.translation}\n`;
    }
    if (options.contextSentence) {
      entryMd += `- **Context**: *“${options.contextSentence}”*\n`;
    }
    if (entry.mnemonic) {
      entryMd += `- **Mnemonic**: 💡 *${entry.mnemonic}*\n`;
    }
    entryMd += `---\n`;

    const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
    if (abstractFile instanceof TFile) {
      await this.app.vault.append(abstractFile, entryMd);
    } else {
      const header = `# 📚 Vocabulary Log\n\nCurated vocabulary discovered in your notes.\n\n---\n`;
      await this.app.vault.create(filePath, header + entryMd);
    }

    this.incrementCount();
  }
}
