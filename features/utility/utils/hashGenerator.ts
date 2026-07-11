/**
 * Hash Generator — Cryptographic hash utilities.
 *
 * SHA-1, SHA-256, SHA-384, SHA-512 use the Web Crypto API (SubtleCrypto).
 * MD5 is a pure JavaScript implementation (not supported by SubtleCrypto).
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

export interface HashResult {
  algorithm: HashAlgorithm
  hash: string
}

export const ALL_ALGORITHMS: HashAlgorithm[] = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

export const ALGORITHM_LABELS: Record<HashAlgorithm, string> = {
  'MD5': 'MD5',
  'SHA-1': 'SHA-1',
  'SHA-256': 'SHA-256',
  'SHA-384': 'SHA-384',
  'SHA-512': 'SHA-512',
}

export const ALGORITHM_DESCRIPTIONS: Record<HashAlgorithm, string> = {
  'MD5': '128-bit — legacy, not cryptographically secure',
  'SHA-1': '160-bit — deprecated, included for compatibility',
  'SHA-256': '256-bit — recommended for most applications',
  'SHA-384': '384-bit — higher security, longer output',
  'SHA-512': '512-bit — maximum security',
}

// ─── Hex Conversion ────────────────────────────────────────────────────────────

/** Convert an ArrayBuffer to a lowercase hex string. */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

// ─── SubtleCrypto Hashes ───────────────────────────────────────────────────────

const encoder = new TextEncoder()

async function subtleHash(algorithm: string, text: string): Promise<string> {
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest(algorithm, data)
  return bufferToHex(hashBuffer)
}

function sha1(text: string): Promise<string> {
  return subtleHash('SHA-1', text)
}

function sha256(text: string): Promise<string> {
  return subtleHash('SHA-256', text)
}

function sha384(text: string): Promise<string> {
  return subtleHash('SHA-384', text)
}

function sha512(text: string): Promise<string> {
  return subtleHash('SHA-512', text)
}

// ─── MD5 (Pure JavaScript) ─────────────────────────────────────────────────────

/**
 * Pure JavaScript implementation of the MD5 hashing algorithm.
 *
 * MD5 is not available in SubtleCrypto because it is cryptographically broken.
 * This implementation follows RFC 1321 and is suitable for non-security use
 * cases such as checksums and legacy compatibility.
 */
function md5(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const hash = md5Core(bytes)
  return Promise.resolve(hash)
}

function md5Core(input: Uint8Array): string {
  // Constants — sine-based
  const K = new Uint32Array(64)
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) | 0
  }

  // Per-round shift amounts
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ]

  // Padding
  const msgLen = input.length
  const padding = new Uint8Array((() => {
    const padLen = (msgLen % 64 < 56) ? 56 - (msgLen % 64) : 120 - (msgLen % 64)
    const padded = new Uint8Array(msgLen + padLen + 8)
    padded.set(input)
    padded[msgLen] = 0x80
    // Append original length in bits as 64-bit little-endian
    const bitLen = msgLen * 8
    for (let i = 0; i < 8; i++) {
      padded[padded.length - 8 + i] = (bitLen >>> (i * 8)) & 0xFF
    }
    return padded
  })())

  // Initial hash values
  let a0 = 0x67452301
  let b0 = 0xEFCDAB89
  let c0 = 0x98BADCFE
  let d0 = 0x10325476

  // Process each 64-byte block
  const words = new Uint32Array(16)
  for (let block = 0; block < padding.length; block += 64) {
    // Break block into 16 32-bit little-endian words
    for (let i = 0; i < 16; i++) {
      const offset = block + i * 4
      words[i] =
        padding[offset] |
        (padding[offset + 1] << 8) |
        (padding[offset + 2] << 16) |
        (padding[offset + 3] << 24)
    }

    let A = a0, B = b0, C = c0, D = d0

    for (let i = 0; i < 64; i++) {
      let F: number, g: number
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }

      F = (F + A + K[i] + words[g]) | 0
      A = D
      D = C
      C = B
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) | 0
    }

    a0 = (a0 + A) | 0
    b0 = (b0 + B) | 0
    c0 = (c0 + C) | 0
    d0 = (d0 + D) | 0
  }

  // Convert to little-endian hex
  const toHex = (val: number) => {
    const b = new Uint8Array(4)
    b[0] = val & 0xFF
    b[1] = (val >>> 8) & 0xFF
    b[2] = (val >>> 16) & 0xFF
    b[3] = (val >>> 24) & 0xFF
    return Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
  }

  return toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0)
}

// ─── Algorithm Map ─────────────────────────────────────────────────────────────

const HASH_FUNCTIONS: Record<HashAlgorithm, (text: string) => Promise<string>> = {
  'MD5': md5,
  'SHA-1': sha1,
  'SHA-256': sha256,
  'SHA-384': sha384,
  'SHA-512': sha512,
}

// ─── Bulk Generation ───────────────────────────────────────────────────────────

/**
 * Generate hashes for the given text using all selected algorithms.
 * Algorithms run in parallel via Promise.all.
 */
export async function generateHashes(
  text: string,
  algorithms: HashAlgorithm[],
): Promise<HashResult[]> {
  const results = await Promise.all(
    algorithms.map(async (algorithm) => {
      const hashFn = HASH_FUNCTIONS[algorithm]
      const hash = await hashFn(text)
      return { algorithm, hash } as HashResult
    }),
  )
  return results
}
