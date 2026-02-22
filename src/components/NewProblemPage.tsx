import { useState, useRef } from 'react'
import { extractQuestionsFromSheet, type SheetQuestion } from '../lib/claude'
import { pdfAllPagesToBase64 } from '../lib/pdfToImage'
import { cropImageByRegion } from '../lib/cropImage'

type Mode = 'single' | 'sheet'

interface Props {
  onBack: () => void
  onContinue: (problem: string, problemImage?: string) => void
  onContinueSheet: (questions: { problem: string; problemImage?: string }[], sheetImageBase64?: string, sheetTitle?: string) => void
}

export function NewProblemPage({ onBack, onContinue, onContinueSheet }: Props) {
  const [mode, setMode] = useState<Mode>('single')
  const [problem, setProblem] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [isPdf, setIsPdf] = useState(false)
  const [pdfConverting, setPdfConverting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sheetFileInputRef = useRef<HTMLInputElement>(null)

  // Sheet mode state
  const [sheetTitle, setSheetTitle] = useState('')
  const [sheetDrag, setSheetDrag] = useState(false)
  const [sheetPageCount, setSheetPageCount] = useState(0)
  const [extractedQuestions, setExtractedQuestions] = useState<SheetQuestion[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [isOpeningSheet, setIsOpeningSheet] = useState(false)
  const [isOpeningSingle, setIsOpeningSingle] = useState(false)

  const canContinueSingle = problem.trim().length >= 5 || imageBase64 !== null
  const canContinueSheet = extractedQuestions.length > 0

  function processImageFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setImagePreview(dataUrl)
      setImageBase64(dataUrl.split(',')[1])
      setIsPdf(false)
      if (mode === 'single' && !problem.trim()) setProblem('Problem shown in image above')
      if (mode === 'sheet') {
        setExtractedQuestions([])
        setExtractError(null)
      }
    }
    reader.readAsDataURL(file)
  }

  async function processPdfFile(file: File) {
    setPdfConverting(true)
    setExtractError(null)
    try {
      const { base64, pageCount } = await pdfAllPagesToBase64(file)
      setImageBase64(base64)
      setImagePreview(`data:image/jpeg;base64,${base64}`)
      setIsPdf(true)
      setSheetPageCount(pageCount)
      if (mode === 'sheet') setExtractedQuestions([])
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Failed to read PDF')
      setImageBase64(null)
      setImagePreview(null)
      setSheetPageCount(0)
    } finally {
      setPdfConverting(false)
    }
  }

  function processFile(file: File) {
    if (file.type.startsWith('image/')) {
      processImageFile(file)
      return
    }
    if (file.type === 'application/pdf') {
      if (mode === 'sheet') processPdfFile(file)
      return
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  function handleSheetFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type.startsWith('image/')) processImageFile(file)
    else if (file.type === 'application/pdf') processPdfFile(file)
    e.target.value = ''
  }

  function clearAttachment() {
    setImagePreview(null)
    setImageBase64(null)
    setIsPdf(false)
    setSheetPageCount(0)
    if (mode === 'sheet') setExtractedQuestions([])
  }

  function handleContinue() {
    if (!canContinueSingle || isOpeningSingle) return
    setIsOpeningSingle(true)
    onContinue(problem.trim() || 'Problem shown in image', imageBase64 ?? undefined)
  }

  async function handleExtractQuestions() {
    if (!imageBase64) return
    setIsExtracting(true)
    setExtractError(null)
    try {
      const questions = await extractQuestionsFromSheet(imageBase64)
      setExtractedQuestions(questions)
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Failed to extract questions')
      setExtractedQuestions([])
    } finally {
      setIsExtracting(false)
    }
  }

  async function handleSheetContinue() {
    if (!canContinueSheet || !imageBase64 || isOpeningSheet) return
    setIsOpeningSheet(true)
    try {
      const questionsWithImages: { problem: string; problemImage?: string }[] = []
      for (const q of extractedQuestions) {
        if (q.region) {
          try {
            const cropped = await cropImageByRegion(imageBase64, q.region)
            questionsWithImages.push({ problem: q.problem, problemImage: cropped })
          } catch {
            questionsWithImages.push({ problem: q.problem })
          }
        } else {
          questionsWithImages.push({ problem: q.problem })
        }
      }
      onContinueSheet(questionsWithImages, imageBase64, sheetTitle.trim() || undefined)
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Failed to open')
      setIsOpeningSheet(false)
    }
  }

  function setQuestionAt(index: number, value: string) {
    setExtractedQuestions((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], problem: value }
      return next
    })
  }

  function handlePaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    if (item) {
      const file = item.getAsFile()
      if (file) processImageFile(file)
    }
  }

  const singleAccept = 'image/*'
  const sheetAccept = 'image/*,application/pdf'

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
            {mode === 'single'
              ? 'Type your problem or attach an image. The AI will watch your work and give live feedback.'
              : 'Upload a problem sheet (image or PDF) to get a separate whiteboard for each question.'}
          </p>

          {/* Mode toggle */}
          <div className="new-problem-page__mode">
            <button
              type="button"
              className={`new-problem-page__mode-btn ${mode === 'single' ? 'new-problem-page__mode-btn--active' : ''}`}
              onClick={() => setMode('single')}
            >
              One problem
            </button>
            <button
              type="button"
              className={`new-problem-page__mode-btn ${mode === 'sheet' ? 'new-problem-page__mode-btn--active' : ''}`}
              onClick={() => setMode('sheet')}
            >
              Problem sheet
            </button>
          </div>

          {mode === 'single' && (
            <div className="form-group new-problem-page__single-block">
              <label className="form-label" htmlFor="problem-input">
                Problem description
              </label>
              <div className="problem-input-wrap">
                <textarea
                  id="problem-input"
                  className="form-textarea problem-input-wrap__textarea"
                  placeholder="e.g. Solve the quadratic equation: 2x² + 5x − 3 = 0"
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  onPaste={handlePaste}
                  rows={4}
                />
                <div className="problem-input-wrap__actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={singleAccept}
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                  {imagePreview ? (
                    <div className="problem-input-wrap__preview">
                      <img src={imagePreview} alt="Attached" className="problem-input-wrap__preview-img" />
                      <button
                        type="button"
                        className="problem-input-wrap__preview-remove"
                        onClick={clearAttachment}
                        title="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="problem-input-wrap__attach"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach image"
                    >
                      📎
                    </button>
                  )}
                </div>
              </div>
              <p className="form-hint">Paste an image into the box or use the attach button.</p>
              <button
                className={`btn btn--primary btn--lg btn--full new-problem-page__cta ${isOpeningSingle ? 'btn--loading' : ''}`}
                disabled={!canContinueSingle || isOpeningSingle}
                onClick={handleContinue}
              >
                {isOpeningSingle ? (
                  <>
                    <span className="btn__spinner" aria-hidden />
                    Opening…
                  </>
                ) : (
                  <>
                    Open Whiteboard
                    <span className="btn__arrow">→</span>
                  </>
                )}
              </button>
            </div>
          )}

          {mode === 'sheet' && (
            <div className="new-problem-page__sheet-block">
              <div className="form-group">
                <label className="form-label">Problem sheet</label>
                <input
                  ref={sheetFileInputRef}
                  type="file"
                  accept={sheetAccept}
                  className="sr-only"
                  onChange={handleSheetFileChange}
                />
                <div
                  className={`sheet-dropzone ${imageBase64 ? 'sheet-dropzone--has-file' : ''} ${sheetDrag ? 'sheet-dropzone--active' : ''}`}
                  onDrop={(e) => {
                    e.preventDefault()
                    setSheetDrag(false)
                    const file = e.dataTransfer.files[0]
                    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
                      if (file.type === 'application/pdf') processPdfFile(file)
                      else processImageFile(file)
                    }
                  }}
                  onDragOver={(e) => { e.preventDefault(); setSheetDrag(true) }}
                  onDragLeave={() => setSheetDrag(false)}
                  onClick={() => !pdfConverting && sheetFileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Sheet preview" className="sheet-dropzone__preview" />
                      <div className="sheet-dropzone__overlay">
                        <span className="sheet-dropzone__badge">{isPdf ? `PDF (${sheetPageCount} page${sheetPageCount !== 1 ? 's' : ''})` : 'Image'}</span>
                        <button
                          type="button"
                          className="sheet-dropzone__replace"
                          onClick={(e) => { e.stopPropagation(); sheetFileInputRef.current?.click() }}
                          disabled={pdfConverting}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          className="sheet-dropzone__remove"
                          onClick={(e) => { e.stopPropagation(); clearAttachment() }}
                        >
                          ✕ Remove
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="sheet-dropzone__placeholder">
                      <span className="sheet-dropzone__icon">📄</span>
                      <p className="sheet-dropzone__text">
                        <strong>Drop image or PDF here</strong> or click to browse
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {extractError && (
                <p className="form-hint form-hint--error" role="alert">
                  {extractError}
                </p>
              )}

              {imageBase64 && (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="sheet-title">
                      Sheet title (optional)
                    </label>
                    <input
                      id="sheet-title"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Week 3 homework"
                      value={sheetTitle}
                      onChange={(e) => setSheetTitle(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className={`btn btn--secondary btn--full ${isExtracting ? 'btn--loading' : ''}`}
                    disabled={isExtracting}
                    onClick={handleExtractQuestions}
                  >
                    {isExtracting ? (
                      <>
                        <span className="btn__spinner" aria-hidden />
                        Extracting questions…
                      </>
                    ) : (
                      'Extract questions from sheet'
                    )}
                  </button>
                </>
              )}

              {extractedQuestions.length > 0 && (
                <div className="form-group sheet-questions">
                  <label className="form-label">
                    Questions ({extractedQuestions.length}) — edit if needed
                  </label>
                  <div className="sheet-questions__list">
                    {extractedQuestions.map((q, i) => (
                      <div key={i} className="sheet-questions__item">
                        <span className="sheet-questions__num">{i + 1}.</span>
                        <input
                          type="text"
                          className="form-input sheet-questions__input"
                          value={q.problem}
                          onChange={(e) => setQuestionAt(i, e.target.value)}
                        />
                        {q.region && <span className="sheet-questions__diagram-badge" title="Diagram will show on whiteboard">📐</span>}
                      </div>
                    ))}
                  </div>
                  <button
                    className={`btn btn--primary btn--lg btn--full ${isOpeningSheet ? 'btn--loading' : ''}`}
                    disabled={!canContinueSheet || isOpeningSheet}
                    onClick={handleSheetContinue}
                  >
                    {isOpeningSheet ? (
                      <>
                        <span className="btn__spinner" aria-hidden />
                        Opening…
                      </>
                    ) : (
                      <>
                        Open whiteboards ({extractedQuestions.length} questions)
                        <span className="btn__arrow">→</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
