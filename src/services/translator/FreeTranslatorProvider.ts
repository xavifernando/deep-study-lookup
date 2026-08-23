import { requestUrl } from "obsidian";
import { TranslationResult } from "../../types";
import { ITranslatorProvider } from "./ITranslatorProvider";
import { splitSentences } from "../../utils/markdown";

interface MyMemoryResponse {
  responseData?: {
    translatedText?: string;
    match?: number;
  };
  responseStatus?: number;
}

export class FreeTranslatorProvider implements ITranslatorProvider {
  name = "Free Translation Service";

  async translate(text: string, targetLang: string, sourceLang = "en"): Promise<TranslationResult | null> {
    const cleanText = text.trim();
    if (!cleanText) return null;

    // 1. Primary engine: Google Translate (no 500-char limit, translates long paragraphs smoothly)
    try {
      const gResult = await this.translateWithGoogle(cleanText, targetLang, sourceLang);
      if (gResult) return gResult;
    } catch (err) {
      console.warn("[SmartLookup] Google translation failed, trying chunked fallback:", err);
    }

    // 2. Chunked translation for long texts (sentences <= 400 chars)
    if (cleanText.length > 400) {
      const chunks = this.chunkText(cleanText, 380);
      const translatedChunks: string[] = [];

      for (const chunk of chunks) {
        const res = await this.translateSingleChunk(chunk, targetLang, sourceLang);
        if (res) {
          translatedChunks.push(res);
        } else {
          translatedChunks.push(chunk);
        }
      }

      if (translatedChunks.length > 0) {
        return {
          translatedText: translatedChunks.join(" "),
          sourceLang,
          targetLang,
          provider: "Google/MyMemory (Chunked)",
        };
      }
    }

    // 3. Single chunk fallback via MyMemory
    const singleResult = await this.translateSingleChunk(cleanText, targetLang, sourceLang);
    if (singleResult) {
      return {
        translatedText: singleResult,
        sourceLang,
        targetLang,
        provider: "MyMemory",
      };
    }

    return null;
  }

  private async translateWithGoogle(text: string, targetLang: string, sourceLang: string): Promise<TranslationResult | null> {
    const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const gRes = await requestUrl({
      url: gUrl,
      method: "GET",
    });

    const gJson = gRes.json as unknown[][][] | undefined;
    if (gRes.status === 200 && Array.isArray(gJson) && Array.isArray(gJson[0])) {
      const translated = gJson[0].map((item) => (Array.isArray(item) && typeof item[0] === "string" ? item[0] : "")).join("");
      if (translated) {
        return {
          translatedText: translated,
          sourceLang,
          targetLang,
          provider: "Google Translate",
        };
      }
    }
    return null;
  }

  private async translateSingleChunk(text: string, targetLang: string, sourceLang: string): Promise<string | null> {
    try {
      const pair = `${sourceLang}|${targetLang}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`;
      const res = await requestUrl({ url, method: "GET" });

      if (res.status === 200 && res.json) {
        const data = res.json as MyMemoryResponse;
        if (data.responseData?.translatedText) {
          return this.decodeHtmlEntities(data.responseData.translatedText);
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  private chunkText(text: string, maxLen = 380): string[] {
    const sentences = splitSentences(text);
    const chunks: string[] = [];
    let current = "";

    for (const sent of sentences) {
      if ((current + " " + sent).trim().length > maxLen) {
        if (current) chunks.push(current.trim());
        current = sent;
      } else {
        current = (current + " " + sent).trim();
      }
    }
    if (current) chunks.push(current.trim());
    return chunks;
  }

  private decodeHtmlEntities(str: string): string {
    const parser = new DOMParser();
    const dom = parser.parseFromString(`<!doctype html><body>${str}`, "text/html");
    return dom.body.textContent || str;
  }
}
