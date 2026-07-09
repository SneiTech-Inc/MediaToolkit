/**
 * JSON Formatter — pure JSON processing utilities.
 * Uses native JSON.parse / JSON.stringify. No dependencies.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JSONError {
  message: string
  line: number
  column: number
}

export interface JSONStats {
  characters: number
  lines: number
  size: number // bytes
}

export interface JSONResult {
  formatted: string
  minified: string
  isValid: boolean
  error?: JSONError
  stats: JSONStats
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStats(text: string): JSONStats {
  return {
    characters: text.length,
    lines: text ? text.split('\n').length : 0,
    size: new Blob([text]).size,
  }
}

/**
 * Parse a JSON.parse error message to extract line and column.
 * Supports Chromium/V8 ("position N") and Firefox ("line N column M") formats.
 */
function parseErrorPosition(
  errorMessage: string,
  source: string
): { line: number; column: number } {
  // Firefox style: "unexpected character at line N column M ..."
  const firefoxMatch = errorMessage.match(/line (\d+) column (\d+)/i)
  if (firefoxMatch) {
    return {
      line: parseInt(firefoxMatch[1], 10),
      column: parseInt(firefoxMatch[2], 10),
    }
  }

  // Chromium/V8 style: "... at position N" or "... position N"
  const chromeMatch = errorMessage.match(/position (\d+)/i)
  if (chromeMatch) {
    const pos = parseInt(chromeMatch[1], 10)
    const prefix = source.slice(0, pos)
    const line = (prefix.match(/\n/g) || []).length + 1
    const lastNewline = prefix.lastIndexOf('\n')
    const column = lastNewline === -1 ? pos + 1 : pos - lastNewline
    return { line, column }
  }

  return { line: 0, column: 0 }
}

// ─── Core Function ────────────────────────────────────────────────────────────

export function formatJSON(text: string, indentSize: 2 | 4 = 2): JSONResult {
  if (!text.trim()) {
    return {
      formatted: '',
      minified: '',
      isValid: false,
      error: { message: 'No JSON input provided.', line: 0, column: 0 },
      stats: computeStats(''),
    }
  }

  try {
    const parsed = JSON.parse(text)
    const formatted = JSON.stringify(parsed, null, indentSize)
    const minified = JSON.stringify(parsed)

    return {
      formatted,
      minified,
      isValid: true,
      stats: computeStats(formatted),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid JSON'
    const { line, column } = parseErrorPosition(message, text)

    return {
      formatted: text,
      minified: text,
      isValid: false,
      error: { message, line, column },
      stats: computeStats(text),
    }
  }
}
