/**
 * Remove Duplicates — pure line deduplication utilities.
 * All functions are pure, synchronous, and side-effect-free.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RemoveDuplicatesOptions {
  caseSensitive: boolean
  trimWhitespace: boolean
  removeEmptyLines: boolean
}

export interface RemoveDuplicatesResult {
  originalLines: string[]
  uniqueLines: string[]
  originalCount: number
  uniqueCount: number
  duplicatesRemoved: number
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULTS: RemoveDuplicatesOptions = {
  caseSensitive: true,
  trimWhitespace: false,
  removeEmptyLines: false,
}

// ─── Core Function ────────────────────────────────────────────────────────────

export function removeDuplicates(
  text: string,
  options: RemoveDuplicatesOptions
): RemoveDuplicatesResult {
  if (!text) {
    return {
      originalLines: [],
      uniqueLines: [],
      originalCount: 0,
      uniqueCount: 0,
      duplicatesRemoved: 0,
    }
  }

  // Split into lines
  let lines = text.split('\n')

  // Remove empty lines if enabled (before dedup so blank lines don't count)
  if (options.removeEmptyLines) {
    lines = lines.filter((line) => line.trim() !== '')
  }

  const originalCount = lines.length

  // Deduplicate preserving order (keep first occurrence)
  const seen = new Set<string>()
  const uniqueLines: string[] = []

  for (const line of lines) {
    // Build a comparison key based on options
    let comparisonKey = line

    if (options.trimWhitespace) {
      comparisonKey = comparisonKey.trim()
    }

    if (!options.caseSensitive) {
      comparisonKey = comparisonKey.toLowerCase()
    }

    if (!seen.has(comparisonKey)) {
      seen.add(comparisonKey)
      uniqueLines.push(line) // preserve original formatting
    }
  }

  return {
    originalLines: lines,
    uniqueLines,
    originalCount,
    uniqueCount: uniqueLines.length,
    duplicatesRemoved: originalCount - uniqueLines.length,
  }
}
