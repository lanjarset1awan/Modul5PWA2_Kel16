import { useState, useEffect, lazy, Suspense } from 'react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import PWABadge from './components/PWABadge.jsx'
import ConfirmModal from './components/modals/ConfirmModal.jsx'
import SplashScreen from './components/common/SplashScreen.jsx'
import gunService, { normalizeProduct } from './services/gunService.js'
import archiveService from './services/archiveService.js'
import GUNS_LOCAL from './data/guns.js'
import { Loader } from 'lucide-react'
import './App.css'

// ---------------------------------------------------------------------------
// Lazy Loaded Components (Code Splitting / Dynamic Import)
// Components are only downloaded on-demand when first requested,
// reducing initial bundle size and improving PWA First Contentful Paint.
// ---------------------------------------------------------------------------
const Catalog = lazy(() => import('./pages/Catalog.jsx'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const CreateGunPage = lazy(() => import('./pages/CreateGunPage.jsx'))
const EditGunPage = lazy(() => import('./pages/EditGunPage.jsx'))
const GunDetail = lazy(() => import('./components/gun/GunDetail.jsx'))

function LoadingFallback() {
  return (
    <div className="state-box" style={{ minHeight: '260px' }}>
      <Loader size={30} className="spin text-brass" />
      <p style={{ marginTop: '10px', color: 'var(--steel)' }}>Loading component…</p>
    </div>
  )
}

function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [tab, setTab] = useState('Catalog')
  const [mode, setMode] = useState('list') // 'list' | 'create' | 'edit' | 'detail'
  const [selectedGun, setSelectedGun] = useState(null)
  const [editingGun, setEditingGun] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // -------------------------------------------------------------------------
  // Deep Linking Handler: Sync URL parameter ?gun=<id> with application state
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleUrlChange = async () => {
      const params = new URLSearchParams(window.location.search)
      const gunParam = params.get('gun')

      if (gunParam) {
        // Try local dataset match first
        const localMatch = GUNS_LOCAL.find(
          (g) => (g.id && g.id === gunParam) || g.name.toLowerCase() === gunParam.toLowerCase()
        )
        if (localMatch) {
          setSelectedGun(normalizeProduct(localMatch))
          setMode('detail')
          return
        }

        // Try API lookup
        try {
          const res = await gunService.getGunById(gunParam)
          if (res?.data) {
            setSelectedGun(res.data)
            setMode('detail')
          }
        } catch {
          // If not found, remain on list
        }
      }
    }

    handleUrlChange()
    window.addEventListener('popstate', handleUrlChange)
    return () => window.removeEventListener('popstate', handleUrlChange)
  }, [])

  // Unified navigation handler
  const handleNavigate = (target, payload) => {
    if (target === 'Create') {
      setMode('create')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'Edit') {
      setEditingGun(payload)
      setMode('edit')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'Detail') {
      setSelectedGun(payload)
      setMode('detail')
      // Deep linking: update URL with ?gun=<id>
      const url = new URL(window.location.href)
      url.searchParams.set('gun', payload.id || payload.name)
      window.history.pushState({}, '', url.toString())
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // Tab change
      setTab(target)
      setMode('list')
      setSelectedGun(null)
      setEditingGun(null)
      // Clean query parameter when leaving detail
      const url = new URL(window.location.href)
      if (url.searchParams.has('gun')) {
        url.searchParams.delete('gun')
        window.history.pushState({}, '', url.pathname)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBackToList = () => {
    setMode('list')
    setSelectedGun(null)
    setEditingGun(null)
    // Clear query parameter
    const url = new URL(window.location.href)
    if (url.searchParams.has('gun')) {
      url.searchParams.delete('gun')
      window.history.pushState({}, '', url.pathname)
    }
  }

  return (
    <div className="shell">
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}

      <Header
        tab={mode === 'list' ? tab : ''}
        onTab={(newTab) => handleNavigate(newTab)}
        onNavigateCreate={() => handleNavigate('Create')}
      />

      <main className="main">
        <Suspense fallback={<LoadingFallback />}>
          {/* Sub-page views */}
          {mode === 'create' && (
            <CreateGunPage
              onBack={handleBackToList}
              onSuccess={() => {
                handleBackToList()
                setTab('Catalog')
              }}
            />
          )}

          {mode === 'edit' && (
            <EditGunPage
              gun={editingGun}
              gunId={editingGun?.id}
              onBack={handleBackToList}
              onSuccess={() => {
                handleBackToList()
                setTab('Catalog')
              }}
            />
          )}

          {mode === 'detail' && selectedGun && (
            <GunDetail
              gun={selectedGun}
              onBack={handleBackToList}
              onEdit={(g) => handleNavigate('Edit', g)}
              onDelete={(g) => setDeleteTarget(g)}
              onArchive={(g) => {
                archiveService.archiveGun(g)
                handleBackToList()
                setTab('Catalog')
              }}
            />
          )}

          {/* Top-level Tabs */}
          {mode === 'list' && (
            <>
              {tab === 'Catalog' && (
                <Catalog
                  onNavigate={(destination, payload) => handleNavigate(destination, payload)}
                />
              )}
              {tab === 'Favorites' && (
                <FavoritesPage
                  onSelectGun={(g) => handleNavigate('Detail', g)}
                  onNavigateCatalog={() => setTab('Catalog')}
                />
              )}
              {tab === 'Profile' && (
                <ProfilePage
                  onReplaySplash={() => setShowSplash(true)}
                  onNavigate={(destination, payload) => handleNavigate(destination, payload)}
                />
              )}
            </>
          )}
        </Suspense>
      </main>

      {/* Global Delete Confirmation */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Hardware Record"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            setDeleting(true)
            await gunService.deleteGun(deleteTarget.id)
            setDeleteTarget(null)
            handleBackToList()
            setTab('Catalog')
          } catch (err) {
            alert(err.message || 'Failed to delete record.')
          } finally {
            setDeleting(false)
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <PWABadge />
      <Footer />
    </div>
  )
}

export default App
