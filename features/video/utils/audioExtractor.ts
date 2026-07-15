/**
 * Audio Extractor utility — extracts audio tracks from video files.
 *
 * Uses ffmpeg.wasm with -vn to exclude the video stream. Supports 6 output
 * formats with format-specific quality controls:
 *   MP3/AAC/M4A — bitrate-based (64–320 kbps)
 *   WAV         — uncompressed PCM (sample rate + bit depth)
 *   OGG         — Vorbis quality scale (0–10)
 *   FLAC        — lossless compression (level 0–8)
 *
 * estimateAudioSize branches by format category — NOT one formula for all:
 *   Bitrate formats:  (bitrate_kbps × 1000 / 8) × duration
 *   WAV (PCM):        sampleRate × (bitDepth/8) × channels × duration
 *   OGG:              quality → kbps lookup (approximate)
 *   FLAC:             WAV equivalent × compression ratio range
 *
 * CRITICAL: Output is read BEFORE temp file deletion.
 * The readFile call is inside the try block; deleteFile is in the finally block.
 */

import { execWithProgress } from '@/features/video/utils/videoProcessor'
import { getFFmpeg, runExclusive } from '@/features/audio/utils/ffmpegClient'
import {
  validateFileSize,
  validateInputFormat,
  MAX_FILE_SIZE_TRIM,
} from '@/features/video/utils/videoValidation'
import { AUDIO_MIME_TYPES } from '@/features/audio/types'
import type { AudioFormat, Bitrate, SampleRate, FLACCompression } from '@/features/audio/types'
import type { ExtractAudioResult } from '@/features/video/types'
import type { FFmpeg } from '@ffmpeg/ffmpeg'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Output audio formats supported by Extract Audio. */
export type AudioExtractFormat = AudioFormat // 'mp3' | 'wav' | 'aac' | 'ogg' | 'flac' | 'm4a'

/** Quality options passed to the extractor. */
export interface ExtractAudioOptions {
  /** Target output audio format. */
  format: AudioExtractFormat
  /** Bitrate in kbps (MP3/AAC/M4A only). */
  bitrate?: Bitrate
  /** Sample rate in Hz (WAV only). */
  sampleRate?: SampleRate
  /** OGG Vorbis quality 0–10 (OGG only). */
  oggQuality?: number
  /** FLAC compression level 0–8 (FLAC only). */
  flacCompression?: FLACCompression
}

