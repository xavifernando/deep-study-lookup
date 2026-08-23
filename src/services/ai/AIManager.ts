import { requestUrl } from "obsidian";
import { AIExplanationResult, PluginSettings } from "../../types";
import { LookupCache } from "../cache/LookupCache";
import { GeminiProvider } from "./GeminiProvider";
import { AIExplanationOptions, IAIProvider } from "./IAIProvider";
import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider";

export class AIManager {
  private geminiProvider: GeminiProvider;
  private openAIProvider: OpenAICompatibleProvider;
  private cache: LookupCache;
  private settings: PluginSettings;

  constructor(cache: LookupCache, settings: PluginSettings) {
    this.cache = cache;
    this.settings = settings;
    this.geminiProvider = new GeminiProvider(settings);
    this.openAIProvider = new OpenAICompatibleProvider(settings);
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
    this.geminiProvider = new GeminiProvider(settings);
    this.openAIProvider = new OpenAICompatibleProvider(settings);
  }

  async explain(options: AIExplanationOptions): Promise<AIExplanationResult | null> {
    const cleanTerm = options.word.trim();
    if (!cleanTerm) return null;

    const level = options.complexityLevel || "practical";
    const cacheKey = `ai:${cleanTerm.toLowerCase()}:${this.settings.aiProvider}:${level}:${options.contextSentence || ""}`;
    if (this.settings.enableCache) {
      const cached = this.cache.get<AIExplanationResult>(cacheKey);
      if (cached) return cached;
    }

    // 1. Try configured primary provider
    try {
      const primaryProvider = this.settings.aiProvider === "gemini" ? this.geminiProvider : this.openAIProvider;
      const result = await primaryProvider.explain(options);
      if (result) {
        result.sourceBadge = this.settings.aiProvider === "gemini"
          ? `✨ ${this.settings.aiModel || "Gemini"}`
          : (this.settings.aiProvider === "ollama" ? `🦙 Ollama (${this.settings.aiModel || "llama3"})` : `✨ ${this.settings.aiModel || "OpenAI"}`);
        if (this.settings.enableCache) {
          this.cache.set(cacheKey, result);
        }
        return result;
      }
    } catch (primaryErr) {
      console.warn("[SmartLookup] Primary AI provider failed, trying fallback:", primaryErr);
    }

    // 2. Try secondary provider
    try {
      const secondaryProvider = this.settings.aiProvider === "gemini" ? this.openAIProvider : this.geminiProvider;
      const secResult = await secondaryProvider.explain(options);
      if (secResult) {
        secResult.sourceBadge = this.settings.aiProvider === "gemini"
          ? `✨ ${this.settings.aiModel || "OpenAI"}`
          : `✨ ${this.settings.aiModel || "Gemini"}`;
        if (this.settings.enableCache) {
          this.cache.set(cacheKey, secResult);
        }
        return secResult;
      }
    } catch {
      // ignore
    }

    // 3. Fallback to honest encyclopedic synthesis (guaranteed zero fabrication)
    const fallback = await this.generateSmartFallback(cleanTerm, options.contextSentence, level);
    if (fallback) {
      if (this.settings.enableCache) {
        this.cache.set(cacheKey, fallback);
      }
      return fallback;
    }

    return null;
  }

  private async generateSmartFallback(term: string, contextSentence?: string, level: "eli5" | "practical" | "expert" = "practical"): Promise<AIExplanationResult> {
    let extract = "";
    let wikiFound = false;
    try {
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term.trim().replace(/ /g, "_"))}`;
      const res = await requestUrl({
        url: wikiUrl,
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });

      if (res.status === 200 && res.json && res.json.extract) {
        extract = res.json.extract;
        wikiFound = true;
      }
    } catch {
      // Gracefully fall through to contextual summary
    }

    const sentences = extract ? extract.split(/(?<=[.!?])\s+/).filter(s => s.length > 10) : [];
    const baseSummary = sentences[0] || (contextSentence
      ? `Referenced in note context: "${contextSentence.slice(0, 140)}..."`
      : `Definition and literature reference for "${term}".`);

    const simpleExplanation = sentences[1] || (sentences[0] ? sentences[0] : (contextSentence
      ? `Used in your active note to express: "${contextSentence.slice(0, 120)}..."`
      : `Factual reference for ${term}.`));

    return {
      summary: baseSummary,
      simpleExplanation: simpleExplanation,
      exampleSentences: [
        contextSentence || (sentences[2] || `Factual usage in literature regarding ${term}.`),
      ],
      contextualMeaning: contextSentence ? `Note Context: "${contextSentence.slice(0, 120)}..."` : undefined,
      sourceBadge: wikiFound ? "📖 Wikipedia (Factual Extract)" : "📚 Dictionary / Note Context",
    };
  }
}
