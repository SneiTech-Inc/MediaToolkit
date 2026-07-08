import * as XLSX from 'xlsx'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TextItem {
  text: string
  x: number
  y: number
  width: number
  height: number
}

interface CellData {
  text: string
  col: number
  row: number
}

interface PageTable {
  rows: string[][]
  colCount: number
  rowCount: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Y-position tolerance for grouping items into the same row */
const ROW_TOLERANCE = 3

/** Minimum X gap between columns (points) */
const COL_GAP = 8

/** Minimum rows for table detection */
const MIN_TABLE_ROWS = 3

/** Minimum columns for table detection */
const MIN_TABLE_COLS = 2

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Convert a PDF file to an Excel (.xlsx) workbook.
 *
 * Extracts tables from the PDF using pdfjs-dist text position analysis.
 * Multi-page documents with consistent table structure are merged into
 * a single sheet; pages with different structures get separate sheets.
 *
 * @param file - The PDF File object
 * @param onProgress - Optional callback receiving progress percentage (0-100)
 * @returns The .xlsx file as a Blob
 */
export async function convertPDFToExcel(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  onProgress?.(0)

  // Dynamic import to prevent SSR crashes in Next.js
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  onProgress?.(10)

  // ── Extract text items from all pages ────────────────────────────────
  const allPageItems: TextItem[][] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(10 + Math.round(((i - 1) / pdf.numPages) * 30))
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const items: TextItem[] = []

    for (const item of content.items) {
      if (!('str' in item) || !item.str?.trim()) continue
      const transform = item.transform as number[]
      items.push({
        text: item.str,
        x: transform[4],
        y: transform[5],
        width: item.width,
        height: item.height,
      })
    }
    allPageItems.push(items)
  }

  const allItems = allPageItems.flat()
  if (allItems.length === 0) {
    throw new Error(
      'No extractable text found in this PDF. It may be an image-only document.',
    )
  }
  onProgress?.(50)

  // ── Process each page into a table ───────────────────────────────────
  const pageTables: PageTable[] = []

  for (const pageItems of allPageItems) {
    const table = extractTable(pageItems)
    if (table) {
      pageTables.push(table)
    }
  }
  onProgress?.(70)

  // If no tables detected, fall back to plain text extraction
  if (pageTables.length === 0) {
    return buildTextFallback(allItems, pdf.numPages)
  }

  // ── Build workbook ───────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()
  const sheets = mergePageTables(pageTables)
  onProgress?.(85)

  for (const sheet of sheets) {
    const ws = sheetToWorksheet(sheet.rows)
    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  }

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  onProgress?.(100)

  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

// ─── Table Extraction ──────────────────────────────────────────────────────

function extractTable(pageItems: TextItem[]): PageTable | null {
  if (pageItems.length === 0) return null

  // Group items into rows by Y position
  const rows = groupIntoRows(pageItems)
  if (rows.length < MIN_TABLE_ROWS) return null

  // Compute column boundaries across the entire page
  const colBoundaries = computeColumnBoundaries(pageItems)
  if (colBoundaries.length < MIN_TABLE_COLS) return null

  // Assign items to grid cells
  const grid = buildGrid(rows, colBoundaries)

  // Filter out empty rows and columns
  const cleanRows = cleanGrid(grid)

  if (cleanRows.length < MIN_TABLE_ROWS) return null
  if (cleanRows[0]?.length < MIN_TABLE_COLS) return null

  return {
    rows: cleanRows,
    colCount: cleanRows[0]?.length ?? 0,
    rowCount: cleanRows.length,
  }
}

function groupIntoRows(items: TextItem[]): TextItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y) // top-to-bottom
  const rows: TextItem[][] = []
  let current: TextItem[] = []
  let currentY = sorted[0]?.y ?? 0

  for (const item of sorted) {
    if (Math.abs(item.y - currentY) > ROW_TOLERANCE) {
      if (current.length > 0) rows.push(current)
      current = []
      currentY = item.y
    }
    current.push(item)
  }
  if (current.length > 0) rows.push(current)

  return rows
}

