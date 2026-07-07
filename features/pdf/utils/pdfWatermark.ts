import { PDFDocument, PDFImage, rgb, degrees } from 'pdf-lib'
import { fileToPngData } from '@/features/image/utils/imageToPDF'

// ─── Types ─────────────────────────────────────────────────────────────────

export type WatermarkPosition = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface TextWatermarkOptions {
  text: string
  fontSize: number
  color: { r: number; g: number; b: number } // 0–1 range
  opacity: number // 0–100
  rotation: number // 0–360 degrees
  position: WatermarkPosition
}

export interface ImageWatermarkOptions {
  imageFile: File
  scale: number // 10–100 percentage
  opacity: number // 0–100
  position: WatermarkPosition
}

// ─── Position Calculation ──────────────────────────────────────────────────

/**
 * Calculate x,y for a watermark within a page, centered or anchored to corners.
 * Padding is 20px from edges for corner positions.
 */
function calculatePosition(
  position: WatermarkPosition,
  pageWidth: number,
  pageHeight: number,
  wmWidth: number,
  wmHeight: number,
  padding = 20,
): { x: number; y: number } {
  switch (position) {
    case 'center':
      return {
        x: (pageWidth - wmWidth) / 2,
        y: (pageHeight - wmHeight) / 2,
      }
    case 'top-left':
      return { x: padding, y: padding }
    case 'top-right':
      return { x: pageWidth - wmWidth - padding, y: padding }
    case 'bottom-left':
      return { x: padding, y: pageHeight - wmHeight - padding }
    case 'bottom-right':
      return { x: pageWidth - wmWidth - padding, y: pageHeight - wmHeight - padding }
  }
}

// ─── Text Watermark ────────────────────────────────────────────────────────

/**
 * Add a text watermark to a PDF. Applies to all pages by default,
 * or to a specific subset of 0-indexed page numbers.
 */
export async function addTextWatermark(
  file: File,
  options: TextWatermarkOptions,
  targetPages?: number[],
): Promise<Uint8Array> {
  const buf = await file.arrayBuffer()
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true })
  const totalPages = pdf.getPageCount()
  const pages = targetPages ?? Array.from({ length: totalPages }, (_, i) => i)

  for (const pageIndex of pages) {
    const page = pdf.getPage(pageIndex)
    const { width, height } = page.getSize()

    // Approximate text dimensions (monospace estimate)
    const textWidth = options.text.length * options.fontSize * 0.55
    const textHeight = options.fontSize

    const pos = calculatePosition(options.position, width, height, textWidth, textHeight)

    page.drawText(options.text, {
      x: pos.x,
      y: pos.y,
      size: options.fontSize,
      color: rgb(options.color.r, options.color.g, options.color.b),
      opacity: options.opacity / 100,
      rotate: degrees(options.rotation),
    })
  }

  return await pdf.save()
}

// ─── Image Watermark ───────────────────────────────────────────────────────

/**
 * Add an image watermark to a PDF. Supports JPG, PNG, and other formats
 * (auto-converted to PNG via Canvas). Applies to all pages by default.
 */
export async function addImageWatermark(
  file: File,
  options: ImageWatermarkOptions,
  targetPages?: number[],
): Promise<Uint8Array> {
  const buf = await file.arrayBuffer()
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true })
  const totalPages = pdf.getPageCount()
  const pages = targetPages ?? Array.from({ length: totalPages }, (_, i) => i)

  // Embed watermark image
  const wmBytes = await options.imageFile.arrayBuffer()
  let image: PDFImage

  if (options.imageFile.type === 'image/png') {
    image = await pdf.embedPng(wmBytes)
  } else if (options.imageFile.type === 'image/jpeg' || options.imageFile.type === 'image/jpg') {
    image = await pdf.embedJpg(wmBytes)
  } else {
    const pngData = await fileToPngData(options.imageFile)
    image = await pdf.embedPng(pngData.pngBytes)
  }

  const scale = options.scale / 100
  const imgWidth = image.width * scale
  const imgHeight = image.height * scale

  for (const pageIndex of pages) {
    const page = pdf.getPage(pageIndex)
    const { width, height } = page.getSize()

    const pos = calculatePosition(options.position, width, height, imgWidth, imgHeight)

    page.drawImage(image, {
      x: pos.x,
      y: pos.y,
      width: imgWidth,
      height: imgHeight,
      opacity: options.opacity / 100,
    })
  }

  return await pdf.save()
}
