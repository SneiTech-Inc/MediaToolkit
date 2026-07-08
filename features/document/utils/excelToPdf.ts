import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

// ─── Constants ──────────────────────────────────────────────────────────────

/** A4 landscape — better for wide tables */
const PAGE_WIDTH = 842
const PAGE_HEIGHT = 595

const MARGIN = 40
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const CONTENT_HEIGHT = PAGE_HEIGHT - MARGIN * 2

const HEADER_FONT_SIZE = 10
const CELL_FONT_SIZE = 9
const ROW_HEIGHT = 20
const HEADER_ROW_HEIGHT = 24
const MAX_ROWS_PER_PAGE = 50
const BORDER_WIDTH = 0.5
const HEADER_BG = rgb(0.92, 0.92, 0.92)

// ─── CJK Font Handling ──────────────────────────────────────────────────────

const CJK_FONT_PATH = '/fonts/NotoSansCJK-Regular.otf'

/**
 * Check whether any cell text contains CJK, Hangul, or Kana characters
 * that Helvetica cannot render.
 */
function needsCJKFont(allRows: string[][]): boolean {
  for (const row of allRows) {
    for (const cell of row) {
      for (const ch of cell) {
        const cp = ch.codePointAt(0)!
        if (
          (cp >= 0x3000 && cp <= 0x9fff) || // CJK
          (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul
          (cp >= 0xff00 && cp <= 0xffef)    // Fullwidth forms / Kana
        ) {
          return true
        }
      }
    }
  }
  return false
}

/**
 * Load and embed the self-hosted CJK font.
 * Throws a clear error if the font file cannot be loaded.
 */
async function embedCJKFont(pdfDoc: PDFDocument): Promise<StoredFonts> {
  pdfDoc.registerFontkit(fontkit)

  const response = await fetch(CJK_FONT_PATH)
  if (!response.ok) {
    throw new Error(
      `CJK font file not found at ${CJK_FONT_PATH}. ` +
        `Please place NotoSansCJK-Regular.otf in the public/fonts/ directory.`,
    )
  }

  const buffer = await response.arrayBuffer()
  const font = await pdfDoc.embedFont(new Uint8Array(buffer))

  // Reuse the same CJK font for both normal and bold in v1
  return { normal: font, bold: font }
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface StoredFonts {
  normal: PDFFont
  bold: PDFFont
}

interface SheetData {
  name: string
  rows: string[][]
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Convert an Excel file (.xlsx/.xls) to PDF.
 *
 * Each sheet becomes one or more PDF pages (paginated if >50 rows).
 * Headers are rendered bold with a gray background. Numbers are
 * right-aligned, text is left-aligned. Cell borders are drawn for
 * table structure.
 *
 * @param file - The Excel File object
 * @param onProgress - Optional callback receiving progress percentage (0-100)
 * @returns The PDF as a Uint8Array
 */
export async function convertExcelToPDF(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Uint8Array> {
  onProgress?.(0)

  // Dynamic import for tree-shaking
  const XLSX = await import('xlsx')

  const arrayBuffer = await file.arrayBuffer()
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  onProgress?.(15)

  // ── Extract all sheets ───────────────────────────────────────────────
  const sheets: SheetData[] = wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: '',
    }) as string[][]

    return {
      name,
      rows: rows.map((row) =>
        row.map((cell) => (cell == null ? '' : String(cell))),
      ),
    }
  })
  onProgress?.(30)

  // ── Build PDF ────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create()

  // Only load the heavy CJK font if the spreadsheet contains CJK text
  const allRows = sheets.flatMap((s) => s.rows)
  const fonts: StoredFonts = needsCJKFont(allRows)
    ? await embedCJKFont(pdfDoc)
    : {
        normal: await pdfDoc.embedStandardFont(StandardFonts.Helvetica),
        bold: await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold),
      }

  const totalSheets = sheets.length
  for (let si = 0; si < totalSheets; si++) {
    const sheet = sheets[si]
    onProgress?.(
      30 + Math.round(((si + 1) / totalSheets) * 65),
    )

    renderSheet(pdfDoc, fonts, sheet)
  }

  onProgress?.(100)
  return await pdfDoc.save()
}

// ─── Sheet Renderer ─────────────────────────────────────────────────────────