/** Return type from estimateAudioSize. */
export interface AudioSizeEstimate {
  /** Estimated size in bytes. */
  bytes: number
  /** Whether this is an approximation (true for OGG, FLAC). */
  isApproximate: boolean
  /** Optional range for formats where exact prediction is impossible (FLAC). */
  range?: { low: number; high: number }
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default bitrate for lossy formats. */
const DEFAULT_BITRATE_KBPS = 192

/** Default sample rate for WAV. */
const DEFAULT_SAMPLE_RATE = 44100

/** Default OGG quality (Vorbis scale). */
const DEFAULT_OGG_QUALITY = 5

/** Default FLAC compression level. */
const DEFAULT_FLAC_COMPRESSION = 5

/** WAV PCM bit depth (16-bit). */
const PCM_BIT_DEPTH = 16

/** WAV channel count (stereo). */
const PCM_CHANNELS = 2

/** Accepted input video formats. */
const ACCEPTED_INPUT_FORMATS = ['mp4', 'webm', 'mov', 'mkv', 'avi']

// ─── OGG Quality → Approximate Bitrate Lookup ─────────────────────────────────

/**
 * Approximate Vorbis bitrate for each quality level (0–10).
 *
 * OGG Vorbis uses a quality scale, not a target bitrate — the actual bitrate
 * varies with audio content. These values are approximate nominal rates
 * commonly cited for the Vorbis encoder at 44.1 kHz stereo.
 *
 * Used by estimateAudioSize to give a ballpark figure; clearly marked as
 * approximate in the UI.
 */
export const OGG_QUALITY_TO_KBPS: Record<number, number> = {
  0: 45,
  1: 64,
  2: 80,
  3: 96,
  4: 112,
  5: 128,
  6: 160,
  7: 192,
  8: 224,
  9: 256,
  10: 320,
}

// ─── Size Estimation ──────────────────────────────────────────────────────────

/**
 * Estimate the output audio file size for the given format and quality options.
 *
 * Branches by format category — NOT one formula for all:
 * - MP3/AAC/M4A: bitrate-based (precise)
 * - WAV: PCM uncompressed (precise)
 * - OGG: quality→kbps lookup (approximate)
 * - FLAC: WAV-based compression ratio range (approximate range)
 *
 * @param format   — Target output format.
 * @param options  — Quality settings for the selected format.
 * @param duration — Audio duration in seconds.
 * @returns Estimated size with approximate flag and optional range.
 */
export function estimateAudioSize(
  format: AudioExtractFormat,
  options: ExtractAudioOptions,
  duration: number,
): AudioSizeEstimate {
  if (duration <= 0) {
    return { bytes: 0, isApproximate: false }
  }

  if (format === 'wav') {
    // Uncompressed PCM: sampleRate × (bitDepth/8) × channels × duration
    const sampleRate = options.sampleRate ? parseInt(options.sampleRate, 10) : DEFAULT_SAMPLE_RATE
    const bytesPerSecond = sampleRate * (PCM_BIT_DEPTH / 8) * PCM_CHANNELS
    const bytes = bytesPerSecond * duration
    return { bytes, isApproximate: false }
  }

  if (format === 'flac') {
    // FLAC is lossless — actual size depends on audio content complexity.
    // Typical compression: 30–70% of WAV equivalent. Show a range.
    const wavBytes = DEFAULT_SAMPLE_RATE * (PCM_BIT_DEPTH / 8) * PCM_CHANNELS * duration
    return {
      bytes: Math.round(wavBytes * 0.5), // midpoint for single-value display
      isApproximate: true,
      range: {
        low: Math.round(wavBytes * 0.3),
        high: Math.round(wavBytes * 0.7),
      },
    }
  }

  if (format === 'ogg') {
    // OGG Vorbis quality doesn't map to a specific bitrate — use lookup table
    const quality = options.oggQuality ?? DEFAULT_OGG_QUALITY
    const approxKbps = OGG_QUALITY_TO_KBPS[Math.round(quality)] ?? OGG_QUALITY_TO_KBPS[5]
    const bytes = (approxKbps * 1000) / 8 * duration
    return { bytes, isApproximate: true }
  }

  // MP3, AAC, M4A — lossy, bitrate-based (precise)
  const bitrateKbps = options.bitrate ? parseInt(options.bitrate, 10) : DEFAULT_BITRATE_KBPS
  const bytes = (bitrateKbps * 1000) / 8 * duration
  return { bytes, isApproximate: false }
}

/**
 * Format an AudioSizeEstimate into a human-readable string.
 *
 * @example formatEstimatedSize({ bytes: 4194304, isApproximate: false }) → "~4.0 MB"
 * @example formatEstimatedSize({ bytes: 2621440, isApproximate: true, range: { low: 1572864, high: 3670016 } }) → "~1.5–3.5 MB"
 */
export function formatEstimatedSize(estimate: AudioSizeEstimate): string {
  if (estimate.bytes <= 0) return '--'

  const formatMb = (b: number) => {
    const mb = b / (1024 * 1024)
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
    if (mb >= 1) return `${mb.toFixed(1)} MB`
    return `${Math.round(b / 1024)} KB`
  }

  if (estimate.range) {
    return `~${formatMb(estimate.range.low)}–${formatMb(estimate.range.high)}`
  }

  const prefix = estimate.isApproximate ? '~' : '~'
  return `${prefix}${formatMb(estimate.bytes)}`
}

// ─── FFmpeg Argument Builder ──────────────────────────────────────────────────

/**
 * Build ffmpeg arguments for audio extraction.
 *
 * Always includes -vn to exclude the video stream. Format-specific quality
 * args are applied based on the selected output format.
 *
 * AAC encoder note: ffmpeg.wasm 0.12.x ships with ffmpeg 6.1 where the
 * native AAC encoder is stable. -strict -2 is included as a defensive
 * measure for older or custom ffmpeg builds where AAC may still be marked
 * experimental — it is a harmless no-op on stable encoders.
 *
 * @param inputName  — Virtual filesystem path of the input file.
 * @param outputName — Virtual filesystem path for the output file.
 * @param options    — Extraction configuration.
 * @returns Full ffmpeg argument array.
 */
export function buildExtractArgs(
  inputName: string,
  outputName: string,
  options: ExtractAudioOptions,
): string[] {
  const args: string[] = ['-i', inputName, '-vn']

  switch (options.format) {
    case 'mp3':
      args.push('-c:a', 'libmp3lame', '-b:a', `${options.bitrate ?? DEFAULT_BITRATE_KBPS}k`)
      break

    case 'aac':
    case 'm4a':
      // -strict -2: safety for ffmpeg builds where native AAC encoder is still
      // marked experimental. No-op on stable builds (ffmpeg 6.0+).
      args.push(
        '-c:a', 'aac',
        '-b:a', `${options.bitrate ?? DEFAULT_BITRATE_KBPS}k`,
        '-strict', '-2',
      )
      break

    case 'wav':
      args.push('-c:a', 'pcm_s16le', '-ar', options.sampleRate ?? String(DEFAULT_SAMPLE_RATE))
      break

    case 'ogg':
      args.push('-c:a', 'libvorbis', '-q:a', String(options.oggQuality ?? DEFAULT_OGG_QUALITY))
      break

    case 'flac':
      args.push('-c:a', 'flac', '-compression_level', options.flacCompression ?? String(DEFAULT_FLAC_COMPRESSION))
      break

    default:
      // Should never happen — TypeScript exhaustiveness
      throw new Error(`Unsupported output format: ${options.format}`)
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
 * Extract audio from a video file.
 *
 * Self-contained processing function that manages its own ffmpeg lifecycle
 * (write → exec → read → delete). Uses execWithProgress for progress
 * tracking and cancellation support.
 *
 * CRITICAL: Output data is read BEFORE temp files are deleted.
 * The finally block deletes all temp files strictly after readFile resolves.
 *
 * @param file       — The source video file.
 * @param options    — Extraction configuration.
 * @param onProgress — Optional progress callback (percent, elapsed, remaining).
 * @param signal     — Optional AbortSignal for cancellation.
 * @returns ExtractAudioResult with the output blob and metadata.
 */
export async function extractAudio(
  file: File,
  options: ExtractAudioOptions,
  onProgress?: (percent: number, elapsed: number, remaining: number) => void,
  signal?: AbortSignal,
): Promise<ExtractAudioResult> {
  // ── Validation ──────────────────────────────────────────────────────────
  validateFileSize(file, MAX_FILE_SIZE_TRIM)
  validateInputFormat(file, ACCEPTED_INPUT_FORMATS)

  if (signal?.aborted) {
    throw new DOMException('Processing cancelled.', 'AbortError')
  }

  // ── ffmpeg setup ────────────────────────────────────────────────────────
  const ffmpeg: FFmpeg = await getFFmpeg()

  if (signal?.aborted) {
    throw new DOMException('Processing cancelled.', 'AbortError')
  }

  const inputExt = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
  const inputName = tempName('ext_in', inputExt)
  const outputExt = options.format
  const outputName = tempName('ext_out', outputExt)

  try {
    // Write the source file into ffmpeg's virtual filesystem
    const fileBuffer = new Uint8Array(await file.arrayBuffer())
    await runExclusive(() => ffmpeg.writeFile(inputName, fileBuffer))

    // Build extraction args and execute
    const args = buildExtractArgs(inputName, outputName, options)
    await execWithProgress(ffmpeg, args, onProgress, signal)

    // ── CRITICAL: Read output BEFORE deleting it ──────────────────────────
    // DO NOT delete outputName before this line.
    const outputData = (await runExclusive(() =>
      ffmpeg.readFile(outputName),
    )) as Uint8Array
    const mimeType = AUDIO_MIME_TYPES[options.format]
    const blob = new Blob([outputData], { type: mimeType })

    // Extract duration from the source metadata (populated by caller)
    return {
      blob,
      mimeType,
      outputFormat: options.format,
      originalSize: file.size,
      outputSize: blob.size,
      duration: 0, // Populated by the caller from video metadata
      hasAudio: true,
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
