/**
 * Video Reverser utility — memory estimation, safety guard, and ffmpeg
 * filter_complex argument construction for reversing video.
 *
 * CRITICAL MEMORY CONSTRAINT:
 * ffmpeg's reverse/areverse filters must buffer the ENTIRE decoded video
 * in WASM memory before producing any output. Unlike every other filter
 * used in this project (trim, crop, rotate, resize, speed — all stream
 * frame-by-frame), reverse is an O(n) memory operation where n = total
 * decoded frames.
 *
 * A 1080p30 clip needs roughly 90 MB of raw buffered memory PER SECOND.
 * The existing 500 MB file-size limit does NOT protect against this —
 * compressed file size has no relation to decoded memory footprint.
 *
 * This module provides a resolution-and-duration-aware guard that MUST be
 * checked BEFORE enabling the Reverse button.
 *
 * Audio handling:
 * - When the input has an audio track: both [0:v]reverse and [0:a]areverse
 * - When the input is video-only: [0:v]reverse only, no [0:a] reference
 *   (referencing a non-existent stream breaks ffmpeg)
 *
 * Re-encoding is always required — stream copy is impossible with reverse.
 */

import { execWithProgress } from '@/features/video/utils/videoProcessor'
import {
  getFFmpeg,
  runExclusive,
} from '@/features/audio/utils/ffmpegClient'
import { buildEncoderArgs } from '@/features/video/utils/videoEncoder'
import type { EncoderOptions } from '@/features/video/utils/videoEncoder'
import {
  validateFileSize,
  validateInputFormat,
  MAX_FILE_SIZE_TRIM,
} from '@/features/video/utils/videoValidation'
import { FORMAT_CONFIG } from '@/features/video/types'
import type {
  VideoOutputFormat,
  ReverseResult,
} from '@/features/video/types'
import type { FFmpeg } from '@ffmpeg/ffmpeg'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReverseArgOptions {
  /** Whether the source video has an audio stream. */
  hasAudio: boolean
  /** Target output container format. */
  targetFormat: VideoOutputFormat
  /** Encoder options for both video and audio re-encode. */
  encoderOptions: EncoderOptions
}

export interface ReverseVideoOptions {
  /** The source video file. */
  file: File
  /** Whether the source video has an audio stream. */
  hasAudio: boolean
  /** Target output container format. */
  targetFormat: VideoOutputFormat
  /** Encoder options for both video and audio re-encode. */
  encoderOptions: EncoderOptions
  /** Progress callback. */
  onProgress?: (percent: number, elapsed: number, remaining: number) => void
  /** AbortSignal for cancellation. */
  signal?: AbortSignal
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum estimated decoded-frame-buffer size (in bytes) allowed for reversing.
 *
 * 1 GB is a conservative ceiling for modern browser tabs with ffmpeg.wasm
 * overhead (the WASM heap itself takes ~256–512 MB). The actual peak usage
 * also includes encoder working buffers, so real consumption is higher than
 * the raw frame-buffer estimate alone.
 *
 * At 1080p30 this allows ~11 seconds. At 720p30 it allows ~20 seconds.
 * At 480p30 it allows ~47 seconds. At 4K30 it allows ~3 seconds.
 */
export const REVERSE_MAX_BUFFER_BYTES = 1024 * 1024 * 1024 // 1 GiB

/** Bytes per pixel for YUV420p chroma subsampling (ffmpeg's internal format). */
const BYTES_PER_PIXEL_YUV420P = 1.5

/** Default FPS used for the conservative estimate when real FPS is unknown. */
const DEFAULT_CONSERVATIVE_FPS = 30

// ─── Memory Estimation ────────────────────────────────────────────────────────

/**
 * Estimate the raw decoded-frame-buffer size required to reverse a video.
 *
 * Formula: width × height × 1.5 bytes/pixel × fps × duration
 *
 * The 1.5 bytes/pixel accounts for YUV420p chroma subsampling — the internal
 * format ffmpeg uses when decoding. Each 2×2 pixel block has 4 Y samples
 * (4 bytes) + 1 U sample (1 byte) + 1 V sample (1 byte) = 6 bytes,
 * averaging to 1.5 bytes per pixel.
 *
 * @param width    — Frame width in pixels.
 * @param height   — Frame height in pixels.
 * @param duration — Video duration in seconds.
 * @param fps      — Frames per second (use 30 as a conservative default when unknown).
 * @returns Estimated raw buffer size in bytes.
 */
export function estimateReverseMemoryUsage(
  width: number,
  height: number,
  duration: number,
  fps: number,
): number {
  if (width <= 0 || height <= 0 || duration <= 0 || fps <= 0) return 0
  return width * height * BYTES_PER_PIXEL_YUV420P * fps * duration
}

/**
 * Conservative memory estimate using fps=30 when the real frame rate
 * is not yet known from an ffmpeg probe.
 */
export function estimateReverseMemoryUsageConservative(
  width: number,
  height: number,
  duration: number,
): number {
  return estimateReverseMemoryUsage(width, height, duration, DEFAULT_CONSERVATIVE_FPS)
}

/**
 * Returns true if the estimated reverse buffer fits within the safe threshold.
 */
export function canSafelyReverse(
  width: number,
  height: number,
  duration: number,
  fps: number,
): boolean {
  return estimateReverseMemoryUsage(width, height, duration, fps) <= REVERSE_MAX_BUFFER_BYTES
}

/**
 * Returns true using the conservative fps=30 estimate.
 */
export function canSafelyReverseConservative(
  width: number,
  height: number,
  duration: number,
): boolean {
  return canSafelyReverse(width, height, duration, DEFAULT_CONSERVATIVE_FPS)
}

/**
 * Format a raw byte count into a human-readable memory string.
 *
 * @example formatReverseMemoryEstimate(890_000_000) → "~890 MB"
 */
export function formatReverseMemoryEstimate(bytes: number): string {
  if (bytes <= 0) return '~0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) {
    return `~${(mb / 1024).toFixed(1)} GB`
  }
  return `~${Math.round(mb)} MB`
}

