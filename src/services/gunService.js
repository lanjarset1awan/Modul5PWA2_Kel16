import { apiClient, IS_SUPABASE } from '../config/api'
import queryCache from '../utils/queryCache'

// ---------------------------------------------------------------------------
// Normalizer — standardizes product shape whether received from Supabase
// (public.products) or from the university API (/api/v1/recipes).
// ---------------------------------------------------------------------------
export const normalizeProduct = (item) => {
  if (!item) return null

  // Resolve specifications from Supabase `specs` (text array) or API `ingredients`
  let specsList = []
  if (Array.isArray(item.specs)) {
    specsList = item.specs.map((s, idx) => {
      if (typeof s === 'string') {
        const colonIndex = s.indexOf(':')
        if (colonIndex > -1) {
          return {
            id: `spec-${idx}`,
            name: s.substring(0, colonIndex).trim(),
            quantity: s.substring(colonIndex + 1).trim(),
          }
        }
        return {
          id: `spec-${idx}`,
          name: 'Specification',
          quantity: s.trim(),
        }
      }
      return s
    })
  } else if (Array.isArray(item.ingredients)) {
    specsList = item.ingredients
  }

  // Resolve steps
  const stepsList =
    Array.isArray(item.steps) && item.steps.length > 0
      ? item.steps
      : ['Verify firearm is completely unloaded and point in safe direction.', 'Inspect receiver and mechanism for maintenance.']

  // 1. Extract remote multi-images embedded in description (persisted in Supabase)
  let serverMultiImages = []
  let cleanDesc = item.description || ''
  if (cleanDesc.includes('<!--BB_IMAGES:')) {
    const match = cleanDesc.match(/<!--BB_IMAGES:(.*?)-->/)
    if (match) {
      try {
        serverMultiImages = JSON.parse(match[1])
        cleanDesc = cleanDesc.replace(/<!--BB_IMAGES:.*?-->/g, '').trim()
      } catch {
        // ignore
      }
    }
  }

  // 2. Resolve multi-image list from local persistence or item properties
  let localMultiImages = []
  if (item.id) {
    try {
      const stored = localStorage.getItem(`bore_barrel_gun_images_${item.id}`)
      if (stored) localMultiImages = JSON.parse(stored)
    } catch {
      // ignore storage error
    }
  }

  const primaryImage =
    (Array.isArray(serverMultiImages) && serverMultiImages[0]) ||
    (Array.isArray(localMultiImages) && localMultiImages[0]) ||
    item.image_url ||
    item.image ||
    (Array.isArray(item.images) && item.images[0]) ||
    '/guns/pistol.svg'

  // 3. Fallback: Ensure catalog weapons have multi-angle imagery so multi-image features
  // (badge, carousel, thumbnails) ALWAYS display on every device (Vercel mobile & localhost)
  const nameLower = (item.name || '').toLowerCase()
  const typeLower = (item.type || item.category || '').toLowerCase()

  let defaultMulti = []
  if (nameLower.includes('ak-47') || typeLower.includes('rifle') || nameLower.includes('m4a1')) {
    defaultMulti = [primaryImage, '/guns/rifle.svg', '/guns/pistol.svg']
  } else if (nameLower.includes('glock') || typeLower.includes('pistol')) {
    defaultMulti = [primaryImage, '/guns/pistol.svg', '/guns/shotgun.svg']
  } else if (nameLower.includes('mossberg') || typeLower.includes('shotgun') || nameLower.includes('remington')) {
    defaultMulti = [primaryImage, '/guns/shotgun.svg', '/guns/rifle.svg']
  } else {
    defaultMulti = [primaryImage, primaryImage === '/guns/pistol.svg' ? '/guns/rifle.svg' : '/guns/pistol.svg']
  }
  defaultMulti = Array.from(new Set(defaultMulti))

  const imagesList =
    Array.isArray(serverMultiImages) && serverMultiImages.length > 0
      ? serverMultiImages
      : Array.isArray(localMultiImages) && localMultiImages.length > 0
      ? localMultiImages
      : Array.isArray(item.images) && item.images.length > 0
      ? item.images
      : defaultMulti

  return {
    ...item,
    id: item.id,
    name: item.name || 'Hardware Piece',
    type: item.type || item.category || 'Hardware',
    category: item.type || item.category || 'Hardware',
    caliber: item.caliber || 'Standard',
    price: Number(item.price ?? item.cook_time ?? 0),
    description: cleanDesc,
    image_url: primaryImage,
    image: primaryImage,
    images: imagesList,
    ingredients: specsList,
    steps: stepsList,
  }
}

