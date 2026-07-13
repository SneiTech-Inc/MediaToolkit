import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  PageBreak,
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
  type: 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'list' | 'pagebreak';
  runs: TextRun_[];
  alignment?: 'left' | 'center' | 'right'; // ← NEW
}

export interface ConvertResult {
  blob: Blob
  hasImages: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

const LINE_TOLERANCE = 2
const HEADING1_FACTOR = 1.6
const HEADING2_FACTOR = 1.25

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Convert a PDF file to a .docx Word document.
 *
 * Text is grouped into lines and classified PER PAGE — pages are never
 * mixed together during ordering, since PDF Y-coordinates reset on every
 * page and sorting across pages by raw Y value scrambles reading order.
 *
 * @returns The .docx blob, plus whether any images were detected (and
 * therefore omitted) so the caller can warn the user.
 */
export async function convertPDFToWord(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ConvertResult> {
  onProgress?.(0)

  const pdfjsLib = await import('pdfjs-dist')
  // Self-hosted worker — no third-party CDN dependency
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  onProgress?.(10)

  const IMAGE_OPS = new Set([
    pdfjsLib.OPS.paintImageXObject,
    pdfjsLib.OPS.paintImageMaskXObject,
  ])

  const pageItemsList: { items: TextItem[]; pageWidth: number }[] = []
  const allItems: TextItem[] = []
  let hasImages = false

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(10 + Math.round(((i - 1) / pdf.numPages) * 30))
    const page = await pdf.getPage(i)

    const viewport = page.getViewport({ scale: 1 })
    const pageWidth = viewport.width;

    const [content, opList] = await Promise.all([
      page.getTextContent(),
      page.getOperatorList(),
    ])

    if (opList.fnArray.some((fn) => IMAGE_OPS.has(fn))) {
      hasImages = true
    }

    const pageItems: TextItem[] = []
    for (const item of content.items) {
      if (!('str' in item) || !item.str?.trim()) continue
      const transform = item.transform as number[]
      const fontSize = Math.hypot(transform[2], transform[3])
      const textItem: TextItem = {
        text: item.str,
        fontSize,
        fontName: item.fontName ?? '',
        x: transform[4],
        y: transform[5],
        width: item.width,
      }
      pageItems.push(textItem)
      allItems.push(textItem)
    }
    pageItemsList.push({ items: pageItems, pageWidth })
  }

  if (allItems.length === 0) {
    throw new Error(
      'No extractable text found in this PDF. It may be an image-only document.',
    )
  }
  onProgress?.(50)

  // Body font size computed globally, for consistent heading detection
  // across the whole document — this part was fine, kept as-is.
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

  // Group + classify PER PAGE, then concatenate in page order with an
  // explicit page break between them — this is the fix for scrambled
  // multi-page ordering.
  const allBlocks: ContentBlock[] = []
  for (let p = 0; p < pageItemsList.length; p++) {
    const { items, pageWidth } = pageItemsList[p]
    if (items.length === 0) continue

    if (p > 0) {
      allBlocks.push({ type: 'pagebreak', runs: [] })
    }

    const lines = groupIntoLines(items)
    const blocks = classifyLines(lines, bodyFontSize, pageWidth)
    allBlocks.push(...blocks)
  }
  onProgress?.(70)

  const doc = buildDocx(allBlocks)
  onProgress?.(90)

  const blob = await Packer.toBlob(doc)
  onProgress?.(100)

  return { blob, hasImages }
}

// ─── Alignment Detection ─────────────────────────────────────────────────────
type Alignment = 'left' | 'center' | 'right';

function detectAlignment(line: TextItem[], pageWidth: number): Alignment {
  if (line.length === 0) return 'left';
  
  // Get the min and max X positions of text items on this line
  const minX = Math.min(...line.map(i => i.x));
  const maxX = Math.max(...line.map(i => i.x + i.width));
  const lineWidth = maxX - minX;
  
  // Page width is the full page width (from PDF metadata)
  // If line is roughly centered, classify as center
  const leftMargin = minX;
  const rightMargin = pageWidth - maxX;
  
  const centerThreshold = pageWidth * 0.15; // 15% tolerance for centering
  
  // If left and right margins are roughly equal and both > 0, it's centered
  if (Math.abs(leftMargin - rightMargin) < centerThreshold && leftMargin > 20 && rightMargin > 20) {
    return 'center';
  }
  
  // If right margin is large and left margin is small, it's left-aligned (default)
  if (leftMargin < rightMargin * 0.5) {
    return 'left';
  }
  
  // If left margin is large and right margin is small, it's right-aligned
  if (rightMargin < leftMargin * 0.5) {
    return 'right';
  }
  
  return 'left';
}

// ─── Gap-Aware Space Insertion ──────────────────────────────────────────────
/**
 * Decide if a real word-space belongs between two text items.
 * PDFs often represent spaces as geometric gaps rather than literal space characters.
 */
function needsSpaceBetween(prev: TextItem, curr: TextItem): boolean {
  const gap = curr.x - (prev.x + prev.width);
  const threshold = Math.max(prev.fontSize, curr.fontSize) * 0.2;
  return gap > threshold;
}

/**
 * Get the full line text with spaces inserted where geometric gaps exist.
 */
function getLineText(line: TextItem[]): string {
  let result = '';
  for (let i = 0; i < line.length; i++) {
    const item = line[i];
    if (i > 0 && needsSpaceBetween(line[i - 1], item) && !result.endsWith(' ')) {
      result += ' ';
    }
    result += item.text;
  }
  return result;
}

// ─── Font-Size-Relative Line Tolerance ──────────────────────────────────────

/**
 * Determine if two text items belong on the same line.
 * Uses a tolerance that scales with font size to absorb superscripts/subscripts
 * without merging genuinely separate lines.
 */
function sameLine(a: TextItem, b: TextItem): boolean {
  const tolerance = Math.max(2.5, Math.min(a.fontSize, b.fontSize) * 0.6);
  return Math.abs(a.y - b.y) <= tolerance;
}

// ─── Group Into Lines (Font-Size-Relative) ──────────────────────────────────
function groupIntoLines(items: TextItem[]): TextItem[][] {
  const sorted = [...items].sort((a, b) => {
    if (!sameLine(a, b)) return b.y - a.y;
    return a.x - b.x;
  });

  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [];
  let currentAnchor = sorted[0];

  for (const item of sorted) {
    if (currentAnchor && !sameLine(item, currentAnchor)) {
      if (currentLine.length > 0) lines.push(currentLine);
      currentLine = [];
      currentAnchor = item;
    }
    currentLine.push(item);
  }
  if (currentLine.length > 0) lines.push(currentLine);

  return lines;
}

// ─── Line Classification — heading check now runs BEFORE list check ─────────
function classifyLines(
  lines: TextItem[][],
  bodyFontSize: number,
  pageWidth: number,
): ContentBlock[] {
  const blocks: ContentBlock[] = []

  for (const line of lines) {
    const lineText = getLineText(line).trim();
    if (!lineText) {
      blocks.push({ type: 'paragraph', runs: [], alignment: 'left' })
      continue
    }

    const maxFontSize = Math.max(...line.map((i) => i.fontSize))
    const alignment = detectAlignment(line, pageWidth);

    // Font size is checked FIRST. A numbered heading like "1. Introduction"
    // must stay a heading, not get swallowed into bullet-list formatting
    // just because it happens to start with a digit and a period.
    if (maxFontSize > bodyFontSize * HEADING1_FACTOR) {
      blocks.push({ type: 'heading1', runs: buildRuns(line), alignment })
    } else if (maxFontSize > bodyFontSize * HEADING2_FACTOR) {
      blocks.push({ type: 'heading2', runs: buildRuns(line), alignment })
    } else if (
      line.every((i) => i.fontName.toLowerCase().includes('bold')) &&
      lineText.split(/\s+/).length <= 12
    ) {
      blocks.push({ type: 'heading3', runs: buildRuns(line), alignment })
    } else if (isLineAListItem(lineText)) {
      // Strip bullet prefix from the line text
      let cleanedText = lineText;
      // Remove common bullet patterns
      cleanedText = cleanedText.replace(/^[•▪▸›»\-–—*]\s+/, '');
      cleanedText = cleanedText.replace(/^\d+[.)]\s+/, '');
      cleanedText = cleanedText.replace(/^[a-zA-Z][.)]\s+/, '');
      
      // Create a single run with the cleaned text using the first item's style
      const firstItem = line[0];
      const run = {
        text: cleanedText,
        bold: firstItem.fontName.toLowerCase().includes('bold'),
        italic: firstItem.fontName.toLowerCase().includes('italic') || firstItem.fontName.toLowerCase().includes('oblique'),
      };
      
      blocks.push({ type: 'list', runs: [run], alignment: 'left' });
    } else {
      blocks.push({ type: 'paragraph', runs: buildRuns(line), alignment })
    }
  }

  return blocks
}

