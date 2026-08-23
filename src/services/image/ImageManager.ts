import { ImageResult, PluginSettings } from "../../types";
import { LookupCache } from "../cache/LookupCache";
import { RequestThrottle } from "../../utils/throttle";
import { IImageProvider } from "./IImageProvider";
import { UnsplashProvider } from "./UnsplashProvider";
import { WikimediaProvider } from "./WikimediaProvider";

export class ImageManager {
  private wikimediaProvider: WikimediaProvider;
  private unsplashProvider: UnsplashProvider;
  private cache: LookupCache;
  private settings: PluginSettings;
  private throttle = new RequestThrottle(300);

  constructor(cache: LookupCache, settings: PluginSettings) {
    this.cache = cache;
    this.settings = settings;
    this.wikimediaProvider = new WikimediaProvider();
    this.unsplashProvider = new UnsplashProvider();
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }

  async search(term: string): Promise<ImageResult[]> {
    if (!this.settings.showImages) return [];
    const cleanTerm = term.trim();
    if (!cleanTerm) return [];

    const cacheKey = `img:${cleanTerm.toLowerCase()}:${this.settings.imageProvider}`;
    if (this.settings.enableCache) {
      const cached = this.cache.get<ImageResult[]>(cacheKey);
      if (cached) return cached;
    }

    await this.throttle.wait();

    const limit = this.settings.maxImages || 4;
    const providers: IImageProvider[] = [];

    if (this.settings.imageProvider === "wikimedia" || this.settings.imageProvider === "all") {
      providers.push(this.wikimediaProvider);
    }
    if (this.settings.imageProvider === "unsplash" || this.settings.imageProvider === "all") {
      providers.push(this.unsplashProvider);
    }

    const resultsMap = new Map<string, ImageResult>();

    for (const provider of providers) {
      try {
        await this.throttle.wait();
        const images = await provider.search(cleanTerm, limit);
        for (const img of images) {
          if (!resultsMap.has(img.url)) {
            resultsMap.set(img.url, img);
          }
          if (resultsMap.size >= limit) break;
        }
      } catch (err) {
        console.warn(`[SmartLookup] Image provider ${provider.name} failed:`, err);
      }
      if (resultsMap.size >= limit) break;
    }

    const finalResults = Array.from(resultsMap.values()).slice(0, limit);
    if (this.settings.enableCache && finalResults.length > 0) {
      this.cache.set(cacheKey, finalResults);
    }

    return finalResults;
  }

  async searchImages(term: string): Promise<ImageResult[]> {
    return this.search(term);
  }
}
