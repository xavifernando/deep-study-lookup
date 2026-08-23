import { requestUrl } from "obsidian";
import { PluginSettings } from "../../types";
import { splitSentences } from "../../utils/markdown";

export interface ParagraphAnalysisResult {
  title: string;
  summaryBulletPoints: string[];
  simplifiedExplanation: string;
  keyConcepts: string[];
  actionableTakeaway: string;
  sourceBadge?: string;
}

export class ParagraphAIService {
  private settings: PluginSettings;

  constructor(settings: PluginSettings) {
    this.settings = settings;
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }

  async analyzeParagraph(text: string): Promise<ParagraphAnalysisResult> {
    const rawKey = this.settings.aiApiKey ? this.settings.aiApiKey.trim().replace(/^["']|["']$/g, "") : "";
    const cleanInput = text.length > 15000 ? text.slice(0, 15000) + "\n\n[... Remaining note content summarized ...]" : text;

    if (rawKey || this.settings.aiProvider === "ollama") {
      try {
        const isLongDoc = cleanInput.length > 800;
        const prompt = `You are an expert learning tutor and cognitive synthesizer.
Analyze this ${isLongDoc ? "full page / long document" : "paragraph / passage"}:
"""
${cleanInput}
"""

${isLongDoc ? "Synthesize an Executive Summary covering the complete scope from introduction to conclusion." : "Synthesize a concise conceptual breakdown."}

Return valid JSON:
{
  "title": "Short 3-5 word conceptual title for this text",
  "summaryBulletPoints": [
    "Key takeaway 1 (core principle)",
    "Key takeaway 2 (governing mechanism)",
    "Key takeaway 3 (critical detail or evidence)",
    "Key takeaway 4 (conclusion or impact)"
  ],
  "simplifiedExplanation": "Plain English, jargon-free explanation deconstructing the overarching mechanism or argument across the entire text (2-3 sentences).",
  "keyConcepts": ["Concept 1", "Concept 2", "Concept 3", "Concept 4"],
  "actionableTakeaway": "1 clear sentence on the definitive practical takeaway or significance."
}`;

        let textResponse = "";
        const timeoutMs = (this.settings.aiTimeoutSeconds || 30) * 1000;

        const aiCall = (async () => {
          if (this.settings.aiProvider === "gemini") {
            const model = (this.settings.aiModel || "gemini-2.0-flash").replace(/^models\//, "");
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(rawKey)}`;
            const res = await requestUrl({
              url,
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 },
              }),
            });
            return res.json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          } else {
            let baseUrl = this.settings.aiBaseUrl || "https://api.openai.com/v1";
            baseUrl = baseUrl.replace(/\/+$/, "");
            const endpoint = this.settings.aiProvider === "ollama" && !this.settings.aiBaseUrl ? "http://localhost:11434/v1/chat/completions" : `${baseUrl}/chat/completions`;
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (rawKey) headers["Authorization"] = `Bearer ${rawKey}`;
            const res = await requestUrl({
              url: endpoint,
              method: "POST",
              headers,
              body: JSON.stringify({
                model: this.settings.aiModel || "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
              }),
            });
            return res.json?.choices?.[0]?.message?.content || "";
          }
        })();

        const timeoutPromise = new Promise<string>((resolve) => window.setTimeout(() => resolve(""), timeoutMs));
        textResponse = await Promise.race([aiCall, timeoutPromise]);

        if (textResponse) {
          const clean = textResponse.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
          const parsed = JSON.parse(clean);
          if (parsed.summaryBulletPoints && parsed.simplifiedExplanation) {
            parsed.sourceBadge = this.settings.aiProvider === "gemini"
              ? `✨ ${this.settings.aiModel || "Gemini"}`
              : (this.settings.aiProvider === "ollama" ? `🦙 Ollama (${this.settings.aiModel || "llama3"})` : `✨ ${this.settings.aiModel || "OpenAI"}`);
            return parsed;
          }
        }
      } catch (err) {
        console.warn("[SmartLookup] Paragraph AI analysis fallback:", err);
      }
    }

    // High quality Distributed NLP Extraction across beginning, middle, and end of the entire page
    const sentences = splitSentences(text).filter((s) => s.length > 15);

    const firstSent = sentences[0] || text.slice(0, 80);
    const titleWords = firstSent.split(/\s+/).slice(0, 6).join(" ").replace(/[,:;.!?]+$/, "");
    const title = titleWords.length > 3 ? titleWords : "Page & Document Summary";

    // Distributed bullet extraction: samples representative points across the whole page
    const bullets: string[] = [];
    if (sentences.length <= 4) {
      bullets.push(...sentences);
    } else {
      const step = Math.max(1, Math.floor(sentences.length / 4));
      for (let i = 0; i < sentences.length && bullets.length < 4; i += step) {
        bullets.push(sentences[i]);
      }
    }
    if (bullets.length === 0) bullets.push(text.slice(0, 150));

    const simplifiedExplanation = sentences.length >= 2
      ? `${sentences[0]} ${sentences[Math.min(sentences.length - 1, Math.floor(sentences.length / 2))]}`
      : `${firstSent}.`;

    const lastSent = sentences[sentences.length - 1] || firstSent;
    const actionableTakeaway = sentences.length >= 3
      ? lastSent
      : `Reference and apply these concepts when analyzing this note.`;

    // Extract significant capitalized / technical terms
    const words = text.match(/\b[A-Z][a-z0-9_-]{2,}\b/g) || [];
    const uniqueKeywords = Array.from(new Set(words)).slice(0, 5);
    const keyConcepts = uniqueKeywords.length > 0 ? uniqueKeywords : ["Core Mechanism", "Systemic Impact", "Key Regulation"];

    return {
      title,
      summaryBulletPoints: bullets,
      simplifiedExplanation,
      keyConcepts,
      actionableTakeaway,
      sourceBadge: "📄 Extracted from note text",
    };
  }

  formatSummaryMarkdown(res: ParagraphAnalysisResult): string {
    let md = `> [!abstract] 📌 ${res.title}\n`;
    res.summaryBulletPoints.forEach((b) => {
      md += `> - ${b}\n`;
    });
    md += `>\n> **💡 Core Mechanism**: ${res.simplifiedExplanation}\n`;
    md += `> **🎯 Key Takeaway**: ${res.actionableTakeaway}\n`;
    return md;
  }
}
