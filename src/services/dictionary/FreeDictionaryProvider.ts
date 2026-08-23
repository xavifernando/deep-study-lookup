import { requestUrl } from "obsidian";
import { DictionaryEntry, MeaningDefinition, PartOfSpeechMeaning, PhoneticData } from "../../types";
import { AudioPlayer } from "../../utils/audio";
import { IDictionaryProvider } from "./IDictionaryProvider";

interface RawPhonetic {
  text?: string;
  audio?: string;
}

interface RawDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface RawMeaning {
  partOfSpeech: string;
  definitions: RawDefinition[];
  synonyms?: string[];
  antonyms?: string[];
}

interface RawDictionaryResponse {
  word: string;
  phonetic?: string;
  phonetics?: RawPhonetic[];
  meanings: RawMeaning[];
  sourceUrls?: string[];
}

export class FreeDictionaryProvider implements IDictionaryProvider {
  name = "Free Dictionary API";

  async lookup(term: string): Promise<DictionaryEntry | null> {
    const cleanTerm = term.trim().toLowerCase();
    if (!cleanTerm) return null;

    try {
      const response = await requestUrl({
        url: `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanTerm)}`,
        method: "GET",
      });

      if (response.status !== 200 || !response.json) {
        return null;
      }

      const data: RawDictionaryResponse[] = response.json;
      if (!Array.isArray(data) || data.length === 0) {
        return null;
      }

      const first = data[0];
      const phonetics: PhoneticData[] = [];
      let phoneticText = first.phonetic;

      if (first.phonetics && Array.isArray(first.phonetics)) {
        for (const p of first.phonetics) {
          if (p.text && !phoneticText) {
            phoneticText = p.text;
          }
          if (p.audio || p.text) {
            phonetics.push({
              text: p.text,
              audio: p.audio ? AudioPlayer.normalizeAudioUrl(p.audio) : undefined,
            });
          }
        }
      }

      const meanings: PartOfSpeechMeaning[] = [];
      for (const m of first.meanings || []) {
        const defs: MeaningDefinition[] = (m.definitions || []).map((d) => ({
          definition: d.definition,
          example: d.example,
          synonyms: d.synonyms || [],
          antonyms: d.antonyms || [],
        }));

        meanings.push({
          partOfSpeech: m.partOfSpeech || "unknown",
          definitions: defs,
          synonyms: m.synonyms || [],
          antonyms: m.antonyms || [],
        });
      }

      return {
        word: first.word,
        phonetic: phoneticText,
        phonetics,
        meanings,
        sourceUrls: first.sourceUrls || [],
        isEncyclopedia: false,
      };
    } catch {
      return null;
    }
  }
}
