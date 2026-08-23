import { requestUrl } from "obsidian";

export class AudioPlayer {
  private static currentAudio: HTMLAudioElement | null = null;
  private static activeBlobUrl: string | null = null;
  private static utteranceHolder: SpeechSynthesisUtterance | null = null;

  /**
   * Normalize audio URLs (e.g., "//ssl.gstatic.com/..." -> "https://ssl.gstatic.com/...")
   */
  static normalizeAudioUrl(url: string): string {
    if (!url) return "";
    let trimmed = url.trim();
    if (trimmed.startsWith("//")) {
      return "https:" + trimmed;
    }
    if (trimmed.startsWith("http://")) {
      return "https://" + trimmed.slice(7);
    }
    return trimmed;
  }

  /**
   * Plays audio from URL using Obsidian requestUrl buffer for 100% Electron & CORS compatibility
   */
  static async play(audioUrl: string): Promise<void> {
    const cleanUrl = this.normalizeAudioUrl(audioUrl);
    if (!cleanUrl) {
      throw new Error("Empty audio URL");
    }

    this.stop();

    try {
      // Fetch via Obsidian requestUrl to bypass all Electron CORS/CSP restrictions
      const response = await requestUrl({
        url: cleanUrl,
        method: "GET",
      });

      if (response.status !== 200 || !response.arrayBuffer) {
        throw new Error(`Audio fetch HTTP ${response.status}`);
      }

      const blob = new Blob([response.arrayBuffer], { type: "audio/mp3" });
      const blobUrl = URL.createObjectURL(blob);
      this.activeBlobUrl = blobUrl;

      return new Promise<void>((resolve, reject) => {
        const audio = new Audio(blobUrl);
        this.currentAudio = audio;

        audio.onended = () => {
          this.cleanupBlob();
          resolve();
        };

        audio.onerror = (e) => {
          this.cleanupBlob();
          reject(e);
        };

        audio.play().catch((err) => {
          this.cleanupBlob();
          reject(err);
        });
      });
    } catch (err) {
      // If direct requestUrl fails, try standard HTML5 Audio fallback
      return new Promise<void>((resolve, reject) => {
        const audio = new Audio(cleanUrl);
        this.currentAudio = audio;
        audio.onended = () => resolve();
        audio.onerror = (e) => reject(e);
        audio.play().catch(reject);
      });
    }
  }

  /**
   * Master function: Plays direct audio URL, falls back to Google HD voice, and lastly to Web Speech API
   */
  static async playOrSpeak(text: string, audioUrl?: string, dialect = "us"): Promise<void> {
    const cleanAudioUrl = this.normalizeAudioUrl(audioUrl || "");

    // 1. Try provided dictionary audio URL first
    if (cleanAudioUrl) {
      try {
        await this.play(cleanAudioUrl);
        return;
      } catch (err) {
        console.warn("[SmartLookup] Direct audio failed, falling back to TTS:", err);
      }
    }

    // 2. High Definition Google TTS Stream (Plays authentic native audio for ANY word)
    const langCode = dialect === "uk" ? "en-GB" : dialect === "au" ? "en-AU" : "en-US";
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${langCode}&q=${encodeURIComponent(text.trim())}`;

    try {
      await this.play(googleTtsUrl);
      return;
    } catch (err) {
      console.warn("[SmartLookup] Google TTS failed, falling back to Web Speech Synthesis:", err);
    }

    // 3. Native Web Speech API fallback
    this.speak(text, langCode);
  }

  /**
   * Native browser SpeechSynthesis fallback
   */
  static speak(text: string, lang = "en-US"): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = lang;
      utterance.rate = 0.92;
      utterance.pitch = 1.0;

      // Keep strong reference so Electron V8 doesn't garbage collect mid-speech
      this.utteranceHolder = utterance;
      utterance.onend = () => {
        this.utteranceHolder = null;
      };
      utterance.onerror = () => {
        this.utteranceHolder = null;
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("[SmartLookup] Speech synthesis error:", err);
    }
  }

  /**
   * Narrates a 60-second spoken micro-lecture combining summary & ELI5 breakdown
   */
  static playMicroLecture(title: string, summary: string, feynmanEli5?: string): void {
    let script = `Micro lecture on ${title}. ${summary.slice(0, 300)}. `;
    if (feynmanEli5) {
      const cleanEli5 = feynmanEli5.replace(/^🐣\s*Beginner\s*\(ELI5\):\s*/i, "");
      script += `In simple terms: ${cleanEli5.slice(0, 250)}.`;
    }
    this.speak(script, "en-US");
  }

  static stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.cleanupBlob();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  private static cleanupBlob(): void {
    if (this.activeBlobUrl) {
      URL.revokeObjectURL(this.activeBlobUrl);
      this.activeBlobUrl = null;
    }
  }
}
