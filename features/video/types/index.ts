/** Supported video input formats. */
export type VideoFormat = 'mp4' | 'webm' | 'mov' | 'mkv'

/**
 * Compression intensity level.
 * "low"  = light compression (CRF 23) → best quality, larger file
 * "high" = heavy compression (CRF 30) → smallest file, lower quality
 */
export type VideoQuality = 'low' | 'medium' | 'high'

/** Output resolution options. "original" keeps the source dimensions. */
export type VideoResolution = 'original' | '1080p' | '720p' | '480p' | '360p'

/** Output frame rate options. "original" keeps the source frame rate. */
export type VideoFrameRate = 'original' | '30' | '24'

/** Metadata extracted from the source video via a native <video> element. */
export interface VideoMetadata {
  /** Duration in seconds. 0 if the source was unreadable. */
  duration: number
  /** Width in pixels. */
  width: number
  /** Height in pixels. */
  height: number
}

/** User-facing compression options. */
export interface CompressionOptions {
  /** Compression intensity — controls the CRF value. */
  quality: VideoQuality
  /** Target output resolution (or "original" to preserve dimensions). */
  resolution: VideoResolution
  /** Target output frame rate (or "original" to preserve frame rate). */
  frameRate: VideoFrameRate
}

/** Result returned after a successful compression. */
export interface CompressionResult {
  /** The compressed video as a Blob (MP4 / H.264 + AAC). */
  blob: Blob
  /** MIME type of the output (always "video/mp4" for v1). */
  mimeType: string
  /** Original file size in bytes (from File.size). */
  originalSize: number
  /** Compressed output file size in bytes (from Blob.size). */
  compressedSize: number
  /** Source video metadata extracted during upload. */
  metadata: VideoMetadata | null
}

/**
 * Maps each compression intensity label to its libx264 CRF value.
 *
 * ffmpeg convention: lower CRF = higher quality = larger file.
 * "Low" compression = CRF 23 (best quality, largest output).
 * "High" compression = CRF 30 (smallest file, lower quality).
 */
export const CRF_MAP: Record<VideoQuality, number> = {
  low: 23,
  medium: 26,
  high: 30,
}

/**
 * Maps each resolution label to its target pixel height.
 * Width is auto-calculated via `scale=-2:HEIGHT` to keep dimensions even
 * (required by most H.264 profiles).
 */
export const RESOLUTION_HEIGHT: Record<Exclude<VideoResolution, 'original'>, number> = {
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
  '360p': 360,
}
