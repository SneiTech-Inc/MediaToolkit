import { PDFDocument, degrees } from 'pdf-lib'

export interface PageRotation {
  /** 0-indexed page number */
  pageIndex: number
  /** Target absolute rotation angle in degrees */
  rotation: 0 | 90 | 180 | 270
}

/**
 * Apply absolute rotation angles to specific pages in a PDF.
 * Uses pdf-lib's `setRotation(degrees(angle))` — sets the
 * rotation directly, independent of any prior rotation.
 *
 * @returns The modified PDF as a Uint8Array ready for download.
 */
export async function rotatePDFPages(
  file: File,
  rotations: PageRotation[],
): Promise<Uint8Array> {
  const buf = await file.arrayBuffer()
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true })

  for (const { pageIndex, rotation } of rotations) {
    const page = pdf.getPage(pageIndex)
    page.setRotation(degrees(rotation))
  }

  return await pdf.save()
}
