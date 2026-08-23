import { TranslationResult } from "../../types";

export interface ITranslatorProvider {
  name: string;
  translate(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult | null>;
}
