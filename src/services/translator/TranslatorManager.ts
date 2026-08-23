import { PluginSettings, TranslationResult } from "../../types";
import { LookupCache } from "../cache/LookupCache";
import { FreeTranslatorProvider } from "./FreeTranslatorProvider";

export class TranslatorManager {
  private freeProvider: FreeTranslatorProvider;
  private cache: LookupCache;
  private settings: PluginSettings;

  constructor(cache: LookupCache, settings: PluginSettings) {
    this.cache = cache;
    this.settings = settings;
    this.freeProvider = new FreeTranslatorProvider();
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }

  async translate(text: string, targetLang?: string, sourceLang = "en"): Promise<TranslationResult | null> {
    const cleanText = text.trim();
    if (!cleanText) return null;

    const lang = targetLang || this.settings.defaultTargetLanguage || "es";
    const cacheKey = `trans:${cleanText.toLowerCase()}:${sourceLang}:${lang}`;

    if (this.settings.enableCache) {
      const cached = this.cache.get<TranslationResult>(cacheKey);
      if (cached) return cached;
    }

    const result = await this.freeProvider.translate(cleanText, lang, sourceLang);
    if (result && this.settings.enableCache) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }
}
