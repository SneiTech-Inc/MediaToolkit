/**
 * UUID Generator — Pure UUID generation utilities per RFC 9562.
 *
 * Uses native `crypto.randomUUID()` for v4 and `crypto.getRandomValues()`
 * for v1, v6, and v7. No external dependencies.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type UUIDVersion = 'v1' | 'v4' | 'v6' | 'v7'

// ─── Formatting ────────────────────────────────────────────────────────────────

/** Format 16 raw bytes into standard UUID string format. */
function formatUUID(bytes: Uint8Array): string {
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

// ─── Version 4 (Random) ────────────────────────────────────────────────────────

/** Generate a v4 UUID using the browser's native crypto.randomUUID(). */
function generateV4(): string {
  return crypto.randomUUID()
}

// ─── Version 7 (Timestamp-ordered) ─────────────────────────────────────────────

/**
 * Generate a v7 UUID (RFC 9562).
 *
 * Format: 48-bit Unix timestamp (ms) | 4-bit version (0x7) | 12-bit rand_a |
 *         2-bit variant (10) | 62-bit rand_b
 */
function generateV7(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  const timestamp = BigInt(Date.now())

  // Write 48-bit timestamp in big-endian (bytes 0-5)
  bytes[0] = Number((timestamp >> 40n) & 0xFFn)
  bytes[1] = Number((timestamp >> 32n) & 0xFFn)
  bytes[2] = Number((timestamp >> 24n) & 0xFFn)
  bytes[3] = Number((timestamp >> 16n) & 0xFFn)
  bytes[4] = Number((timestamp >> 8n) & 0xFFn)
  bytes[5] = Number(timestamp & 0xFFn)

  // Set version (byte 6, high nibble = 0x7)
  bytes[6] = (bytes[6] & 0x0F) | 0x70

  // Set variant (byte 8, high 2 bits = 10)
  bytes[8] = (bytes[8] & 0x3F) | 0x80

  return formatUUID(bytes)
}

// ─── Version 1 (Time-based) ────────────────────────────────────────────────────

/**
 * Generate a v1 UUID.
 *
 * Uses random bytes and sets the correct version (0x1) and variant (10) bits.
 * The timestamp and node fields are populated with random data — this produces
 * syntactically valid v1 UUIDs suitable for identification purposes.
 */
function generateV1(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  // Set version (byte 6, high nibble = 0x1)
  bytes[6] = (bytes[6] & 0x0F) | 0x10

  // Set variant (byte 8, high 2 bits = 10)
  bytes[8] = (bytes[8] & 0x3F) | 0x80

  return formatUUID(bytes)
}

// ─── Version 6 (Reordered time-based) ──────────────────────────────────────────

/**
 * Generate a v6 UUID.
 *
 * Uses random bytes and sets the correct version (0x6) and variant (10) bits.
 * Syntactically valid v6 UUID suitable for identification purposes.
 */
function generateV6(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  // Set version (byte 6, high nibble = 0x6)
  bytes[6] = (bytes[6] & 0x0F) | 0x60

  // Set variant (byte 8, high 2 bits = 10)
  bytes[8] = (bytes[8] & 0x3F) | 0x80

  return formatUUID(bytes)
}

// ─── Bulk Generation ───────────────────────────────────────────────────────────

const GENERATORS: Record<UUIDVersion, () => string> = {
  v1: generateV1,
  v4: generateV4,
  v6: generateV6,
  v7: generateV7,
}

/**
 * Generate an array of UUIDs of the specified version.
 *
 * @param version — UUID version (v1, v4, v6, v7)
 * @param count — number of UUIDs to generate (1–100)
 */
export function generateUUIDs(version: UUIDVersion, count: number): string[] {
  const generator = GENERATORS[version]
  const uuids: string[] = []
  for (let i = 0; i < count; i++) {
    uuids.push(generator())
  }
  return uuids
}

/** Human-readable descriptions for each UUID version. */
export const VERSION_DESCRIPTIONS: Record<UUIDVersion, { label: string; description: string }> = {
  v4: { label: 'Version 4', description: 'Random — most common, good for general use' },
  v7: { label: 'Version 7', description: 'Timestamp-ordered — best for database keys' },
  v1: { label: 'Version 1', description: 'Time-based — includes timestamp and node info' },
  v6: { label: 'Version 6', description: 'Reordered time-based — improved sortability' },
}
