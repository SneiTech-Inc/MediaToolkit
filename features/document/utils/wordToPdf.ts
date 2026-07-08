import { renderAsync } from 'docx-preview'
import html2canvas from 'html2canvas-pro'
import { PDFDocument } from 'pdf-lib'

// ─── Constants ──────────────────────────────────────────────────────────────

/** Container width in pixels — matches A4 at ~96dpi */
const CONTAINER_WIDTH = 800

/** Container padding to add white space around the rendered content */
const CONTAINER_PADDING = 40

/** PDF page size — A4 in points */
const PAGE_WIDTH_PT = 595.28
const PAGE_HEIGHT_PT = 841.89

/** Dots-per-inch for pixel ↔ point conversion */
const DPI = 96

/** JPEG quality (0-1) for page images embedded in the PDF */
const JPEG_QUALITY = 0.92

/** Height of one PDF page in pixels at 96dpi */
const PAGE_HEIGHT_PX = (PAGE_HEIGHT_PT / 72) * DPI

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Convert a Word (.docx) file to PDF using docx-preview + html2canvas.
 *
 * The .docx is rendered into the browser DOM (preserving images, tables,
 * fonts, and layout), captured as canvas images, and assembled into a
 * multi-page PDF via pdf-lib.
 *
 * @param file - The .docx File object
 * @param onProgress - Optional callback receiving progress percentage (0-100)
 * @returns The PDF as a Uint8Array
 */
export async function convertWordToPDF(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Uint8Array> {
  onProgress?.(0)

  // ── Step 1: Render .docx into hidden container ──────────────────────
  onProgress?.(10)
  const buffer = await file.arrayBuffer()
  const container = createRenderContainer()
  document.body.appendChild(container)

  try {
    await renderAsync(buffer, container, undefined, {
      className: 'docx-render',
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: false,
    })
  } catch (err) {
    container.remove()
    throw new Error(
      `Could not render document: ${err instanceof Error ? err.message : 'Unknown error'}`,
    )
  }
  onProgress?.(40)

  // ── Step 2: Capture as canvas via html2canvas ───────────────────────
  const canvas = await html2canvas(container, {
    scale: 2, // 2× for sharp text
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: CONTAINER_WIDTH,
    height: container.scrollHeight,
  })
  onProgress?.(60)

  // ── Step 3: Clean up hidden container ───────────────────────────────
  container.remove() // safe — no-op if already detached

  // ── Step 4: Split canvas into pages and assemble PDF ────────────────
  const pdfBytes = await assemblePDF(canvas, onProgress)
  onProgress?.(100)

  // Clean up the full canvas
  canvas.remove()

  return pdfBytes
}

/**
 * Render a .docx file into a visible container element for preview.
 * Returns the container so the caller can insert it into the DOM.
 */
export async function renderDocxPreview(
  file: File,
  container: HTMLElement,
): Promise<void> {
  const arrayBuffer = await file.arrayBuffer()
  console.log('[WordToPDF] ArrayBuffer loaded:', arrayBuffer.byteLength, 'bytes')

  await renderAsync(arrayBuffer, container, undefined, {
    className: 'docx-render',
    inWrapper: false,
    ignoreWidth: true,
    ignoreHeight: true,
    breakPages: false,
  })
  console.log('[WordToPDF] renderAsync completed')
}

// ─── Internal Helpers ──────────────────────────────────────────────────────

/** Create a hidden, off-screen container for rendering. */
function createRenderContainer(): HTMLDivElement {
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = `${CONTAINER_WIDTH}px`
  container.style.padding = `${CONTAINER_PADDING}px`
  container.style.background = 'white'
  container.style.fontFamily = 'Arial, sans-serif'
  return container
}

/** Split the full canvas into page-sized images and assemble into a PDF. */
async function assemblePDF(
  fullCanvas: HTMLCanvasElement,
  onProgress?: (percent: number) => void,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()

  const totalHeight = fullCanvas.height
  const pageCount = Math.ceil(totalHeight / PAGE_HEIGHT_PX)

  for (let i = 0; i < pageCount; i++) {
    onProgress?.(60 + Math.round(((i + 1) / pageCount) * 35))

    const yOffset = i * PAGE_HEIGHT_PX
    const cropHeight = Math.min(PAGE_HEIGHT_PX, totalHeight - yOffset)

    // Create a temporary canvas for this page slice
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = CONTAINER_WIDTH * 2 // scale ×2 to match html2canvas
    pageCanvas.height = cropHeight * 2
    const ctx = pageCanvas.getContext('2d')!

    // Copy the relevant portion of the full canvas
    ctx.drawImage(
      fullCanvas,
      0,
      yOffset * 2, // compensate for 2× scale
      CONTAINER_WIDTH * 2,
      cropHeight * 2,
      0,
      0,
      CONTAINER_WIDTH * 2,
      cropHeight * 2,
    )

    // Convert to JPEG and embed in PDF
    const dataUrl = pageCanvas.toDataURL('image/jpeg', JPEG_QUALITY)
    const response = await fetch(dataUrl)
    const imageBytes = await response.arrayBuffer()
    const image = await pdfDoc.embedJpg(imageBytes)

    // Add page and draw the image scaled to fit
    const page = pdfDoc.addPage([PAGE_WIDTH_PT, PAGE_HEIGHT_PT])
    const scaleFactor = PAGE_WIDTH_PT / CONTAINER_WIDTH
    const imgWidth = PAGE_WIDTH_PT
    const imgHeight = cropHeight * scaleFactor

    page.drawImage(image, {
      x: 0,
      y: PAGE_HEIGHT_PT - imgHeight,
      width: imgWidth,
      height: imgHeight,
    })

    // Clean up temporary canvas
    pageCanvas.remove()
  }

  return await pdfDoc.save()
}
