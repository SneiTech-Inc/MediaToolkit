import html2canvas from 'html2canvas-pro'
import { PDFDocument } from 'pdf-lib'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HTMLToPDFOptions {
  pageSize: 'A4' | 'Letter' | 'Legal'
  orientation: 'portrait' | 'landscape'
  viewportWidth: number
}

// ─── Page Sizes (portrait, points) ──────────────────────────────────────────

const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function convertHTMLToPDF(
  html: string,
  options: HTMLToPDFOptions,
): Promise<Uint8Array> {
  // Render HTML in a hidden iframe
  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.left = '-9999px'
  iframe.style.top = '0'
  iframe.style.width = `${options.viewportWidth}px`
  iframe.style.height = '800px'
  iframe.sandbox.add('allow-scripts', 'allow-same-origin')
  document.body.appendChild(iframe)

  // Load HTML via srcdoc
  iframe.srcdoc = html
  await waitForIframeLoad(iframe)

  // Scroll to get full content height
  const body = iframe.contentDocument?.body
  const contentHeight = body ? Math.max(body.scrollHeight, 800) : 800
  iframe.style.height = `${contentHeight}px`

  // Capture with html2canvas-pro
  const canvas = await html2canvas(iframe.contentDocument!.documentElement, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: options.viewportWidth,
    height: contentHeight,
  })

  // Clean up iframe
  iframe.remove()

  // Get page dimensions
  let [pw, ph] = PAGE_SIZES[options.pageSize] || PAGE_SIZES['A4']
  if (options.orientation === 'landscape') [pw, ph] = [ph, pw]

  // Assemble PDF
  const pdfDoc = await PDFDocument.create()
  const totalHeight = canvas.height
  const pageHeightPx = (ph / 72) * 96 // convert points to pixels at 96dpi
  const pageCount = Math.ceil(totalHeight / pageHeightPx)

  for (let i = 0; i < pageCount; i++) {
    const yOffset = i * pageHeightPx
    const cropH = Math.min(pageHeightPx, totalHeight - yOffset)

    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = options.viewportWidth * 2
    pageCanvas.height = cropH * 2
    const ctx = pageCanvas.getContext('2d')!
    ctx.drawImage(canvas, 0, yOffset * 2, options.viewportWidth * 2, cropH * 2, 0, 0, options.viewportWidth * 2, cropH * 2)

    const dataUrl = pageCanvas.toDataURL('image/jpeg', 0.92)
    const imgBytes = await (await fetch(dataUrl)).arrayBuffer()
    const image = await pdfDoc.embedJpg(imgBytes)

    const page = pdfDoc.addPage([pw, ph])
    const scale = Math.min(pw / options.viewportWidth, ph / cropH)
    page.drawImage(image, { x: 0, y: ph - cropH * scale, width: pw, height: cropH * scale })

    pageCanvas.remove()
  }

  canvas.remove()
  return await pdfDoc.save()
}

function waitForIframeLoad(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Iframe load timed out.')), 15_000)
    iframe.onload = () => { clearTimeout(timeout); resolve() }
    iframe.onerror = () => { clearTimeout(timeout); reject(new Error('Failed to load HTML content.')) }
  })
}
