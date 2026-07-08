import { PDFDocument } from 'pdf-lib'

// ─── Constants ──────────────────────────────────────────────────────────────

/** Slide render width (pixels) */
const SLIDE_WIDTH = 960
const SLIDE_HEIGHT = 540

/** PDF page — A4 landscape */
const PAGE_WIDTH = 842
const PAGE_HEIGHT = 595

/** JPEG quality */
const JPEG_QUALITY = 0.92

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Convert a PowerPoint file (.pptx) to PDF.
 *
 * Each slide is rendered to a Canvas via pptxviewjs and embedded
 * as a JPEG image in the PDF. One slide = one PDF page.
 *
 * @param file - The .pptx File object
 * @param onProgress - Optional callback receiving (current, total) slide numbers
 * @returns The PDF as a Uint8Array
 */
export async function convertPPTToPDF(
  file: File,
  onProgress?: (current: number, total: number) => void,
): Promise<Uint8Array> {
  const { PPTXViewer } = await import('pptxviewjs')

  const viewer = new PPTXViewer({
    backgroundColor: '#ffffff',
    slideSizeMode: 'fit',
  })
  await viewer.loadFile(file)

  const totalSlides = viewer.getSlideCount()
  onProgress?.(0, totalSlides)

  const pdfDoc = await PDFDocument.create()

  for (let i = 0; i < totalSlides; i++) {
    onProgress?.(i + 1, totalSlides)

    try {
      // Create a canvas and render the slide
      const canvas = document.createElement('canvas')
      canvas.width = SLIDE_WIDTH
      canvas.height = SLIDE_HEIGHT

      await viewer.renderSlide(i, canvas)

      // Convert canvas to JPEG and embed in PDF
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
      const response = await fetch(dataUrl)
      const imageBytes = await response.arrayBuffer()
      const image = await pdfDoc.embedJpg(imageBytes)

      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      const scale = Math.min(
        PAGE_WIDTH / SLIDE_WIDTH,
        PAGE_HEIGHT / SLIDE_HEIGHT,
      )
      const imgW = SLIDE_WIDTH * scale
      const imgH = SLIDE_HEIGHT * scale
      const x = (PAGE_WIDTH - imgW) / 2
      const y = (PAGE_HEIGHT - imgH) / 2

      page.drawImage(image, { x, y, width: imgW, height: imgH })

      canvas.remove()
    } catch {
      // Fallback: placeholder page for failed slides
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      page.drawText(`Slide ${i + 1}`, {
        x: 50,
        y: PAGE_HEIGHT / 2,
        size: 24,
        font: await pdfDoc.embedStandardFont('Helvetica' as never),
        color: { r: 0.6, g: 0.6, b: 0.6 } as never,
      })
    }
  }

  return await pdfDoc.save()
}
