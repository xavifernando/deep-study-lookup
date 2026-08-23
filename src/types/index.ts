export interface PhoneticData {
  text?: string;
  audio?: string;
}

export interface MeaningDefinition {
  definition: string;
  example?: string;
  synonyms: string[];
  antonyms: string[];
}

export interface PartOfSpeechMeaning {
  partOfSpeech: string;
  definitions: MeaningDefinition[];
  synonyms: string[];
  antonyms: string[];
}

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: PhoneticData[];
  meanings: PartOfSpeechMeaning[];
  sourceUrls?: string[];
  isEncyclopedia?: boolean;
  extract?: string;
  difficultyLevel?: "Beginner (A1/A2)" | "Intermediate (B1/B2)" | "Advanced (C1/C2)" | "Academic / Technical";
  mnemonic?: string;
}

export interface ImageResult {
  url: string;
  thumbUrl: string;
  title: string;
  source: "wikimedia" | "unsplash" | "wikipedia";
  author?: string;
  sourceUrl?: string;
}

export interface MemoryPalaceRoute {
  frontDoor: string;
  livingRoom: string;
  kitchen: string;
  hallway: string;
  bedroom: string;
}

export interface AIExplanationResult {
  summary: string;
  simpleExplanation: string;
  etymology?: string;
  exampleSentences: string[];
  contextualMeaning?: string;
  translation?: string;
  mnemonic?: string;
  analogicalBridge?: string;
  sourceBadge?: string;
}

export interface StudyQuestion {
  question: string;
  answer: string;
}

export interface StudyNoteResult {
  title: string;
  summary: string;
  simpleDefinition: string;
  keyRules: string[];
  realWorldExample: string;
  whyItMatters: string;
  commonTraps: string;
  quickLinks: string[];
  visualDiagram?: string;
  mnemonicHook?: string;
  memoryPalaceRoute?: MemoryPalaceRoute | string;
  etymologyRoots?: string;
  acronymOrPeg?: string;
  analogicalBridge?: string;
  cueQuestions?: StudyQuestion[];
  keyPoints?: string[];
  mnemonic?: string;
  memoryPalace?: string;
  mermaidDiagram?: string;
  webSourceUrl?: string;
  fullWebExtract?: string;
  images?: ImageResult[];
  sourceBadge?: string;
}

export interface TranslationResult {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  provider: string;
}

export type TriggerMode = "selection_pill" | "auto_popup" | "manual_only";

export type AIProviderType = "gemini" | "openai" | "anthropic" | "ollama" | "custom";

export type InsertFormatType = "callout" | "tooltip_abbr" | "footnote" | "quote_block" | "inline_bracket";

export type AccentDialectType = "us" | "uk" | "au";

export type ResearchCategory = "All" | "AI Search" | "Academic & Medical" | "Video & Visuals" | "Tech & Math" | "General";

export interface ResearchEngine {
  id: string;
  name: string;
  shortLabel: string;
  category: "AI Search" | "Academic & Medical" | "Video & Visuals" | "Tech & Math" | "General";
  icon: string;
  urlTemplate: string;
}

export interface WolframResult {
  query: string;
  solution: string;
  pods: { title: string; text: string; image?: string }[];
  steps?: string[];
  markdownFormatted: string;
}

export interface YouTubeCaptionSegment {
  start: number;
  dur: number;
  text: string;
}

