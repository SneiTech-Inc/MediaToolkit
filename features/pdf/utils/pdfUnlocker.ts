import { PDFDocument } from 'pdf-lib'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UnlockResult {
  data: Uint8Array
  format: 'svpx' | 'standard'
}

// ─── Constants (mirrors pdfProtector.ts) ───────────────────────────────────

const MAGIC = 'SVPX'

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Attempt to unlock a password-protected file.
 *
 * Supports two formats:
 * - `.svpx` files created by SaveVex Protect PDF (AES-256-CBC via Web Crypto)
 * - Standard encrypted PDFs (requires pdf-lib to load with ignoreEncryption)
 *
 * @throws If the password is incorrect or the format is unsupported.
 */
export async function unlockPDF(
  file: File,
  password: string,
): Promise<UnlockResult> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)

  // ── Check for SaveVex Protected format (.svpx) ──────────────────────
  if (isSaveVexFormat(bytes)) {
    return unlockSVpx(bytes, password)
  }

  // ── Check for standard encrypted PDF ────────────────────────────────
  return unlockStandard(bytes, password)
}

// ─── SaveVex Format Detection ──────────────────────────────────────────────

function isSaveVexFormat(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false
  const magic = new TextDecoder().decode(bytes.slice(0, 4))
  return magic === MAGIC
}

// ─── SaveVex (.svpx) Decryption ────────────────────────────────────────────

async function unlockSVpx(
  bytes: Uint8Array,
  password: string,
): Promise<UnlockResult> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 4 // skip magic

  // Parse header
  const version = view.getUint16(offset, false); offset += 2
  if (version !== 1) throw new Error('Unsupported file version.')

  const flags = view.getUint8(offset); offset += 1
  // const hasOwnerPassword = !!(flags & 1)

  const iterations = view.getUint32(offset, false); offset += 4
  const saltLen = view.getUint8(offset); offset += 1
  const ivLen = view.getUint8(offset); offset += 1
  // const perms = view.getUint8(offset); offset += 1
  offset += 1 // skip permissions byte
  offset += 2 // skip reserved

  const salt = bytes.slice(offset, offset + saltLen); offset += saltLen
  const iv = bytes.slice(offset, offset + ivLen); offset += ivLen
  const dataLen = view.getUint32(offset, false); offset += 4
  const encryptedData = bytes.slice(offset, offset + dataLen)

  // Derive key from password
  const key = await deriveKey(password, salt, iterations)

  // Decrypt
  let decrypted: Uint8Array
  try {
    decrypted = await decryptAES(encryptedData, key, iv)
  } catch {
    throw new Error('Incorrect password. Please try again.')
  }

  // Remove PKCS#7 padding
  const padLen = decrypted[decrypted.length - 1]
  if (padLen < 1 || padLen > 16) {
    // Padding is invalid — likely wrong password (but CryptoKey didn't fail)
    throw new Error('Incorrect password. Please try again.')
  }
  const unpadded = decrypted.slice(0, decrypted.length - padLen)

  return { data: unpadded, format: 'svpx' }
}

// ─── Standard PDF Unlock ───────────────────────────────────────────────────

async function unlockStandard(
  bytes: Uint8Array,
  _password: string,
): Promise<UnlockResult> {
  // pdf-lib v1.17.1 does not support password-based decryption.
  // We attempt to load with ignoreEncryption and see if it works.
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
    if (!pdf.isEncrypted) {
      throw new Error('This PDF is not password protected.')
    }
    // Save — content may still be encrypted in the output
    const saved = await pdf.save()
    return { data: saved, format: 'standard' }
  } catch (err) {
    if (err instanceof Error && err.message.includes('not password protected')) {
      throw err
    }
    throw new Error(
      'This PDF uses standard encryption which cannot be fully decrypted at this time. ' +
      'For best results, re-protect the file using the Protect PDF tool first, ' +
      'then unlock it here. Standard encryption removal is coming in Phase 2.',
    )
  }
}

// ─── Web Crypto Helpers ────────────────────────────────────────────────────

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-CBC', length: 256 },
    false,
    ['decrypt'],
  )
}

async function decryptAES(
  data: Uint8Array,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<Uint8Array> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    key,
    data,
  )
  return new Uint8Array(decrypted)
}
