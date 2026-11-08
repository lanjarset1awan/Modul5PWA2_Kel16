import { useState, useEffect } from 'react'
import {
  Shield,
  Copy,
  Check,
  Heart,
  FileText,
  Camera,
  Play,
  Edit3,
  Archive,
  RotateCcw,
  Trash2,
  ExternalLink,
  MapPin,
  Clock,
  Phone,
  Info,
  X,
  PackageOpen,
} from 'lucide-react'
import userService from '../services/userService'
import { useFavorites } from '../hooks/useFavorites'
import archiveService from '../services/archiveService'
import {
  getAllDraftIds,
  loadDraft,
  deleteDraft,
  formatDraftTime,
} from '../utils/draftStorage'
import ConfirmModal from '../components/modals/ConfirmModal'
import { formatPrice } from '../utils/helpers'

/**
 * ProfilePage — User identity, Drafts, Archived Hardware, and About & Contact.
 *
 * Implements:
 * 1. Edit Profile as a dedicated Modal/Pop-up via "Edit Profile" button.
 * 2. Drafts section with resume and discard actions.
 * 3. Soft Delete / Archived Hardware section with Restore & Permanent Delete.
 * 4. Embedded About & Contact sections (moved from standalone navbar).
 */
export default function ProfilePage({ onReplaySplash, onNavigate }) {
  // ---- Profile state ----
  const [profile, setProfile] = useState(() => userService.getUserProfile())
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState('')

  // Edit Profile Modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editUsername, setEditUsername] = useState(profile.username || 'Shooter')
  const [editBio, setEditBio] = useState(profile.bio || '')
  const [editAvatar, setEditAvatar] = useState(profile.avatar || null)

  // Favorites
  const { favorites } = useFavorites()

  // ---- Drafts state ----
  const getInitialDrafts = () => {
    try {
      const ids = getAllDraftIds()
      return ids.map((id) => {
        const data = loadDraft(id)
        return {
          id,
          name: data?.name || data?.formData?.name || 'Untitled Hardware Item',
          type: data?.type || data?.formData?.type || 'Draft',
          image: data?.uploadedImageUrl || (Array.isArray(data?.uploadedImages) && data.uploadedImages[0]) || data?.image_url || '/guns/pistol.svg',
          savedAt: data?.savedAt,
          raw: data,
        }
      })
    } catch {
      return []
    }
  }

  const [drafts, setDrafts] = useState(getInitialDrafts)

  const loadDraftsList = () => {
    setDrafts(getInitialDrafts())
  }

  // ---- Archive state ----
  const [archivedGuns, setArchivedGuns] = useState(() => archiveService.getArchivedGuns())
  const [deletePermanentTarget, setDeletePermanentTarget] = useState(null)

  const reloadArchive = () => {
    setArchivedGuns(archiveService.getArchivedGuns())
  }

  useEffect(() => {
    const handleArchiveChanged = () => {
      reloadArchive()
    }
    window.addEventListener('archive_changed', handleArchiveChanged)
    return () => window.removeEventListener('archive_changed', handleArchiveChanged)
  }, [])

  const notify = (msg) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleCopyId = () => {
    if (profile.userId) {
      navigator.clipboard.writeText(profile.userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // ---- Edit Profile Handlers ----
  const handleOpenEditModal = () => {
    setEditUsername(profile.username || 'Shooter')
    setEditBio(profile.bio || '')
    setEditAvatar(profile.avatar || null)
    setShowEditModal(true)
  }

  const handleAvatarFile = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      notify('Avatar file must be under 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setEditAvatar(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfileModal = (e) => {
    e.preventDefault()
    const updated = {
      ...profile,
      username: editUsername.trim() || 'Shooter',
      bio: editBio.trim(),
      avatar: editAvatar,
    }
    const result = userService.saveUserProfile(updated)
    if (result.success) {
      setProfile(result.data)
      setShowEditModal(false)
      notify('Operator profile updated.')
    }
  }

  // ---- Draft Handlers ----
  const handleDeleteDraft = (draftId) => {
    deleteDraft(draftId)
    loadDraftsList()
    notify('Draft discarded.')
  }

  const handleResumeDraft = () => {
    if (onNavigate) {
      onNavigate('Create')
    }
  }

  // ---- Archive Handlers ----
  const handleRestore = (gunId) => {
    const restored = archiveService.restoreGun(gunId)
    if (restored) {
      reloadArchive()
      notify(`"${restored.name}" restored to catalog stock.`)
    }
  }

  const handleConfirmPermanentDelete = () => {
    if (!deletePermanentTarget) return
    archiveService.deletePermanently(deletePermanentTarget.id)
    setDeletePermanentTarget(null)
    reloadArchive()
    notify(`"${deletePermanentTarget.name}" deleted permanently.`)
  }

  return (
    <div className="profile-page">
      {/* Header */}
      <section className="masthead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="display">Operator Profile & Armory</h1>
          <p className="lede">
            Operator credentials, offline draft listings, hardware archive, and store information.
          </p>
        </div>
        {onReplaySplash && (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={onReplaySplash}
            title="Replay introductory splash animation"
          >
            <Play size={14} /> Replay Intro
          </button>
        )}
      </section>

      {feedback && (
        <div className="toast toast--floating toast--success">
          <Check size={18} /> {feedback}
        </div>
      )}

      {/* Operator Card */}
      <div className="profile-card">
        <div className="profile-card-top">
          <div className="avatar-wrap">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.username} className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">
                <Shield size={36} stroke="var(--brass)" />
              </div>
            )}
          </div>

          <div className="profile-identity">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h2 className="display">{profile.username || 'Shooter'}</h2>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={handleOpenEditModal}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              >
                <Edit3 size={13} /> Edit Profile
              </button>
            </div>

            <div className="profile-id-row">
              <span className="mono-badge">{profile.userId}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={handleCopyId}
                title="Copy User ID to clipboard"
              >
                {copied ? <Check size={14} color="var(--brass)" /> : <Copy size={14} />}
              </button>
            </div>

            {profile.bio && (
              <p className="profile-bio-text">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="profile-stats">
          <div className="stat-item">
            <Heart size={20} className="stat-icon" stroke="var(--brass)" />
            <div className="stat-val">{favorites.length}</div>
            <div className="stat-label">Favorites</div>
          </div>
          <div className="stat-item">
            <FileText size={20} className="stat-icon" stroke="var(--steel)" />
            <div className="stat-val">{drafts.length}</div>
            <div className="stat-label">Active Drafts</div>
          </div>
          <div className="stat-item">
            <Archive size={20} className="stat-icon" stroke="var(--brass)" />
            <div className="stat-val">{archivedGuns.length}</div>
            <div className="stat-label">Archived Items</div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------
       * 1. SECTION: DRAFT KATALOG
       * ------------------------------------------------------------------- */}
      <section className="profile-section">
        <div className="section-head">
          <h2 className="section-title">
            <FileText size={18} /> Offline Drafts
          </h2>
          <span className="count">{drafts.length} draft{drafts.length !== 1 ? 's' : ''}</span>
        </div>

        {drafts.length === 0 ? (
          <div className="empty-subbox">
            <PackageOpen size={24} stroke="var(--steel)" />
            <p>No unsaved drafts. When adding new hardware, drafts are saved automatically here.</p>
          </div>
        ) : (
          <ul className="profile-item-list">
            {drafts.map((d) => (
              <li key={d.id} className="profile-item-row">
                <div className="profile-item-info">
                  <img src={d.image} alt={d.name} className="profile-item-thumb" />
                  <div>
                    <h3 className="profile-item-name">{d.name}</h3>
                    <p className="profile-item-meta">
                      Type: {d.type} {d.savedAt ? `· Saved ${formatDraftTime(d.savedAt)}` : ''}
                    </p>
                  </div>
                </div>

                <div className="profile-item-actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => handleResumeDraft(d.id)}
                  >
                    <ExternalLink size={14} /> Resume Form
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={() => handleDeleteDraft(d.id)}
                    title="Discard Draft"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* -------------------------------------------------------------------
       * 2. SECTION: ARSIP KATALOG (SOFT DELETE)
       * ------------------------------------------------------------------- */}
      <section className="profile-section">
        <div className="section-head">
          <h2 className="section-title">
            <Archive size={18} /> Hardware Archive
          </h2>
          <span className="count">
            {archivedGuns.length} archived item{archivedGuns.length !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="section-desc">
          Katalog terarsip (soft delete). Senjata dapat dipulihkan kembali ke stok aktif atau dihapus secara permanen.
        </p>

        {archivedGuns.length === 0 ? (
          <div className="empty-subbox">
            <Archive size={24} stroke="var(--steel)" />
            <p>Belum ada data hardware yang diarsipkan. Gunakan tombol arsip pada kartu katalog untuk menyimpannya di sini.</p>
          </div>
        ) : (
          <ul className="profile-item-list">
            {archivedGuns.map((g) => {
              const imgSrc = (Array.isArray(g.images) && g.images[0]) || g.image_url || g.image || '/guns/pistol.svg'
              return (
                <li key={g.id || g.name} className="profile-item-row">
                  <div className="profile-item-info">
                    <img src={imgSrc} alt={g.name} className="profile-item-thumb" />
                    <div>
                      <h3 className="profile-item-name">{g.name}</h3>
                      <p className="profile-item-meta">
                        {g.type || 'Hardware'} {g.caliber ? `· ${g.caliber}` : ''} · {formatPrice(g.price || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="profile-item-actions">
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => handleRestore(g.id)}
                      title="Pulihkan senjata ke katalog"
                    >
                      <RotateCcw size={14} /> Pulihkan
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      onClick={() => setDeletePermanentTarget(g)}
                      title="Hapus permanen dari basis data"
                    >
                      <Trash2 size={14} /> Hapus Permanen
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* -------------------------------------------------------------------
       * 3. SECTION: ABOUT & CONTACT (DIPINDAHKAN DARI NAVBAR)
       * ------------------------------------------------------------------- */}
      <section className="profile-section">
        <div className="section-head">
          <h2 className="section-title">
            <Info size={18} /> About Bore &amp; Barrel
          </h2>
        </div>
        <div className="info-box">
          <h3 className="display">A one-room armory.</h3>
          <p className="lede">
            Bore &amp; Barrel sells a short, honest list of firearms. Each piece is priced
            from the bench — no markup theatre, no filler. Every specification is listed
            with precision for professional operators and enthusiasts.
          </p>
        </div>

        <div className="section-head" style={{ marginTop: '24px' }}>
          <h2 className="section-title">
            <Phone size={18} /> Store Contact &amp; Operating Hours
          </h2>
        </div>
        <div className="contact-grid">
          <div className="contact-card">
            <MapPin size={20} className="contact-icon" />
            <div>
              <strong>Armory Location</strong>
              <p>123 Range Road, Sector 7</p>
            </div>
          </div>
          <div className="contact-card">
            <Clock size={20} className="contact-icon" />
            <div>
              <strong>Operating Hours</strong>
              <p>Tuesday to Saturday, 10:00 – 18:00</p>
            </div>
          </div>
          <div className="contact-card">
            <Phone size={20} className="contact-icon" />
            <div>
              <strong>Direct Comm Line</strong>
              <p>(555) 010-0100 / dispatch@borebarrel.local</p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------
       * MODAL: EDIT PROFILE (POP-UP)
       * ------------------------------------------------------------------- */}
      {showEditModal && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal modal--edit-profile" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Operator Profile</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowEditModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfileModal} className="modal-form">
              <div className="avatar-edit-center">
                <div className="avatar-wrap">
                  {editAvatar ? (
                    <img src={editAvatar} alt="Avatar" className="avatar-img" />
                  ) : (
                    <div className="avatar-placeholder">
                      <Shield size={36} stroke="var(--brass)" />
                    </div>
                  )}
                  <label htmlFor="modal-avatar-input" className="avatar-upload-btn" title="Upload avatar">
                    <Camera size={14} />
                    <input
                      id="modal-avatar-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFile}
                      className="hidden-file-input"
                    />
                  </label>
                </div>
                <span className="avatar-hint">Click camera icon to change photo (Max 2MB)</span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-username-input">
                  Callsign / Alias
                </label>
                <input
                  id="edit-username-input"
                  type="text"
                  className="form-input"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="e.g. Master Gunsmith"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-bio-input">
                  Armorer Notes / Bio
                </label>
                <textarea
                  id="edit-bio-input"
                  className="form-textarea"
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell other operators about your specialty or assigned unit..."
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation for Permanent Delete */}
      <ConfirmModal
        open={Boolean(deletePermanentTarget)}
        title="Hapus Permanen Dari Arsip"
        message={`Apakah Anda yakin ingin menghapus "${deletePermanentTarget?.name}" secara permanen? Data ini tidak akan dapat dipulihkan kembali.`}
        confirmLabel="Hapus Permanen"
        danger
        onConfirm={handleConfirmPermanentDelete}
        onCancel={() => setDeletePermanentTarget(null)}
      />
    </div>
  )
}