function computeColumnBoundaries(items: TextItem[]): number[] {
  // Collect all distinct X positions, sorted left-to-right
  const xPositions = [...new Set(items.map((i) => Math.round(i.x)))]
    .sort((a, b) => a - b)

  // Cluster nearby X positions into column boundaries
  const clusters: number[] = []
  for (const x of xPositions) {
    const last = clusters[clusters.length - 1]
    if (last === undefined || x - last > COL_GAP) {
      clusters.push(x)
    }
  }
  return clusters
}

function buildGrid(
  rows: TextItem[][],
  colBoundaries: number[],
): string[][] {
  const grid: string[][] = []

  for (const row of rows) {
    const cells: string[] = new Array(colBoundaries.length).fill('')

    for (const item of row) {
      // Find the closest column boundary
      let bestCol = 0
      let bestDist = Infinity
      for (let c = 0; c < colBoundaries.length; c++) {
        const dist = Math.abs(item.x - colBoundaries[c])
        if (dist < bestDist) {
          bestDist = dist
          bestCol = c
        }
      }
      cells[bestCol] = cells[bestCol]
        ? cells[bestCol] + ' ' + item.text
        : item.text
    }

    grid.push(cells)
  }

  return grid
}

function cleanGrid(grid: string[][]): string[][] {
  // Remove trailing empty columns
  let maxNonEmptyCol = 0
  for (const row of grid) {
    for (let c = row.length - 1; c >= 0; c--) {
      if (row[c]?.trim()) {
        maxNonEmptyCol = Math.max(maxNonEmptyCol, c)
        break
      }
    }
  }

  return grid
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => row.slice(0, maxNonEmptyCol + 1))
}

// ─── Multi-page Merging ────────────────────────────────────────────────────

interface SheetDef {
  name: string
  rows: (string | number)[][]
}

function mergePageTables(tables: PageTable[]): SheetDef[] {
  if (tables.length === 0) return []

  // Check if all tables have the same column count
  const firstCols = tables[0].colCount
  const allSame = tables.every((t) => t.colCount === firstCols)

  if (allSame) {
    // Merge all rows into one sheet
    const allRows: (string | number)[][] = []
    for (const table of tables) {
      allRows.push(...table.rows.map(toNumericRow))
    }
    return [{ name: 'Data', rows: allRows }]
  }

  // Different structures → separate sheets
  return tables.map((table, i) => ({
    name: `Page ${i + 1}`,
    rows: table.rows.map(toNumericRow),
  }))
}

// ─── Numeric Detection ─────────────────────────────────────────────────────

function toNumeric(text: string): string | number {
  // Remove commas and spaces (thousands separators)
  const cleaned = text.replace(/[, ]/g, '').trim()

  // Check if it's a number
  const num = Number(cleaned)
  if (!isNaN(num) && cleaned.length > 0) return num

  return text
}

function toNumericRow(row: string[]): (string | number)[] {
  return row.map(toNumeric)
}

// ─── Worksheet Building ─────────────────────────────────────────────────────

function sheetToWorksheet(
  rows: (string | number)[][],
): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Auto-fit column widths (approximate)
  const colWidths: XLSX.ColInfo[] = []
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const len = String(row[c] ?? '').length
      colWidths[c] = { wch: Math.max(colWidths[c]?.wch ?? 10, Math.min(len + 4, 40)) }
    }
  }
  ws['!cols'] = colWidths

  return ws
}

// ─── Fallback: Plain Text ──────────────────────────────────────────────────

function buildTextFallback(
  allItems: TextItem[],
  pageCount: number,
): Blob {
  const wb = XLSX.utils.book_new()

  const rows = groupIntoRows(allItems)
  const textRows = rows.map((row) => [
    row.map((i) => i.text).join(' '),
  ])

  const ws = XLSX.utils.aoa_to_sheet([['Extracted Text'], ...textRows])
  ws['!cols'] = [{ wch: 80 }]
  XLSX.utils.book_append_sheet(wb, ws, `Text (${pageCount} page${pageCount > 1 ? 's' : ''})`)

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
