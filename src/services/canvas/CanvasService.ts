import { App, normalizePath, TFile } from "obsidian";
import { PluginSettings, StudyNoteResult } from "../../types";

interface CanvasNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "text" | "file" | "link" | "group";
  text?: string;
  color?: string;
}

interface CanvasEdge {
  id: string;
  fromNode: string;
  fromSide: "top" | "right" | "bottom" | "left";
  toNode: string;
  toSide: "top" | "right" | "bottom" | "left";
  label?: string;
  color?: string;
}

export class CanvasService {
  private app: App;
  private settings: PluginSettings;

  constructor(app: App, settings: PluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Generates an interactive Obsidian .canvas whiteboard file
   */
  async createConceptCanvas(studyPack: StudyNoteResult): Promise<TFile> {
    const rawFolder = (this.settings.studyNotesFolder || "Study Notes").trim().replace(/\/+$/, "");
    const folder = normalizePath(rawFolder);

    if (!this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder).catch(() => {});
    }

    const sanitizedTitle = studyPack.title.replace(/[\\/:*?"<>|]/g, " ").trim();
    const filePath = normalizePath(`${folder}/${sanitizedTitle} - Concept Canvas.canvas`);

    const nodes: CanvasNode[] = [];
    const edges: CanvasEdge[] = [];

    // 1. Center Core Concept Node
    const centerNodeId = "node-center-concept";
    nodes.push({
      id: centerNodeId,
      x: 0,
      y: 0,
      width: 420,
      height: 240,
      type: "text",
      color: "4", // purple/accent
      text: `# 🧠 ${studyPack.title}\n\n**Core Synthesis:**\n${studyPack.summary}\n\n${studyPack.mnemonic ? `> 💡 **Mnemonic Hook**: ${studyPack.mnemonic}` : ""}`,
    });

    // 2. Left Node: Key Principles & Mechanisms
    const mechNodeId = "node-mechanisms";
    nodes.push({
      id: mechNodeId,
      x: -480,
      y: -50,
      width: 380,
      height: 280,
      type: "text",
      color: "2", // green
      text: `### 🎯 Key Principles & Mechanisms\n\n${(studyPack.keyRules || studyPack.keyPoints || [studyPack.summary]).map((kp) => `- ${kp}`).join("\n")}`,
    });

    edges.push({
      id: "edge-center-to-mech",
      fromNode: centerNodeId,
      fromSide: "left",
      toNode: mechNodeId,
      toSide: "right",
      label: "Principles",
    });

    // 3. Right Node: Visuals & Illustrations
    if (studyPack.images && studyPack.images.length > 0) {
      const imgNodeId = "node-visuals";
      const img = studyPack.images[0];
      nodes.push({
        id: imgNodeId,
        x: 480,
        y: -120,
        width: 360,
        height: 320,
        type: "text",
        color: "5", // cyan
        text: `### 🖼️ Visual Illustration\n\n![${img.title}](${img.url})\n\n*${img.title}*`,
      });

      edges.push({
        id: "edge-center-to-img",
        fromNode: centerNodeId,
        fromSide: "right",
        toNode: imgNodeId,
        toSide: "left",
        label: "Visual Concept",
      });
    }

    // 4. Bottom Nodes: Active Recall FAQs
    if (studyPack.cueQuestions && studyPack.cueQuestions.length > 0) {
      studyPack.cueQuestions.slice(0, 3).forEach((q, idx) => {
        const faqNodeId = `node-faq-${idx + 1}`;
        const xOffset = (idx - 1) * 360;
        nodes.push({
          id: faqNodeId,
          x: xOffset,
          y: 320,
          width: 320,
          height: 220,
          type: "text",
          color: "6", // orange
          text: `### ❓ Active Recall Q${idx + 1}\n\n**${q.question}**\n\n---\n\n> [!abstract]- Reveal Answer\n> ${q.answer}`,
        });

        edges.push({
          id: `edge-center-to-faq-${idx + 1}`,
          fromNode: centerNodeId,
          fromSide: "bottom",
          toNode: faqNodeId,
          toSide: "top",
          label: `Q${idx + 1}`,
        });
      });
    }

    const canvasData = {
      nodes,
      edges,
    };

    const canvasContent = JSON.stringify(canvasData, null, 2);

    let targetFile: TFile;
    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, canvasContent);
      targetFile = existing;
    } else {
      targetFile = await this.app.vault.create(filePath, canvasContent);
    }

    return targetFile;
  }
}
