import { AIExplanationResult } from "../../types";

export interface AIExplanationOptions {
  word: string;
  contextSentence?: string;
  targetLanguage?: string;
  complexityLevel?: "eli5" | "practical" | "expert";
}

export interface IAIProvider {
  name: string;
  explain(options: AIExplanationOptions): Promise<AIExplanationResult | null>;
}
