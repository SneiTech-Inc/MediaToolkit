/**
 * QR Code Generator — Type definitions.
 */

/** Error correction levels supported by the qrcode library. */
export type QRErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

/** Preset pixel sizes for the QR code output canvas. */
export type QRCodeSize = 'small' | 'medium' | 'large'

/** Possible states of the QR generation workflow. */
export type QRGenerationStatus = 'idle' | 'generating' | 'complete' | 'error'

/** User-configurable options for QR generation. */
export interface QROptions {
  inputText: string
  qrName: string
  errorCorrectionLevel: QRErrorCorrectionLevel
  size: QRCodeSize
  foregroundColor: string
  backgroundColor: string
  logoFile: File | null
}

/** A QR code persisted in the recent-codes history. */
export interface RecentQRCode {
  id: string
  inputText: string
  qrName: string
  qrDataUrl: string
  createdAt: string
}

/** Maps a size preset to its canvas pixel width. */
export const QR_SIZE_MAP: Record<QRCodeSize, number> = {
  small: 200,
  medium: 400,
  large: 600,
}

/** localStorage key for the recent QR codes list. */
export const RECENT_QR_STORAGE_KEY = 'savevex-qr-history'

/** Maximum number of recent QR codes to keep. */
export const MAX_RECENT_QR_CODES = 10

/** Debounce delay in milliseconds before auto-generating. */
export const GENERATION_DEBOUNCE_MS = 400
