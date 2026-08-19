/**
 * Simple in-memory TTL cache shared across all server routes.
 *
 * Each entry stores a value plus an expiration timestamp.  The store is
 * per-process — on Render's free tier there is only one container so this
 * works perfectly.  If the container restarts the cache is rebuilt from
 * fresh DB/API calls.
 */

const _cache = new Map();
const MAX_ENTRIES = 500;

export function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return undefined;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlMs) {
  if (_cache.size >= MAX_ENTRIES) {
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
  _cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Clear the entire cache (call after admin saves). */
export function cacheClear() {
  _cache.clear();
}

/** Clear only entries whose keys start with `prefix`. */
export function cacheClearPrefix(prefix) {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

export const DB_CACHE_TTL = 60_000;      // 1 minute
export const API_CACHE_TTL = 120_000;    // 2 minutes