// ─── FFmpeg Argument Builder ──────────────────────────────────────────────────

/**
 * Build full ffmpeg arguments for a reverse operation.
 *
 * Uses filter_complex to process both video (reverse) and audio (areverse)
 * in a single coordinated filter graph. For video-only files, only the
 * video branch is included — DO NOT unconditionally reference [0:a].
 *
 * Always full re-encode — stream copy is impossible with reverse.
 *
 * @param inputName  — Virtual filesystem path of the input file.
 * @param outputName — Virtual filesystem path for the output file.
 * @param options    — Reverse configuration.
 * @returns Full ffmpeg argument array.
 */
export function buildReverseArgs(
  inputName: string,
  outputName: string,
  options: ReverseArgOptions,
): string[] {
  const { hasAudio, targetFormat, encoderOptions } = options

  const args: string[] = ['-i', inputName]

  // ── Build filter_complex ──────────────────────────────────────────────
  if (hasAudio) {
    args.push(
      '-filter_complex',
      '[0:v]reverse[outv];[0:a]areverse[outa]',
    )
    args.push('-map', '[outv]', '-map', '[outa]')
  } else {
    // Video-only: no audio branch — referencing [0:a] would break
    args.push('-filter_complex', '[0:v]reverse[outv]')
    args.push('-map', '[outv]')
  }

  // ── Encoder args (video + audio) — always re-encode ───────────────────
  // Both reverse and areverse modify decoded streams before the encoder
  // receives them, so stream copy is impossible.
  const encoderArgs = buildEncoderArgs({
    ...encoderOptions,
    resolution: 'original',
  })
  args.push(...encoderArgs)

  // ── Preserve metadata ─────────────────────────────────────────────────
  args.push('-map_metadata', '0')

  // ── Fast start for streaming-friendly containers ──────────────────────
  if (targetFormat === 'mp4' || targetFormat === 'mov') {
    args.push('-movflags', '+faststart')
  }

  args.push('-y', outputName)

  return args
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tempName(prefix: string, suffix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${suffix}`
}

// ─── Processing ───────────────────────────────────────────────────────────────

/**
 * Reverse a video file.
 *
 * Self-contained processing function that manages its own ffmpeg lifecycle
 * (write → exec → read → delete). Does NOT use processVideo() because
 * the memory guard is applied in the component BEFORE this function is
 * called — processVideo's internal validation is generic and doesn't
 * account for the reverse-specific memory constraint.
 *
 * CRITICAL: Output data is read BEFORE temp files are deleted.
 * The finally block deletes all temp files strictly after readFile resolves.
 *
 * @param options — Reverse configuration including file, format, encoder options.
 * @returns ReverseResult with the output blob and metadata.
 */
export async function reverseVideo(options: ReverseVideoOptions): Promise<ReverseResult> {
  const {
    file,
    hasAudio,
    targetFormat,
    encoderOptions,
    onProgress,
    signal,
  } = options

  // ── Validation ──────────────────────────────────────────────────────────
  validateFileSize(file, MAX_FILE_SIZE_TRIM)
  validateInputFormat(file, ['mp4', 'webm', 'mov', 'mkv', 'avi'])

  if (signal?.aborted) {
    throw new DOMException('Processing cancelled.', 'AbortError')
  }

  // ── ffmpeg setup ────────────────────────────────────────────────────────
  const ffmpeg: FFmpeg = await getFFmpeg()

  if (signal?.aborted) {
    throw new DOMException('Processing cancelled.', 'AbortError')
  }

  const inputExt = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
  const inputName = tempName('rev_in', inputExt)
  const outputExt = FORMAT_CONFIG[targetFormat].ext
  const outputName = tempName('rev_out', outputExt)

  try {
    // Write the source file into ffmpeg's virtual filesystem
    const fileBuffer = new Uint8Array(await file.arrayBuffer())
    await runExclusive(() => ffmpeg.writeFile(inputName, fileBuffer))

    // Build reverse-specific args and execute
    const args = buildReverseArgs(inputName, outputName, {
      hasAudio,
      targetFormat,
      encoderOptions,
    })
    await execWithProgress(ffmpeg, args, onProgress, signal)

    // ── CRITICAL: Read output BEFORE deleting it ──────────────────────────
    // DO NOT move this above the finally block — it must be inside try so
    // the finally cleanup still runs if readFile fails.
    // DO NOT delete outputName before this line.
    const outputData = (await runExclusive(() =>
      ffmpeg.readFile(outputName),
    )) as Uint8Array
    const blob = new Blob([outputData], { type: FORMAT_CONFIG[targetFormat].mime })

    return {
      blob,
      mimeType: FORMAT_CONFIG[targetFormat].mime,
      targetFormat,
      originalSize: file.size,
      outputSize: blob.size,
      hasAudio,
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
      await runExclusive(() => ffmpeg.deleteFile(outputName))
    } catch {
      // Best-effort
    }
  }
}
