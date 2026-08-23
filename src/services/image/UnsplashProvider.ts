import { requestUrl } from "obsidian";
import { ImageResult } from "../../types";
import { IImageProvider } from "./IImageProvider";

interface UnsplashPhoto {
  id: string;
  alt_description?: string;
  description?: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  user?: {
    name: string;
    username: string;
  };
  links?: {
    html: string;
  };
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
}

export class UnsplashProvider implements IImageProvider {
  name = "Unsplash Source";

  async search(term: string, limit: number = 4): Promise<ImageResult[]> {
    const cleanTerm = term.trim();
    if (!cleanTerm) return [];

    try {
      // Free direct search endpoint from Unsplash public service
      const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(
        cleanTerm
      )}&per_page=${limit}&page=1`;

      const response = await requestUrl({
        url,
        method: "GET",
        headers: {
          "Accept-Version": "v1",
        },
      });

      if (response.status !== 200 || !response.json) return [];

      const data: UnsplashSearchResponse = response.json;
      if (!data.results || !Array.isArray(data.results)) return [];

      return data.results.slice(0, limit).map((photo) => ({
        url: photo.urls.regular,
        thumbUrl: photo.urls.small || photo.urls.thumb,
        title: photo.alt_description || photo.description || cleanTerm,
        source: "unsplash",
        author: photo.user?.name,
        sourceUrl: photo.links?.html || `https://unsplash.com/photos/${photo.id}`,
      }));
    } catch {
      return [];
    }
  }
}