// ---------------------------------------------------------------------------
// GunService — wraps backend CRUD endpoints.
// Supports both Supabase PostgREST table (/rest/v1/products) and
// standard REST API (/api/v1/recipes).
// ---------------------------------------------------------------------------
class GunService {
  /**
   * Fetch a paginated, filterable list of products.
   */
  async getGuns(params = {}) {
    if (IS_SUPABASE) {
      const queryParts = ['select=*']

      if (params.search) {
        queryParts.push(`name=ilike.*${encodeURIComponent(params.search)}*`)
      }

      if (params.category && params.category !== 'All') {
        queryParts.push(`type=eq.${encodeURIComponent(params.category)}`)
      }

      if (params.sort_by) {
        const order = params.order === 'desc' ? 'desc' : 'asc'
        queryParts.push(`order=${encodeURIComponent(params.sort_by)}.${order}`)
      } else {
        queryParts.push('order=created_at.desc')
      }

      if (params.limit) {
        queryParts.push(`limit=${params.limit}`)
      }

      const queryString = queryParts.join('&')
      const data = await apiClient.get(`/rest/v1/products?${queryString}`)
      const list = Array.isArray(data) ? data.map(normalizeProduct) : []

      return {
        success: true,
        data: list,
        pagination: {
          total: list.length,
          page: params.page || 1,
          limit: params.limit || 50,
        },
      }
    }

    // Fallback: university REST API
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    )
    return apiClient.get('/api/v1/recipes', { params: clean })
  }

  /**
   * Fetch a single product by ID.
   */
  async getGunById(id) {
    if (IS_SUPABASE) {
      const data = await apiClient.get(`/rest/v1/products?id=eq.${id}&select=*`)
      if (Array.isArray(data) && data.length > 0) {
        return { success: true, data: normalizeProduct(data[0]) }
      }
      throw new Error('Hardware item not found.')
    }
    return apiClient.get(`/api/v1/recipes/${id}`)
  }

  /**
   * Create a new product.
   */
  async createGun(data) {
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : []

      const primaryImg = (Array.isArray(data.images) && data.images[0]) || data.image_url || '/guns/pistol.svg'

      // Embed multi-images in description comment so Supabase persists it across all devices
      let finalDescription = data.description || ''
      if (Array.isArray(data.images) && data.images.length > 0) {
        finalDescription = finalDescription.replace(/<!--BB_IMAGES:.*?-->/g, '').trim()
        finalDescription = `${finalDescription}\n<!--BB_IMAGES:${JSON.stringify(data.images)}-->`
      }

      const payload = {
        name: data.name,
        type: data.type || (data.category === 'minuman' ? 'Rifle' : 'Pistol'),
        caliber: data.caliber || '9mm',
        price: Number(data.price ?? data.cook_time ?? 0),
        description: finalDescription,
        specs: specsArray,
        image_url: primaryImg,
      }

      const res = await apiClient.post('/rest/v1/products', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res

      // Save multi-image array locally linked to the created ID so it doesn't fail Supabase schema
      if (created && created.id && Array.isArray(data.images) && data.images.length > 0) {
        try {
          localStorage.setItem(`bore_barrel_gun_images_${created.id}`, JSON.stringify(data.images))
        } catch {
          // ignore
        }
      }

      queryCache.invalidate('guns')
      return { success: true, data: normalizeProduct(created) }
    }
    const result = await apiClient.post('/api/v1/recipes', data)
    queryCache.invalidate('guns')
    return result
  }

  /**
   * Update existing product.
   */
  async updateGun(id, data) {
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : undefined

      const payload = {
        updated_at: new Date().toISOString(),
      }
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.caliber !== undefined) payload.caliber = data.caliber
      if (data.price !== undefined || data.cook_time !== undefined) {
        payload.price = Number(data.price ?? data.cook_time ?? 0)
      }
      
      let finalDescription = data.description
      if (finalDescription !== undefined) {
        if (Array.isArray(data.images) && data.images.length > 0) {
          finalDescription = finalDescription.replace(/<!--BB_IMAGES:.*?-->/g, '').trim()
          finalDescription = `${finalDescription}\n<!--BB_IMAGES:${JSON.stringify(data.images)}-->`
        }
        payload.description = finalDescription
      }

      if (specsArray !== undefined) payload.specs = specsArray
      if (data.images !== undefined && Array.isArray(data.images) && data.images.length > 0) {
        try {
          localStorage.setItem(`bore_barrel_gun_images_${id}`, JSON.stringify(data.images))
        } catch {
          // ignore
        }
        payload.image_url = data.images[0]
      } else if (data.image_url !== undefined) {
        payload.image_url = data.image_url
      }

      const res = await apiClient.patch(`/rest/v1/products?id=eq.${id}`, payload, {
        headers: { Prefer: 'return=representation' },
      })
      const updated = Array.isArray(res) ? res[0] : res
      queryCache.invalidate('guns')
      queryCache.invalidate('gun-detail')
      return { success: true, data: normalizeProduct(updated) }
    }
    const result = await apiClient.put(`/api/v1/recipes/${id}`, data)
    queryCache.invalidate('guns')
    queryCache.invalidate('gun-detail')
    return result
  }

  /**
   * Partial update (PATCH).
   */
  async patchGun(id, data) {
    queryCache.invalidate('guns')
    queryCache.invalidate('gun-detail')
    if (IS_SUPABASE) {
      return this.updateGun(id, data)
    }
    return apiClient.patch(`/api/v1/recipes/${id}`, data)
  }

  /**
   * Delete product.
   */
  async deleteGun(id) {
    queryCache.invalidate('guns')
    queryCache.invalidate('gun-detail')
    try {
      localStorage.removeItem(`bore_barrel_gun_images_${id}`)
    } catch {
      // ignore
    }
    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/products?id=eq.${id}`)
      return { success: true }
    }
    return apiClient.delete(`/api/v1/recipes/${id}`)
  }
}

export default new GunService()
