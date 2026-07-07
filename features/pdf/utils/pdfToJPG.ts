import * as pdfjsLib from 'pdfjs-dist'

// Configure the PDF.js worker via CDN (browser-only, no bundler worker config needed)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

export interface PDFToJPGResult {
  blob: Blob
  pageNumber: number // 1-indexed
  width: number
  height: number
  previewUrl: string // Object URL for thumbnail display (caller must revoke)
}

export interface PDFToJPGOptions {
  /** JPEG quality 1–100, mapped to 0.01–1.0 for canvas.toBlob() */
  quality: number
  /** 1-indexed page numbers to convert */
  pages: number[]
  /** Scale factor: 1.0 = 72 DPI, 2.0 = 144 DPI, 3.0 = 216 DPI */
  scale: number
  /** Progress callback: (current, total) */
  onProgress?: (current: number, total: number) => void
}

/**
 * Convert pages of a PDF file to JPEG images using pdfjs-dist for rendering
 * and the Canvas API for JPEG export.
 *
 * All processing happens client-side — nothing is uploaded to a server.
 */
export async function convertPDFToJPG(
  file: File,
  options: PDFToJPGOptions,
): Promise<PDFToJPGResult[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const total = options.pages.length
  const results: PDFToJPGResult[] = []

  for (let i = 0; i < options.pages.length; i++) {
    const pageNum = options.pages[i]
    options.onProgress?.(i + 1, total)

    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: options.scale })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to create Canvas 2D context.')

    await page.render({ canvasContext: ctx, viewport, canvas: null }).promise

    const blob = await canvasToBlob(canvas, 'image/jpeg', options.quality / 100)
    const previewUrl = URL.createObjectURL(blob)

    results.push({
      blob,
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
      previewUrl,
    })
  }

  return results
}

/** Wrap canvas.toBlob() in a Promise. */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) {
          resolve(b)
        } else {
          reject(new Error('Canvas.toBlob returned null. The canvas may be too large.'))
        }
      },
      format,
      quality,
    )
  })
}
