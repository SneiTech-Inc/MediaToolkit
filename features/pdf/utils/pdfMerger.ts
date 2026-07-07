import { PDFDocument } from 'pdf-lib'

/** Get the page count of a PDF file without fully processing it. */
export async function getPdfPageCount(file: File): Promise<number> {
  const buf = await file.arrayBuffer()
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true })
  return pdf.getPageCount()
}

/**
 * Merge multiple PDF files into a single PDF document.
 * Pages are appended in the order the files appear in the array.
 */
export async function mergePDFs(
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  const merged = await PDFDocument.create()

  for (let i = 0; i < files.length; i++) {
    onProgress?.(i + 1, files.length)
    const buf = await files[i].arrayBuffer()
    const pdf = await PDFDocument.load(buf, { ignoreEncryption: true })
    const pageIndices = pdf.getPageIndices()
    const pages = await merged.copyPages(pdf, pageIndices)
    pages.forEach((page) => merged.addPage(page))
  }

  return await merged.save()
}
