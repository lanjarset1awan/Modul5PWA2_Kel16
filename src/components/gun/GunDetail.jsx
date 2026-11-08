import { useState, useMemo } from 'react'
import {
  ArrowLeft,
  Star,
  Send,
  Loader,
  ChevronLeft,
  ChevronRight,
  Archive,
  ThumbsUp,
  ThumbsDown,
  Edit2,
  Trash2,
  Check,
  X,
} from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import ShareButton from '../common/ShareButton'
import { useReviews, useCreateReview, useUpdateReview, useDeleteReview } from '../../hooks/useReviews'
import reviewService from '../../services/reviewService'
import { getUserIdentifier } from '../../services/userService'
import { formatPrice, averageRating } from '../../utils/helpers'

/**
 * Full-screen product detail view with:
 * - Multi-image interactive gallery
 * - Review submission, edit/delete for own review
 * - Thumbs up / Thumbs down (like/dislike) for others' reviews
 * - Sharelink and Archive actions
 */
export default function GunDetail({ gun, onBack, onEdit, onDelete, onArchive }) {
  // ---- Multi-image gallery ----
  const images = useMemo(() => {
    if (Array.isArray(gun.images) && gun.images.length > 0) {
      return gun.images
    }
    const single = gun.image_url || gun.image || '/guns/pistol.svg'
    const fallbackList = [
      single,
      single.includes('rifle') ? '/guns/pistol.svg' : '/guns/rifle.svg',
      single.includes('shotgun') ? '/guns/pistol.svg' : '/guns/shotgun.svg',
    ]
    return Array.from(new Set(fallbackList))
  }, [gun])

  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }

  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0
  const currentUserId = getUserIdentifier()

  // ---- Reviews State & Hooks ----
  const { reviews, loading: reviewsLoading, refetch: refetchReviews } = useReviews(gun.id)
  const { createReview, loading: submitting } = useCreateReview()
  const { updateReview, loading: updatingReview } = useUpdateReview()
  const { deleteReview } = useDeleteReview()

  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')

  // Edit review state
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [editRating, setEditRating] = useState(5)
  const [editComment, setEditComment] = useState('')

  // Reactions state cache for instant UI feedback
  const [reactionsMap, setReactionsMap] = useState({})

  const getReviewReactions = (reviewId) => {
    if (reactionsMap[reviewId]) return reactionsMap[reviewId]
    return reviewService.getReactions(reviewId)
  }

  const handleToggleReaction = (reviewId, type) => {
    const updated = reviewService.toggleReaction(reviewId, type)
    setReactionsMap((prev) => ({
      ...prev,
      [reviewId]: updated,
    }))
  }

  const avgRating = gun.average_rating || averageRating(reviews)
  const reviewCount = gun.review_count ?? reviews.length

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    setReviewError('')
    setReviewSuccess('')

    if (rating < 1 || rating > 5) {
      setReviewError('Rating must be between 1 and 5.')
      return
    }

    const result = await createReview(gun.id, {
      user_identifier: currentUserId,
      rating,
      comment: comment.trim(),
    })

    if (result) {
      setReviewSuccess('Review submitted successfully!')
      setComment('')
      setRating(5)
      refetchReviews()
    } else {
      setReviewError('Could not submit review.')
    }
  }

  const handleStartEditReview = (rev) => {
    setEditingReviewId(rev.id)
    setEditRating(rev.rating)
    setEditComment(rev.comment || '')
  }

  const handleSaveEditReview = async (revId) => {
    const updated = await updateReview(revId, {
      rating: editRating,
      comment: editComment.trim(),
    })
    if (updated) {
      setEditingReviewId(null)
      refetchReviews()
    }
  }

  const handleDeleteReviewItem = async (revId) => {
    if (window.confirm('Delete this review permanently?')) {
      const ok = await deleteReview(revId)
      if (ok) {
        refetchReviews()
      }
    }
  }

  return (
    <div className="detail">
      {/* Back button */}
      <button type="button" className="detail-back" onClick={onBack}>
        <ArrowLeft size={18} /> Back to Catalog
      </button>

      {/* Hero */}
      <div className="detail-hero">
        {/* Multi-image gallery display */}
        <div className="detail-gallery">
          <div className="detail-img-frame">
            <img
              className="detail-img"
              src={images[activeImageIndex] || '/guns/pistol.svg'}
              alt={`${gun.name} view ${activeImageIndex + 1}`}
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="gallery-arrow gallery-arrow--left"
                  onClick={handlePrevImage}
                  aria-label="Previous image"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  className="gallery-arrow gallery-arrow--right"
                  onClick={handleNextImage}
                  aria-label="Next image"
                >
                  <ChevronRight size={20} />
                </button>
                <span className="gallery-counter">
                  {activeImageIndex + 1} / {images.length}
                </span>
              </>
            )}
          </div>

          {/* Thumbnails strip */}
          {images.length > 1 && (
            <div className="detail-thumbs">
              {images.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`thumb-btn ${idx === activeImageIndex ? 'thumb-btn--active' : ''}`}
                  onClick={() => setActiveImageIndex(idx)}
                >
                  <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <h1 className="display">{gun.name}</h1>
          <p className="type">
            {category}
            {caliber ? ` · ${caliber}` : ''}
          </p>
          <p className="price detail-price">{formatPrice(price)}</p>

          {avgRating > 0 && (
            <p className="detail-rating">
              <Star size={16} fill="var(--brass)" stroke="var(--brass)" />
              {avgRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
            </p>
          )}

          <div className="detail-actions">
            <ShareButton gun={gun} variant="button" />
            <FavoriteButton gunId={gun.id || gun.name} />

            {onArchive && (
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => onArchive(gun)}
                title="Archive (Soft Delete)"
              >
                <Archive size={16} /> Archive
              </button>
            )}

            {onEdit && (
              <button type="button" className="btn btn--outline" onClick={() => onEdit(gun)}>
                Edit
              </button>
            )}

            {onDelete && (
              <button type="button" className="btn btn--danger" onClick={() => onDelete(gun)}>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <section className="detail-section">
        <h2>Description</h2>
        <p>{gun.description || 'No description available.'}</p>
      </section>

      {/* Specifications */}
      {gun.ingredients && gun.ingredients.length > 0 && (
        <section className="detail-section">
          <h2>Specifications</h2>
          <ul className="detail-specs">
            {gun.ingredients.map((ing, i) => (
              <li key={ing.id || i}>
                <strong>{ing.name}</strong> — {ing.quantity}
              </li>
            ))}
          </ul>
        </section>
      )}

      {gun.steps && gun.steps.length > 0 && (
        <section className="detail-section">
          <h2>Assembly / Maintenance Steps</h2>
          <ol className="detail-steps">
            {gun.steps.map((step, i) => (
              <li key={step.id || i}>
                {step.instruction || step}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Reviews Section */}
      <section className="detail-section">
        <h2>Reviews & Operator Ratings</h2>

        {/* Submit review */}
        <form className="review-form" onSubmit={handleSubmitReview}>
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="star-btn"
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  size={22}
                  fill={n <= rating ? 'var(--brass)' : 'none'}
                  stroke={n <= rating ? 'var(--brass)' : 'var(--steel)'}
                />
              </button>
            ))}
          </div>

          <textarea
            className="review-input"
            rows="3"
            placeholder="Share your operator field review…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
          />

          <button
            type="submit"
            className="btn btn--primary"
            disabled={submitting}
          >
            {submitting ? (
              <><Loader size={16} className="spin" /> Submitting…</>
            ) : (
              <><Send size={16} /> Submit Review</>
            )}
          </button>

          {reviewError && <p className="form-error">{reviewError}</p>}
          {reviewSuccess && <p className="form-success">{reviewSuccess}</p>}
        </form>

        {/* Existing reviews */}
        {reviewsLoading ? (
          <p className="detail-loading">Loading reviews…</p>
        ) : reviews.length > 0 ? (
          <ul className="review-list">
            {reviews.map((rev) => {
              const isOwnReview =
                rev.user_id === currentUserId ||
                rev.user_identifier === currentUserId ||
                rev.user_identifier === `Operator ${currentUserId.substring(0, 8)}`

              const isEditing = editingReviewId === rev.id
              const reactions = getReviewReactions(rev.id)

              return (
                <li key={rev.id} className="review-item">
                  <div className="review-head">
                    <div className="review-user-info">
                      <span className="review-user">{rev.user_identifier || 'Operator'}</span>
                      {!isEditing && (
                        <span className="review-stars-display" aria-label={`${rev.rating} of 5 stars`}>
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              size={14}
                              fill={i < rev.rating ? 'var(--brass)' : 'none'}
                              stroke={i < rev.rating ? 'var(--brass)' : 'var(--line)'}
                            />
                          ))}
                        </span>
                      )}
                    </div>

                    {/* Own review actions: Edit / Delete */}
                    {isOwnReview && !isEditing && (
                      <div className="review-own-actions">
                        <button
                          type="button"
                          className="btn-rev-act btn-rev-act--edit"
                          onClick={() => handleStartEditReview(rev)}
                          title="Edit your review"
                        >
                          <Edit2 size={14} /> <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="btn-rev-act btn-rev-act--delete"
                          onClick={() => handleDeleteReviewItem(rev.id)}
                          title="Delete your review"
                        >
                          <Trash2 size={14} /> <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline editing mode */}
                  {isEditing ? (
                    <div className="review-edit-box">
                      <div className="review-stars">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className="star-btn"
                            onClick={() => setEditRating(n)}
                          >
                            <Star
                              size={18}
                              fill={n <= editRating ? 'var(--brass)' : 'none'}
                              stroke={n <= editRating ? 'var(--brass)' : 'var(--steel)'}
                            />
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="review-input"
                        rows="2"
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        placeholder="Edit your review..."
                      />
                      <div className="review-edit-btns">
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          disabled={updatingReview}
                          onClick={() => handleSaveEditReview(rev.id)}
                        >
                          <Check size={14} /> Save
                        </button>
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={() => setEditingReviewId(null)}
                        >
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {rev.comment && <p className="review-comment">{rev.comment}</p>}

                      {/* Other reviews: Thumbs up / down reaction bar */}
                      <div className="review-reaction-bar">
                        <button
                          type="button"
                          className={`btn-reaction ${reactions.userReaction === 'like' ? 'btn-reaction--active' : ''}`}
                          onClick={() => handleToggleReaction(rev.id, 'like')}
                          title="Like review"
                        >
                          <ThumbsUp size={13} />
                          <span>{reactions.likes > 0 ? reactions.likes : ''}</span>
                        </button>

                        <button
                          type="button"
                          className={`btn-reaction ${reactions.userReaction === 'dislike' ? 'btn-reaction--active' : ''}`}
                          onClick={() => handleToggleReaction(rev.id, 'dislike')}
                          title="Dislike review"
                        >
                          <ThumbsDown size={13} />
                          <span>{reactions.dislikes > 0 ? reactions.dislikes : ''}</span>
                        </button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="detail-empty">No reviews yet. Be the first operator to review!</p>
        )}
      </section>
    </div>
  )
}
