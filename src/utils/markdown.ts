import { DictionaryEntry, ImageResult, InsertFormatType } from "../types";

export function formatDefinitionByStyle(
  entry: DictionaryEntry,
  style: InsertFormatType,
  customTemplate?: string
): string {
  const firstMeaning = entry.meanings[0];
  const firstDef = firstMeaning?.definitions[0];
  const defText = firstDef?.definition || entry.extract || "No definition";
  const pos = firstMeaning?.partOfSpeech ? `(${firstMeaning.partOfSpeech})` : "";
  const phonetic = entry.phonetic ? `/${entry.phonetic}/` : "";

  switch (style) {
    case "tooltip_abbr":
      // Renders as a hover popup tooltip natively in Obsidian Preview!
      const cleanTooltip = defText.replace(/"/g, "&quot;");
      return `<abbr title="${pos} ${cleanTooltip}">${entry.word}</abbr>`;

    case "callout":
      return `> [!info] ${entry.word} ${phonetic}\n> **${pos || "Meaning"}**: ${defText}${firstDef?.example ? `\n> *Example*: “${firstDef.example}”` : ""}`;

    case "footnote":
      return `${entry.word}[^${entry.word.toLowerCase()}]\n\n[^${entry.word.toLowerCase()}]: **${entry.word}** ${pos}: ${defText}`;

    case "inline_bracket":
      return `${entry.word} [${pos} ${defText}]`;

    case "quote_block":
    default:
      if (customTemplate) {
        let result = customTemplate;
        result = result.replace(/\{\{word\}\}/g, entry.word);
        result = result.replace(/\{\{phonetic\}\}/g, entry.phonetic || "");
        result = result.replace(/\{\{partOfSpeech\}\}/g, firstMeaning?.partOfSpeech || "");
        result = result.replace(/\{\{definition\}\}/g, defText);
        result = result.replace(/\{\{example\}\}/g, firstDef?.example || "");
        return result.trim();
      }
      return `> **${entry.word}** (${entry.phonetic || ""})\n> ${pos} ${defText}`;
  }
}

export function formatImageMarkdown(image: ImageResult, template: string): string {
  let result = template;
  result = result.replace(/\{\{title\}\}/g, image.title || "image");
  result = result.replace(/\{\{url\}\}/g, image.url);
  result = result.replace(/\{\{author\}\}/g, image.author || "");
  return result.trim();
}