function isLineAListItem(text: string): boolean {
  if (/^[•▪▸›»\-–—*]\s/.test(text)) return true
  if (/^\d+[.)]\s/.test(text)) return true
  if (/^[a-zA-Z][.)]\s/.test(text)) return true
  return false
}

// ─── Build Text Runs (Gap-Aware) ────────────────────────────────────────────

function buildRuns(line: TextItem[]): TextRun_[] {
  const runs: TextRun_[] = [];

  for (let i = 0; i < line.length; i++) {
    const item = line[i];
    const bold = item.fontName.toLowerCase().includes('bold');
    const italic =
      item.fontName.toLowerCase().includes('italic') ||
      item.fontName.toLowerCase().includes('oblique');

    const last = runs[runs.length - 1];
    const needsSpace =
      i > 0 && needsSpaceBetween(line[i - 1], item) && !item.text.startsWith(' ');

    if (last && last.bold === bold && last.italic === italic) {
      // Same style — add space if needed
      if (needsSpace && !last.text.endsWith(' ')) last.text += ' ';
      last.text += item.text;
    } else {
      // Style changed — a real word-gap here must still get a space
      if (last && needsSpace && !last.text.endsWith(' ')) last.text += ' ';
      runs.push({ text: item.text, bold, italic });
    }
  }

  return runs;
}

