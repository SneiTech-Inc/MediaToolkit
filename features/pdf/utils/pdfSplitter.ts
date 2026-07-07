import { PDFDocument } from 'pdf-lib'

/** Parse "1,3,5-7" → zero-based indices [0, 2, 4, 5, 6] */
export function parsePageInput(input: string, totalPages: number): number[] {
  const indices = new Set<number>()
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean)

  for (const part of parts) {
    if (part.includes('-')) {
      const [s, e] = part.split('-').map(Number)
      if (isNaN(s) || isNaN(e) || s < 1 || e > totalPages || s > e) {
        throw new Error(`Invalid range: ${part}. Pages must be between 1 and ${totalPages}.`)
      }
      for (let i = s; i <= e; i++) indices.add(i - 1)
    } else {
      const n = Number(part)
      if (isNaN(n) || n < 1 || n > totalPages) {
        throw new Error(`Invalid page: ${part}. Pages must be between 1 and ${totalPages}.`)
      }
      indices.add(n - 1)
    }
  }

  if (indices.size === 0) throw new Error('No valid pages specified.')
  return Array.from(indices).sort((a, b) => a - b)
}

/** Parse "1-3,4-6" → zero-based ranges [[0,2],[3,5]] */
export function parseRangeInput(input: string, totalPages: number): [number, number][] {
  const ranges: [number, number][] = []
  const parts = input.split(',').map((s) => s.trim()).filter(Boolean)

  for (const part of parts) {
    if (!part.includes('-')) throw new Error(`Invalid range: "${part}". Use format like "1-3".`)
    const [s, e] = part.split('-').map(Number)
    if (isNaN(s) || isNaN(e) || s < 1 || e > totalPages || s > e) {
      throw new Error(`Invalid range: "${part}". Pages must be between 1 and ${totalPages}.`)
    }
    ranges.push([s - 1, e - 1])
  }

  if (ranges.length === 0) throw new Error('No valid ranges specified.')
  return ranges
}

/** Extract specific pages from a PDF into a new single PDF. */
export async function extractPages(
  file: File,
  pageIndices: number[]
): Promise<Uint8Array> {
  const buf = await file.arrayBuffer()
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true })
  const newPdf = await PDFDocument.create()
  const pages = await newPdf.copyPages(pdf, pageIndices)
  pages.forEach((page) => newPdf.addPage(page))
  return await newPdf.save()
}

/** Split a PDF into multiple PDFs, one per page range. */
export async function splitByRanges(
  file: File,
  ranges: [number, number][]
): Promise<{ name: string; data: Uint8Array; pages: string }[]> {
  const buf = await file.arrayBuffer()
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true })
  const results: { name: string; data: Uint8Array; pages: string }[] = []

  for (let i = 0; i < ranges.length; i++) {
    const [start, end] = ranges[i]
    const pageIndices = Array.from({ length: end - start + 1 }, (_, j) => start + j)
    const newPdf = await PDFDocument.create()
    const pages = await newPdf.copyPages(pdf, pageIndices)
    pages.forEach((page) => newPdf.addPage(page))
    const data = await newPdf.save()
    results.push({
      name: `split-${i + 1}.pdf`,
      data,
      pages: start === end ? `Page ${start + 1}` : `Pages ${start + 1}–${end + 1}`,
    })
  }

  return results
}
