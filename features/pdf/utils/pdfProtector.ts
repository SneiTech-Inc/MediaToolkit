import { PDFDocument } from 'pdf-lib'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ProtectOptions {
  userPassword: string
  ownerPassword?: string
  permissions: {
    printing: boolean
    copying: boolean
    modifying: boolean
    annotating: boolean
    fillingForms: boolean
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100000
const SALT_LENGTH = 16
const IV_LENGTH = 16
const KEY_LENGTH = 256
const MAGIC = new TextEncoder().encode('SVPX') // SaveVex Protected

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Encrypt a PDF file using AES-256-CBC with PBKDF2 key derivation.
 * The encrypted output is wrapped in a self-describing container that
 * includes the salt, IV, and encryption parameters needed for decryption.
 *
 * All encryption happens client-side via the Web Crypto API.
 */
export async function protectPDF(
  file: File,
  options: ProtectOptions,
): Promise<Uint8Array> {
  // 1. Load and serialize the PDF to clean bytes
  const buf = await file.arrayBuffer()
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true })
  const pdfBytes = await pdf.save()

  // 2. Generate salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  // 3. Derive encryption key from password using PBKDF2
  const key = await deriveKey(options.userPassword, salt)

  // 4. Build permissions byte
  const permsByte = buildPermissionsByte(options.permissions)

  // 5. Encrypt the PDF bytes with AES-256-CBC
  const encryptedData = await encryptAES(pdfBytes, key, iv)

  // 6. Build the wrapper container
  return buildWrapper(salt, iv, encryptedData, permsByte, options)
}

// ─── Key Derivation ────────────────────────────────────────────────────────

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
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
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-CBC', length: KEY_LENGTH },
    false,
    ['encrypt'],
  )
}

// ─── Encryption ────────────────────────────────────────────────────────────

async function encryptAES(
  data: Uint8Array,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<Uint8Array> {
  // Pad data to 16-byte boundary (PKCS#7-style, but we use a known length header)
  const padLen = 16 - (data.length % 16)
  const padded = new Uint8Array(data.length + padLen)
  padded.set(data)
  // Pad bytes equal the padding length
  padded.fill(padLen, data.length)

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    key,
    padded,
  )
  return new Uint8Array(encrypted)
}

// ─── Permissions ───────────────────────────────────────────────────────────

function buildPermissionsByte(perms: ProtectOptions['permissions']): number {
  // PDF permissions bits (bit 1 is reserved, always 1)
  let byte = 0b11000000 // bits 7-6: reserved, bit 6=1 per spec
  if (perms.printing) byte |= 0b00000100     // bit 2
  if (perms.modifying) byte |= 0b00001000    // bit 3
  if (perms.copying) byte |= 0b00010000      // bit 4
  if (perms.annotating) byte |= 0b00100000   // bit 5
  if (perms.fillingForms) byte |= 0b01000000 // bit 6
  return byte
}

// ─── Wrapper Format ────────────────────────────────────────────────────────

/**
 * Container format (all fields big-endian):
 * ┌─────────┬──────────┬──────────┬────────────┬───────────┐
 * │ MAGIC   │ version  │ flags    │ iterations │ salt_len  │
 * │ 4 bytes │ 2 bytes  │ 1 byte   │ 4 bytes    │ 1 byte    │
 * ├─────────┼──────────┼──────────┼────────────┼───────────┤
 * │ iv_len  │ perms   │ reserved  │ salt       │ iv        │
 * │ 1 byte  │ 1 byte  │ 2 bytes   │ 16 bytes   │ 16 bytes  │
 * ├─────────┼──────────┼──────────┼────────────┼───────────┤
 * │ data_len │ encrypted_data                                    │
 * │ 4 bytes  │ N bytes                                           │
 * └─────────┴────────────────────────────────────────────────────┘
 * Total header: 36 bytes + encrypted data
 */
function buildWrapper(
  salt: Uint8Array,
  iv: Uint8Array,
  encryptedData: Uint8Array,
  perms: number,
  options: ProtectOptions,
): Uint8Array {
  const headerSize = 4 + 2 + 1 + 4 + 1 + 1 + 1 + 2 + SALT_LENGTH + IV_LENGTH + 4
  const result = new Uint8Array(headerSize + encryptedData.length)
  const view = new DataView(result.buffer)
  let offset = 0

  // Magic: "SVPX"
  result.set(MAGIC, offset); offset += 4

  // Version: 1
  view.setUint16(offset, 1, false); offset += 2

  // Flags: bit 0 = has owner password
  view.setUint8(offset, options.ownerPassword ? 1 : 0); offset += 1

  // Iterations
  view.setUint32(offset, PBKDF2_ITERATIONS, false); offset += 4

  // Salt length
  view.setUint8(offset, SALT_LENGTH); offset += 1

  // IV length
  view.setUint8(offset, IV_LENGTH); offset += 1

  // Permissions
  view.setUint8(offset, perms); offset += 1

  // Reserved
  view.setUint16(offset, 0, false); offset += 2

  // Salt
  result.set(salt, offset); offset += SALT_LENGTH

  // IV
  result.set(iv, offset); offset += IV_LENGTH

  // Data length
  view.setUint32(offset, encryptedData.length, false); offset += 4

  // Encrypted data
  result.set(encryptedData, offset)

  return result
}

// ─── Password Strength ─────────────────────────────────────────────────────

export function checkPasswordStrength(password: string): { label: string; score: number; color: string } {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score >= 5) return { label: 'Strong', score, color: 'text-green-600' }
  if (score >= 3) return { label: 'Medium', score, color: 'text-amber-600' }
  return { label: 'Weak', score, color: 'text-red-600' }
}
