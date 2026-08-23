interface CacheItem<T> {
  data: T;
  timestamp: number;
}

export class LookupCache {
  private cache = new Map<string, CacheItem<unknown>>();
  private defaultTtlMs: number;

  constructor(ttlMinutes: number = 1440) {
    this.defaultTtlMs = ttlMinutes * 60 * 1000;
  }

  setTtl(minutes: number): void {
    this.defaultTtlMs = minutes * 60 * 1000;
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.defaultTtlMs) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }
}
