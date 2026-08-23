import { requestUrl } from "obsidian";
import { AIExplanationResult, PluginSettings } from "../../types";
import { AIExplanationOptions, IAIProvider } from "./IAIProvider";

export class GeminiProvider implements IAIProvider {
  name = "Google Gemini";
  private settings: PluginSettings;

  constructor(settings: PluginSettings) {
    this.settings = settings;
  }

  async explain(options: AIExplanationOptions): Promise<AIExplanationResult | null> {
    const rawKey = this.settings.aiApiKey ? this.settings.aiApiKey.trim().replace(/^["']|["']$/g, "") : "";
    if (!rawKey) {
      throw new Error("Gemini API Key is missing. Please enter your API key in Plugin Settings.");
    }

    let model = (this.settings.aiModel || "gemini-1.5-flash").trim();
    // Normalize model string if user pasted 'models/gemini-1.5-flash'
    model = model.replace(/^models\//, "");

    const levelInstruction = options.complexityLevel === "eli5"
      ? "Complexity Target: Explain for a beginner / ELI5 with everyday analogies and zero jargon."
      : options.complexityLevel === "expert"
      ? "Complexity Target: Explain at an advanced, rigorous, technical academic level with exact operational mechanics."
      : "Complexity Target: Explain clearly and practically for general learning.";

    const prompt = `You are a concise, helpful vocabulary and concept tutor.
Explain the term: "${options.word}".
${levelInstruction}
${options.contextSentence ? `Appears in context: "${options.contextSentence}"` : ""}
Target Language: ${options.targetLanguage || "English"}

Return ONLY a valid JSON object matching this schema:
{
  "summary": "1 concise sentence defining the concept clearly",
  "simpleExplanation": "Explanation matching the complexity target (2-3 sentences)",
  "etymology": "Brief root words, Greek/Latin origins, or history",
  "exampleSentences": ["Clear example sentence 1", "Clear example sentence 2"],
  "contextualMeaning": "Specific role/meaning in the provided context if provided, else null",
  "translation": null
}`;

    const candidateModels = [model, "gemini-1.5-flash", "gemini-2.0-flash", "gemini-pro"];
    let lastError = "";

    for (const m of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(rawKey)}`;

        const response = await requestUrl({
          url,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": rawKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
            },
          }),
        });

        if (response.status === 200 && response.json) {
          const candidate = response.json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidate) {
            return this.parseResponse(candidate);
          }
        }
      } catch (err: unknown) {
        const errorMsg = (err as Error)?.message || String(err);
        lastError = errorMsg;
        // If it's a 404 on model name, try next candidate model
        if (!errorMsg.includes("404")) {
          break;
        }
      }
    }

    throw new Error(`Gemini API Error: ${lastError || "Could not connect to Gemini API. Check API key."}`);
  }

  private parseResponse(text: string): AIExplanationResult {
    try {
      const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return {
        summary: text.slice(0, 150),
        simpleExplanation: text,
        exampleSentences: [],
      };
    }
  }
}
