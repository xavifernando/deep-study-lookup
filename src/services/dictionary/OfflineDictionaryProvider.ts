import { DictionaryEntry } from "../../types";
import { IDictionaryProvider } from "./IDictionaryProvider";

const OFFLINE_TERMS: Record<string, { pos: string; def: string; origin?: string; syn?: string[] }> = {
  algorithm: {
    pos: "noun",
    def: "A step-by-step procedure or mathematical set of rules designed to solve a specific problem or execute a computation.",
    origin: "From Persian mathematician al-Khwarizmi (9th century)",
    syn: ["procedure", "protocol", "routine", "formula"],
  },
  recursion: {
    pos: "noun",
    def: "The process in which a function or routine calls itself directly or indirectly to solve smaller instances of the same problem.",
    origin: "From Latin recursio ('running back')",
    syn: ["self-reference", "iteration"],
  },
  entropy: {
    pos: "noun",
    def: "A thermodynamic quantity representing the unavailability of a system's thermal energy for mechanical work, commonly understood as a measure of disorder or randomness.",
    origin: "From Greek entropia ('a turning toward')",
    syn: ["disorder", "randomness", "uncertainty"],
  },
  mitosis: {
    pos: "noun",
    def: "A type of cell division that results in two daughter cells each having the same number and kind of chromosomes as the parent nucleus.",
    origin: "From Greek mitos ('warp thread')",
    syn: ["cell division", "replication"],
  },
  photosynthesis: {
    pos: "noun",
    def: "The biological process by which green plants and certain other organisms use sunlight to synthesize nutrients from carbon dioxide and water.",
    origin: "From Greek photo ('light') + synthesis ('putting together')",
    syn: ["carbon fixation", "light reaction"],
  },
  metabolism: {
    pos: "noun",
    def: "The chemical processes that occur within a living organism in order to maintain life, including catabolism and anabolism.",
    origin: "From Greek metabole ('change')",
    syn: ["bioenergetics", "transformation"],
  },
  epistemology: {
    pos: "noun",
    def: "The philosophical branch that investigates the origin, nature, methods, and limits of human knowledge.",
    origin: "From Greek episteme ('knowledge') + logia ('study of')",
    syn: ["theory of knowledge", "philosophy of mind"],
  },
  derivative: {
    pos: "noun",
    def: "In mathematics, the rate of change of a function with respect to a variable; geometrically, the slope of the tangent line.",
    origin: "From Latin derivativus ('drawn off')",
    syn: ["rate of change", "gradient", "differential"],
  },
  latency: {
    pos: "noun",
    def: "The time elapsed between the initiation of a request or stimulus and the emergence of a visible response or transmission.",
    origin: "From Latin latentia ('hiddenness')",
    syn: ["delay", "lag", "response time"],
  },
  heuristic: {
    pos: "adjective",
    def: "Enabling a person or algorithm to discover or learn something for themselves; a practical problem-solving shortcut.",
    origin: "From Greek heuriskein ('to find')",
    syn: ["rule of thumb", "shortcut", "practical method"],
  },
};

const ROOTS_AND_AFFIXES: Record<string, string> = {
  hyper: "Over, excessive, beyond normal limits (e.g. hypertension, hypertrophy)",
  hypo: "Under, deficient, below normal limits (e.g. hypoglycemia, hypothesis)",
  bio: "Life or living organisms (e.g. biology, biochemistry)",
  auto: "Self, same, spontaneous (e.g. autonomous, automatic)",
  poly: "Many, multiple (e.g. polymer, polynomial)",
  mono: "One, single (e.g. monomer, monochromatic)",
  morph: "Form, shape, or structure (e.g. morphology, amorphous)",
  syn: "Together, with, union (e.g. synthesis, synergy)",
  anti: "Against, opposite, preventative (e.g. antibody, antibiotic)",
  endo: "Internal, within, inside (e.g. endocrine, endothermic)",
  exo: "External, outer, outside (e.g. exothermic, exoskeleton)",
  chrono: "Time, duration (e.g. chronological, chronic)",
  tele: "Distant, far off (e.g. telemetry, television)",
  micro: "Small, microscopic (e.g. microcosm, microbiology)",
  macro: "Large, whole scale (e.g. macroeconomics, macroscopic)",
};

export class OfflineDictionaryProvider implements IDictionaryProvider {
  name = "Offline Curated Lexicon";

  async lookup(term: string): Promise<DictionaryEntry | null> {
    const clean = term.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!clean) return null;

    // 1. Direct match in curated academic lexicon
    if (OFFLINE_TERMS[clean]) {
      const d = OFFLINE_TERMS[clean];
      return {
        word: term.trim(),
        phonetic: d.origin ? `[Origin: ${d.origin}]` : undefined,
        phonetics: [],
        meanings: [
          {
            partOfSpeech: d.pos,
            definitions: [
              {
                definition: d.def,
                synonyms: d.syn || [],
                antonyms: [],
              },
            ],
            synonyms: d.syn || [],
            antonyms: [],
          },
        ],
        sourceUrls: [],
        isEncyclopedia: false,
      };
    }

    // 2. Root / Prefix / Affix decomposition
    for (const [affix, meaning] of Object.entries(ROOTS_AND_AFFIXES)) {
      if (clean.startsWith(affix) && clean.length > affix.length + 2) {
        return {
          word: term.trim(),
          phonetic: `[Root: "${affix}" - ${meaning}]`,
          phonetics: [],
          meanings: [
            {
              partOfSpeech: "academic root",
              definitions: [
                {
                  definition: `Derived from root "${affix}" (${meaning}). Represents a specialized concept involving this core prefix.`,
                  synonyms: [],
                  antonyms: [],
                },
              ],
              synonyms: [],
              antonyms: [],
            },
          ],
          sourceUrls: [],
          isEncyclopedia: false,
        };
      }
    }

    return null;
  }
}
