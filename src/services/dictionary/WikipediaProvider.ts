import { requestUrl } from "obsidian";
import { DictionaryEntry } from "../../types";
import { IDictionaryProvider } from "./IDictionaryProvider";

interface WikiSummaryResponse {
  title: string;
  extract?: string;
  description?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
}

export class WikipediaProvider implements IDictionaryProvider {
  name = "Wikipedia Summary API";

  async lookup(term: string): Promise<DictionaryEntry | null> {
    const cleanTerm = term.trim();
    if (!cleanTerm) return null;

    try {
      const response = await requestUrl({
        url: `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTerm)}`,
        method: "GET",
      });

      if (response.status !== 200 || !response.json) {
        return null;
      }

      const data = response.json as WikiSummaryResponse;
      if (!data?.extract) return null;

      return {
        word: data.title || cleanTerm,
        phonetic: data.description,
        phonetics: [],
        meanings: [
          {
            partOfSpeech: data.description || "Concept / Entity",
            definitions: [
              {
                definition: data.extract,
                synonyms: [],
                antonyms: [],
              },
            ],
            synonyms: [],
            antonyms: [],
          },
        ],
        sourceUrls: data.content_urls?.desktop?.page ? [data.content_urls.desktop.page] : [],
        isEncyclopedia: true,
        extract: data.extract,
      };
    } catch {
      return null;
    }
  }
}
