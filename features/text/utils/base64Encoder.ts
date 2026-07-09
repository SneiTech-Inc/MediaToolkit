/**
 * Base64 Encoder — pure encode/decode utilities with UTF-8 support.
 * Uses native btoa/atob + TextEncoder/TextDecoder. No dependencies.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Base64Mode = 'encode' | 'decode'

export interface Base64Result {
  output: string
  error: string | null
}

// ─── Validation ───────────────────────────────────────────────────────────────

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/

export function isBase64(str: string): boolean {
  return BASE64_RE.test(str)
}

// ─── Encode ───────────────────────────────────────────────────────────────────

export function encodeToBase64(text: string): string {
  if (!text) return ''
  const encoder = new TextEncoder()
  const bytes = encoder.encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// ─── Decode ───────────────────────────────────────────────────────────────────

export function decodeFromBase64(base64: string): string {
  if (!base64) return ''

  // Strip whitespace first
  const cleaned = base64.replace(/\s/g, '')

  if (!isBase64(cleaned)) {
    throw new Error(
      'Invalid Base64 input. Base64 strings should only contain letters (A-Z, a-z), numbers (0-9), +, /, and optional = padding.'
    )
  }

  try {
    const binary = atob(cleaned)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const decoder = new TextDecoder()
    return decoder.decode(bytes)
  } catch {
    throw new Error(
      'Failed to decode Base64. Please check your input and try again.'
    )
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export function convertBase64(
  text: string,
  mode: Base64Mode
): Base64Result {
  if (!text) return { output: '', error: null }

  if (mode === 'encode') {
    return { output: encodeToBase64(text), error: null }
  }

  try {
    return { output: decodeFromBase64(text), error: null }
  } catch (err) {
    return {
      output: '',
      error: err instanceof Error ? err.message : 'Decoding failed.',
    }
  }
}
