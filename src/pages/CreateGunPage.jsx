import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Loader,
  Save,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import gunService from '../services/gunService'
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  hasDraft,
  getDraftTimestamp,
  formatDraftTime,
} from '../utils/draftStorage'
import ConfirmModal from '../components/modals/ConfirmModal'

function compressImageFile(file, maxWidth = 800, quality = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => resolve(e.target.result)
      img.src = e.target.result
    }
    reader.onerror = () => resolve('/guns/pistol.svg')
    reader.readAsDataURL(file)
  })
}

/**
 * CreateGunPage — Create a new weapon / hardware item with image upload,
 * draft persistence (auto-save), specs, and assembly steps.
 */
export default function CreateGunPage({ onBack, onSuccess }) {
  // Step state: 'upload' (upload or choose image) or 'form' (enter details)
  const [currentStep, setCurrentStep] = useState('upload')

  const [formData, setFormData] = useState({
    name: '',
    type: 'Pistol',
    caliber: '9mm',
    category: 'makanan', // API validation expects 'makanan' or 'minuman'
    difficulty: 'mudah',  // 'mudah' (Standard) | 'sedang' (Service) | 'sulit' (Match)
    price: 599,
    description: '',
    servings: 1,
    is_featured: false,
  })

  // Multi-image upload state
  const [uploadedImages, setUploadedImages] = useState([])

  // Specifications (ingredients in API)
  const [specs, setSpecs] = useState([
    { name: 'Frame', quantity: 'Polymer' },
    { name: 'Action', quantity: 'Striker-Fired' },
    { name: 'Capacity', quantity: '17 rounds' },
  ])

  // Maintenance / Assembly Steps (steps in API)
  const [steps, setSteps] = useState([
    'Verify firearm is completely unloaded and point in safe direction.',
    'Disassemble slide assembly from receiver frame for routine maintenance.',
  ])

  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Draft management
  const [showDraftModal, setShowDraftModal] = useState(() => hasDraft('create'))
  const [draftTimestamp, setDraftTimestamp] = useState(() => getDraftTimestamp('create'))

  const handleSaveDraft = useCallback((notify = true) => {
    const draftData = {
      formData,
      specs,
      steps,
      uploadedImages,
    }
    const saved = saveDraft(draftData, 'create')
    if (saved) {
      const ts = getDraftTimestamp('create')
      setDraftTimestamp(ts)
      if (notify) {
        setSuccessMsg(`Draft saved (${formatDraftTime(ts)})`)
        setTimeout(() => setSuccessMsg(''), 3000)
      }
    }
  }, [formData, specs, steps, uploadedImages])

  // Auto-save draft every 30 seconds while in form step
  useEffect(() => {
    if (currentStep !== 'form') return

    const interval = setInterval(() => {
      handleSaveDraft(false)
    }, 30000)

    return () => clearInterval(interval)
  }, [handleSaveDraft, currentStep])

  const handleLoadDraft = () => {
    const draft = loadDraft('create')
    if (draft) {
      if (draft.formData) setFormData(draft.formData)
      if (draft.specs) setSpecs(draft.specs)
      if (draft.steps) setSteps(draft.steps)
      if (draft.uploadedImages && Array.isArray(draft.uploadedImages)) {
        setUploadedImages(draft.uploadedImages)
        if (draft.uploadedImages.length > 0) setCurrentStep('form')
      } else if (draft.uploadedImageUrl) {
        setUploadedImages([draft.uploadedImageUrl])
        setCurrentStep('form')
      }
      setShowDraftModal(false)
      setSuccessMsg('Draft successfully loaded.')
      setTimeout(() => setSuccessMsg(''), 4000)
    }
  }

  const handleDiscardDraft = () => {
    deleteDraft('create')
    setShowDraftModal(false)
    setDraftTimestamp(null)
  }

  // Handle multi-image file selection with client-side compression
  const handleImagesChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setError('')

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) {
        setError('One or more files exceed the 8MB limit.')
        continue
      }
      if (!allowed.includes(file.type)) {
        setError('Allowed formats: .jpg, .jpeg, .png, .webp')
        continue
      }

      try {
        const compressed = await compressImageFile(file, 800, 0.75)
        setUploadedImages((prev) => [...prev, compressed])
      } catch {
        setError('Failed to process image file.')
      }
    }
  }

  // Add stock preset vector to images
  const handleAddPreset = (url) => {
    setUploadedImages((prev) => [...prev, url])
    setError('')
  }

  const handleRemoveImage = (index) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSetCover = (index) => {
    setUploadedImages((prev) => {
      const selected = prev[index]
      const rest = prev.filter((_, i) => i !== index)
      return [selected, ...rest]
    })
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  // Specs handlers
  const handleSpecChange = (index, field, value) => {
    setSpecs((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const addSpec = () => {
    setSpecs((prev) => [...prev, { name: '', quantity: '' }])
  }

  const removeSpec = (index) => {
    if (specs.length <= 1) return
    setSpecs((prev) => prev.filter((_, i) => i !== index))
  }

  // Steps handlers
  const handleStepChange = (index, value) => {
    setSteps((prev) => {
      const copy = [...prev]
      copy[index] = value
      return copy
    })
  }

  const addStep = () => {
    setSteps((prev) => [...prev, ''])
  }

  const removeStep = (index) => {
    if (steps.length <= 1) return
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  // Submit create product
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim() || formData.name.trim().length < 3) {
      setError('Product name must be at least 3 characters.')
      return
    }

    const cleanSpecs = specs
      .filter((s) => s.name.trim())
      .map((s) => ({
        name: s.name.trim(),
        quantity: s.quantity.trim() || 'Standard',
      }))

    if (cleanSpecs.length === 0) {
      setError('Please provide at least one specification.')
      return
    }

    const cleanSteps = steps
      .filter((s) => s.trim())
      .map((s) => s.trim())

    if (cleanSteps.length === 0) {
      setError('Please provide at least one maintenance / assembly step.')
      return
    }

    // Prepare payload compliant with backend /api/v1/recipes schema
    const primaryImg = uploadedImages[0] || '/guns/pistol.svg'
    const payload = {
      name: formData.name.trim(),
      category: formData.category || 'makanan',
      description: formData.description.trim() || `${formData.type} caliber ${formData.caliber}.`,
      image_url: primaryImg,
      images: uploadedImages.length > 0 ? uploadedImages : [primaryImg],
      prep_time: 15,
      cook_time: Number(formData.price) || 500, // Price stored in cook_time
      servings: Number(formData.servings) || 1,
      difficulty: formData.difficulty || 'mudah',
      is_featured: Boolean(formData.is_featured),
      ingredients: cleanSpecs,
      steps: cleanSteps,
    }

    try {
      setCreating(true)
      const response = await gunService.createGun(payload)
      if (response.success || response.data) {
        deleteDraft('create')
        if (onSuccess) {
          onSuccess(response.data)
        } else if (onBack) {
          onBack()
        }
      } else {
        throw new Error(response.message || 'Failed to create product.')
      }
    } catch (err) {
      setError(err.message || 'Error occurred while saving product to server.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="form-page">
      {/* Header */}
      <div className="form-head">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Catalog
        </button>
        <div className="form-head-actions">
          {currentStep === 'form' && (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => handleSaveDraft(true)}
              title="Save draft"
            >
              <Save size={14} /> Save Draft
            </button>
          )}
        </div>
      </div>

      <div className="form-title-group">
        <h1 className="display">Register New Hardware</h1>
        <p className="lede">
          Add a firearm or accessory to the catalog. Data will be synchronized with the
          university RESTful backend.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="toast toast--error">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {successMsg && (
        <div className="toast toast--success">
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      {/* Step Indicators */}
      <div className="form-steps-nav">
        <div className={`step-badge ${currentStep === 'upload' ? 'step-badge--active' : 'step-badge--done'}`}>
          1. Imagery
        </div>
        <div className="step-badge-connector" />
        <div className={`step-badge ${currentStep === 'form' ? 'step-badge--active' : ''}`}>
          2. Specifications &amp; Details
        </div>
      </div>

      {/* STEP 1: Upload Image */}
      {currentStep === 'upload' && (
        <div className="card-box">
          <h2 className="card-box-title">Weapon Imagery (Multi-Image)</h2>
          <p className="card-box-desc">
            Upload one or more photographs or blueprints (max 5MB each), or select armory stock presets.
          </p>

          <div className="upload-dropzone">
            <input
              id="gun-images-input"
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImagesChange}
              className="hidden-file-input"
            />
            <label htmlFor="gun-images-input" className="upload-label">
              <Upload size={36} className="upload-icon" />
              <span className="upload-main-text">Click to choose image files (multiple allowed)</span>
              <span className="upload-sub-text">JPG, PNG, or WebP up to 5MB each</span>
            </label>

            <div className="preset-selector">
              <span className="preset-title">Or add stock presets:</span>
              <div className="preset-pills">
                <button
                  type="button"
                  className="pill"
                  onClick={() => handleAddPreset('/guns/pistol.svg')}
                >
                  + Pistol Vector
                </button>
                <button
                  type="button"
                  className="pill"
                  onClick={() => handleAddPreset('/guns/rifle.svg')}
                >
                  + Rifle Vector
                </button>
                <button
                  type="button"
                  className="pill"
                  onClick={() => handleAddPreset('/guns/shotgun.svg')}
                >
                  + Shotgun Vector
                </button>
              </div>
            </div>
          </div>

          {/* Uploaded images gallery */}
          {uploadedImages.length > 0 && (
            <div className="multi-preview-section">
              <h3 className="section-title">Selected Imagery ({uploadedImages.length})</h3>
              <div className="multi-preview-grid">
                {uploadedImages.map((url, idx) => (
                  <div key={idx} className={`multi-preview-card ${idx === 0 ? 'multi-preview-card--cover' : ''}`}>
                    <img src={url} alt={`Preview ${idx + 1}`} className="multi-preview-img" />
                    <div className="multi-preview-actions">
                      {idx === 0 ? (
                        <span className="badge-cover">Primary Cover</span>
                      ) : (
                        <button
                          type="button"
                          className="btn-set-cover"
                          onClick={() => handleSetCover(idx)}
                          title="Set as primary cover image"
                        >
                          Set Cover
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-remove-img"
                        onClick={() => handleRemoveImage(idx)}
                        title="Remove image"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="preview-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setCurrentStep('form')}
                >
                  Continue with {uploadedImages.length} Image{uploadedImages.length > 1 ? 's' : ''} &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Product Form */}
      {currentStep === 'form' && (
        <form onSubmit={handleSubmit} className="entry-form">
          {/* Active Image Thumbnail Bar */}
          <div className="selected-thumb-bar">
            <div className="thumb-group" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {uploadedImages.slice(0, 4).map((u, i) => (
                <img key={i} src={u} alt={`Assigned ${i + 1}`} className="thumb-small" />
              ))}
            </div>
            <div className="thumb-info">
              <span className="thumb-title">
                {uploadedImages.length > 0 ? `${uploadedImages.length} Images Assigned` : 'Default Asset Assigned'}
              </span>
              <span className="thumb-sub">{uploadedImages.length > 0 ? 'Cover set & ready' : 'Vector Preset'}</span>
            </div>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setCurrentStep('upload')}
            >
              Manage Images
            </button>
          </div>

          {/* Core Info */}
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Model Designation <span className="req">*</span>
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="e.g. Glock 19 Gen 5, Colt M4A1..."
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="type" className="form-label">
                Platform / Category <span className="req">*</span>
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={(e) => {
                  handleFormChange(e)
                  // Map category for backend schema
                  setFormData((prev) => ({
                    ...prev,
                    category: e.target.value === 'Pistol' ? 'makanan' : 'minuman',
                  }))
                }}
                className="form-select"
              >
                <option value="Pistol">Pistol (Sidearm)</option>
                <option value="Rifle">Rifle (Long Gun)</option>
                <option value="Shotgun">Shotgun (Smoothbore)</option>
                <option value="Submachine Gun">Submachine Gun</option>
              </select>
            </div>
          </div>

          <div className="form-grid form-grid--3">
            <div className="form-group">
              <label htmlFor="caliber" className="form-label">
                Caliber / Chambering <span className="req">*</span>
              </label>
              <input
                id="caliber"
                type="text"
                name="caliber"
                value={formData.caliber}
                onChange={handleFormChange}
                placeholder="e.g. 9mm, 5.56mm, 12 Gauge"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="price" className="form-label">
                Price (USD) <span className="req">*</span>
              </label>
              <input
                id="price"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleFormChange}
                placeholder="599"
                min="0"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="difficulty" className="form-label">
                Grade / Build Quality <span className="req">*</span>
              </label>
              <select
                id="difficulty"
                name="difficulty"
                value={formData.difficulty}
                onChange={handleFormChange}
                className="form-select"
              >
                <option value="mudah">Commercial / Standard</option>
                <option value="sedang">Mil-Spec / Service Issue</option>
                <option value="sulit">Match Grade / Custom</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Armory Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              placeholder="Operational background, ergonomics, intended mission profile..."
              rows={3}
              className="form-textarea"
            />
          </div>

          {/* Specifications (Ingredients) */}
          <div className="form-fieldset">
            <div className="fieldset-header">
              <label className="form-label">Specifications &amp; Components</label>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={addSpec}
              >
                <Plus size={14} /> Add Spec
              </button>
            </div>
            <div className="multi-rows">
              {specs.map((spec, i) => (
                <div key={i} className="multi-row">
                  <input
                    type="text"
                    placeholder="Attribute (e.g. Barrel Length, Action)"
                    value={spec.name}
                    onChange={(e) => handleSpecChange(i, 'name', e.target.value)}
                    className="form-input"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 16 inch, Striker-fired)"
                    value={spec.quantity}
                    onChange={(e) => handleSpecChange(i, 'quantity', e.target.value)}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="btn btn--danger-ghost"
                    onClick={() => removeSpec(i)}
                    disabled={specs.length <= 1}
                    title="Remove item"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Assembly / Maintenance Steps */}
          <div className="form-fieldset">
            <div className="fieldset-header">
              <label className="form-label">Assembly &amp; Maintenance Protocol</label>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={addStep}
              >
                <Plus size={14} /> Add Step
              </button>
            </div>
            <div className="multi-rows">
              {steps.map((st, i) => (
                <div key={i} className="step-row">
                  <span className="step-num">{i + 1}</span>
                  <input
                    type="text"
                    placeholder="e.g. Clear the chamber and lock slide back..."
                    value={st}
                    onChange={(e) => handleStepChange(i, e.target.value)}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="btn btn--danger-ghost"
                    onClick={() => removeStep(i)}
                    disabled={steps.length <= 1}
                    title="Remove step"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Featured checkbox */}
          <div className="checkbox-row">
            <input
              id="is_featured"
              type="checkbox"
              name="is_featured"
              checked={formData.is_featured}
              onChange={handleFormChange}
              className="form-checkbox"
            />
            <label htmlFor="is_featured" className="checkbox-label">
              Feature in Armory Showcase (Highlight product on catalog)
            </label>
          </div>

          {/* Submit bar */}
          <div className="form-actions-bar">
            <button
              type="button"
              className="btn btn--outline"
              onClick={onBack}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader size={18} className="spin" /> Registering Hardware…
                </>
              ) : (
                'Commit to Armory'
              )}
            </button>
          </div>
        </form>
      )}

      {/* Restore Draft Modal */}
      <ConfirmModal
        open={showDraftModal}
        title="Resume Previous Draft?"
        message={`An unfinished draft from ${draftTimestamp ? formatDraftTime(draftTimestamp) : 'earlier'} was detected. Would you like to resume editing?`}
        confirmLabel="Load Draft"
        cancelLabel="Discard"
        onConfirm={handleLoadDraft}
        onCancel={handleDiscardDraft}
      />
    </div>
  )
}
