import { useState, useRef, useCallback } from 'react'

interface Props {
  onBack: () => void
  onContinue: (problem: string, problemImage?: string) => void
}

export function NewProblemPage({ onBack, onContinue }: Props) {
  const [problem, setProblem] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canContinue = problem.trim().length >= 5 || imageBase64 !== null

  function processFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setImagePreview(dataUrl)
      // Strip data: prefix for storage
      setImageBase64(dataUrl.split(',')[1])
      // Auto-fill problem field hint if empty
      if (!problem.trim()) {
        setProblem('Problem shown in image above')
      }
    }
    reader.readAsDataURL(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [problem],
  )

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleContinue() {
    if (!canContinue) return
    onContinue(problem.trim() || 'Problem shown in image', imageBase64 ?? undefined)
  }

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    if (item) {
      const file = item.getAsFile()
      if (file) processFile(file)
    }
  }

  return (
    <div className="page new-problem-page">
      <main className="new-problem-page__main">
        <div className="new-problem-page__inner">
          <button className="btn btn--ghost btn--sm new-problem-page__back" onClick={onBack}>
            ← Back
          </button>
          <h1 className="new-problem-page__title">
            What are you <em>solving today?</em>
          </h1>
          <p className="new-problem-page__sub">
            Type your problem or upload a screenshot. The AI will watch your work and give
            live feedback.
          </p>

          {/* Problem text */}
          <div className="form-group">
            <label className="form-label" htmlFor="problem-input">
              Problem description
            </label>
            <textarea
              id="problem-input"
              className="form-textarea"
              placeholder="e.g. Solve the quadratic equation: 2x² + 5x − 3 = 0"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              onPaste={handlePaste}
              rows={4}
            />
            <p className="form-hint">You can also paste an image directly into this field.</p>
          </div>

          {/* Divider */}
          <div className="divider">
            <span>or</span>
          </div>

          {/* Image upload */}
          <div className="form-group">
            <label className="form-label">Upload problem image</label>
            <div
              className={`dropzone ${isDragging ? 'dropzone--active' : ''} ${imagePreview ? 'dropzone--has-image' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Problem" className="dropzone__preview" />
                  <button
                    className="dropzone__remove"
                    onClick={(e) => {
                      e.stopPropagation()
                      setImagePreview(null)
                      setImageBase64(null)
                    }}
                  >
                    ✕ Remove
                  </button>
                </>
              ) : (
                <div className="dropzone__placeholder">
                  <span className="dropzone__icon">📎</span>
                  <p className="dropzone__text">
                    <strong>Drop an image here</strong> or click to browse
                  </p>
                  <p className="dropzone__hint">PNG, JPG, WEBP supported</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>

          {/* Continue */}
          <button
            className="btn btn--primary btn--lg btn--full"
            disabled={!canContinue}
            onClick={handleContinue}
          >
            Open Whiteboard
            <span className="btn__arrow">→</span>
          </button>
        </div>
      </main>
    </div>
  )
}
