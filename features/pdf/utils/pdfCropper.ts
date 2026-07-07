import { PDFDocument } from 'pdf-lib'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CropMargins {
  top: number    // points to crop from top
  bottom: number // points to crop from bottom
  left: number   // points to crop from left
  right: number  // points to crop from right
}

export interface CropOptions {
  margins: CropMargins
  pages: number[] // 0-indexed page indices
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Apply crop boxes to specific pages in a PDF.
 * Uses `page.setCropBox(x, y, width, height)` where (x,y) is the
 * lower-left corner of the crop region.
 */
export async function cropPDF(
  file: File,
  options: CropOptions,
): Promise<Uint8Array> {
  const buf = await file.arrayBuffer()
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true })

  for (const pageIndex of options.pages) {
    const page = pdf.getPage(pageIndex)
    const { width, height } = page.getSize()

    const { top, bottom, left, right } = options.margins

    // Clamp margins to prevent negative dimensions
    const cropLeft = Math.min(left, width - 1)
    const cropRight = Math.min(right, width - cropLeft - 1)
    const cropBottom = Math.min(bottom, height - 1)
    const cropTop = Math.min(top, height - cropBottom - 1)

    const cropWidth = width - cropLeft - cropRight
    const cropHeight = height - cropBottom - cropTop

    // setCropBox(x, y, width, height) — (x,y) is lower-left corner
    page.setCropBox(cropLeft, cropBottom, cropWidth, cropHeight)
  }

  return await pdf.save()
}

// ─── Auto-Detect White Margins ─────────────────────────────────────────────

/**
 * Render the first page of a PDF to a canvas and scan from each edge
 * to find the bounding box of non-white content. Returns margins that
 * tightly crop to visible content.
 *
 * Pixels with all RGB channels > 250 are considered "white" (near-white).
 */
export async function detectWhiteMargins(file: File): Promise<CropMargins> {
  const { getDocument } = await import('pdfjs-dist')
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1.0 })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport, canvas: null }).promise

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { data, width, height } = imageData

  const WHITE_THRESHOLD = 250

  // Scan from top
  let top = 0
  topLoop: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      if (data[idx] < WHITE_THRESHOLD || data[idx + 1] < WHITE_THRESHOLD || data[idx + 2] < WHITE_THRESHOLD) {
        break topLoop
      }
    }
    top = y + 1
  }

  // Scan from bottom
  let bottom = 0
  bottomLoop: for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      if (data[idx] < WHITE_THRESHOLD || data[idx + 1] < WHITE_THRESHOLD || data[idx + 2] < WHITE_THRESHOLD) {
        break bottomLoop
      }
    }
    bottom = height - y
  }

  // Scan from left
  let left = 0
  leftLoop: for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4
      if (data[idx] < WHITE_THRESHOLD || data[idx + 1] < WHITE_THRESHOLD || data[idx + 2] < WHITE_THRESHOLD) {
        break leftLoop
      }
    }
    left = x + 1
  }

  // Scan from right
  let right = 0
  rightLoop: for (let x = width - 1; x >= 0; x--) {
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4
      if (data[idx] < WHITE_THRESHOLD || data[idx + 1] < WHITE_THRESHOLD || data[idx + 2] < WHITE_THRESHOLD) {
        break rightLoop
      }
    }
    right = width - x
  }

  return {
    top: Math.max(0, top - 2),      // small padding
    bottom: Math.max(0, bottom - 2),
    left: Math.max(0, left - 2),
    right: Math.max(0, right - 2),
  }
}
