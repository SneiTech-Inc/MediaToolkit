import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TextToPDFOptions {
  pageSize: 'A4' | 'Letter' | 'Legal'
  orientation: 'portrait' | 'landscape'
  fontSize: number
  lineHeight: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
}

export interface TextStats {
  words: number
  chars: number
  lines: number
  estimatedPages: number
}

// ─── Page Size Map (portrait dimensions in points) ──────────────────────────

const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function convertTextToPDF(
  text: string,
  options: TextToPDFOptions,
): Promise<Uint8Array> {
  // Check for non-Latin characters
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (cp > 0xff && cp !== 0x2013 && cp !== 0x2014 && cp !== 0x2018 && cp !== 0x2019 && cp !== 0x201c && cp !== 0x201d && cp !== 0x2026) {
      throw new Error(
        'This tool currently supports only Latin characters. ' +
        'Characters like Chinese, Japanese, Korean, Arabic, or Cyrillic are not supported in this version.',
      )
    }
  }

  const pdfDoc = await PDFDocument.create()

  // Get page dimensions
  let [pw, ph] = PAGE_SIZES[options.pageSize] || PAGE_SIZES['A4']
  if (options.orientation === 'landscape') {
    ;[pw, ph] = [ph, pw]
  }

  const font = await pdfDoc.embedStandardFont(StandardFonts.Helvetica)
  const fontSize = options.fontSize
  const lh = fontSize * options.lineHeight
  const marginL = options.marginLeft
  const marginR = options.marginRight
  const marginT = options.marginTop
  const marginB = options.marginBottom
  const maxWidth = pw - marginL - marginR

  // Split into paragraphs by newline
  const paragraphs = text.split('\n')
  const lines: string[] = []

  for (const para of paragraphs) {
    if (para.length === 0) {
      lines.push('') // empty line = paragraph break
      continue
    }
    // Wrap each paragraph
    const wrapped = wrapText(para, font, fontSize, maxWidth)
    lines.push(...wrapped)
  }

  let page = pdfDoc.addPage([pw, ph])
  let y = ph - marginT

  for (const line of lines) {
    if (y - lh < marginB) {
      page = pdfDoc.addPage([pw, ph])
      y = ph - marginT
    }

    if (line) {
      page.drawText(line, {
        x: marginL,
        y: y - lh,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        maxWidth,
      })
    }
    y -= lh
  }

  return await pdfDoc.save()
}

// ─── Text Wrapping ──────────────────────────────────────────────────────────

function wrapText(
  text: string,
  font: ReturnType<PDFDocument['embedStandardFont']> extends Promise<infer T> ? T : never,
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    const width = font.widthOfTextAtSize(test, fontSize)

    if (width <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      // If single word is too long, push as-is (force break)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export function computeTextStats(
  text: string,
  options: TextToPDFOptions,
): TextStats {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const chars = text.length
  const lines = text.split('\n').length

  // Rough estimate of rendered lines for page count
  let [pw, ph] = PAGE_SIZES[options.pageSize] || PAGE_SIZES['A4']
  if (options.orientation === 'landscape') [pw, ph] = [ph, pw]
  const maxWidth = pw - options.marginLeft - options.marginRight
  const lh = options.fontSize * options.lineHeight
  const availableHeight = ph - options.marginTop - options.marginBottom
  const linesPerPage = Math.floor(availableHeight / lh)

  let totalLines = 0
  for (const para of text.split('\n')) {
    if (!para) { totalLines++; continue }
    // Approximate without font measurement
    const avgCharWidth = options.fontSize * 0.6
    const charsPerLine = Math.max(1, Math.floor(maxWidth / avgCharWidth))
    totalLines += Math.ceil(para.length / charsPerLine)
  }

  return {
    words,
    chars,
    lines,
    estimatedPages: Math.max(1, Math.ceil(totalLines / linesPerPage)),
  }
}
