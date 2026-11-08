import { Archive, Images } from 'lucide-react'
import FavoriteButton from '../common/FavoriteButton'
import ShareButton from '../common/ShareButton'
import LazyImage from '../common/LazyImage'
import { formatPrice, truncate } from '../../utils/helpers'

/**
 * Product card used in the catalog grid.
 *
 * @param {Object}   props
 * @param {Object}   props.gun       — product data
 * @param {Function} props.onSelect  — called with the gun when clicked
 * @param {Function} [props.onEdit]  — called when Edit is clicked
 * @param {Function} [props.onDelete]— called when Delete is clicked
 * @param {Function} [props.onArchive]— called when Archive is clicked
 * @param {Function} [props.onNotify]— callback for toast notification
 */
export default function GunCard({ gun, onSelect, onEdit, onDelete, onArchive, onNotify }) {
  const imgSrc = (Array.isArray(gun.images) && gun.images.length > 0)
    ? gun.images[0]
    : gun.image_url || gun.image || '/guns/pistol.svg'
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0
  const imageCount = Array.isArray(gun.images) ? gun.images.length : (gun.image_url ? 1 : 0)

  return (
    <li className="card">
      <button
        type="button"
        className="card-btn"
        onClick={() => onSelect(gun)}
        aria-label={`View ${gun.name}`}
      >
        <div className="card-img-wrap">
          <LazyImage
            className="card-img"
            src={imgSrc}
            alt={gun.name}
            height={180}
          />
          {imageCount > 1 && (
            <span
              className="badge-multi-img"
              title={`${imageCount} images available`}
            >
              <Images size={12} /> {imageCount}
            </span>
          )}
        </div>

        <span className="name display">{gun.name}</span>

        <span className="type">
          {category}
          {caliber ? ` · ${caliber}` : ''}
        </span>

        {gun.description && (
          <span className="card-desc">{truncate(gun.description, 72)}</span>
        )}

        <span className="price">{formatPrice(price)}</span>
      </button>

      {/* Floating actions row */}
      <div className="card-actions">
        <ShareButton gun={gun} onNotify={onNotify} />
        <FavoriteButton gunId={gun.id || gun.name} />

        {onArchive && (
          <button
            type="button"
            className="card-act-btn card-act-btn--archive"
            onClick={(e) => { e.stopPropagation(); onArchive(gun) }}
            aria-label={`Archive ${gun.name}`}
            title="Arsipkan (Soft Delete)"
          >
            <Archive size={14} />
          </button>
        )}

        {onEdit && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => { e.stopPropagation(); onEdit(gun) }}
            aria-label={`Edit ${gun.name}`}
            title="Edit"
          >
            ✏️
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            className="card-act-btn card-act-btn--danger"
            onClick={(e) => { e.stopPropagation(); onDelete(gun) }}
            aria-label={`Delete ${gun.name}`}
            title="Delete Permanently"
          >
            🗑️
          </button>
        )}
      </div>
    </li>
  )
}
