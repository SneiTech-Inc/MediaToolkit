/**
 * QR Code Generator — Pure utility functions.
 *
 * All functions that touch the `qrcode` or `pdf-lib` libraries dynamically import
 * them so the ~40 KB qrcode bundle and ~300 KB pdf-lib bundle are code-split.
 */

import type { QRErrorCorrectionLevel } from '@/features/utility/types/qr'

// ─── QR Code Rendering (Canvas) ────────────────────────────────────────────────

/**
 * Render a QR code directly onto the provided canvas element.
 *
 * Uses the `qrcode` library's `toCanvas` method, which avoids an intermediate
 * data-URL → image-load round-trip.
 */
export async function generateQrToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  options: {
    width: number
    margin: number
    darkColor: string
    lightColor: string
    errorCorrectionLevel: QRErrorCorrectionLevel
  },
): Promise<void> {
  const QRCode = await import('qrcode')
  await QRCode.toCanvas(canvas, text, {
    width: options.width,
    margin: options.margin,
    color: {
      dark: options.darkColor,
      light: options.lightColor,
    },
    errorCorrectionLevel: options.errorCorrectionLevel,
  })
}

// ─── QR Code Rendering (SVG) ──────────────────────────────────────────────────

/**
 * Generate a raw SVG string for the QR code.
 *
 * NOTE: The SVG output is the plain QR code only — logo overlay and watermark
 * are NOT applied. For logo-bearing output, use the PNG (canvas-based) path.
 */
export async function generateQrSvgString(
  text: string,
  options: {
    width: number
    margin: number
    darkColor: string
    lightColor: string
    errorCorrectionLevel: QRErrorCorrectionLevel
  },
): Promise<string> {
  const QRCode = await import('qrcode')
  return QRCode.toString(text, {
    type: 'svg',
    width: options.width,
    margin: options.margin,
    color: {
      dark: options.darkColor,
      light: options.lightColor,
    },
    errorCorrectionLevel: options.errorCorrectionLevel,
  })
}

// ─── Logo Overlay ──────────────────────────────────────────────────────────────

/**
 * Draw a logo image centered on the QR code canvas with a white circle background.
 *
 * The logo is drawn at ~15 % of the canvas width, inside a filled white circle
 * that provides contrast against the QR modules behind it.
 */
export async function overlayLogo(
  canvas: HTMLCanvasElement,
  logoFile: File,
): Promise<void> {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  const circleRadius = canvas.width * 0.15
  const logoSize = canvas.width * 0.12

  // White circle background so the logo sits on a clean surface
  ctx.beginPath()
  ctx.arc(centerX, centerY, circleRadius + 2, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()

  // Load and draw the logo image
  const img = new Image()
  const url = URL.createObjectURL(logoFile)

  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(
        img,
        centerX - logoSize / 2,
        centerY - logoSize / 2,
        logoSize,
        logoSize,
      )
      ctx.restore()
      URL.revokeObjectURL(url)
      resolve()
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load logo image'))
    }
    img.src = url
  })
}

// ─── Watermark ─────────────────────────────────────────────────────────────────

/**
 * Draw the "Powered by SaveVex" watermark at the bottom of the canvas.
 *
 * The watermark is drawn below the QR code area. Callers should allocate extra
 * canvas height to accommodate it (typically 40–48 px below the QR grid).
 */
export function drawWatermark(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const text = 'Powered by SaveVex'
  const fontSize = 14
  const paddingBottom = 6

  ctx.fillStyle = '#94a3b8' // slate-400 — subtle but readable
  ctx.font = `${fontSize}px Inter, system-ui, -apple-system, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(text, canvas.width / 2, canvas.height - paddingBottom)
}

// ─── PDF Generation ────────────────────────────────────────────────────────────

/**
 * Generate a single-page PDF containing the QR code image.
 *
 * Dynamically imports `pdf-lib` (~300 KB) so the library is only loaded when
 * the user explicitly requests a PDF download.
 */
export async function generateQrPdf(qrDataUrl: string): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib')

  // Convert the data URL to raw bytes
  const response = await fetch(qrDataUrl)
  const imageBytes = await response.arrayBuffer()

  const pdfDoc = await PDFDocument.create()

  // Detect PNG vs others — the data URL from canvas.toDataURL is always PNG
  const image = await pdfDoc.embedPng(imageBytes)

  // Scale to fit on a reasonable page size while preserving aspect ratio
  const pageWidth = 400
  const pageHeight = 400 + 48 // extra space matches canvas watermark area
  const page = pdfDoc.addPage([pageWidth, pageHeight])

  const imgDims = image.scale(1)
  const scale = Math.min(
    (pageWidth - 40) / imgDims.width,
    (pageHeight - 40) / imgDims.height,
  )
  const scaledWidth = imgDims.width * scale
  const scaledHeight = imgDims.height * scale

  page.drawImage(image, {
    x: (pageWidth - scaledWidth) / 2,
    y: (pageHeight - scaledHeight) / 2,
    width: scaledWidth,
    height: scaledHeight,
  })

  return pdfDoc.save()
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate a unique ID for recent-QR-code entries.
 *
 * Prefers `crypto.randomUUID()` and falls back to a timestamp + random string.
 */
export function generateEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}
