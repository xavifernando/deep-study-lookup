import { DictionaryEntry, PluginSettings } from "../../types";
import { LookupCache } from "../cache/LookupCache";
import { RequestThrottle } from "../../utils/throttle";
import { FreeDictionaryProvider } from "./FreeDictionaryProvider";
import { IDictionaryProvider } from "./IDictionaryProvider";
import { WikipediaProvider } from "./WikipediaProvider";
import { OfflineDictionaryProvider } from "./OfflineDictionaryProvider";

export class DictionaryManager {
  private providers: IDictionaryProvider[];
  private cache: LookupCache;
  private settings: PluginSettings;
  private throttle = new RequestThrottle(250);

  constructor(cache: LookupCache, settings: PluginSettings) {
    this.cache = cache;
    this.settings = settings;
    this.providers = [
      new FreeDictionaryProvider(),
      new WikipediaProvider(),
      new OfflineDictionaryProvider(),
    ];
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }

  async lookup(term: string): Promise<DictionaryEntry | null> {
    const cleanTerm = term.trim();
    if (!cleanTerm) return null;

    const cacheKey = `dict:${cleanTerm.toLowerCase()}`;
    if (this.settings.enableCache) {
      const cached = this.cache.get<DictionaryEntry>(cacheKey);
      if (cached) return cached;
    }

    // Enforce network rate-limit throttle
    await this.throttle.wait();

    // 1. Direct search
    let result = await this.queryProviders(cleanTerm);
    if (result) {
      this.attachDifficultyLevel(result);
      if (this.settings.enableCache) this.cache.set(cacheKey, result);
      return result;
    }

    // 2. Smart Stemming / Lemmatization fallback
    const stemCandidates = this.getStemCandidates(cleanTerm);
    for (const stem of stemCandidates) {
      result = await this.queryProviders(stem);
      if (result) {
        this.attachDifficultyLevel(result);
        if (this.settings.enableCache) this.cache.set(cacheKey, result);
        return result;
      }
    }

    return null;
  }

  private attachDifficultyLevel(entry: DictionaryEntry): void {
    const len = entry.word.length;
    const isEncyclopedia = entry.isEncyclopedia;

    if (isEncyclopedia || len > 11 || /itis$|ology$|ation$|osis$|pathy$|phoresis$/i.test(entry.word)) {
      entry.difficultyLevel = "Academic / Technical";
    } else if (len >= 8) {
      entry.difficultyLevel = "Advanced (C1/C2)";
    } else if (len >= 5) {
      entry.difficultyLevel = "Intermediate (B1/B2)";
    } else {
      entry.difficultyLevel = "Beginner (A1/A2)";
    }
  }

  private async queryProviders(word: string): Promise<DictionaryEntry | null> {
    for (const provider of this.providers) {
      try {
        const res = await provider.lookup(word);
        if (res && res.meanings && res.meanings.length > 0) {
          return res;
        }
      } catch (err) {
        console.warn(`[SmartLookup] Provider ${provider.name} failed for "${word}":`, err);
      }
    }
    return null;
  }

  private getStemCandidates(word: string): string[] {
    const lower = word.toLowerCase();
    const candidates: string[] = [];

    if (lower.endsWith("ing")) {
      candidates.push(lower.slice(0, -3));
      candidates.push(lower.slice(0, -3) + "e");
    } else if (lower.endsWith("ed")) {
      candidates.push(lower.slice(0, -2));
      candidates.push(lower.slice(0, -1));
    } else if (lower.endsWith("ies")) {
      candidates.push(lower.slice(0, -3) + "y");
    } else if (lower.endsWith("es")) {
      candidates.push(lower.slice(0, -2));
    } else if (lower.endsWith("s") && !lower.endsWith("ss")) {
      candidates.push(lower.slice(0, -1));
    } else if (lower.endsWith("ly")) {
      candidates.push(lower.slice(0, -2));
    }

    return Array.from(new Set(candidates)).filter((c) => c.length > 2);
  }
}
