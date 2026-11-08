// ---------------------------------------------------------------------------
// shareHelper.js — Sharelink utility with Web Share API and Clipboard fallback.
// Generates deep-linkable URLs (?gun=<id>) for catalog items.
// ---------------------------------------------------------------------------

/**
 * Generate a shareable URL containing the ?gun= query parameter.
 */
export const generateShareUrl = (gun) => {
  if (!gun) return window.location.href
  const base = `${window.location.origin}${window.location.pathname}`
  const identifier = gun.id || gun.name
  return `${base}?gun=${encodeURIComponent(identifier)}`
}

/**
 * Share a product using native Web Share API (mobile/modern browsers)
 * with graceful fallback to copying the link to clipboard.
 *
 * @param {Object} gun - Product data
 * @returns {Promise<{ success: boolean, method: string, message?: string }>}
 */
export const shareGun = async (gun) => {
  if (!gun) return { success: false, method: 'error', message: 'No item to share.' }

  const url = generateShareUrl(gun)
  const category = gun.type || gun.category || 'Hardware'
  const title = `Bore & Barrel — ${gun.name}`
  const text = `Check out ${gun.name} (${category}) on Bore & Barrel armory!`

  // 1. Try native Web Share API
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return {
        success: true,
        method: 'share',
        message: `Shared ${gun.name}!`,
      }
    } catch (err) {
      // If user cancelled, don't trigger fallback error
      if (err.name === 'AbortError') {
        return { success: false, method: 'aborted' }
      }
      // If native share failed, continue to clipboard fallback below
    }
  }

  // 2. Fallback to Clipboard API
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return {
        success: true,
        method: 'clipboard',
        message: `Link copied to clipboard!`,
      }
    }

    // 3. Legacy textarea fallback if clipboard API unavailable
    const textArea = document.createElement('textarea')
    textArea.value = url
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textArea)

    if (copied) {
      return {
        success: true,
        method: 'clipboard',
        message: `Link copied to clipboard!`,
      }
    }
    throw new Error('Copy command failed')
  } catch (err) {
    return {
      success: false,
      method: 'error',
      message: err.message || 'Could not copy link.',
    }
  }
}

