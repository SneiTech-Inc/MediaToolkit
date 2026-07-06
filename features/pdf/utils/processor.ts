/**
 * PDF processing utilities.
 * Heavy libraries (pdf-lib, pdfjs) will be dynamically imported here in Phase 2.
 *
 * @example
 *   const { PDFDocument } = await import('pdf-lib')
 */
export async function createPdfProcessor() {
  // TODO: Lazy-load pdf-lib when PDF tool logic is implemented
  throw new Error('PDF processing is not yet implemented.')
}

/**
 * Merge multiple PDF files into one.
 * Will use pdf-lib's PDFDocument for in-browser processing.
 */
export async function mergePdfs(_files: File[]): Promise<Blob> {
  const processor = await createPdfProcessor()
  throw new Error('mergePdfs is not yet implemented.')
}
