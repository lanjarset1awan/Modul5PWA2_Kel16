import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { shareGun } from '../../utils/shareHelper'

/**
 * Reusable Share Button with Web Share API and Clipboard Fallback.
 *
 * @param {Object} props
 * @param {Object} props.gun - Product data to share
 * @param {'icon' | 'button'} [props.variant='icon'] - Button appearance style
 * @param {Function} [props.onNotify] - Callback when share/copy triggers
 * @param {string} [props.className] - Additional CSS class
 */
export default function ShareButton({ gun, variant = 'icon', onNotify, className = '' }) {
  const [copied, setCopied] = useState(false)

  const handleShare = async (e) => {
    e.stopPropagation()
    const result = await shareGun(gun)

    if (result.success) {
      setCopied(true)
      if (onNotify) {
        onNotify(result.message || 'Link copied!')
      }
      setTimeout(() => setCopied(false), 2200)
    }
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        className={`btn btn--outline btn-share ${copied ? 'btn-share--copied' : ''} ${className}`}
        onClick={handleShare}
        title={`Share ${gun?.name || 'product'}`}
      >
        {copied ? (
          <>
            <Check size={16} className="text-success" /> Copied Link!
          </>
        ) : (
          <>
            <Share2 size={16} /> Share Link
          </>
        )}
      </button>
    )
  }

  // Icon variant for cards
  return (
    <button
      type="button"
      className={`card-act-btn card-act-btn--share ${copied ? 'card-act-btn--copied' : ''} ${className}`}
      onClick={handleShare}
      aria-label={`Share link for ${gun?.name || 'product'}`}
      title={copied ? 'Link Copied!' : `Share ${gun?.name || 'product'}`}
    >
      {copied ? <Check size={15} color="var(--brass)" /> : <Share2 size={15} />}
    </button>
  )
}

