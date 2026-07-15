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

// ─── Conversion Types ───────────────────────────────────────────────────────

/** Output container formats supported by Convert Video (v1 — H.264 only, no WebM). */
export type VideoOutputFormat = 'mp4' | 'mov' | 'avi' | 'mkv'

/** Encoding preset: speed vs. compression efficiency tradeoff. */
export type VideoPreset = 'fast' | 'medium' | 'slow'

/** CRF bounds (H.264). */
export const MIN_CRF = 18
export const MAX_CRF = 32
export const DEFAULT_CRF = 23

/** Maps each output format to its container, MIME type, and audio codec. */
export const FORMAT_CONFIG: Record<
  VideoOutputFormat,
  { ext: string; mime: string; audioCodec: string; audioBitrate: string }
> = {
  mp4: { ext: 'mp4', mime: 'video/mp4', audioCodec: 'aac', audioBitrate: '128k' },
  mov: { ext: 'mov', mime: 'video/quicktime', audioCodec: 'aac', audioBitrate: '128k' },
  avi: { ext: 'avi', mime: 'video/x-msvideo', audioCodec: 'mp3', audioBitrate: '128k' },
  mkv: { ext: 'mkv', mime: 'video/x-matroska', audioCodec: 'aac', audioBitrate: '128k' },
}

/** User-facing conversion options. */
export interface ConversionOptions {
  /** Target output container format. */
  targetFormat: VideoOutputFormat
  /** Encoding speed preset (fast/medium/slow). */
  preset: VideoPreset
  /** CRF quality value (18–32, lower = better quality + larger file). */
  crf: number
  /** Target output resolution (or "original" to preserve dimensions). */
  resolution: VideoResolution
  /** Target output frame rate (or "original" to preserve frame rate). */
  frameRate: VideoFrameRate
}

/** Result returned after a successful conversion. */
export interface ConversionResult {
  /** The converted video as a Blob. */
  blob: Blob
  /** MIME type of the output (e.g. "video/mp4"). */
  mimeType: string
  /** The output container format used. */
  targetFormat: VideoOutputFormat
  /** Original file size in bytes (from File.size). */
  originalSize: number
  /** Converted output file size in bytes (from Blob.size). */
  convertedSize: number
  /** Source video metadata extracted during upload. */
  metadata: VideoMetadata | null
}

// ─── Extended Video Metadata ────────────────────────────────────────────────

/** Rich metadata extracted from a video file (for Trim Video and future tools). */
export interface ExtendedVideoMetadata {
  /** Duration in seconds. */
  duration: number
  /** Width in pixels. */
  width: number
  /** Height in pixels. */
  height: number
  /** Frames per second (for frame stepping). Falls back to 30 if unreadable. */
  fps: number
  /** Video codec string (e.g. "avc1", "vp09"). */
  codec: string
  /** Estimated video bitrate in bits per second. */
  bitrate: number
  /** Audio codec string (e.g. "mp4a", "opus"). */
  audioCodec: string
  /** Display aspect ratio (e.g. "16:9", "4:3"). */
  aspectRatio: string
}

// ─── Trim Types ─────────────────────────────────────────────────────────────

/** Options for the Trim Video tool. */
export interface TrimOptions {
  /** Start time in seconds. */
  startTime: number
  /** End time in seconds. */
  endTime: number
  /** Target output container format. */
  targetFormat: VideoOutputFormat
  /** Whether to use stream copy (fast trim). False forces re-encode for frame accuracy. */
  useFastTrim: boolean
  /** Encoding preset (only used when re-encoding). */
  preset: VideoPreset
  /** CRF quality value 18–32 (only used when re-encoding). */
  crf: number
  /** Target output resolution (only used when re-encoding). */
  resolution: VideoResolution
  /** Target output frame rate (only used when re-encoding). */
  frameRate: VideoFrameRate
}

/** Result returned after a successful trim. */
export interface TrimResult {
  /** The trimmed video as a Blob. */
  blob: Blob
  /** MIME type of the output. */
  mimeType: string
  /** The output container format used. */
  targetFormat: VideoOutputFormat
  /** Original file size in bytes. */
  originalSize: number
  /** Trimmed output file size in bytes. */
  trimmedSize: number
  /** Duration of the trimmed segment in seconds. */
  trimmedDuration: number
  /** Source video metadata extracted during upload. */
  metadata: VideoMetadata | null
  /** Whether stream copy was used (fast, keyframe-aligned) vs re-encode (frame-accurate). */
  usedStreamCopy: boolean
}

// ─── Crop Types ──────────────────────────────────────────────────────────────

/** A rectangular region, typically in display coordinates (relative to a container element). */
export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

