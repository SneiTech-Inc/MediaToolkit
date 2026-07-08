import { PDFDocument, rgb } from 'pdf-lib'

// ─── Types ─────────────────────────────────────────────────────────────────

export type OCRLanguage =
  | 'eng' | 'spa' | 'fra' | 'deu' | 'ita'
  | 'por' | 'rus' | 'jpn' | 'chi_sim' | 'chi_tra'

export interface OCROptions {
  language: OCRLanguage
  onProgress?: (progress: OCRProgress) => void
}

export interface OCRProgress {
  status: 'loading' | 'recognizing' | 'done'
  page: number
  totalPages: number
  percent: number // overall percentage
  detail?: string // current status text from Tesseract
}

export interface OCRResult {
  data: Uint8Array
  pages: { pageNumber: number; text: string; wordCount: number }[]
}

// ─── Language Map ──────────────────────────────────────────────────────────

export const OCR_LANGUAGES: { value: OCRLanguage; label: string }[] = [
  { value: 'eng', label: 'English' },
  { value: 'spa', label: 'Spanish' },
  { value: 'fra', label: 'French' },
  { value: 'deu', label: 'German' },
  { value: 'ita', label: 'Italian' },
  { value: 'por', label: 'Portuguese' },
  { value: 'rus', label: 'Russian' },
  { value: 'jpn', label: 'Japanese' },
  { value: 'chi_sim', label: 'Chinese (Simplified)' },
  { value: 'chi_tra', label: 'Chinese (Traditional)' },
]

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Process a scanned PDF through OCR to create a searchable PDF.
 *
 * 1. Renders each page via pdfjs-dist at 2x scale
 * 2. Runs Tesseract.js OCR with word-level bounding boxes
 * 3. Builds a new PDF with images + invisible searchable text layer
 */
export async function ocrPDF(
  file: File,
  options: OCROptions,
): Promise<OCRResult> {
  const pdfjsLib = await import('pdfjs-dist')
  const Tesseract = (await import('tesseract.js')).default

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const totalPages = pdf.numPages

  const outputPdf = await PDFDocument.create()
  const pageResults: OCRResult['pages'] = []

  for (let i = 1; i <= totalPages; i++) {
    options.onProgress?.({
      status: 'recognizing',
      page: i,
      totalPages,
      percent: Math.round(((i - 1) / totalPages) * 90),
      detail: `Rendering page ${i}...`,
    })

    // 1. Render page to high-res canvas
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2.0 })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport, canvas: null }).promise

    // 2. Run OCR
    const dataUrl = canvas.toDataURL('image/png')
    const ocrResult = await Tesseract.recognize(dataUrl, options.language, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          options.onProgress?.({
            status: 'recognizing',
            page: i,
            totalPages,
            percent: Math.round(((i - 1) / totalPages) * 90 + (m.progress * 0.9) / totalPages),
            detail: `Page ${i}: ${Math.round(m.progress * 100)}%`,
          })
        }
      },
    })

    const text = ocrResult.data.text || ''

    // Extract words from blocks → paragraphs → lines → words
    const words = (ocrResult.data.blocks || [])
      .flatMap((b) => b.paragraphs)
      .flatMap((p) => p.lines)
      .flatMap((l) => l.words)

    // 3. Embed page image in new PDF
    const imgBytes = await fetch(dataUrl).then((r) => r.arrayBuffer())
    let embeddedImage
    try {
      embeddedImage = await outputPdf.embedPng(new Uint8Array(imgBytes))
    } catch {
      // Fallback: compress to JPEG if PNG fails (e.g., too large)
      const jpegDataUrl = await pngToJpeg(canvas)
      const jpegBytes = await fetch(jpegDataUrl).then((r) => r.arrayBuffer())
      embeddedImage = await outputPdf.embedJpg(new Uint8Array(jpegBytes))
    }

    const outputPage = outputPdf.addPage([viewport.width, viewport.height])
    outputPage.drawImage(embeddedImage, {
      x: 0, y: 0, width: viewport.width, height: viewport.height,
    })

    // 4. Draw invisible searchable text layer
    for (const word of words) {
      if (!word.text || !word.bbox) continue

      const { x0, y0, y1 } = word.bbox
      const fontSize = Math.max(6, (y1 - y0) * 0.8)

      try {
        outputPage.drawText(word.text, {
          x: x0,
          y: viewport.height - y1, // Tesseract: y0=top, PDF: y=0 is bottom
          size: fontSize,
          color: rgb(0, 0, 0),
          opacity: 0, // invisible but selectable/searchable
        })
      } catch {
        // Skip individual words that fail (e.g., unsupported characters)
      }
    }

    pageResults.push({ pageNumber: i, text, wordCount: words.length })
  }

  options.onProgress?.({
    status: 'done',
    page: totalPages,
    totalPages,
    percent: 100,
    detail: 'Done',
  })

  const data = await outputPdf.save()
  return { data, pages: pageResults }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function pngToJpeg(canvas: HTMLCanvasElement): Promise<string> {
  const jpegCanvas = document.createElement('canvas')
  jpegCanvas.width = canvas.width
  jpegCanvas.height = canvas.height
  const ctx = jpegCanvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height)
  ctx.drawImage(canvas, 0, 0)
  return jpegCanvas.toDataURL('image/jpeg', 0.85)
}
