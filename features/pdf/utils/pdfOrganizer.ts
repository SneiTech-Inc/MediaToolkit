import { PDFDocument, degrees } from 'pdf-lib'

export interface PageItem {
  /** 0-indexed position in the source PDF */
  originalIndex: number
  /** Cumulative rotation to apply (0, 90, 180, 270) */
  rotation: 0 | 90 | 180 | 270
}

/**
 * Rebuild a PDF by copying pages from the source in a new order,
 * applying rotations, and omitting deleted pages.
 *
 * @param file - Source PDF file
 * @param pages - Ordered list of pages to include (already filtered + sorted)
 * @returns The reorganized PDF as a Uint8Array
 */
export async function reorganizePDF(
  file: File,
  pages: PageItem[],
): Promise<Uint8Array> {
  const buf = await file.arrayBuffer()
  const source = await PDFDocument.load(buf, { ignoreEncryption: true })
  const result = await PDFDocument.create()

  for (const page of pages) {
    const [copied] = await result.copyPages(source, [page.originalIndex])
    if (page.rotation !== 0) {
      copied.setRotation(degrees(page.rotation))
    }
    result.addPage(copied)
  }

  return await result.save()
}
