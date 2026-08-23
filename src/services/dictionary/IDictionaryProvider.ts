import { DictionaryEntry } from "../../types";

export interface IDictionaryProvider {
  name: string;
  lookup(term: string): Promise<DictionaryEntry | null>;
}
