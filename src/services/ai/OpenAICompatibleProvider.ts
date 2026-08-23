import { requestUrl } from "obsidian";
import { AIExplanationResult, PluginSettings } from "../../types";
import { AIExplanationOptions, IAIProvider } from "./IAIProvider";

export class OpenAICompatibleProvider implements IAIProvider {
  name = "OpenAI Compatible / Ollama";
  private settings: PluginSettings;

  constructor(settings: PluginSettings) {
    this.settings = settings;
  }

  async explain(options: AIExplanationOptions): Promise<AIExplanationResult | null> {
    let baseUrl = this.settings.aiBaseUrl || "https://api.openai.com/v1";
    baseUrl = baseUrl.replace(/\/+$/, "");

    let endpoint = `${baseUrl}/chat/completions`;
    if (this.settings.aiProvider === "ollama" && !this.settings.aiBaseUrl) {
      endpoint = "http://localhost:11434/v1/chat/completions";
    }

    const model = this.settings.aiModel || (this.settings.aiProvider === "ollama" ? "llama3" : "gpt-3.5-turbo");
    const levelInstruction = options.complexityLevel === "eli5"
      ? "Complexity Target: Explain for a beginner / ELI5 with everyday analogies and zero jargon."
      : options.complexityLevel === "expert"
      ? "Complexity Target: Explain at an advanced, rigorous, technical academic level with exact operational mechanics."
      : "Complexity Target: Explain clearly and practically for general learning.";

    const prompt = `You are a concise vocabulary explainer.
Explain the word/term "${options.word}".
${levelInstruction}
${options.contextSentence ? `Context where it appears: "${options.contextSentence}"` : ""}
Target language: ${options.targetLanguage || "English"}

Return ONLY a valid JSON object matching this schema:
{
  "summary": "1-sentence summary",
  "simpleExplanation": "Explanation matching the complexity target (2-3 sentences)",
  "etymology": "Origin or roots",
  "exampleSentences": ["Example 1", "Example 2"],
  "contextualMeaning": "Specific contextual meaning if context was provided",
  "translation": "Translation if target language is not English"
}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.settings.aiApiKey) {
      headers["Authorization"] = `Bearer ${this.settings.aiApiKey}`;
    }

    const response = await requestUrl({
      url: endpoint,
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that outputs only valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (response.status !== 200 || !response.json) {
      throw new Error(`AI API error: HTTP ${response.status}`);
    }

    const content = response.json.choices?.[0]?.message?.content;
    if (!content) return null;

    try {
      const clean = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      return JSON.parse(clean);
    } catch {
      return {
        summary: content,
        simpleExplanation: content,
        exampleSentences: [],
      };
    }
  }
}
