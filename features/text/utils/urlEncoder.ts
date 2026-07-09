/**
 * URL Encoder/Decoder — pure encode/decode utilities.
 * Uses native encodeURIComponent / decodeURIComponent. No dependencies.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type UrlMode = 'encode' | 'decode'

export interface UrlResult {
  output: string
  error: string | null
}

// ─── Encode ───────────────────────────────────────────────────────────────────

export function encodeURL(text: string): string {
  if (!text) return ''
  return encodeURIComponent(text)
}

// ─── Decode ───────────────────────────────────────────────────────────────────

export function decodeURL(text: string): string {
  if (!text) return ''

  try {
    return decodeURIComponent(text)
  } catch {
    throw new Error(
      'Invalid URL encoding. The input contains malformed percent-encoding sequences (e.g., "%ZZ" or incomplete "%"). Please check your input and try again.'
    )
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export function convertURL(text: string, mode: UrlMode): UrlResult {
  if (!text) return { output: '', error: null }

  if (mode === 'encode') {
    return { output: encodeURL(text), error: null }
  }

  try {
    return { output: decodeURL(text), error: null }
  } catch (err) {
    return {
      output: '',
      error: err instanceof Error ? err.message : 'Decoding failed.',
    }
  }
}
