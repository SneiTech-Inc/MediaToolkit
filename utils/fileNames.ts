const BRAND_PREFIX = 'savevex.com - '

/**
 * Generate a branded download filename for a single-file operation.
 * Prepends the SaveVex brand prefix to the given filename.
 *
 * Operation suffixes (like "-compressed", "-bordered") should be dropped
 * by the caller before passing the name — just pass the clean filename
 * with the correct output extension.
 *
 * @param originalName - The filename to brand (e.g. "report.pdf", "photo.jpg").
 * @returns "savevex.com - report.pdf"
 *
 * @example
 * getSaveVexFileName('report.pdf')             // "savevex.com - report.pdf"
 * getSaveVexFileName(file.name)                 // preserve original name
 * getSaveVexFileName(`${baseName}.jpg`)         // with new extension
 * getSaveVexFileName('converted-text.txt')      // hardcoded fallback names
 */
export function getSaveVexFileName(originalName: string): string {
  if (originalName.startsWith(BRAND_PREFIX)) return originalName
  return `${BRAND_PREFIX}${originalName}`
}

/**
 * Generate a branded download filename for a merged output file.
 * Use when there is no single original file to reference.
 *
 * @param extension - File extension without leading dot (e.g. "pdf", "zip").
 * @returns "savevex.com - merged.pdf"
 */
export function getSaveVexMergedFileName(extension: string): string {
  const ext = extension.replace(/^\./, '')
  return `${BRAND_PREFIX}merged.${ext}`
}

/**
 * Generate a branded download filename for a split or extracted part.
 *
 * @param originalName - Name of the original source file (e.g. "document.pdf").
 * @param partLabel - Descriptive label for this part (e.g. "extracted", "part-1", "page-3").
 * @param outputExtension - Optional override for the output extension.
 *   When omitted, the original file's extension is used.
 *   Use this when the output format differs from the input (e.g. PDF→JPG).
 * @returns "savevex.com - document - extracted.pdf"
 *
 * @example
 * getSaveVexSplitFileName('report.pdf', 'extracted')            // "savevex.com - report - extracted.pdf"
 * getSaveVexSplitFileName('report.pdf', 'part-1')               // "savevex.com - report - part-1.pdf"
 * getSaveVexSplitFileName('report.pdf', 'page-1', 'jpg')        // "savevex.com - report - page-1.jpg"
 * getSaveVexSplitFileName('report.pdf', 'all-pages', 'zip')     // "savevex.com - report - all-pages.zip"
 */
export function getSaveVexSplitFileName(
  originalName: string,
  partLabel: string,
  outputExtension?: string
): string {
  const base = originalName.replace(/\.[^.]+$/, '')
  const ext = outputExtension || originalName.split('.').pop() || 'pdf'
  return `${BRAND_PREFIX}${base} - ${partLabel}.${ext}`
}
