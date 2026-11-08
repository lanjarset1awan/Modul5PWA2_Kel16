import { useState, useMemo, useEffect } from 'react'
import { RefreshCw, Plus, Loader, AlertCircle, PackageOpen, Zap, CheckCircle2 } from 'lucide-react'
import { useGuns } from '../hooks/useGuns'
import GUNS_LOCAL from '../data/guns'
import GunCard from '../components/gun/GunCard'
import GunDetail from '../components/gun/GunDetail'
import AdvancedFilter from '../components/common/AdvancedFilter'
import Pagination from '../components/common/Pagination'
import ConfirmModal from '../components/modals/ConfirmModal'
import gunService from '../services/gunService'
import queryCache from '../utils/queryCache'
import archiveService from '../services/archiveService'
import {
  matchesSearch,
  matchesCategory,
  sortItems,
  extractCategories,
} from '../utils/helpers'

/**
 * Catalog page — product listing with Query Caching, Sharelink, and Pagination.
 *
 * Data source priority:
 *   1. Live API via useGuns() (with in-memory Query Caching)
 *   2. Local static array (GUNS_LOCAL) when the API is unreachable
 */
export default function Catalog({ onNavigate }) {
  // ---- API data with Query Cache ----
  const { guns: apiGuns, loading, error, refetch, isFromCache } = useGuns({ limit: 50 })
  const [useLocal, setUseLocal] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3000)
  }

  // Decide data source
  const rawGuns = useMemo(() => {
    if (useLocal || (error && apiGuns.length === 0)) {
      return GUNS_LOCAL.map((g, i) => ({ ...g, id: g.id || `local-${i}` }))
    }
    return apiGuns
  }, [apiGuns, error, useLocal])

  // ---- Filters / sort ----
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')

  // ---- Pagination state ----
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(6)

  const handleSearchChange = (val) => {
    setSearch(val)
    setCurrentPage(1)
  }

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat)
    setCurrentPage(1)
  }

  const handleSortChange = ({ key, order }) => {
    setSortKey(key)
    setSortOrder(order)
    setCurrentPage(1)
  }

  const handleItemsPerPageChange = (newSize) => {
    setItemsPerPage(newSize)
    setCurrentPage(1)
  }

  const [archiveTrigger, setArchiveTrigger] = useState(0)

  useEffect(() => {
    const handleArchiveEvent = () => setArchiveTrigger((prev) => prev + 1)
    window.addEventListener('archive_changed', handleArchiveEvent)
    return () => window.removeEventListener('archive_changed', handleArchiveEvent)
  }, [])

  const handleArchive = (gun) => {
    archiveService.archiveGun(gun)
    showToast(`"${gun.name}" moved to Archive. View in Profile.`)
  }

  const categories = useMemo(() => extractCategories(rawGuns), [rawGuns])

  // Filtered & sorted array (excludes archived items)
  const filteredGuns = useMemo(() => {
    // Reference archiveTrigger so reactivity triggers upon archive/restore
    if (archiveTrigger < 0) return []
    let result = rawGuns.filter(
      (g) => !archiveService.isArchived(g.id || g.name) &&
             matchesSearch(g, search) &&
             matchesCategory(g, activeCategory),
    )
    return sortItems(result, sortKey, sortOrder)
  }, [rawGuns, search, activeCategory, sortKey, sortOrder, archiveTrigger])

  // Calculate pagination slices
  const totalPages = Math.max(1, Math.ceil(filteredGuns.length / itemsPerPage))
  const paginatedGuns = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredGuns.slice(start, start + itemsPerPage)
  }, [filteredGuns, currentPage, itemsPerPage])

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    const stockEl = document.querySelector('.stock')
    if (stockEl) {
      stockEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // ---- Detail view state (fallback when onNavigate is not used) ----
  const [selectedGun, setSelectedGun] = useState(null)

  // ---- Delete flow ----
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      setDeleteError('')
      await gunService.deleteGun(deleteTarget.id)
      setDeleteTarget(null)
      refetch({ force: true })
      showToast(`Item "${deleteTarget.name}" deleted.`)
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete.')
    } finally {
      setDeleting(false)
    }
  }

  // ---- Detail view fallback ----
  if (selectedGun) {
    return (
      <GunDetail
        gun={selectedGun}
        onBack={() => setSelectedGun(null)}
        onEdit={(g) => onNavigate ? onNavigate('Edit', g) : null}
        onDelete={(g) => { setSelectedGun(null); setDeleteTarget(g) }}
        onArchive={(g) => { setSelectedGun(null); handleArchive(g) }}
      />
    )
  }

  return (
    <>
      <section className="masthead">
        <h1 className="display">Hardware, by the spec sheet.</h1>
        <p className="lede">
          A small armory of pistols, rifles, and shotguns. Every piece listed
          with its type, caliber, and price — nothing else.
        </p>

        {/* Query Cache & PWA Status bar */}
        <div className="status-toolbar">
          {isFromCache ? (
            <div className="badge-cache" title="Data fetched instantaneously from memory cache without network request">
              <Zap size={14} className="badge-cache__icon" />
              <span>Served from Query Cache (Instant)</span>
              <button
                type="button"
                className="btn-cache-purge"
                onClick={() => refetch({ force: true })}
                title="Bypass cache and force reload from API"
              >
                Force Reload
              </button>
            </div>
          ) : (
            <div className="badge-cache badge-cache--network" title="Data fetched fresh from network API">
              <RefreshCw size={12} className={loading ? 'spin' : ''} />
              <span>Network Sync Active</span>
              <button
                type="button"
                className="btn-cache-purge"
                onClick={() => {
                  queryCache.clear()
                  refetch({ force: true })
                  showToast('Cache cleared & reloaded')
                }}
              >
                Clear Cache
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="toast toast--floating toast--success" role="alert">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      <section>
        <div className="list-head">
          <h2>Current stock</h2>
          <div className="list-head-right">
            <span className="count">
              {filteredGuns.length} piece{filteredGuns.length !== 1 ? 's' : ''}
            </span>
            {onNavigate && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => onNavigate('Create')}
              >
                <Plus size={16} /> Add
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <AdvancedFilter
          search={search}
          onSearch={handleSearchChange}
          categories={categories}
          activeCategory={activeCategory}
          onCategory={handleCategoryChange}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSortChange}
        />

        {/* States */}
        {loading && !isFromCache && (
          <div className="state-box">
            <Loader size={28} className="spin" />
            <p>Loading products…</p>
          </div>
        )}

        {!loading && error && !useLocal && apiGuns.length === 0 && (
          <div className="state-box state-box--error">
            <AlertCircle size={28} />
            <p>{error}</p>
            <div className="state-box__actions">
              <button type="button" className="btn btn--outline" onClick={() => refetch({ force: true })}>
                <RefreshCw size={16} /> Retry
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setUseLocal(true)}
              >
                View Local Catalog
              </button>
            </div>
          </div>
        )}

        {!loading && filteredGuns.length === 0 && !error && (
          <div className="state-box">
            <PackageOpen size={28} />
            <p>No products match your search.</p>
          </div>
        )}

        {/* Product grid (Paginated) */}
        {paginatedGuns.length > 0 && (
          <ul className="stock">
            {paginatedGuns.map((gun) => (
              <GunCard
                key={gun.id || gun.name}
                gun={gun}
                onSelect={(g) => onNavigate ? onNavigate('Detail', g) : setSelectedGun(g)}
                onEdit={onNavigate ? (g) => onNavigate('Edit', g) : undefined}
                onDelete={setDeleteTarget}
                onArchive={handleArchive}
                onNotify={showToast}
              />
            ))}
          </ul>
        )}

        {/* Pagination Controls */}
        {filteredGuns.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredGuns.length}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}

        {useLocal && (
          <p className="local-notice">
            Showing local catalog (server unavailable).{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => { setUseLocal(false); refetch({ force: true }) }}
            >
              Retry server
            </button>
          </p>
        )}
      </section>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError('') }}
      />
      {deleteError && (
        <div className="toast toast--error">{deleteError}</div>
      )}
    </>
  )
}
