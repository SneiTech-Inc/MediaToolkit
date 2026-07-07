import { PDFDocument, PDFImage, PageSizes } from 'pdf-lib'
import { fileToPngData } from '@/features/image/utils/imageToPDF'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface JPGToPDFOptions {
  /** Page size: 'fit' matches image dimensions, others use standard paper sizes */
  pageSize: 'fit' | 'a4' | 'letter' | 'legal'
  /** Orientation: 'auto' detects from image aspect ratio */
  orientation: 'auto' | 'portrait' | 'landscape'
  /** Margin in pixels (0–50), added between image edge and page edge */
  margin: number
  /** How the image fills the available area */
  imageFit: 'contain' | 'cover'
}

// ─── Page Size Map ─────────────────────────────────────────────────────────

const PAGE_SIZE_MAP: Record<string, [number, number]> = {
  a4: PageSizes.A4,
  letter: PageSizes.Letter,
  legal: PageSizes.Legal,
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Convert a list of image files into a single PDF document.
 * Each image becomes one page. Supports configurable page size,
 * orientation, margins, and contain/cover image fitting.
 *
 * JPG and PNG are embedded directly. WebP, GIF, and BMP are
 * auto-converted to PNG via Canvas before embedding.
 *
 * @returns The PDF as a Uint8Array ready for download.
 */
export async function convertJPGToPDF(
  files: File[],
  options: JPGToPDFOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()

  for (let i = 0; i < files.length; i++) {
    onProgress?.(i + 1, files.length)
    const file = files[i]
    const imageBytes = await file.arrayBuffer()

    // ── Embed image ──────────────────────────────────────────────────

    let imageWidth: number
    let imageHeight: number
    let image: PDFImage

    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      image = await pdfDoc.embedJpg(imageBytes)
      imageWidth = image.width
      imageHeight = image.height
    } else if (file.type === 'image/png') {
      image = await pdfDoc.embedPng(imageBytes)
      imageWidth = image.width
      imageHeight = image.height
    } else {
      // WebP, GIF, BMP, SVG → convert to PNG via Canvas
      const pngData = await fileToPngData(file)
      image = await pdfDoc.embedPng(pngData.pngBytes)
      imageWidth = pngData.width
      imageHeight = pngData.height
    }

    // ── Determine page dimensions ────────────────────────────────────

    let pageWidth: number
    let pageHeight: number

    if (options.pageSize === 'fit') {
      pageWidth = imageWidth + options.margin * 2
      pageHeight = imageHeight + options.margin * 2
    } else {
      const size = PAGE_SIZE_MAP[options.pageSize]
      pageWidth = size[0]
      pageHeight = size[1]
    }

    // Apply orientation
    if (options.orientation === 'auto') {
      const isImageLandscape = imageWidth > imageHeight
      const isPageLandscape = pageWidth > pageHeight
      if (isImageLandscape !== isPageLandscape) {
        ;[pageWidth, pageHeight] = [pageHeight, pageWidth]
      }
    } else if (options.orientation === 'landscape') {
      if (pageWidth < pageHeight) {
        ;[pageWidth, pageHeight] = [pageHeight, pageWidth]
      }
    } else if (options.orientation === 'portrait') {
      if (pageWidth > pageHeight) {
        ;[pageWidth, pageHeight] = [pageHeight, pageWidth]
      }
    }

    // ── Calculate image placement ────────────────────────────────────

    const availableWidth = pageWidth - options.margin * 2
    const availableHeight = pageHeight - options.margin * 2

    const { x, y, width, height } = calculateImageFit(
      imageWidth,
      imageHeight,
      availableWidth,
      availableHeight,
      options.imageFit,
    )

    // ── Draw page ────────────────────────────────────────────────────

    const page = pdfDoc.addPage([pageWidth, pageHeight])
    page.drawImage(image, {
      x: x + options.margin,
      y: y + options.margin,
      width,
      height,
    })
  }

  return await pdfDoc.save()
}

// ─── Image Fit Calculation ─────────────────────────────────────────────────

/**
 * Calculate the position and dimensions for an image within a container,
 * applying either "contain" (fit entirely) or "cover" (fill entirely) logic.
 * The image is always centered within the container.
 */
function calculateImageFit(
  imgWidth: number,
  imgHeight: number,
  containerWidth: number,
  containerHeight: number,
  fit: 'contain' | 'cover',
): { x: number; y: number; width: number; height: number } {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const imgRatio = imgWidth / imgHeight
  const containerRatio = containerWidth / containerHeight

  let width: number
  let height: number

  if (fit === 'contain') {
    // Scale so the entire image fits within the container
    if (imgRatio > containerRatio) {
      width = containerWidth
      height = containerWidth / imgRatio
    } else {
      height = containerHeight
      width = containerHeight * imgRatio
    }
  } else {
    // Scale so the container is fully covered (image may be cropped)
    if (imgRatio > containerRatio) {
      height = containerHeight
      width = containerHeight * imgRatio
    } else {
      width = containerWidth
      height = containerWidth / imgRatio
    }
  }

  // Center the image
  const x = (containerWidth - width) / 2
  const y = (containerHeight - height) / 2

  return { x, y, width, height }
}
