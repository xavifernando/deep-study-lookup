import { requestUrl } from "obsidian";
import { ImageResult } from "../../types";
import { IImageProvider } from "./IImageProvider";

interface WikiImagePage {
  pageid: number;
  title: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  original?: {
    source: string;
    width: number;
    height: number;
  };
}

interface WikiQueryResponse {
  query?: {
    pages?: Record<string, WikiImagePage>;
  };
}

export class WikimediaProvider implements IImageProvider {
  name = "Wikimedia Commons";

  async search(term: string, limit: number = 4): Promise<ImageResult[]> {
    const cleanTerm = term.trim();
    if (!cleanTerm) return [];

    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        cleanTerm
      )}&gsrlimit=${limit * 2}&prop=pageimages&pithumbsize=400&piprop=thumbnail|original&format=json&origin=*`;

      const response = await requestUrl({
        url,
        method: "GET",
      });

interface WikiSummaryImageResponse {
  title?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

interface CommonsPage {
  title?: string;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    descriptionurl?: string;
  }>;
}

interface CommonsQueryResponse {
  query?: {
    pages?: Record<string, CommonsPage>;
  };
}

      if (response.status !== 200 || !response.json) return [];

      const data = response.json as WikiQueryResponse;
      if (!data?.query?.pages) return [];

      const results: ImageResult[] = [];
      for (const pageId in data.query.pages) {
        const page = data.query.pages[pageId];
        if (page.thumbnail && page.thumbnail.source) {
          // Clean title removing File: or similar
          const title = page.title.replace(/^File:/, "").replace(/\.[^/.]+$/, "");
          results.push({
            url: page.original ? page.original.source : page.thumbnail.source,
            thumbUrl: page.thumbnail.source,
            title: title || cleanTerm,
            source: "wikimedia",
            sourceUrl: `https://en.wikipedia.org/?curid=${page.pageid}`,
          });
        }
        if (results.length >= limit) break;
      }

      if (results.length > 0) {
        return results;
      }

      // Fallback 1: Wikipedia REST Page Summary API
      try {
        const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTerm.replace(/\s+/g, "_"))}`;
        const sumRes = await requestUrl({ url: sumUrl, method: "GET" });
        const sumJson = sumRes.json as WikiSummaryImageResponse | undefined;
        if (sumRes.status === 200 && sumJson?.thumbnail?.source) {
          results.push({
            url: sumJson.originalimage?.source || sumJson.thumbnail.source,
            thumbUrl: sumJson.thumbnail.source,
            title: sumJson.title || cleanTerm,
            source: "wikimedia",
            sourceUrl: sumJson.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(cleanTerm)}`,
          });
        }
      } catch {
        // ignore
      }

      // Fallback 2: Wikimedia Commons File Search API
      try {
        const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanTerm)}&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url|thumburl&iiurlwidth=400&format=json&origin=*`;
        const cRes = await requestUrl({ url: commonsUrl, method: "GET" });
        const cJson = cRes.json as CommonsQueryResponse | undefined;
        if (cRes.status === 200 && cJson?.query?.pages) {
          const pages = cJson.query.pages;
          for (const pid in pages) {
            const page = pages[pid];
            const info = page?.imageinfo?.[0];
            if (info && info.thumburl) {
              results.push({
                url: info.url || info.thumburl,
                thumbUrl: info.thumburl,
                title: page?.title?.replace(/^File:/, "").replace(/\.[^/.]+$/, "") || cleanTerm,
                source: "wikimedia",
                sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/?curid=${pid}`,
              });
            }
            if (results.length >= limit) break;
          }
        }
      } catch {
        // ignore
      }

      return results;
    } catch {
      return [];
    }
  }
}
