import { useState, useEffect, useRef } from 'react'

/**
 * LazyImage — Defers image loading until it enters or approaches the viewport
 * using IntersectionObserver. Ensures gradual network fetching upon scroll.
 *
 * @param {Object} props
 * @param {string} props.src - Target image source URL
 * @param {string} props.alt - Alternative text
 * @param {string} [props.className] - Class name for image element
 * @param {number} [props.width] - Image width
 * @param {number} [props.height] - Image height
 * @param {string} [props.placeholder] - Optional fallback placeholder
 */
export default function LazyImage({
  src,
  alt = '',
  className = '',
  width,
  height,
  placeholder = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180"><rect width="240" height="180" fill="%23e2e8f0"/></svg>',
  ...rest
}) {
  const [isVisible, setIsVisible] = useState(
    () => typeof window !== 'undefined' && !('IntersectionObserver' in window),
  )
  const [isLoaded, setIsLoaded] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.unobserve(entry.target)
          }
        })
      },
      {
        rootMargin: '50px 0px', // trigger slightly before entering viewport
        threshold: 0.01,
      },
    )

    const el = imgRef.current
    if (el) observer.observe(el)

    return () => {
      if (el) observer.unobserve(el)
    }
  }, [])

  return (
    <div
      ref={imgRef}
      className={`lazy-img-container ${isLoaded ? 'lazy-img--loaded' : 'lazy-img--loading'}`}
      style={{ width: width ? `${width}px` : '100%', height: height ? `${height}px` : 'auto' }}
    >
      <img
        src={isVisible ? src : placeholder}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onLoad={() => {
          if (isVisible) setIsLoaded(true)
        }}
        className={`lazy-img ${className} ${isLoaded ? 'lazy-img--visible' : ''}`}
        {...rest}
      />
    </div>
  )
}

