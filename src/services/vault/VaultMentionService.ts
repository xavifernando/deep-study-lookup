import { App, TFile } from "obsidian";

export interface VaultMention {
  file: TFile;
  basename: string;
  snippet: string;
}

export class VaultMentionService {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Scans markdown files in the vault to find notes mentioning the term
   */
  async findMentions(term: string, currentFilePath?: string, maxResults = 5): Promise<VaultMention[]> {
    const cleanTerm = term.trim();
    if (!cleanTerm || cleanTerm.length < 2) return [];

    const results: VaultMention[] = [];
    const files = this.app.vault.getMarkdownFiles();
    const regex = new RegExp(`\\b${cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

    for (const file of files) {
      if (currentFilePath && file.path === currentFilePath) continue;
      if (file.path.startsWith(".obsidian")) continue;

      try {
        const content = await this.app.vault.cachedRead(file);
        const match = regex.exec(content);
        if (match) {
          const index = match.index;
          const start = Math.max(0, index - 40);
          const end = Math.min(content.length, index + cleanTerm.length + 40);
          const snippet = "..." + content.slice(start, end).replace(/\n+/g, " ") + "...";

          results.push({
            file,
            basename: file.basename,
            snippet,
          });

          if (results.length >= maxResults) break;
        }
      } catch {
        // ignore
      }
    }

    return results;
  }
}
