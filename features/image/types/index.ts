/** Supported output formats for image compression. */
export type OutputFormat = 'image/jpeg' | 'image/png' | 'image/webp'

/** Options passed to the compression function. */
export interface ImageCompressionOptions {
  /** JPEG/WebP quality 0.0–1.0 (PNG ignores quality). Default 0.8. */
  quality: number
  /** Output MIME type. Default 'image/jpeg'. */
  format: OutputFormat
  /** Maximum width in pixels — image is scaled down proportionally if wider. Omit for original dimensions. */
  maxWidth?: number
  /** Maximum height in pixels — image is scaled down proportionally if taller. Omit for original dimensions. */
  maxHeight?: number
}

/** Result of a compression operation. */
export interface ImageCompressionResult {
  /** The compressed image as a Blob. */
  blob: Blob
  /** Compressed file size in bytes. */
  compressedSize: number
  /** Original file size in bytes. */
  originalSize: number
  /** Compression ratio: compressedSize / originalSize (0–1). Lower = more compressed. */
  ratio: number
  /** Percentage reduction in size. */
  percentSaved: number
  /** Width of the output image in pixels. */
  width: number
  /** Height of the output image in pixels. */
  height: number
  /** Object URL for previewing the compressed image. Must be revoked. */
  previewUrl: string
}

/** Compression progress callback. */
export type CompressionProgressCallback = (percent: number) => void

/** Result of an image resize operation. */
export interface ResizeResult {
  blob: Blob
  width: number
  height: number
  previewUrl: string
}
