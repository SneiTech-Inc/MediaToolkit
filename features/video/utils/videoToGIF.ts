/**
 * Video to GIF converter — two-pass palette technique using ffmpeg.wasm.
 *
 * Pass 1 (palettegen): Generates an optimal color palette from the video
 * segment. Uses `-ss` before `-i` for fast seeking.
 *
 * Pass 2 (paletteuse): Applies the palette with dithering to produce the
 * final GIF. Uses `-filter_complex` with explicit stream labels and
 * `-map [outv]` — a plain comma-separated `-vf` chain WILL FAIL because
 * paletteuse requires two inputs (scaled video + palette).
 *
 * CRITICAL: Output data is read BEFORE temp files are deleted.
 * The finally block deletes all temp files strictly after readFile resolves.
 *
 * Quality mapping (CORRECTED — more colors = better quality + larger file):
 *   low    = 32 colors  → smallest file, most banding
 *   medium = 128 colors → balanced
 *   high   = 256 colors → best fidelity, largest file (GIF maximum)
 */

import { execWithProgress } from '@/features/video/utils/videoProcessor'
import {
  getFFmpeg,
  runExclusive,
} from '@/features/audio/utils/ffmpegClient'
import {
  validateFileSize,
  validateInputFormat,
  MAX_FILE_SIZE_TRIM,
} from '@/features/video/utils/videoValidation'
import type {
  GIFQuality,
  GIFLoop,
  VideoToGIFOptions,
  VideoToGIFResult,
} from '@/features/video/types'
import type { FFmpeg } from '@ffmpeg/ffmpeg'

// ─── Re-export types ───────────────────────────────────────────────────────────

export type { GIFQuality, GIFLoop, VideoToGIFOptions, VideoToGIFResult }

// ─── Constants ─────────────────────────────────────────────────────────────────

/**
 * Maps each quality level to the maximum number of palette colors.
 *
 * DIRECTION: more colors = better quality + larger file.
 * GIF format maximum is 256 colors.
 * Low (32) = smallest file, most visible banding.
 * High (256) = best fidelity, largest file.
 */
export const QUALITY_PALETTE: Record<GIFQuality, number> = {
  low: 32,
  medium: 128,
  high: 256,
}

/** Accepted input format extensions. */
const ACCEPTED_FORMATS = ['mp4', 'webm', 'mov', 'mkv', 'avi'] as const

/** Supported FPS range. */
export const MIN_FPS = 5
export const MAX_FPS = 30
export const DEFAULT_FPS = 10

/** Maximum GIF dimension in pixels (safety cap for browser memory). */
export const MAX_GIF_DIMENSION = 1280

// ─── Helpers ───────────────────────────────────────────────────────────────────

