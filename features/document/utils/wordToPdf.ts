import { renderAsync } from 'docx-preview'
import html2canvas from 'html2canvas-pro'
import { PDFDocument } from 'pdf-lib'

// ─── Constants ──────────────────────────────────────────────────────────────

/** Dots-per-inch for pixel ↔ point conversion */
const DPI = 96

/** JPEG quality (0-1) for page images embedded in the PDF */
const JPEG_QUALITY = 0.92

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Convert a Word (.docx) file to PDF using docx-preview + html2canvas.
 *
 * The .docx is rendered with native pagination (breakPages: true) so that
 * each page is a separate <section> element sized to the document's actual
 * page dimensions.  Every page element is captured individually with
 * html2canvas and assembled into a multi-page PDF via pdf-lib.
 *
 * Unlike the previous approach of capturing one giant canvas and slicing it
 * at a fixed pixel height, this method respects the document's own page
 * boundaries — paragraphs, table rows, and images are never cut in half.
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

  // ── Step 1: Render .docx with native pagination ──────────────────────
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
      breakPages: true, // each page is a <section> sized to the doc's real dimensions
    })
  } catch (err) {
    container.remove()
    throw new Error(
      `Could not render document: ${err instanceof Error ? err.message : 'Unknown error'}`,
    )
  }
  onProgress?.(40)

  // ── Step 2: Locate individual page elements ──────────────────────────
  const pageElements = Array.from(
    container.querySelectorAll<HTMLElement>('section'),
  )

  if (pageElements.length === 0) {
    container.remove()
    throw new Error('No pages were rendered from this document.')
  }

  // ── Step 3: Capture each page & assemble PDF ─────────────────────────
  const pdfDoc = await PDFDocument.create()

  for (let i = 0; i < pageElements.length; i++) {
    onProgress?.(40 + Math.round(((i + 1) / pageElements.length) * 55))

    const pageEl = pageElements[i]
    const canvas = await html2canvas(pageEl, {
      scale: 2, // 2× for sharp text
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    const response = await fetch(dataUrl)
    const imageBytes = await response.arrayBuffer()
    const image = await pdfDoc.embedJpg(imageBytes)

    // Page dimensions come from the ACTUAL rendered element, not a
    // hardcoded A4/Letter constant. Works with any document page size.
    const widthPt = (pageEl.offsetWidth / DPI) * 72
    const heightPt = (pageEl.offsetHeight / DPI) * 72

    const page = pdfDoc.addPage([widthPt, heightPt])
    page.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt })

    canvas.remove()
  }
  onProgress?.(95)

  // ── Step 4: Clean up hidden container ────────────────────────────────
  container.remove()

  const pdfBytes = await pdfDoc.save()
  onProgress?.(100)

  return pdfBytes
}

/**
 * Render a .docx file into a visible container element for live preview.
 *
 * Uses continuous scroll (breakPages: false) — this is deliberate:
 * the preview is a single scrollable view, NOT the paginated export.
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
    breakPages: false, // continuous scroll preview
  })
  console.log('[WordToPDF] renderAsync completed')
}

// ─── Internal Helpers ──────────────────────────────────────────────────────

/**
 * Create a hidden, off-screen container for the paginated export render.
 *
 * Styled to match docx-preview's own `.docx-wrapper` behaviour — gray
 * background, flex column, centered pages — so that the section elements
 * render at their natural document size without being constrained by any
 * hardcoded pixel width.
 */
function createRenderContainer(): HTMLDivElement {
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.display = 'flex'
  container.style.flexDirection = 'column'
  container.style.alignItems = 'center'
  container.style.background = 'gray'
  container.style.padding = '30px'
  container.style.paddingBottom = '0px'
  container.style.fontFamily = 'Arial, sans-serif'
  return container
}
