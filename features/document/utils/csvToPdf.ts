import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CSVToPDFOptions {
  pageSize: 'A4' | 'Letter' | 'Legal'
  orientation: 'portrait' | 'landscape'
  fontSize: number
  tableStyle: 'bordered' | 'striped' | 'plain'
  firstRowHeader: boolean
  delimiter: string
}

// ─── Page Sizes ─────────────────────────────────────────────────────────────

const PAGE_SIZES: Record<string, [number, number]> = { A4: [595, 842], Letter: [612, 792], Legal: [612, 1008] }
const MARGIN = 40
const ROW_H = 22
const HEADER_ROW_H = 26

// ─── CSV Parser ─────────────────────────────────────────────────────────────

export function parseCSV(content: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    const next = content[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { field += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === delimiter) { row.push(field); field = '' }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(field); field = ''
        if (row.some((c) => c)) rows.push(row)
        row = []
        if (ch === '\r') i++
      } else if (ch === '\r') {
        row.push(field); field = ''
        if (row.some((c) => c)) rows.push(row)
        row = []
      } else { field += ch }
    }
  }
  row.push(field)
  if (row.some((c) => c)) rows.push(row)
  return rows
}

export function detectDelimiter(content: string): string {
  const lines = content.split('\n').slice(0, 10).join('\n') // sample first 10 lines
  const counts = { ',': (lines.match(/,/g) || []).length, ';': (lines.match(/;/g) || []).length, '\t': (lines.match(/\t/g) || []).length }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

// ─── PDF Builder ────────────────────────────────────────────────────────────

export async function convertCSVToPDF(content: string, options: CSVToPDFOptions): Promise<Uint8Array> {
  const delimiter = options.delimiter === 'auto' ? detectDelimiter(content) : options.delimiter
  const rows = parseCSV(content, delimiter)
  if (rows.length === 0) throw new Error('No data found in CSV file.')

  const hasHeader = options.firstRowHeader && rows.length > 1
  const headerRow = hasHeader ? rows[0] : null
  const dataRows = hasHeader ? rows.slice(1) : rows
  const colCount = Math.max(...rows.map((r) => r.length), 1)

  let [pw, ph] = PAGE_SIZES[options.pageSize]
  if (options.orientation === 'landscape') [pw, ph] = [ph, pw]

  const pdfDoc = await PDFDocument.create()
  const normal = await pdfDoc.embedStandardFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold)
  const fs = options.fontSize
  const cw = computeColWidths([...(headerRow ? [headerRow] : []), ...dataRows], normal, fs, pw)

  const rowsPerPage = Math.floor((ph - MARGIN * 2 - HEADER_ROW_H) / ROW_H)

  for (let pi = 0; pi < Math.ceil(dataRows.length / rowsPerPage); pi++) {
    const page = pdfDoc.addPage([pw, ph])
    let y = ph - MARGIN

    // Header row
    if (headerRow) {
      y = drawRow(page, normal, bold, headerRow, cw, MARGIN, y, fs, HEADER_ROW_H, true, options.tableStyle, 0)
    }

    const start = pi * rowsPerPage
    const pageRows = dataRows.slice(start, start + rowsPerPage)
    for (let ri = 0; ri < pageRows.length; ri++) {
      if (y - ROW_H < MARGIN) break
      y = drawRow(page, normal, normal, pageRows[ri], cw, MARGIN, y, fs, ROW_H, false, options.tableStyle, start + ri)
    }
  }

  return await pdfDoc.save()
}

function computeColWidths(rows: string[][], font: any, fs: number, pw: number): number[] {
  const maxCols = Math.max(...rows.map((r) => r.length), 1)
  const widths = new Array(maxCols).fill(50)
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      widths[c] = Math.max(widths[c], font.widthOfTextAtSize(String(row[c] || ''), fs) + 16)
    }
  }
  const total = widths.reduce((s, w) => s + w, 0)
  const avail = pw - MARGIN * 2
  if (total > avail) { const s = avail / total; for (let c = 0; c < widths.length; c++) widths[c] = Math.max(40, Math.floor(widths[c] * s)) }
  return widths
}

function drawRow(page: PDFPage, font: any, hFont: any, row: string[], cw: number[], x: number, y: number, fs: number, rh: number, isHeader: boolean, style: string, ri: number): number {
  const bottom = y - rh; let cx = x

  if (isHeader) {
    page.drawRectangle({ x, y: bottom, width: cw.reduce((s, w) => s + w, 0), height: rh, color: rgb(0.9, 0.9, 0.9) })
  } else if (style === 'striped' && ri % 2 === 1) {
    page.drawRectangle({ x, y: bottom, width: cw.reduce((s, w) => s + w, 0), height: rh, color: rgb(0.96, 0.96, 0.96) })
  }

  for (let c = 0; c < cw.length; c++) {
    const text = String(c < row.length ? (row[c] ?? '') : '')
    const isNum = /^[\d,.%$\-]+$/.test(text.trim()) && text.trim().length > 0

    if (style !== 'plain') {
      page.drawRectangle({ x: cx, y: bottom, width: cw[c], height: rh, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 })
    }

    if (text) {
      const tx = isNum ? cx + cw[c] - (isHeader ? hFont : font).widthOfTextAtSize(text, fs) - 4 : cx + 4
      page.drawText(text, { x: tx, y: bottom + 5, size: fs, font: isHeader ? hFont : font, color: rgb(0, 0, 0), maxWidth: cw[c] - 8 })
    }
    cx += cw[c]
  }
  return bottom
}