function tempName(prefix: string, suffix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${suffix}`
}

/**
 * Snap a dimension to the nearest even integer.
 * palettegen/paletteuse require even dimensions.
 */
export function snapEven(value: number): number {
  const rounded = Math.round(value)
  return rounded % 2 === 0 ? rounded : rounded + 1
}

/**
 * Compute output dimensions maintaining aspect ratio.
 * When one dimension is 0, it is auto-derived from the other.
 * When both are 0, the source resolution is used.
 * Dimensions are snapped to even values.
 */
export function computeGIFDimensions(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: 0, height: 0 }
  }

  const aspectRatio = sourceWidth / sourceHeight

  let w: number
  let h: number

  if (targetWidth > 0 && targetHeight > 0) {
    // Both specified — use as-is
    w = targetWidth
    h = targetHeight
  } else if (targetWidth > 0) {
    // Width specified, derive height
    w = targetWidth
    h = targetWidth / aspectRatio
  } else if (targetHeight > 0) {
    // Height specified, derive width
    h = targetHeight
    w = targetHeight * aspectRatio
  } else {
    // Both 0 — use source dimensions
    w = sourceWidth
    h = sourceHeight
  }

  // Snap to even
  w = snapEven(w)
  h = snapEven(h)

  // Cap maximum dimension
  if (w > MAX_GIF_DIMENSION) {
    const scale = MAX_GIF_DIMENSION / w
    w = MAX_GIF_DIMENSION
    h = snapEven(h * scale)
  }
  if (h > MAX_GIF_DIMENSION) {
    const scale = MAX_GIF_DIMENSION / h
    h = MAX_GIF_DIMENSION
    w = snapEven(w * scale)
  }

  // Floor at 2px minimum
  return { width: Math.max(2, w), height: Math.max(2, h) }
}

/**
 * Estimate approximate GIF output size in bytes.
 *
 * GIF size depends heavily on content complexity and color count, so this is
 * inherently imprecise. Provides a rough order-of-magnitude estimate.
 *
 * Formula: w × h × fps × duration × bytes_per_pixel_palette × compression_ratio
 * where bytes_per_pixel_palette ≈ 0.25 for palette-based encoding (worst case),
 * and the LZW compression ratio for simple content is roughly 0.5.
 */
export function estimateGIFSize(
  width: number,
  height: number,
  fps: number,
  duration: number,
  paletteColors: number,
): number {
  if (width <= 0 || height <= 0 || fps <= 0 || duration <= 0) return 0

  // Each pixel is a palette index: log2(colors)/8 bytes uncompressed.
  // Typical LZW compression on GIF: 2:1 to 4:1 for natural content.
  const bitsPerPixel = Math.ceil(Math.log2(paletteColors))
  const bytesPerFrameUncompressed = (width * height * bitsPerPixel) / 8
  const totalFrames = fps * duration
  const compressionRatio = 0.35 // conservative LZW estimate for video-sourced content
  return Math.round(bytesPerFrameUncompressed * totalFrames * compressionRatio)
}

/**
 * Format an estimated byte count as a human-readable size with a tilde prefix.
 * Emphasizes that this is an approximation.
 *
 * @example formatGIFSizeEstimate(1_500_000) → "~1.5 MB (approximate)"
 */
export function formatGIFSizeEstimate(bytes: number): string {
  if (bytes <= 0) return 'Unknown'
  if (bytes >= 1_000_000_000) {
    return `~${(bytes / 1_000_000_000).toFixed(1)} GB (approximate)`
  }
  if (bytes >= 1_000_000) {
    return `~${(bytes / 1_000_000).toFixed(1)} MB (approximate)`
  }
  return `~${Math.round(bytes / 1000)} KB (approximate)`
}

// ─── Processing ────────────────────────────────────────────────────────────────

/**
 * Convert a video segment to an animated GIF using the two-pass palette method.
 *
 * Self-contained processing function that manages its own ffmpeg lifecycle
 * (write → exec pass1 → exec pass2 → read → delete). Does NOT use processVideo()
 * because the two-pass technique requires managing an intermediate palette file.
 *
 * CRITICAL: Output data is read BEFORE temp files are deleted.
 * The finally block deletes all temp files strictly after readFile resolves.
 *
 * @param options — Conversion configuration.
 * @returns VideoToGIFResult with the output blob and metadata.
 */
export async function videoToGIF(options: VideoToGIFOptions): Promise<VideoToGIFResult> {
  const {
    file,
    startTime,
    duration,
    width,
    height,
    fps,
    quality,
    loop,
    onProgress,
    signal,
  } = options

  // ── Validation ──────────────────────────────────────────────────────────
  validateFileSize(file, MAX_FILE_SIZE_TRIM)
  validateInputFormat(file, ACCEPTED_FORMATS)

  if (signal?.aborted) {
    throw new DOMException('Processing cancelled.', 'AbortError')
  }

  // ── ffmpeg setup ────────────────────────────────────────────────────────
  const ffmpeg: FFmpeg = await getFFmpeg()

  if (signal?.aborted) {
    throw new DOMException('Processing cancelled.', 'AbortError')
  }

  const inputExt = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
  const inputName = tempName('gif_in', inputExt)
  const paletteName = tempName('gif_palette', 'png')
  const outputName = tempName('gif_out', 'gif')

  const paletteColors = QUALITY_PALETTE[quality]
  const loopValue = loop === 'infinite' ? '0' : loop

  // Build scale dimension string for the filters
  const scaleStr = `${width}:${height}`

  try {
    // Write the source file into ffmpeg's virtual filesystem
    const fileBuffer = new Uint8Array(await file.arrayBuffer())
    await runExclusive(() => ffmpeg.writeFile(inputName, fileBuffer))

    if (signal?.aborted) {
      throw new DOMException('Processing cancelled.', 'AbortError')
    }

    // ── Pass 1: palettegen ────────────────────────────────────────────────
    // -ss BEFORE -i for fast seeking
    // Silent exec — palettegen is fast, no progress tracking needed
    const paletteArgs: string[] = [
      '-ss', String(startTime),
      '-i', inputName,
      '-t', String(duration),
      '-vf', `fps=${fps},scale=${scaleStr}:flags=lanczos,palettegen=max_colors=${paletteColors}:stats_mode=diff`,
      '-y', paletteName,
    ]

    await runExclusive(() => ffmpeg.exec(paletteArgs))

    if (signal?.aborted) {
      throw new DOMException('Processing cancelled.', 'AbortError')
    }

    // ── Pass 2: paletteuse with filter_complex ────────────────────────────
    // CRITICAL: Uses -filter_complex (NOT -vf) because paletteuse takes TWO
    // inputs — the scaled video stream and the palette image. Explicit
    // [0:v]/[1:v] labels and -map [outv] are REQUIRED.
    //
    // -ss before -i on the VIDEO input for fast seeking.
    // The palette is a still image (no seeking needed), so no -ss on -i for it.
    const gifArgs: string[] = [
      '-ss', String(startTime),
      '-i', inputName,
      '-i', paletteName,
      '-t', String(duration),
      '-filter_complex',
      `[0:v]fps=${fps},scale=${scaleStr}:flags=lanczos[scaled];[scaled][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle[outv]`,
      '-map', '[outv]',
      '-loop', loopValue,
      '-y', outputName,
    ]

    await execWithProgress(ffmpeg, gifArgs, onProgress, signal)

    // ── CRITICAL: Read output BEFORE deleting it ──────────────────────────
    // DO NOT move this above the finally block — it must be inside try so
    // the finally cleanup still runs if readFile fails.
    // DO NOT delete outputName before this line.
    const outputData = (await runExclusive(() =>
      ffmpeg.readFile(outputName),
    )) as Uint8Array
    const blob = new Blob([outputData], { type: 'image/gif' })

    return {
      blob,
      mimeType: 'image/gif',
      originalSize: file.size,
      outputSize: blob.size,
      width,
      height,
      duration,
      fps,
      loop,
      metadata: null, // Populated by the caller from existing state
    }
  } finally {
    // ── Cleanup temp files — ALWAYS, even on error or cancellation ───────
    // These run AFTER readFile above (in the try block), guaranteeing
    // the output is read before deletion.
    try {
      await runExclusive(() => ffmpeg.deleteFile(inputName))
    } catch {
      // Best-effort
    }
    try {
      await runExclusive(() => ffmpeg.deleteFile(paletteName))
    } catch {
      // Best-effort
    }
    try {
      await runExclusive(() => ffmpeg.deleteFile(outputName))
    } catch {
      // Best-effort
    }
  }
}
