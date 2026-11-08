// ---------------------------------------------------------------------------
// queryCache.js — Lightweight in-memory query caching with TTL & invalidation.
// Designed for PWA data management to reduce network overhead and provide
// instant responses for previously fetched queries.
// ---------------------------------------------------------------------------

class QueryCache {
  constructor(defaultTtlMs = 5 * 60 * 1000) { // 5 minutes default
    this.cache = new Map()
    this.defaultTtl = defaultTtlMs
  }

  /**
   * Generate a normalized cache key.
   */
  createKey(namespace, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        if (params[key] !== undefined && params[key] !== '') {
          acc[key] = params[key]
        }
        return acc
      }, {})
    return `${namespace}:${JSON.stringify(sortedParams)}`
  }

  /**
   * Retrieve cached item if valid (not expired).
   */
  get(key) {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * Store data in cache with TTL.
   */
  set(key, data, ttlMs = this.defaultTtl) {
    const expiresAt = Date.now() + ttlMs
    this.cache.set(key, {
      data,
      savedAt: Date.now(),
      expiresAt,
    })
  }

  /**
   * Invalidate specific key or all keys matching a prefix.
   * e.g. invalidate('guns') removes all keys starting with 'guns'
   */
  invalidate(keyOrPrefix) {
    let count = 0
    for (const key of this.cache.keys()) {
      if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) {
        this.cache.delete(key)
        count++
      }
    }
    return count
  }

  /**
   * Check if a valid entry exists.
   */
  has(key) {
    return this.get(key) !== null
  }

  /**
   * Clear all cached items.
   */
  clear() {
    this.cache.clear()
  }

  /**
   * Get debug/status info about cached items.
   */
  getStats() {
    const now = Date.now()
    const entries = []
    for (const [key, val] of this.cache.entries()) {
      entries.push({
        key,
        ageSeconds: Math.round((now - val.savedAt) / 1000),
        remainingSeconds: Math.max(0, Math.round((val.expiresAt - now) / 1000)),
        expired: now > val.expiresAt,
      })
    }
    return {
      size: this.cache.size,
      entries,
    }
  }
}

export const queryCache = new QueryCache()
export default queryCache

