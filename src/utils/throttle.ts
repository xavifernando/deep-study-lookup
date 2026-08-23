export class RequestThrottle {
  private lastRequestTime = 0;
  private minIntervalMs: number;

  constructor(minIntervalMs = 250) {
    this.minIntervalMs = minIntervalMs;
  }

  async wait(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      const delay = this.minIntervalMs - elapsed;
      if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
        await new Promise((r) => window.setTimeout(r, delay));
      } else {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    this.lastRequestTime = Date.now();
  }
}
