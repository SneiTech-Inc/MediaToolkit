/**
 * Sort Lines — pure line sorting utilities.
 * All functions are pure, synchronous, and side-effect-free.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SortOptions {
  order: 'asc' | 'desc'
  type: 'alphabetical' | 'numerical'
  caseSensitive: boolean
  trimWhitespace: boolean
  removeEmptyLines: boolean
}

export interface SortResult {
  originalLines: string[]
  sortedLines: string[]
  originalCount: number
  sortedCount: number
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULTS: SortOptions = {
  order: 'asc',
  type: 'alphabetical',
  caseSensitive: true,
  trimWhitespace: false,
  removeEmptyLines: false,
}

// ─── Comparison Key ───────────────────────────────────────────────────────────

function comparisonKey(line: string, options: SortOptions): string {
  let key = line
  if (options.trimWhitespace) key = key.trim()
  if (!options.caseSensitive) key = key.toLowerCase()
  return key
}

// ─── Numerical Extraction ─────────────────────────────────────────────────────

function extractNumber(line: string): number | null {
  // Try to parse the entire trimmed line as a number first
  const trimmed = line.trim()
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed)
  }
  // Try to extract the first number found in the line
  const match = trimmed.match(/-?\d+(\.\d+)?/)
  if (match) {
    return parseFloat(match[0])
  }
  return null
}

// ─── Core Function ────────────────────────────────────────────────────────────

export function sortLines(text: string, options: SortOptions): SortResult {
  if (!text) {
    return {
      originalLines: [],
      sortedLines: [],
      originalCount: 0,
      sortedCount: 0,
    }
  }

  // Split into lines
  let lines = text.split('\n')

  // Remove empty lines if enabled
  if (options.removeEmptyLines) {
    lines = lines.filter((line) => line.trim() !== '')
  }

  const originalLines = [...lines]
  const originalCount = lines.length

  // Sort
  const sorted = [...lines].sort((a, b) => {
    const keyA = comparisonKey(a, options)
    const keyB = comparisonKey(b, options)

    let cmp: number

    if (options.type === 'numerical') {
      const numA = extractNumber(keyA)
      const numB = extractNumber(keyB)

      if (numA !== null && numB !== null) {
        cmp = numA - numB
      } else if (numA !== null) {
        cmp = -1 // numbers before non-numbers
      } else if (numB !== null) {
        cmp = 1 // non-numbers after numbers
      } else {
        cmp = keyA.localeCompare(keyB, undefined, { numeric: true, sensitivity: 'base' })
      }
    } else {
      cmp = keyA.localeCompare(keyB, undefined, { sensitivity: 'base' })
    }

    return options.order === 'desc' ? -cmp : cmp
  })

  return {
    originalLines,
    sortedLines: sorted,
    originalCount,
    sortedCount: sorted.length,
  }
}
