import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TextItem {
  text: string
  fontSize: number
  fontName: string
  x: number
  y: number
  width: number
}

interface TextRun_ {
  text: string
  bold: boolean
  italic: boolean
}

interface ContentBlock {
  type: 'heading1' | 'heading2' | 'paragraph' | 'list'
  runs: TextRun_[]
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Y-position tolerance for grouping items into the same line (in points) */
const LINE_TOLERANCE = 2

/** Heading 1 threshold: font size > body × this factor */
const HEADING1_FACTOR = 1.6

/** Heading 2 threshold: font size > body × this factor */
const HEADING2_FACTOR = 1.25

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Convert a PDF file to a .docx Word document.
 *
 * Extracts text content with pdfjs-dist, analyzes structure
 * (headings, lists, bold/italic), and generates an editable .docx.
 *
 * @param file - The PDF File object
 * @param onProgress - Optional callback receiving progress percentage (0-100)
 * @returns The .docx file as a Blob
 */
export async function convertPDFToWord(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  onProgress?.(0)

  // Dynamic import to prevent SSR crashes in Next.js
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  onProgress?.(10)

  // ── Extract text items from all pages ────────────────────────────────
  const allItems: TextItem[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(10 + Math.round(((i - 1) / pdf.numPages) * 30))
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    for (const item of content.items) {
      if (!('str' in item) || !item.str?.trim()) continue

      const transform = item.transform as number[]
      const fontSize = Math.hypot(transform[2], transform[3])

      allItems.push({
        text: item.str,
        fontSize,
        fontName: item.fontName ?? '',
        x: transform[4],
        y: transform[5],
        width: item.width,
      })
    }
  }

  if (allItems.length === 0) {
    throw new Error(
      'No extractable text found in this PDF. It may be an image-only document.',
    )
  }
  onProgress?.(50)

  // ── Detect body font size (most common) ──────────────────────────────
  const fontSizeCounts = new Map<number, number>()
  for (const item of allItems) {
    const rounded = Math.round(item.fontSize * 10) / 10
    fontSizeCounts.set(rounded, (fontSizeCounts.get(rounded) || 0) + 1)
  }
  let bodyFontSize = 12
  let maxCount = 0
  for (const [size, count] of fontSizeCounts) {
    if (count > maxCount) {
      maxCount = count
      bodyFontSize = size
    }
  }
  onProgress?.(55)

  // ── Group items into lines by Y position ─────────────────────────────
  const lines = groupIntoLines(allItems)

  // ── Classify each line into a content block ──────────────────────────
  const blocks = classifyLines(lines, bodyFontSize)
  onProgress?.(70)

  // ── Build .docx document ─────────────────────────────────────────────
  const doc = buildDocx(blocks)
  onProgress?.(90)

  const blob = await Packer.toBlob(doc)
  onProgress?.(100)

  return blob
}

// ─── Line Grouping ──────────────────────────────────────────────────────────

function groupIntoLines(items: TextItem[]): TextItem[][] {
  // Sort by Y descending (top-to-bottom), then X ascending (left-to-right)
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) > LINE_TOLERANCE) return b.y - a.y
    return a.x - b.x
  })

  const lines: TextItem[][] = []
  let currentLine: TextItem[] = []
  let currentY = sorted[0]?.y ?? 0

  for (const item of sorted) {
    if (Math.abs(item.y - currentY) > LINE_TOLERANCE) {
      if (currentLine.length > 0) lines.push(currentLine)
      currentLine = []
      currentY = item.y
    }
    currentLine.push(item)
  }
  if (currentLine.length > 0) lines.push(currentLine)

  return lines
}

// ─── Line Classification ────────────────────────────────────────────────────

function classifyLines(
  lines: TextItem[][],
  bodyFontSize: number,
): ContentBlock[] {
  const blocks: ContentBlock[] = []

  for (const line of lines) {
    const lineText = line.map((i) => i.text).join('').trim()
    if (!lineText) {
      // Empty line = paragraph break
      blocks.push({ type: 'paragraph', runs: [] })
      continue
    }

    const maxFontSize = Math.max(...line.map((i) => i.fontSize))
    const isListItem = isLineAListItem(lineText)

    if (isListItem) {
      blocks.push({
        type: 'list',
        runs: buildRuns(line),
      })
    } else if (maxFontSize > bodyFontSize * HEADING1_FACTOR) {
      blocks.push({
        type: 'heading1',
        runs: buildRuns(line),
      })
    } else if (maxFontSize > bodyFontSize * HEADING2_FACTOR) {
      blocks.push({
        type: 'heading2',
        runs: buildRuns(line),
      })
    } else {
      blocks.push({
        type: 'paragraph',
        runs: buildRuns(line),
      })
    }
  }

  return blocks
}

// ─── List Detection ─────────────────────────────────────────────────────────

function isLineAListItem(text: string): boolean {
  // Bullet lists
  if (/^[•▪▸›»\-–—*]\s/.test(text)) return true

  // Numbered lists: "1.", "1)", "1 -", etc.
  if (/^\d+[.)]\s/.test(text)) return true

  // Lettered lists: "a.", "A)", etc.
  if (/^[a-zA-Z][.)]\s/.test(text)) return true

  return false
}

// ─── Run Building ───────────────────────────────────────────────────────────

function buildRuns(line: TextItem[]): TextRun_[] {
  const runs: TextRun_[] = []

  for (const item of line) {
    // Merge adjacent runs with the same formatting
    const last = runs[runs.length - 1]
    const bold = item.fontName.toLowerCase().includes('bold')
    const italic =
      item.fontName.toLowerCase().includes('italic') ||
      item.fontName.toLowerCase().includes('oblique')

    if (last && last.bold === bold && last.italic === italic) {
      last.text += item.text
    } else {
      runs.push({ text: item.text, bold, italic })
    }
  }

  return runs
}

// ─── .docx Document Builder ─────────────────────────────────────────────────

function buildDocx(blocks: ContentBlock[]): Document {
  const children: Paragraph[] = []

  for (const block of blocks) {
    const textRuns = block.runs.map(
      (r) =>
        new TextRun({
          text: r.text,
          bold: r.bold,
          italics: r.italic,
          font: 'Calibri',
          size: 24, // 12pt in half-points
        }),
    )

    switch (block.type) {
      case 'heading1':
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: textRuns,
          }),
        )
        break
      case 'heading2':
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: textRuns,
          }),
        )
        break
      case 'list':
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: textRuns,
          }),
        )
        break
      case 'paragraph':
        if (block.runs.length === 0) {
          // Empty paragraph = spacing
          children.push(new Paragraph({ children: [] }))
        } else {
          children.push(new Paragraph({ children: textRuns }))
        }
        break
    }
  }

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })
}
