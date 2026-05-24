/**
 * cache.js — Centralized in-memory cache with stale-while-revalidate
 *
 * Design:
 *  - Pure JS objects in a Map — zero sessionStorage/quota risk
 *  - Survives React navigation (module-level), clears on hard-refresh
 *  - Configurable TTL per resource
 *  - get() returns { data, stale } — stale=true means data is past TTL
 *  - Pages show cached data instantly (stale or fresh) then revalidate
 */

const store = new Map();

// Default TTLs in milliseconds
const TTL = {
  feed:                  2 * 60 * 1000,   // 2 min
  explore_categories:   10 * 60 * 1000,   // 10 min
  explore_recommended:   3 * 60 * 1000,   // 3 min
  explore_category:      3 * 60 * 1000,   // 3 min
  profile_own:           5 * 60 * 1000,   // 5 min
  profile_other:         3 * 60 * 1000,   // 3 min
  connections:           2 * 60 * 1000,   // 2 min
  watchlist:             3 * 60 * 1000,   // 3 min
  playlists:             5 * 60 * 1000,   // 5 min
  leaderboard:          10 * 60 * 1000,   // 10 min
  quizzes:               3 * 60 * 1000,   // 3 min
  study_status:          2 * 60 * 1000,   // 2 min
  study_chart:          10 * 60 * 1000,   // 10 min
  notifications:         1 * 60 * 1000,   // 1 min
  moderation:            1 * 60 * 1000,   // 1 min
  post_detail:           2 * 60 * 1000,   // 2 min
  default:               3 * 60 * 1000,   // 3 min fallback
};

/**
 * Get cached data.
 * @param {string} key — cache key (e.g. 'feed:rec:1', 'profile:42')
 * @returns {{ data: any, stale: boolean } | null}
 */
export function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.timestamp;
  const ttl = entry.ttl || TTL.default;
  return { data: entry.data, stale: age > ttl };
}

/**
 * Store data in cache.
 * @param {string} key
 * @param {any} data
 * @param {string} [ttlKey] — key into TTL map (e.g. 'feed', 'profile_own')
 */
export function set(key, data, ttlKey) {
  store.set(key, {
    data,
    timestamp: Date.now(),
    ttl: TTL[ttlKey] || TTL.default,
  });
}

/**
 * Invalidate a single key.
 */
export function invalidate(key) {
  store.delete(key);
}

/**
 * Invalidate all keys starting with a prefix.
 * e.g. invalidatePrefix('feed') clears 'feed:rec:1', 'feed::latest:1', etc.
 */
export function invalidatePrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Update cached data in-place (for optimistic updates).
 * Calls updater(currentData) and stores the result with refreshed timestamp.
 */
export function update(key, updater) {
  const entry = store.get(key);
  if (!entry) return;
  entry.data = updater(entry.data);
  entry.timestamp = Date.now();
}

/**
 * Check if a key exists in cache (regardless of staleness).
 */
export function has(key) {
  return store.has(key);
}

/**
 * Clear entire cache (e.g. on logout).
 */
export function clear() {
  store.clear();
}

export default { get, set, invalidate, invalidatePrefix, update, has, clear };
