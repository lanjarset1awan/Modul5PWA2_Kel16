import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Reusable Pagination Controls.
 *
 * @param {Object} props
 * @param {number} props.currentPage - Current active page (1-based)
 * @param {number} props.totalPages - Total number of available pages
 * @param {number} props.totalItems - Total item count across all pages
 * @param {number} props.itemsPerPage - Number of items displayed per page
 * @param {Function} props.onPageChange - Handler called with new page number
 * @param {Function} [props.onItemsPerPageChange] - Handler called when page size changes
 */
export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}) {
  const safeTotalPages = Math.max(1, totalPages || 1)
  const startIndex = totalItems === 0 ? 0 : Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems)

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = []
    const maxButtons = 5

    if (safeTotalPages <= maxButtons) {
      for (let i = 1; i <= safeTotalPages; i++) pages.push(i)
    } else {
      let start = Math.max(1, currentPage - 2)
      let end = Math.min(safeTotalPages, start + maxButtons - 1)

      if (end - start < maxButtons - 1) {
        start = Math.max(1, end - maxButtons + 1)
      }

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
    }
    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <nav className="pagination-wrap" aria-label="Catalog pagination">
      <div className="pagination-info">
        Showing <span className="font-semibold">{startIndex}–{endIndex}</span> of{' '}
        <span className="font-semibold">{totalItems}</span> pieces
      </div>

      <div className="pagination-controls">
        {/* Previous page */}
        <button
          type="button"
          className="btn-page btn-page--nav"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} /> Prev
        </button>

        {/* Page buttons */}
        <div className="pagination-numbers">
          {pageNumbers[0] > 1 && (
            <>
              <button
                type="button"
                className={`btn-page ${currentPage === 1 ? 'btn-page--active' : ''}`}
                onClick={() => onPageChange(1)}
              >
                1
              </button>
              {pageNumbers[0] > 2 && <span className="pagination-ellipsis">…</span>}
            </>
          )}

          {pageNumbers.map((page) => (
            <button
              key={page}
              type="button"
              className={`btn-page ${currentPage === page ? 'btn-page--active' : ''}`}
              onClick={() => onPageChange(page)}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </button>
          ))}

          {pageNumbers[pageNumbers.length - 1] < safeTotalPages && (
            <>
              {pageNumbers[pageNumbers.length - 1] < safeTotalPages - 1 && (
                <span className="pagination-ellipsis">…</span>
              )}
              <button
                type="button"
                className={`btn-page ${currentPage === safeTotalPages ? 'btn-page--active' : ''}`}
                onClick={() => onPageChange(safeTotalPages)}
              >
                {safeTotalPages}
              </button>
            </>
          )}
        </div>

        {/* Next page */}
        <button
          type="button"
          className="btn-page btn-page--nav"
          disabled={currentPage >= safeTotalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>

      {/* Page size dropdown */}
      {onItemsPerPageChange && (
        <div className="pagination-size">
          <label htmlFor="per-page-select">Per page:</label>
          <select
            id="per-page-select"
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="pagination-select"
          >
            <option value={4}>4</option>
            <option value={6}>6</option>
            <option value={8}>8</option>
            <option value={12}>12</option>
          </select>
        </div>
      )}
    </nav>
  )
}
