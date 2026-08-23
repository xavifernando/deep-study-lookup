import { requestUrl } from "obsidian";
import { AIExplanationResult, IAIProvider } from "../../types";

interface OpenAIChoice {
  message?: {
    content?: string;
  };
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
}

export class OpenAICompatibleProvider implements IAIProvider {
  name: string;
  private endpoint: string;
  private defaultModel: string;

  constructor(name: string, endpoint: string, defaultModel: string) {
    this.name = name;
    this.endpoint = endpoint;
    this.defaultModel = defaultModel;
  }

  async explain(
    term: string,
    contextSentence?: string,
    apiKey?: string,
    model?: string,
    targetLanguage?: string
  ): Promise<AIExplanationResult | null> {
    const langInstruction =
      targetLanguage && targetLanguage !== "en"
        ? ` Respond in language: ${targetLanguage}.`
        : "";

    const prompt = `You are a world-class lexicographer, educator, and cognitive learning scientist. Explain the following word or technical concept clearly and insightfully.${langInstruction}

Word: "${term}"
${contextSentence ? `Context in which it appears: "${contextSentence}"` : ""}

Respond ONLY with a valid JSON object strictly matching this schema:
{
  "summary": "Brief 1-sentence definition of the term",
  "simpleExplanation": "Clear, intuitive explanation (ELI5 / beginner friendly)",
  "etymology": "Origin or morphological breakdown (Greek/Latin roots if applicable)",
  "analogicalBridge": "A memorable real-world analogy explaining how it works",
  "mnemonic": "A clever, vivid mnemonic hook or memory device to never forget it",
  "exampleSentences": ["Natural example 1", "Natural example 2"]
}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey && apiKey.trim()) {
      headers["Authorization"] = `Bearer ${apiKey.trim()}`;
    }

    const modelToUse = model && model !== "custom" ? model : this.defaultModel;

    const response = await requestUrl({
      url: this.endpoint,
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
      }),
    });

    const json = response.json as OpenAIResponse | undefined;
    if (response.status !== 200 || !json) {
      throw new Error(`AI API error: HTTP ${response.status}`);
    }

    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    try {
      const clean = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      return JSON.parse(clean) as AIExplanationResult;
    } catch {
      return {
        summary: content,
        simpleExplanation: content,
        exampleSentences: [],
      };
    }
  }
}