export interface YouTubeSummaryResult {
  videoId: string;
  title: string;
  author: string;
  summary: string;
  keyTakeaways: string[];
  chapters: { timestamp: string; title: string; summary: string }[];
  faq: { question: string; answer: string }[];
  markdownFormatted: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export const RESEARCH_ENGINES: ResearchEngine[] = [
  { id: "google", name: "Google Web Search", shortLabel: "Google", category: "General", icon: "search", urlTemplate: "https://www.google.com/search?q={{query}}" },
  { id: "wolfram", name: "Wolfram|Alpha (Problem Solver & Math)", shortLabel: "Wolfram", category: "Tech & Math", icon: "calculator", urlTemplate: "https://www.wolframalpha.com/input?i={{query}}" },
  { id: "perplexity", name: "Perplexity AI", shortLabel: "Perplexity", category: "AI Search", icon: "brain", urlTemplate: "https://www.perplexity.ai/search?q={{query}}" },
  { id: "wikipedia", name: "Wikipedia", shortLabel: "Wikipedia", category: "Academic & Medical", icon: "book-open", urlTemplate: "https://en.wikipedia.org/wiki/Special:Search?search={{query}}" },
  { id: "sciencedirect", name: "ScienceDirect", shortLabel: "ScienceDirect", category: "Academic & Medical", icon: "microscope", urlTemplate: "https://www.sciencedirect.com/search?qs={{query}}" },
  { id: "pubmed", name: "PubMed / NIH", shortLabel: "PubMed", category: "Academic & Medical", icon: "activity", urlTemplate: "https://pubmed.ncbi.nlm.nih.gov/?term={{query}}" },
  { id: "scholar", name: "Google Scholar", shortLabel: "Scholar", category: "Academic & Medical", icon: "graduation-cap", urlTemplate: "https://scholar.google.com/scholar?q={{query}}" },
  { id: "youtube", name: "YouTube (Tutorials & Explainers)", shortLabel: "YouTube", category: "Video & Visuals", icon: "video", urlTemplate: "https://www.youtube.com/results?search_query={{query}}+explained" },
  { id: "reddit", name: "Reddit Discussions", shortLabel: "Reddit", category: "General", icon: "message-square", urlTemplate: "https://www.reddit.com/search/?q={{query}}" },
];

export interface PluginSettings {
  triggerMode: TriggerMode;
  hotkey: string;
  showImages: boolean;
  imageProvider: "wikimedia" | "unsplash" | "all";
  maxImages: number;
  autoPlayAudio: boolean;
  accentDialect: AccentDialectType;
  // Multi-Engine Research Quick-Bar
  enableResearchBar: boolean;
  enabledEngines: string[];
  wolframAppId: string;
  // Translation
  enableTranslation: boolean;
  defaultTargetLanguage: string;
  // Deep-Dive Study Notes
  enableStudyNotes: boolean;
  studySummaryHeading: string;
  studyNotesFolder: string;
  includeImagesInStudyNote: boolean;
  enableSRS: boolean;
  // Status Bar & Mnemonics
  enableStatusBar: boolean;
  enableMnemonics: boolean;
  // AI Settings
  enableAI: boolean;
  aiProvider: AIProviderType;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  aiTimeoutSeconds: number;
  // Anki Settings
  enableAnki: boolean;
  ankiConnectUrl: string;
  ankiDeckName: string;
  ankiNoteType: string;
  ankiClozeFormat: boolean;
  ankiIncludeAudio: boolean;
  ankiIncludeImage: boolean;
  ankiTags: string;
  // Vocabulary Logging
  enableVocabLog: boolean;
  vocabLogPath: string;
  autoLogLookups: boolean;
  // Insertion format
  defaultInsertFormat: InsertFormatType;
  insertTemplate: string;
  imageInsertTemplate: string;
  enableCache: boolean;
  cacheTtlMinutes: number;
  reviewStreak: number;
  lastReviewDate: string;
}

export const MODEL_PRESETS: Record<AIProviderType, { id: string; name: string }[]> = {
  gemini: [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Fastest & Recommended)" },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (Balanced)" },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (Deep Reasoning)" },
    { id: "gemini-1.5-flash-8b", name: "Gemini 1.5 Flash-8B (Ultra Lightweight)" },
    { id: "gemini-1.0-pro", name: "Gemini 1.0 Pro" },
    { id: "custom", name: "Custom (Enter Manually)" },
  ],
  openai: [
    { id: "gpt-4o-mini", name: "GPT-4o Mini (Fast & Cheap, Recommended)" },
    { id: "gpt-4o", name: "GPT-4o (Omni High Intelligence)" },
    { id: "o1-mini", name: "o1-mini (Reasoning Model)" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    { id: "custom", name: "Custom (Enter Manually)" },
  ],
  anthropic: [
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku (Ultra Fast & Smart)" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (High Accuracy)" },
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
    { id: "custom", name: "Custom (Enter Manually)" },
  ],
  ollama: [
    { id: "llama3.2:latest", name: "Llama 3.2 (3B - Fast & Local)" },
    { id: "llama3.1:latest", name: "Llama 3.1 (8B - High Quality Local)" },
    { id: "mistral:latest", name: "Mistral 7B (Local)" },
    { id: "gemma2:9b", name: "Google Gemma 2 (9B Local)" },
    { id: "phi3.5:latest", name: "Microsoft Phi-3.5 (Mini Local)" },
    { id: "qwen2.5:7b", name: "Qwen 2.5 (7B Local)" },
    { id: "custom", name: "Custom (Enter Manually)" },
  ],
  custom: [
    { id: "custom", name: "Custom Model" },
  ],
};

export const DEFAULT_SETTINGS: PluginSettings = {
  triggerMode: "selection_pill",
  hotkey: "Mod+Shift+D",
  showImages: true,
  imageProvider: "all",
  maxImages: 4,
  autoPlayAudio: false,
  accentDialect: "us",
  enableResearchBar: true,
  enabledEngines: ["wolfram", "perplexity", "pubmed", "scholar", "youtube", "wikipedia", "reddit"],
  wolframAppId: "",
  enableTranslation: true,
  defaultTargetLanguage: "es",
  enableStudyNotes: true,
  studySummaryHeading: "## 📌 Key Synthesis & Takeaways",
  studyNotesFolder: "Study Notes",
  includeImagesInStudyNote: true,
  enableSRS: true,
  enableStatusBar: true,
  enableMnemonics: true,
  enableAI: false,
  aiProvider: "gemini",
  aiApiKey: "",
  aiModel: "gemini-2.0-flash",
  aiBaseUrl: "http://localhost:11434",
  aiTimeoutSeconds: 30,
  enableAnki: true,
  ankiConnectUrl: "http://127.0.0.1:8765",
  ankiDeckName: "Default",
  ankiNoteType: "Basic",
  ankiClozeFormat: false,
  ankiIncludeAudio: true,
  ankiIncludeImage: true,
  ankiTags: "obsidian, smart-lookup",
  enableVocabLog: true,
  vocabLogPath: "Vocabulary Log.md",
  autoLogLookups: false,
  defaultInsertFormat: "callout",
  insertTemplate: "> [!info] {{word}} (_{{phonetic}}_)\n> **{{partOfSpeech}}**: {{definition}}\n> *Example*: {{example}}",
  imageInsertTemplate: "![{{title}}]({{url}})",
  enableCache: true,
  cacheTtlMinutes: 1440,
  reviewStreak: 0,
  lastReviewDate: "",
};

export const SUPPORTED_LANGUAGES = [
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese (Simplified)" },
  { code: "ko", name: "Korean" },
  { code: "hi", name: "Hindi" },
  { code: "ar", name: "Arabic" },
  { code: "tr", name: "Turkish" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "sv", name: "Swedish" },
  { code: "id", name: "Indonesian" },
  { code: "vi", name: "Vietnamese" },
  { code: "el", name: "Greek" },
  { code: "he", name: "Hebrew" },
  { code: "th", name: "Thai" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "bn", name: "Bengali" },
];
