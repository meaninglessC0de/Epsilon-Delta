import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
// @ts-expect-error Vite resolves worker with ?url
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let workerSrcSet = false
function ensureWorker() {
  if (workerSrcSet) return
  GlobalWorkerOptions.workerSrc = typeof pdfjsWorker === 'string' ? pdfjsWorker : (pdfjsWorker as { default?: string })?.default ?? ''
  workerSrcSet = true
}

const scale = 2
const jpegQuality = 0.85

/**
 * Render the first page of a PDF to a JPEG base64 string (no data: prefix).
 */
export async function pdfFirstPageToBase64(file: File): Promise<string> {
  const { base64 } = await pdfAllPagesToBase64(file, 1)
  return base64
}

/**
 * Render all pages of a PDF (or up to maxPages), stitch vertically into one image.
 * Returns base64 JPEG (no data: prefix) and the number of pages rendered.
 * Used so the AI can extract questions from the full sheet.
 */
export async function pdfAllPagesToBase64(
  file: File,
  maxPages?: number,
): Promise<{ base64: string; pageCount: number }> {
  ensureWorker()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const numPages = pdf.numPages
  const toRender = maxPages ? Math.min(maxPages, numPages) : numPages
  const pageCanvases: HTMLCanvasElement[] = []
  let totalHeight = 0
  let maxWidth = 0

  for (let i = 1; i <= toRender; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get canvas context')
    await page.render({
      canvasContext: ctx,
      viewport,
      intent: 'display',
    }).promise
    pageCanvases.push(canvas)
    totalHeight += viewport.height
    if (viewport.width > maxWidth) maxWidth = viewport.width
  }

  const stitched = document.createElement('canvas')
  stitched.width = maxWidth
  stitched.height = totalHeight
  const ctx = stitched.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')
  let y = 0
  for (const c of pageCanvases) {
    ctx.drawImage(c, 0, y, c.width, c.height)
    y += c.height
  }
  const dataUrl = stitched.toDataURL('image/jpeg', jpegQuality)
  return { base64: dataUrl.split(',')[1] ?? '', pageCount: toRender }
}
