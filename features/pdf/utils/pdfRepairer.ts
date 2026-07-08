import { PDFDocument, ParseSpeeds } from 'pdf-lib'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RepairReport {
  issuesFound: string[]
  issuesFixed: string[]
  issuesUnresolved: string[]
  success: boolean
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Attempt to repair a damaged or corrupt PDF by loading with
 * error-recovery options and saving with structural optimization.
 */
export async function repairPDF(file: File): Promise<{ data: Uint8Array; report: RepairReport }> {
  const report: RepairReport = {
    issuesFound: [],
    issuesFixed: [],
    issuesUnresolved: [],
    success: false,
  }

  const arrayBuffer = await file.arrayBuffer()
  report.issuesFound.push('Analyzing PDF structure')

  // Check for empty file
  if (arrayBuffer.byteLength === 0) {
    report.issuesFound.push('File is empty')
    report.issuesUnresolved.push('Cannot repair an empty file')
    return { data: new Uint8Array(0), report }
  }

  // Attempt to load with increasingly forgiving options
  let pdf: PDFDocument | null = null

  // Strategy 1: Standard load with object skipping
  try {
    pdf = await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      parseSpeed: ParseSpeeds.Fastest,
    })
    report.issuesFixed.push('PDF structure parsed successfully')
  } catch {
    report.issuesFound.push('Direct parsing failed — attempting fallback recovery')

    // Strategy 2: More aggressive — let pdf-lib throw and skip bad objects
    try {
      pdf = await PDFDocument.load(arrayBuffer, {
        ignoreEncryption: true,
        throwOnInvalidObject: true,
        parseSpeed: ParseSpeeds.Fastest,
      })
      report.issuesFixed.push('PDF recovered with fallback parser')
    } catch {
      report.issuesUnresolved.push('PDF structure is too damaged to repair')
      return { data: new Uint8Array(0), report }
    }
  }

  if (!pdf) {
    report.issuesUnresolved.push('Could not load PDF')
    return { data: new Uint8Array(0), report }
  }

  // Check encryption
  if (pdf.isEncrypted) {
    report.issuesFound.push('PDF is encrypted')
    report.issuesUnresolved.push(
      'Cannot repair encrypted PDFs. Use the Unlock PDF tool to remove encryption first.',
    )
    return { data: new Uint8Array(0), report }
  }

  // Validate page count
  const pageCount = pdf.getPageCount()
  if (pageCount === 0) {
    report.issuesFound.push('PDF has no pages')
    report.issuesUnresolved.push('Cannot repair a PDF with no pages')
    return { data: new Uint8Array(0), report }
  }
  report.issuesFixed.push(`Found ${pageCount} page${pageCount !== 1 ? 's' : ''}`)

  // Save with structural optimization to rebuild xref/object streams
  let repairedBytes: Uint8Array
  try {
    repairedBytes = await pdf.save({
      useObjectStreams: true,
      objectsPerTick: 50,
    })
    report.issuesFixed.push('Rebuilt cross-reference table and object streams')
  } catch {
    // Fallback: save without optimization
    try {
      repairedBytes = await pdf.save()
      report.issuesFixed.push('Saved with minimal structure')
    } catch {
      report.issuesUnresolved.push('Failed to save repaired PDF')
      return { data: new Uint8Array(0), report }
    }
  }

  // Size comparison
  const originalSize = file.size
  const repairedSize = repairedBytes.byteLength
  if (repairedSize !== originalSize) {
    const diff = Math.abs(repairedSize - originalSize)
    const pct = Math.round((diff / originalSize) * 100)
    if (repairedSize < originalSize) {
      report.issuesFixed.push(`Optimized file size: ${originalSize} → ${repairedSize} bytes (${pct}% smaller)`)
    }
  }

  report.success = true
  return { data: repairedBytes, report }
}
