import { useState, useEffect, useCallback } from 'react'
import gunService from '../services/gunService'
import queryCache from '../utils/queryCache'

// ---------------------------------------------------------------------------
// useGuns — fetch the paginated / filtered product list with Query Caching.
//
// Features:
// - In-memory Query Caching (TTL based) to eliminate redundant network roundtrips.
// - Returns { guns, loading, error, pagination, refetch, isFromCache }.
// - refetch({ force: true }) bypasses the cache to fetch fresh data from server.
// ---------------------------------------------------------------------------

export function useGuns(params = {}) {
  const [guns, setGuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [isFromCache, setIsFromCache] = useState(false)

  // Serialise params so the effect re-runs when they change.
  const paramKey = JSON.stringify(params)

  const fetchGuns = useCallback(async (options = {}) => {
    const { force = false } = options
    const cacheKey = queryCache.createKey('guns', params)

    // Check query cache unless forced refresh
    if (!force) {
      const cached = queryCache.get(cacheKey)
      if (cached) {
        setGuns(cached.guns || [])
        setPagination(cached.pagination || null)
        setError(null)
        setLoading(false)
        setIsFromCache(true)
        return
      }
    }

    try {
      setLoading(true)
      setError(null)
      setIsFromCache(false)

      const response = await gunService.getGuns(params)

      if (response.success) {
        const data = response.data || []
        const pag = response.pagination || null
        setGuns(data)
        setPagination(pag)
        // Store in query cache
        queryCache.set(cacheKey, { guns: data, pagination: pag })
      } else {
        setError(response.message || 'Failed to fetch products.')
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching products.')
      setGuns([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey])

  useEffect(() => {
    fetchGuns()
  }, [fetchGuns])

  return { guns, loading, error, pagination, refetch: fetchGuns, isFromCache }
}

// ---------------------------------------------------------------------------
// useGunById — fetch a single product by its UUID with Query Caching.
// ---------------------------------------------------------------------------

export function useGunById(id) {
  const [gun, setGun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isFromCache, setIsFromCache] = useState(false)

  const fetchGun = useCallback(async (options = {}) => {
    if (!id) {
      setLoading(false)
      return
    }

    const { force = false } = options
    const cacheKey = queryCache.createKey('gun-detail', { id })

    if (!force) {
      const cached = queryCache.get(cacheKey)
      if (cached) {
        setGun(cached)
        setError(null)
        setLoading(false)
        setIsFromCache(true)
        return
      }
    }

    try {
      setLoading(true)
      setError(null)
      setIsFromCache(false)

      const response = await gunService.getGunById(id)

      if (response.success) {
        setGun(response.data)
        queryCache.set(cacheKey, response.data)
      } else {
        setError(response.message || 'Product not found.')
      }
    } catch (err) {
      setError(err.message || 'Failed to load product details.')
      setGun(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchGun()
  }, [fetchGun])

  return { gun, loading, error, refetch: fetchGun, isFromCache }
}