function renderSheet(
  pdfDoc: PDFDocument,
  fonts: StoredFonts,
  sheet: SheetData,
): void {
  const rows = sheet.rows
  if (rows.length === 0) {
    // Empty sheet — still create a page with the sheet name
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    page.drawText(`${sheet.name} (empty)`, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN - 14,
      size: 14,
      font: fonts.bold,
      color: rgb(0, 0, 0),
    })
    return
  }

  // Detect header row (first non-empty row)
  const headerRowIdx = findHeaderRow(rows)
  const headerRow = rows[headerRowIdx]
  const dataRows = rows.slice(headerRowIdx + 1)

  // Calculate column widths based on content
  const colWidths = computeColumnWidths([headerRow, ...dataRows], fonts)

  // Paginate data rows
  const totalPages = Math.ceil(dataRows.length / MAX_ROWS_PER_PAGE)

  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    const startRow = pageNum * MAX_ROWS_PER_PAGE
    const pageRows = dataRows.slice(startRow, startRow + MAX_ROWS_PER_PAGE)

    let y = PAGE_HEIGHT - MARGIN

    // Sheet title
    page.drawText(sheet.name, {
      x: MARGIN,
      y: y - 14,
      size: 14,
      font: fonts.bold,
      color: rgb(0, 0, 0),
    })
    y -= 28

    // Render header row
    y = renderRow(page, fonts, headerRow, colWidths, MARGIN, y, true)
    y -= 2 // small gap after header

    // Render data rows
    for (const row of pageRows) {
      if (y - ROW_HEIGHT < MARGIN) break
      y = renderRow(page, fonts, row, colWidths, MARGIN, y, false)
    }

    // Page footer
    if (totalPages > 1) {
      const footerText = `${sheet.name} — Page ${pageNum + 1} of ${totalPages}`
      const footerWidth = fonts.normal.widthOfTextAtSize(footerText, 8)
      page.drawText(footerText, {
        x: PAGE_WIDTH - MARGIN - footerWidth,
        y: MARGIN / 2,
        size: 8,
        font: fonts.normal,
        color: rgb(0.5, 0.5, 0.5),
      })
    }
  }
}

// ─── Row Renderer ───────────────────────────────────────────────────────────

function renderRow(
  page: PDFPage,
  fonts: StoredFonts,
  row: string[],
  colWidths: number[],
  x: number,
  y: number,
  isHeader: boolean,
): number {
  const rowHeight = isHeader ? HEADER_ROW_HEIGHT : ROW_HEIGHT
  const fontSize = isHeader ? HEADER_FONT_SIZE : CELL_FONT_SIZE
  const font = isHeader ? fonts.bold : fonts.normal
  const rowBottom = y - rowHeight

  // Row background for header
  if (isHeader) {
    let totalWidth = 0
    for (let c = 0; c < colWidths.length; c++) {
      totalWidth += colWidths[c]
    }
    page.drawRectangle({
      x,
      y: rowBottom,
      width: totalWidth,
      height: rowHeight,
      color: HEADER_BG,
    })
  }

  // Draw each cell
  let cellX = x
  for (let c = 0; c < colWidths.length; c++) {
    const cellText = c < row.length ? String(row[c] ?? '') : ''
    const cellWidth = colWidths[c]
    const isNumber = isNumeric(cellText)

    // Cell border
    page.drawRectangle({
      x: cellX,
      y: rowBottom,
      width: cellWidth,
      height: rowHeight,
      borderColor: rgb(0.6, 0.6, 0.6),
      borderWidth: BORDER_WIDTH,
    })

    // Cell text
    if (cellText) {
      const textX = isNumber
        ? cellX + cellWidth - fonts.normal.widthOfTextAtSize(cellText, fontSize) - 4
        : cellX + 4

      page.drawText(cellText, {
        x: textX,
        y: rowBottom + 5,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        maxWidth: cellWidth - 8,
      })
    }

    cellX += cellWidth
  }

  return rowBottom
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findHeaderRow(rows: string[][]): number {
  // First row with at least 2 non-empty cells is the header
  for (let i = 0; i < rows.length; i++) {
    const filled = rows[i].filter((c) => String(c).trim()).length
    if (filled >= 2) return i
  }
  return 0
}

function computeColumnWidths(
  rows: string[][],
  fonts: StoredFonts,
): number[] {
  const maxCols = Math.max(...rows.map((r) => r.length), 1)
  const widths: number[] = new Array(maxCols).fill(60) // minimum width

  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const text = String(row[c] ?? '')
      const textWidth = fonts.normal.widthOfTextAtSize(text, CELL_FONT_SIZE) + 12
      widths[c] = Math.max(widths[c], textWidth)
    }
  }

  // Cap each column width so total fits within CONTENT_WIDTH
  const totalWidth = widths.reduce((s, w) => s + w, 0)
  if (totalWidth > CONTENT_WIDTH) {
    const scale = CONTENT_WIDTH / totalWidth
    for (let c = 0; c < widths.length; c++) {
      widths[c] = Math.max(40, Math.floor(widths[c] * scale))
    }
  }

  return widths
}

function isNumeric(text: string): boolean {
  if (!text.trim()) return false
  return !isNaN(Number(text.replace(/[, ]/g, '')))
}
