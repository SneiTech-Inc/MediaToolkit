import PptxGenJS from 'pptxgenjs'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TextItem {
  text: string
  fontSize: number
  fontName: string
  x: number
  y: number
}

interface TextRun {
  text: string
  bold: boolean
  italic: boolean
}

interface ContentLine {
  type: 'heading1' | 'heading2' | 'paragraph' | 'bullet' | 'numbered'
  runs: TextRun[]
}

// ─── Constants ──────────────────────────────────────────────────────────────

const LINE_TOLERANCE = 2
const HEADING1_FACTOR = 1.6
const HEADING2_FACTOR = 1.25

// ─── Public API ─────────────────────────────────────────────────────────────

export async function convertPDFToPPT(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  onProgress?.(0)

  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  onProgress?.(10)

  // ── Extract text items ──────────────────────────────────────────────
  const allItems: TextItem[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(10 + Math.round(((i - 1) / pdf.numPages) * 20))
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    for (const item of content.items) {
      if (!('str' in item) || !item.str?.trim()) continue
      const transform = item.transform as number[]
      allItems.push({
        text: item.str,
        fontSize: Math.hypot(transform[2], transform[3]),
        fontName: item.fontName ?? '',
        x: transform[4],
        y: transform[5],
      })
    }
  }

  if (allItems.length === 0) {
    throw new Error('No extractable text found in this PDF.')
  }
  onProgress?.(40)

  // ── Detect body font size ───────────────────────────────────────────
  const sizeCounts = new Map<number, number>()
  for (const item of allItems) {
    const rounded = Math.round(item.fontSize * 10) / 10
    sizeCounts.set(rounded, (sizeCounts.get(rounded) || 0) + 1)
  }
  let bodySize = 12
  let maxCount = 0
  for (const [size, count] of sizeCounts) {
    if (count > maxCount) { maxCount = count; bodySize = size }
  }

  // ── Build slides — one per PDF page ─────────────────────────────────
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'

  // Group items by page (approximate: items are already ordered by page in allItems)
  // For simplicity, process all items in page order
  const totalPages = pdf.numPages

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.(40 + Math.round(((i - 1) / totalPages) * 55))

    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageItems: TextItem[] = []

    for (const item of content.items) {
      if (!('str' in item) || !item.str?.trim()) continue
      const transform = item.transform as number[]
      pageItems.push({
        text: item.str,
        fontSize: Math.hypot(transform[2], transform[3]),
        fontName: item.fontName ?? '',
        x: transform[4],
        y: transform[5],
      })
    }

    const slide = pptx.addSlide()
    const lines = groupAndClassify(pageItems, bodySize)
    addTextToSlide(slide, lines)
  }
  onProgress?.(95)

  const blob = (await pptx.write({ outputType: 'blob' })) as Blob
  onProgress?.(100)
  return blob
}

// ─── Line Grouping & Classification ────────────────────────────────────────

function groupAndClassify(
  items: TextItem[],
  bodySize: number,
): ContentLine[] {
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) > LINE_TOLERANCE) return b.y - a.y
    return a.x - b.x
  })

  const lineItems: TextItem[][] = []
  let current: TextItem[] = []
  let currentY = sorted[0]?.y ?? 0

  for (const item of sorted) {
    if (Math.abs(item.y - currentY) > LINE_TOLERANCE) {
      if (current.length > 0) lineItems.push(current)
      current = []
      currentY = item.y
    }
    current.push(item)
  }
  if (current.length > 0) lineItems.push(current)

  const lines: ContentLine[] = []

  for (const line of lineItems) {
    const text = line.map((i) => i.text).join('').trim()
    if (!text) { lines.push({ type: 'paragraph', runs: [] }); continue }

    const maxSize = Math.max(...line.map((i) => i.fontSize))

    if (isListItem(text)) {
      if (/^\d+[.)]\s/.test(text)) {
        lines.push({ type: 'numbered', runs: buildRuns(line) })
      } else {
        lines.push({ type: 'bullet', runs: buildRuns(line) })
      }
    } else if (maxSize > bodySize * HEADING1_FACTOR) {
      lines.push({ type: 'heading1', runs: buildRuns(line) })
    } else if (maxSize > bodySize * HEADING2_FACTOR) {
      lines.push({ type: 'heading2', runs: buildRuns(line) })
    } else {
      lines.push({ type: 'paragraph', runs: buildRuns(line) })
    }
  }

  return lines
}

function isListItem(text: string): boolean {
  return /^[•▪▸›»\-–—*]\s/.test(text)
    || /^\d+[.)]\s/.test(text)
    || /^[a-zA-Z][.)]\s/.test(text)
}

function buildRuns(line: TextItem[]): TextRun[] {
  const runs: TextRun[] = []
  for (const item of line) {
    const bold = item.fontName.toLowerCase().includes('bold')
    const italic =
      item.fontName.toLowerCase().includes('italic') ||
      item.fontName.toLowerCase().includes('oblique')
    const last = runs[runs.length - 1]
    if (last && last.bold === bold && last.italic === italic) {
      last.text += item.text
    } else {
      runs.push({ text: item.text, bold, italic })
    }
  }
  return runs
}

// ─── Slide Content ─────────────────────────────────────────────────────────

function addTextToSlide(slide: PptxGenJS.Slide, lines: ContentLine[]): void {
  const textParts: { text: string; options: PptxGenJS.TextPropsOptions }[] = []

  for (const line of lines) {
    if (line.runs.length === 0) {
      textParts.push({ text: '\n', options: { fontSize: 12 } })
      continue
    }

    switch (line.type) {
      case 'heading1':
        textParts.push({
          text: runsToText(line.runs) + '\n',
          options: { fontSize: 36, bold: true, breakType: 'none' },
        })
        break
      case 'heading2':
        textParts.push({
          text: runsToText(line.runs) + '\n',
          options: { fontSize: 28, bold: true, breakType: 'none' },
        })
        break
      case 'bullet':
        textParts.push({
          text: '• ' + runsToText(line.runs) + '\n',
          options: { fontSize: 16, bullet: true, breakType: 'none' },
        })
        break
      case 'numbered':
        textParts.push({
          text: runsToText(line.runs) + '\n',
          options: { fontSize: 16, breakType: 'none' },
        })
        break
      default:
        textParts.push({
          text: runsToText(line.runs) + '\n',
          options: { fontSize: 16, breakType: 'none' },
        })
        break
    }
  }

  if (textParts.length > 0) {
    slide.addText(textParts, {
      x: 0.5,
      y: 0.5,
      w: '90%',
      h: '90%',
      valign: 'top',
      autoFit: true,
    })
  }
}

function runsToText(runs: TextRun[]): string {
  return runs.map((r) => r.text).join('')
}