/** Result returned after a successful crop operation. */
export interface CropResult {
  /** The cropped video as a Blob. */
  blob: Blob
  /** MIME type of the output. */
  mimeType: string
  /** The output container format used. */
  targetFormat: VideoOutputFormat
  /** Original file size in bytes. */
  originalSize: number
  /** Cropped output file size in bytes. */
  croppedSize: number
  /** The crop rectangle in native video pixels. */
  cropRegion: { x: number; y: number; width: number; height: number }
  /** Width of the cropped output in pixels (always even). */
  outputWidth: number
  /** Height of the cropped output in pixels (always even). */
  outputHeight: number
  /** Source video metadata extracted during upload. */
  metadata: VideoMetadata | null
}

// ─── Rotate Types ─────────────────────────────────────────────────────────────

/** Options for the Rotate Video tool. */
export interface RotateOptions {
  /** Rotation angle in degrees (0–360). */
  angle: number
  /** Whether to flip horizontally. */
  flipH: boolean
  /** Whether to flip vertically. */
  flipV: boolean
  /** Fill color for border areas at non-90° angles (default "black"). */
  fillColor?: string
  /** Whether to auto-crop empty borders after rotation. */
  autoCrop?: boolean
}

/** Result returned after a successful rotation. */
export interface RotateResult {
  /** The rotated video as a Blob. */
  blob: Blob
  /** MIME type of the output. */
  mimeType: string
  /** The output container format used. */
  targetFormat: VideoOutputFormat
  /** Original file size in bytes. */
  originalSize: number
  /** Rotated output file size in bytes. */
  rotatedSize: number
  /** Actual rotation angle applied (0–360). */
  angle: number
  /** Whether horizontal flip was applied. */
  flipH: boolean
  /** Whether vertical flip was applied. */
  flipV: boolean
  /** Source video metadata extracted during upload. */
  metadata: VideoMetadata | null
}

// ─── Resize Types ─────────────────────────────────────────────────────────────

/** Result returned after a successful resize operation. */
export interface ResizeResult {
  /** The resized video as a Blob. */
  blob: Blob
  /** MIME type of the output. */
  mimeType: string
  /** The output container format used. */
  targetFormat: VideoOutputFormat
  /** Original file size in bytes. */
  originalSize: number
  /** Resized output file size in bytes. */
  resizedSize: number
  /** Target width in pixels (always even). */
  targetWidth: number
  /** Target height in pixels (always even). */
  targetHeight: number
  /** Scale method used: 'fit' = letterbox, 'fill' = cover-crop. */
  scaleMethod: 'fit' | 'fill'
  /** Source video metadata extracted during upload. */
  metadata: VideoMetadata | null
}

// ─── Speed Types ──────────────────────────────────────────────────────────────

/** Result returned after a successful speed change operation. */
export interface SpeedResult {
  /** The speed-adjusted video as a Blob. */
  blob: Blob
  /** MIME type of the output. */
  mimeType: string
  /** The output container format used. */
  targetFormat: VideoOutputFormat
  /** Original file size in bytes. */
  originalSize: number
  /** Speed-adjusted output file size in bytes. */
  outputSize: number
  /** The playback speed multiplier applied (0.25–4.0). */
  speed: number
  /** Original duration in seconds. */
  originalDuration: number
  /** New duration in seconds (originalDuration / speed). */
  outputDuration: number
  /** Source video metadata extracted during upload. */
  metadata: VideoMetadata | null
}

// ─── Thumbnail Types ────────────────────────────────────────────────────────

/** A single timeline thumbnail. */
export interface ThumbnailData {
  /** Timestamp in seconds this thumbnail represents. */
  time: number
  /** Base64-encoded data URL of the thumbnail image. */
  dataUrl: string
}

// ─── Merge Types ─────────────────────────────────────────────────────────────

/** Per-file info used by the Merge Video tool. */
export interface MergeFileInfo {
  /** The source file. */
  file: File
  /** Basic metadata from HTML5 <video> element (available immediately). */
  metadata: VideoMetadata
  /** Advanced metadata from ffmpeg probe (populated async, may be undefined). */
  advanced?: ExtendedVideoMetadata
}

/** Options for the Merge Video tool. */
export interface MergeOptions {
  /** Target output container format. */
  outputFormat: VideoOutputFormat
  /** Encoding speed preset (only used when re-encoding). */
  preset: VideoPreset
  /** CRF quality value 18–32 (only used when re-encoding). */
  crf: number
  /** Target output resolution (only used when re-encoding). */
  resolution: VideoResolution
  /** Target output frame rate (only used when re-encoding). */
  frameRate: VideoFrameRate
  /** Use stream copy when files are compatible. Default true. */
  fastMerge: boolean
}
