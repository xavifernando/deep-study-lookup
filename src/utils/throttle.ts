export class RequestThrottle {
  private lastRequestTime = 0;
  private minIntervalMs: number;

  constructor(minIntervalMs = 250) {
    this.minIntervalMs = minIntervalMs;
  }

  async wait(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise((r) => window.setTimeout(r, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}
