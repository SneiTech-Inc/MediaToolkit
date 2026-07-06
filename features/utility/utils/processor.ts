/**
 * Utility tool helpers.
 * Mostly pure functions — no heavy dependencies needed.
 */

export function generateQrDataUrl(_text: string): string {
  // TODO: Lazy-load qrcode library when implemented
  throw new Error('QR code generation is not yet implemented.')
}

export function generateHash(text: string, _algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  return crypto.subtle.digest('SHA-256', data).then((buffer) =>
    Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  )
}