// ─── .docx Document Builder — explicit spacing restored per block type ──────

function buildDocx(blocks: ContentBlock[]): Document {
  const children: Paragraph[] = []

  for (const block of blocks) {
    if (block.type === 'pagebreak') {
      children.push(new Paragraph({ children: [new PageBreak()] }))
      continue
    }

    const textRuns = block.runs.map(
      (r) =>
        new TextRun({
          text: r.text,
          bold: r.bold,
          italics: r.italic,
          font: 'Calibri',
          size: 24,
        }),
    )

    const alignment = block.alignment || 'left';
    const alignMap = {
      left: 'left' as const,
      center: 'center' as const,
      right: 'right' as const,
    }

    switch (block.type) {
      case 'heading1':
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: textRuns,
            alignment: alignMap[alignment],
            spacing: { before: 240, after: 120 },
          }),
        )
        break
      case 'heading2':
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: textRuns,
            alignment: alignMap[alignment],
            spacing: { before: 200, after: 100 },
          }),
        )
        break
      case 'heading3':
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: textRuns,
            alignment: alignMap[alignment],
            spacing: { before: 160, after: 80 },
          }),
        )
        break
      case 'list':
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            children: textRuns,
            alignment: 'left',
            spacing: { before: 40, after: 40 },
          }),
        )
        break
      case 'paragraph':
        if (block.runs.length === 0) {
          children.push(new Paragraph({ children: [], alignment: alignMap[alignment], spacing: { after: 120 } }))
        } else {
          children.push(
            new Paragraph({
              children: textRuns,
              alignment: alignMap[alignment],
              spacing: { before: 80, after: 120 },
            }),
          )
        }
        break
    }
  }

  return new Document({ sections: [{ properties: {}, children }] })
}