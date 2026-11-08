// ---------------------------------------------------------------------------
// archiveService.js — Soft Delete / Archive Management.
// Allows catalog items to be soft-deleted (archived), restored to the catalog,
// or permanently destroyed.
// ---------------------------------------------------------------------------

const ARCHIVE_KEY = 'bore_barrel_archived_guns'

class ArchiveService {
  getArchivedGuns() {
    try {
      const data = localStorage.getItem(ARCHIVE_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  isArchived(gunId) {
    if (!gunId) return false
    const list = this.getArchivedGuns()
    return list.some((item) => String(item.id) === String(gunId) || item.name === gunId)
  }

  archiveGun(gun) {
    if (!gun) return false
    try {
      const list = this.getArchivedGuns()
      const identifier = gun.id || gun.name
      // If already in archive, do nothing
      if (list.some((i) => (i.id && i.id === identifier) || i.name === gun.name)) {
        return true
      }

      const archivedItem = {
        ...gun,
        id: gun.id || `archived-${Date.now()}`,
        archivedAt: new Date().toISOString(),
      }

      list.unshift(archivedItem)
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list))
      window.dispatchEvent(new CustomEvent('archive_changed', { detail: { action: 'archive', item: archivedItem } }))
      return true
    } catch {
      return false
    }
  }

  restoreGun(gunId) {
    if (!gunId) return null
    try {
      const list = this.getArchivedGuns()
      const target = list.find((i) => String(i.id) === String(gunId) || i.name === gunId)
      if (!target) return null

      const updated = list.filter((i) => String(i.id) !== String(gunId) && i.name !== gunId)
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent('archive_changed', { detail: { action: 'restore', item: target } }))
      return target
    } catch {
      return null
    }
  }

  deletePermanently(gunId) {
    if (!gunId) return false
    try {
      const list = this.getArchivedGuns()
      const updated = list.filter((i) => String(i.id) !== String(gunId) && i.name !== gunId)
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent('archive_changed', { detail: { action: 'delete', gunId } }))
      return true
    } catch {
      return false
    }
  }

  getArchiveCount() {
    return this.getArchivedGuns().length
  }
}

export const archiveService = new ArchiveService()
export default archiveService

