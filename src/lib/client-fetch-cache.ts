"use client";

type CacheEntry<T> = {
  expiresAt: number;
  promise?: Promise<T>;
  value?: T;
};

type FetchCachedJsonOptions = {
  cacheKey?: string;
  ttlMs?: number;
};

const requestCache = new Map<string, CacheEntry<unknown>>();

export function createBucketedIsoString(date = new Date(), bucketMs = 300_000): string {
  const bucketStart = Math.floor(date.getTime() / bucketMs) * bucketMs;
  return new Date(bucketStart).toISOString();
}

export async function fetchCachedJson<T>(
  url: string,
  init?: RequestInit,
  options: FetchCachedJsonOptions = {}
): Promise<T> {
  const cacheKey = options.cacheKey ?? `${init?.method ?? "GET"}:${url}`;
  const ttlMs = options.ttlMs ?? 10 * 60 * 1000;
  const now = Date.now();
  const existing = requestCache.get(cacheKey);

  if (existing && existing.expiresAt > now) {
    if (existing.promise) {
      return existing.promise as Promise<T>;
    }

    return existing.value as T;
  }

  const request = fetch(url, init)
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as
        | Record<string, unknown>
        | null;

      if (!response.ok) {
        const errorMessage =
          payload && typeof payload.error === "string"
            ? payload.error
            : `Request failed (${response.status}).`;

        throw new Error(errorMessage);
      }

      const value = payload as T;
      requestCache.set(cacheKey, {
        expiresAt: Date.now() + ttlMs,
        value,
      });
      return value;
    })
    .catch((error) => {
      requestCache.delete(cacheKey);
      throw error;
    });

  requestCache.set(cacheKey, {
    expiresAt: now + ttlMs,
    promise: request,
  });

  return request;
}
