// ─── Types ─────────────────────────────────────────────────────────────────

export interface MarkdownResult {
  markdown: string
  pages: number
  words: number
  characters: number
  headings: number
  lists: number
}

interface TextItem {
  str: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontName: string
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function convertPDFToMarkdown(file: File): Promise<MarkdownResult> {
  const { getDocument } = await import('pdfjs-dist')

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const pageCount = pdf.numPages

  const allLines: { text: string; fontSize: number; fontName: string; y: number }[] = []

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()

    // Filter to only TextItem objects (exclude TextMarkedContent)
    const textItems = textContent.items.filter(
      (item): item is import('pdfjs-dist/types/src/display/api').TextItem => 'str' in item && 'transform' in item,
    )

    const items: TextItem[] = textItems.map((item) => {
      const tx = item.transform as number[]
      return {
        str: item.str,
        x: tx[4],
        y: tx[5],
        width: item.width,
        height: item.height,
        fontSize: Math.abs(tx[0]) || 12,
        fontName: item.fontName || '',
      }
    })

    // Group items into lines by Y proximity
    const sorted = items.sort((a, b) => b.y - a.y || a.x - b.x) // top-to-bottom, left-to-right
    const lines = groupIntoLines(sorted)

    for (const line of lines) {
      const fontSize = line[0]?.fontSize ?? 12
      const fontName = line[0]?.fontName ?? ''
      const y = line[0]?.y ?? 0
      const text = line.map((item) => item.str).join(' ').trim()
      if (text) allLines.push({ text, fontSize, fontName, y })
    }
  }

  // Convert lines to Markdown
  let headings = 0
  let lists = 0
  const mdLines: string[] = []
  let prevY = -Infinity

  for (const line of allLines) {
    const { text, fontSize, fontName } = line
    const isBold = /bold|heavy|black/i.test(fontName)

    // Detect headings by font size
    if ((fontSize > 16 || (fontSize > 14 && isBold)) && text.length < 200) {
      const level = fontSize > 22 ? 1 : fontSize > 18 ? 2 : 3
      mdLines.push(`${'#'.repeat(level)} ${text}`)
      mdLines.push('')
      headings++
      prevY = line.y
      continue
    }

    // Detect bullet lists
    const bulletMatch = text.match(/^([•·◦▪▫○◆◇■□➤›»\-–—])\s+(.+)/)
    if (bulletMatch) {
      mdLines.push(`- ${bulletMatch[2]}`)
      lists++
      prevY = line.y
      continue
    }

    // Detect numbered lists
    const numMatch = text.match(/^(\d+)[.)]\s+(.+)/)
    if (numMatch) {
      mdLines.push(`${numMatch[1]}. ${numMatch[2]}`)
      lists++
      prevY = line.y
      continue
    }

    // Gap detection: larger than 1.5x line height = paragraph break
    if (prevY !== -Infinity && Math.abs(line.y - prevY) > line.fontSize * 1.8) {
      mdLines.push('')
    }

    mdLines.push(text)
    prevY = line.y
  }

  // Clean up
  const markdown = cleanMarkdown(mdLines.join('\n'))

  const words = markdown.split(/\s+/).filter(Boolean).length
  const characters = markdown.replace(/\s/g, '').length

  return { markdown, pages: pageCount, words, characters, headings, lists }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function groupIntoLines(items: TextItem[]): TextItem[][] {
  if (items.length === 0) return []
  const lines: TextItem[][] = [[items[0]]]

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]
    const curr = items[i]
    const prevLine = lines[lines.length - 1]

    // Same line if Y is within half the font height
    const threshold = Math.min(prev.height, curr.height) * 0.5
    if (Math.abs(curr.y - prev.y) < threshold) {
      prevLine.push(curr)
    } else {
      lines.push([curr])
    }
  }

  // Sort items within each line left-to-right
  return lines.map((line) => line.sort((a, b) => a.x - b.x))
}

function cleanMarkdown(text: string): string {
  return text
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    // Remove trailing whitespace
    .replace(/[ \t]+$/gm, '')
    // Ensure single trailing newline
    .trim() + '\n'
}
