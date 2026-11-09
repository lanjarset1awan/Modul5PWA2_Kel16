import { apiClient, IS_SUPABASE } from '../config/api.js'
import { getUserIdentifier } from './userService.js'

// ---------------------------------------------------------------------------
// ReviewService — product reviews, ratings, edit/delete, & like/dislike.
// Supports Supabase, REST API, and local storage fallback for offline robustness.
// Syncs reaction metadata (likes, dislikes, user votes) seamlessly via Supabase.
// ---------------------------------------------------------------------------

const LOCAL_REVIEWS_KEY = 'bore_barrel_local_reviews'
const REACTIONS_KEY = 'bore_barrel_review_reactions'

class ReviewService {
  /**
   * Helper: Get local reviews from localStorage
   */
  getLocalReviews(gunId) {
    try {
      const raw = localStorage.getItem(LOCAL_REVIEWS_KEY)
      const all = raw ? JSON.parse(raw) : []
      if (!gunId) return all
      return all.filter((r) => String(r.product_id) === String(gunId))
    } catch {
      return []
    }
  }

  /**
   * Helper: Save local review
   */
  saveLocalReview(review) {
    try {
      const raw = localStorage.getItem(LOCAL_REVIEWS_KEY)
      const all = raw ? JSON.parse(raw) : []
      all.unshift(review)
      localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(all))
      return review
    } catch {
      return review
    }
  }

  /**
   * Sync reaction metadata received from server into client storage
   */
  syncServerReactions(reviewId, serverMeta) {
    try {
      const raw = localStorage.getItem(REACTIONS_KEY)
      const data = raw ? JSON.parse(raw) : {}
      const existing = data[reviewId] || { likes: 0, dislikes: 0, userReactions: {} }
      const serverUsers = serverMeta.users || {}
      
      const mergedUsers = { ...serverUsers, ...existing.userReactions }
      const likes = typeof serverMeta.likes === 'number' ? serverMeta.likes : Object.values(mergedUsers).filter((v) => v === 'like').length
      const dislikes = typeof serverMeta.dislikes === 'number' ? serverMeta.dislikes : Object.values(mergedUsers).filter((v) => v === 'dislike').length

      data[reviewId] = {
        likes,
        dislikes,
        userReactions: mergedUsers,
      }
      localStorage.setItem(REACTIONS_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('Failed syncing server reactions:', e)
    }
  }

  /**
   * Fetch all reviews for a given product.
   */
  async getReviews(gunId) {
    const local = this.getLocalReviews(gunId)

    if (IS_SUPABASE) {
      try {
        const data = await apiClient.get(
          `/rest/v1/reviews?product_id=eq.${gunId}&select=*&order=created_at.desc`,
        )
        const serverList = Array.isArray(data)
          ? data.map((r) => {
              let cleanComment = r.comment || ''
              let serverMeta = null

              if (cleanComment.includes('<!--BB_REACTIONS:')) {
                const match = cleanComment.match(/<!--BB_REACTIONS:(.*?)-->/)
                if (match) {
                  try {
                    serverMeta = JSON.parse(match[1])
                    cleanComment = cleanComment.replace(/<!--BB_REACTIONS:.*?-->/g, '').trim()
                  } catch {
                    // ignore JSON parse error
                  }
                }
              }

              if (serverMeta) {
                this.syncServerReactions(r.id, serverMeta)
              }

              return {
                id: r.id,
                product_id: r.product_id,
                user_id: r.user_id,
                user_identifier: r.user_id ? `Operator ${String(r.user_id).substring(0, 8)}` : 'Anonymous',
                rating: r.rating,
                comment: cleanComment,
                created_at: r.created_at,
              }
            })
          : []

        // Merge server and local unique reviews
        const ids = new Set(serverList.map((r) => String(r.id)))
        const merged = [...serverList]
        local.forEach((lr) => {
          if (!ids.has(String(lr.id))) {
            merged.push(lr)
          }
        })
        return { success: true, data: merged }
      } catch (err) {
        console.warn('Review API unreachable, returning local reviews:', err.message)
        return { success: true, data: local }
      }
    }

    try {
      const res = await apiClient.get(`/api/v1/recipes/${gunId}/reviews`)
      const list = res.data || []
      return { success: true, data: [...list, ...local] }
    } catch {
      return { success: true, data: local }
    }
  }

  /**
   * Submit a new review.
   */
  async createReview(gunId, reviewData) {
    const currentUserId = getUserIdentifier()
    const syntheticId = `rev-${Date.now()}`
    const localEntry = {
      id: syntheticId,
      product_id: gunId,
      user_id: currentUserId,
      user_identifier: reviewData.user_identifier || `Operator ${currentUserId.substring(0, 8)}`,
      rating: Number(reviewData.rating),
      comment: reviewData.comment || '',
      created_at: new Date().toISOString(),
    }

    if (IS_SUPABASE) {
      try {
        const payload = {
          product_id: Number(gunId) || undefined,
          user_id: currentUserId,
          rating: Number(reviewData.rating),
          comment: reviewData.comment || '',
        }

        const res = await apiClient.post('/rest/v1/reviews', payload, {
          headers: { Prefer: 'return=representation' },
        })
        const created = Array.isArray(res) ? res[0] : res
        return {
          success: true,
          data: {
            ...created,
            user_id: currentUserId,
            user_identifier: `Operator ${currentUserId.substring(0, 8)}`,
          },
        }
      } catch (err) {
        console.warn('Could not post to remote API, saving locally:', err.message)
        this.saveLocalReview(localEntry)
        return { success: true, data: localEntry }
      }
    }

    try {
      const res = await apiClient.post(`/api/v1/recipes/${gunId}/reviews`, reviewData)
      return res
    } catch {
      this.saveLocalReview(localEntry)
      return { success: true, data: localEntry }
    }
  }

  /**
   * Edit an existing review (only if created by current user).
   */
  async updateReview(reviewId, reviewData) {
    // Preserve any existing reaction metadata
    let serverComment = reviewData.comment || ''
    try {
      const raw = localStorage.getItem(REACTIONS_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        const reactionsMeta = data[reviewId]
        if (reactionsMeta) {
          const metaStr = JSON.stringify({
            likes: reactionsMeta.likes || 0,
            dislikes: reactionsMeta.dislikes || 0,
            users: reactionsMeta.userReactions || {},
          })
          serverComment = `${serverComment.replace(/<!--BB_REACTIONS:.*?-->/g, '').trim()}\n<!--BB_REACTIONS:${metaStr}-->`
        }
      }
    } catch {
      // ignore
    }

    // Update in localStorage
    try {
      const raw = localStorage.getItem(LOCAL_REVIEWS_KEY)
      if (raw) {
        const list = JSON.parse(raw)
        const idx = list.findIndex((r) => String(r.id) === String(reviewId))
        if (idx > -1) {
          list[idx].rating = Number(reviewData.rating)
          list[idx].comment = reviewData.comment
          list[idx].updated_at = new Date().toISOString()
          localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(list))
        }
      }
    } catch (e) {
      console.warn('Failed local review update:', e)
    }

    if (IS_SUPABASE && !String(reviewId).startsWith('rev-')) {
      try {
        const res = await apiClient.patch(
          `/rest/v1/reviews?id=eq.${reviewId}`,
          {
            rating: Number(reviewData.rating),
            comment: serverComment,
          },
          { headers: { Prefer: 'return=representation' } },
        )
        return { success: true, data: Array.isArray(res) ? res[0] : res }
      } catch (err) {
        console.warn('Server review update failed:', err.message)
      }
    }

    return {
      success: true,
      data: { id: reviewId, rating: Number(reviewData.rating), comment: reviewData.comment },
    }
  }

  /**
   * Delete a review.
   */
  async deleteReview(reviewId) {
    // Delete from localStorage
    try {
      const raw = localStorage.getItem(LOCAL_REVIEWS_KEY)
      if (raw) {
        const list = JSON.parse(raw).filter((r) => String(r.id) !== String(reviewId))
        localStorage.setItem(LOCAL_REVIEWS_KEY, JSON.stringify(list))
      }
    } catch (e) {
      console.warn('Failed local review delete:', e)
    }

    if (IS_SUPABASE && !String(reviewId).startsWith('rev-')) {
      try {
        await apiClient.delete(`/rest/v1/reviews?id=eq.${reviewId}`)
      } catch (err) {
        console.warn('Server review delete failed:', err.message)
      }
    }

    return { success: true }
  }

  /**
   * Get reactions (likes/dislikes) for a review.
   */
  getReactions(reviewId) {
    try {
      const raw = localStorage.getItem(REACTIONS_KEY)
      const data = raw ? JSON.parse(raw) : {}
      const item = data[reviewId] || { likes: 0, dislikes: 0, userReactions: {} }
      const currentUserId = getUserIdentifier()
      return {
        likes: item.likes ?? 0,
        dislikes: item.dislikes ?? 0,
        userReaction: item.userReactions?.[currentUserId] || null, // 'like' | 'dislike' | null
      }
    } catch {
      return { likes: 0, dislikes: 0, userReaction: null }
    }
  }

  /**
   * Toggle like or dislike for a review.
   * Optimistically updates state and syncs to Supabase so other users/devices see updated counts.
   *
   * @param {string|number|Object} reviewOrId - review object or ID
   * @param {'like'|'dislike'} reactionType
   */
  toggleReaction(reviewOrId, reactionType) {
    const reviewId = typeof reviewOrId === 'object' && reviewOrId !== null ? reviewOrId.id : reviewOrId
    const currentComment = typeof reviewOrId === 'object' && reviewOrId !== null ? reviewOrId.comment : ''

    try {
      const raw = localStorage.getItem(REACTIONS_KEY)
      const data = raw ? JSON.parse(raw) : {}
      const item = data[reviewId] || { likes: 0, dislikes: 0, userReactions: {} }
      if (!item.userReactions) item.userReactions = {}

      const currentUserId = getUserIdentifier()
      const currentReaction = item.userReactions[currentUserId]

      if (currentReaction === reactionType) {
        // Toggle OFF
        delete item.userReactions[currentUserId]
        if (reactionType === 'like') item.likes = Math.max(0, (item.likes || 1) - 1)
        if (reactionType === 'dislike') item.dislikes = Math.max(0, (item.dislikes || 1) - 1)
      } else {
        // Switch or set
        if (currentReaction === 'like') item.likes = Math.max(0, (item.likes || 1) - 1)
        if (currentReaction === 'dislike') item.dislikes = Math.max(0, (item.dislikes || 1) - 1)

        item.userReactions[currentUserId] = reactionType
        if (reactionType === 'like') item.likes = (item.likes || 0) + 1
        if (reactionType === 'dislike') item.dislikes = (item.dislikes || 0) + 1
      }

      data[reviewId] = item
      localStorage.setItem(REACTIONS_KEY, JSON.stringify(data))

      // Sync reaction changes to Supabase so all users & devices observe the incremented count
      if (IS_SUPABASE && !String(reviewId).startsWith('rev-')) {
        const metaStr = JSON.stringify({
          likes: item.likes,
          dislikes: item.dislikes,
          users: item.userReactions,
        })
        const cleanText = (currentComment || '').replace(/<!--BB_REACTIONS:.*?-->/g, '').trim()
        const commentPayload = `${cleanText}\n<!--BB_REACTIONS:${metaStr}-->`

        apiClient
          .patch(`/rest/v1/reviews?id=eq.${reviewId}`, { comment: commentPayload })
          .catch((err) => {
            console.warn('Supabase reaction sync error:', err.message)
          })
      }

      return {
        likes: item.likes,
        dislikes: item.dislikes,
        userReaction: item.userReactions[currentUserId] || null,
      }
    } catch {
      return { likes: 0, dislikes: 0, userReaction: null }
    }
  }
}

export default new ReviewService()
