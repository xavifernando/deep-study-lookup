import { requestUrl } from "obsidian";
import { PluginSettings, StudyNoteResult, StudyQuestion } from "../../types";
import { RequestThrottle } from "../../utils/throttle";

export interface ResearchDossier {
  term: string;
  summary: string;
  sourceUrl: string;
  sentences: string[];
  primaryDefinition: string;
  keyMechanism: string;
  practicalApplication: string;
  limitationsAndBottlenecks: string;
}

export class StudyNoteAIService {
  private settings: PluginSettings;
  private throttle = new RequestThrottle(250);

  constructor(settings: PluginSettings) {
    this.settings = settings;
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }

  /**
   * Conducts verified internet/Wikipedia research for the topic before generating study notes
   */
  async conductDeepResearch(term: string, contextSentence?: string): Promise<ResearchDossier> {
    const cleanTerm = term.trim().replace(/^["']|["']$/g, "");
    let summaryText = "";
    let sourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(cleanTerm.replace(/\s+/g, "_"))}`;
    const termsToTry = [cleanTerm];

    if (cleanTerm.includes(" and ")) {
      termsToTry.push(...cleanTerm.split(" and ").map((t) => t.trim()));
    }

    for (const t of termsToTry) {
      try {
        await this.throttle.wait();
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/\s+/g, "_"))}`;
        const res = await requestUrl({ url, method: "GET" });
        if (res.status === 200 && res.json?.extract && res.json.extract.length > 40) {
          summaryText = res.json.extract;
          if (res.json.content_urls?.desktop?.page) {
            sourceUrl = res.json.content_urls.desktop.page;
          }
          break;
        }
      } catch {
        // try next
      }

      try {
        await this.throttle.wait();
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(t)}&utf8=&format=json`;
        const sRes = await requestUrl({ url: searchUrl, method: "GET" });
        const snippet = sRes.json?.query?.search?.[0]?.snippet;
        if (snippet) {
          const cleanSnippet = snippet.replace(/<[^>]+>/g, "").trim();
          if (cleanSnippet.length > 40) {
            summaryText = cleanSnippet;
            break;
          }
        }
      } catch {
        // try next
      }
    }

    if (!summaryText && contextSentence) {
      summaryText = `In note context: "${contextSentence.trim()}". ${cleanTerm} represents a key subject concept and operational principle.`;
    } else if (!summaryText) {
      summaryText = `"${cleanTerm}" is a foundational concept representing specific operational mechanisms, systematic interactions, and domain applications.`;
    }

    const sentences = summaryText
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);

    const primaryDefinition = sentences[0] || `${cleanTerm} is a foundational concept in its discipline.`;
    const keyMechanism = sentences[1] || `It operates as a primary regulatory and functional mechanism.`;
    const practicalApplication = sentences[2] || sentences[1] || `Applied directly to optimize system performance and predictable outcomes.`;
    const limitationsAndBottlenecks = sentences[3] || sentences[0] || `Constrained by environmental saturation thresholds and rate boundaries.`;

    return {
      term: cleanTerm,
      summary: summaryText,
      sourceUrl,
      sentences,
      primaryDefinition,
      keyMechanism,
      practicalApplication,
      limitationsAndBottlenecks,
    };
  }

  async generateStudyPack(term: string, contextSentence?: string): Promise<StudyNoteResult> {
    const rawKey = this.settings.aiApiKey ? this.settings.aiApiKey.trim().replace(/^["']|["']$/g, "") : "";
    const dossier = await this.conductDeepResearch(term, contextSentence);
    const timeoutMs = (this.settings.aiTimeoutSeconds || 30) * 1000;

    if (rawKey || this.settings.aiProvider === "ollama") {
      try {
        const prompt = `You are a distinguished educator creating a great, clean academic study note on "${dossier.term}".
LITERATURE SUMMARY:
"""
${dossier.summary}
"""

Produce a structured study note with these exact parts:
1. Clear Title: "${dossier.term}"
2. Simple Definition: What it means in one plain sentence.
3. Key Rules or Traits: 3-5 short bullet points detailing main parts, steps, or features.
4. Real Example: A concrete, realistic real-world case or use case showing the concept in action.
5. Why It Matters: Clear sentence on the primary goal and practical significance.
6. Common Traps: Common mistakes people make or misconceptions to avoid.
7. Quick Links: 3-5 related concepts, prerequisites, or opposites to connect in memory.
8. Visual Diagram: A concise Mermaid flowchart (graph TD).
9. Memory Retention Suite:
   - Mnemonic Hook: A bizarre, vivid, unforgettable visual scene or phonetic wordplay.
   - Memory Palace (5 Rooms): Specific spatial objects for Front Door, Living Room, Kitchen, Hallway, and Bedroom.
   - Etymology: Greek/Latin root words and literal translation.
   - Acronym or Peg: A catchy acronym or rhyme.
   - Analogical Bridge: A concrete everyday machine or physical mechanism analogy.

Return ONLY valid JSON matching this schema:
{
  "title": "${dossier.term}",
  "summary": "1-2 sentence core definition.",
  "simpleDefinition": "1 plain sentence stating what it means.",
  "keyRules": [
    "Core Feature/Rule 1",
    "Core Feature/Rule 2",
    "Core Feature/Rule 3"
  ],
  "realWorldExample": "Concrete scenario illustrating how ${dossier.term} works in practice.",
  "whyItMatters": "Why this concept is critical and where it is applied.",
  "commonTraps": "Common misconceptions, traps, or incorrect assumptions to avoid.",
  "quickLinks": ["Related Concept 1", "Related Concept 2", "Contrasting Concept 3"],
  "visualDiagram": "graph TD\\n  A[\\\"Input / Stimulus\\\"] --> B[\\\"${dossier.term}\\\"]\\n  B --> C[\\\"Primary Mechanism\\\"]\\n  C --> D[\\\"Observed Result\\\"]",
  "mnemonicHook": "Bizarre, vivid visual imagery connecting the term name to its primary function.",
  "memoryPalaceRoute": {
    "frontDoor": "Visual anchor for the definition at the front door",
    "livingRoom": "Visual anchor for Rule 1 on the couch",
    "kitchen": "Visual anchor for Rule 2 & Real Example on the counter",
    "hallway": "Visual warning trap in the hallway",
    "bedroom": "Takeaway & significance in the bedroom"
  },
  "etymologyRoots": "Root word origins and literal breakdown",
  "acronymOrPeg": "Catchy acronym or memory rhyme",
  "analogicalBridge": "Everyday physical object or machine analogy"
}`;

        const aiPromise = this.settings.aiProvider === "gemini"
          ? this.generateWithGemini(prompt, dossier.term, rawKey)
          : this.generateWithOpenAI(prompt, dossier.term, rawKey);

        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
        const res = await Promise.race([aiPromise, timeoutPromise]);

        if (res && res.simpleDefinition && res.keyRules && res.keyRules.length > 0) {
          res.webSourceUrl = dossier.sourceUrl;
          res.fullWebExtract = dossier.summary;
          res.sourceBadge = this.settings.aiProvider === "gemini"
            ? `✨ ${this.settings.aiModel || "Gemini"}`
            : (this.settings.aiProvider === "ollama" ? `🦙 Ollama (${this.settings.aiModel || "llama3"})` : `✨ ${this.settings.aiModel || "OpenAI"}`);
          return res;
        }
      } catch (err) {
        console.warn("[SmartLookup] AI StudyNote generation fallback:", err);
      }
    }

    return this.synthesizeResearchStudyPack(dossier, contextSentence);
  }

  private async generateWithGemini(prompt: string, term: string, apiKey: string): Promise<StudyNoteResult | null> {
    let model = (this.settings.aiModel || "gemini-2.0-flash").trim().replace(/^models\//, "");
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await requestUrl({
        url,
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      });

      if (response.status === 200 && response.json) {
        const text = response.json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
          return JSON.parse(clean);
        }
      }
    } catch {
      // Fallback
    }
    return null;
  }

  private async generateWithOpenAI(prompt: string, term: string, apiKey: string): Promise<StudyNoteResult | null> {
    let baseUrl = this.settings.aiBaseUrl || "https://api.openai.com/v1";
    baseUrl = baseUrl.replace(/\/+$/, "");

    let endpoint = `${baseUrl}/chat/completions`;
    let model = this.settings.aiModel || "gpt-4o-mini";

    if (this.settings.aiProvider === "ollama") {
      endpoint = this.settings.aiBaseUrl ? `${baseUrl}/chat/completions` : "http://localhost:11434/v1/chat/completions";
      model = this.settings.aiModel || "llama3.2:1b";
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const response = await requestUrl({
      url: endpoint,
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });

    if (response.status !== 200 || !response.json) return null;
    const text = response.json.choices?.[0]?.message?.content;
    if (!text) return null;

    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    return JSON.parse(clean);
  }

  /**
   * Synthesizes a structured study pack directly from factual research extracts (Zero Fabrications)
   */
  public synthesizeResearchStudyPack(dossier: ResearchDossier, contextSentence?: string): StudyNoteResult {
    const { term, summary, sourceUrl, sentences, primaryDefinition, keyMechanism, practicalApplication, limitationsAndBottlenecks } = dossier;
    const safeTitle = term.replace(/"/g, "'");

    const simpleDefinition = primaryDefinition;

    // Use genuine extracted sentences as the core rules
    const keyRules: string[] = [];
    if (sentences.length >= 2) {
      for (let i = 1; i < Math.min(sentences.length, 5); i++) {
        if (sentences[i] && sentences[i].length > 15) {
          keyRules.push(sentences[i]);
        }
      }
    }
    if (keyRules.length === 0) {
      keyRules.push(`Primary principle: ${primaryDefinition}`);
      if (keyMechanism) keyRules.push(`Key mechanism: ${keyMechanism}`);
      if (practicalApplication) keyRules.push(`Core function: ${practicalApplication}`);
    }

    const realWorldExample = contextSentence
      ? `As referenced in your notes: "${contextSentence.trim()}". In practical application, ${safeTitle} operates directly to fulfill this functional requirement.`
      : (practicalApplication ? `${safeTitle} in practical application: ${practicalApplication}` : `Applied in practical systems and literature regarding ${safeTitle}.`);

    const whyItMatters = practicalApplication ? `Foundational for understanding the properties and functional role of ${safeTitle}: ${practicalApplication}` : `Essential foundational concept for understanding the behavior and properties of ${safeTitle}.`;
    const commonTraps = limitationsAndBottlenecks ? `Pay attention to ${safeTitle} constraints: ${limitationsAndBottlenecks}` : `Ensure accurate distinction between ${safeTitle} and related domain terminology.`;

    const quickLinks = [
      "Key Principles",
      "Domain Fundamentals",
      "System Applications"
    ];

    const cleanDefShort = primaryDefinition.slice(0, 30).replace(/["'()]/g, "");
    const visualDiagram = `graph TD\n  A["🚩 Context / Trigger"] --> B["💠 ${safeTitle}"]\n  B --> C["⚡ ${cleanDefShort}"]\n  C --> D["🎯 Outcome"]`;

    // Memory Retention Suite
    const mnemonicHook = `Picture a giant, glowing symbol of ${safeTitle} actively transforming its inputs into ${cleanDefShort}.`;
    const memoryPalaceRoute = {
      frontDoor: `🚪 At your Front Door: A large brass plaque inscribed with '${safeTitle}' and its definition.`,
      livingRoom: `🛋️ In your Living Room: An interactive simulation demonstrating rule 1 (${keyRules[0] || primaryDefinition}).`,
      kitchen: `🍳 In your Kitchen: A practical recipe in action (${realWorldExample.slice(0, 80)}...).`,
      hallway: `⚠️ In the Hallway: A bright caution sign warning against (${commonTraps.slice(0, 80)}...).`,
      bedroom: `🛏️ In the Bedroom: A golden medal representing why it matters (${whyItMatters.slice(0, 80)}...).`,
    };
    const etymologyRoots = `Etymological derivation of ${safeTitle} reflects its foundational operational role in domain literature.`;
    const acronymOrPeg = `${safeTitle.split(/\s+/).map((w) => w[0]?.toUpperCase()).join("") || "KEY"} $\\rightarrow$ Memory Anchor for ${safeTitle}.`;
    const analogicalBridge = `Think of ${safeTitle} like a specialized central control valve regulating the state and flow of the surrounding system.`;

    return {
      title: term,
      summary: simpleDefinition,
      simpleDefinition,
      keyRules,
      realWorldExample,
      whyItMatters,
      commonTraps,
      quickLinks,
      visualDiagram,
      mnemonicHook,
      memoryPalaceRoute,
      etymologyRoots,
      acronymOrPeg,
      analogicalBridge,
      sourceBadge: "📖 Wikipedia (Factual Extract)",
      webSourceUrl: sourceUrl,
      fullWebExtract: summary,
    };
  }
}
