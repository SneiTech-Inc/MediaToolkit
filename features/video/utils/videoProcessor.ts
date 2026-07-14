/**
 * Core ffmpeg execution pipeline.
 *
 * Provides two layers:
 * 1. execWithProgress() — raw ffmpeg.exec() with progress tracking and
 *    cancellation. Callers manage their own file I/O (writeFile/readFile/
 *    deleteFile). Used by multi-input tools like Merge Video.
 * 2. processVideo() — convenience wrapper for single-file tools. Handles
 *    validation, writeFile, execWithProgress, readFile, and cleanup in one call.
 *    Used by Compress, Convert, Trim.
 *
 * All ffmpeg operations are serialized through runExclusive() to prevent
 * virtual filesystem races on the shared ffmpeg.wasm singleton.
 */

import {
  getFFmpeg,
  normalizeProgress,
  runExclusive,
  terminateFFmpeg,
} from '@/features/audio/utils/ffmpegClient'
import { validateFileSize, validateInputFormat } from '@/features/video/utils/videoValidation'
import type { FFmpeg } from '@ffmpeg/ffmpeg'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessOptions {
  /** The source video file. */
  file: File

  /**
   * Callback that builds ffmpeg arguments given the input and output filenames.
   * Called by processVideo after writing the input file to the virtual filesystem.
   */
  buildArgs: (inputName: string, outputName: string) => string[]

  /** Output file extension (without dot), e.g. "mp4". */
  outputExt: string

  /** MIME type for the output Blob, e.g. "video/mp4". */
  outputMime: string

  /** Maximum file size in bytes. Defaults to 300 MB. */
  maxSize?: number

  /** Accepted input format extensions (without dots). */
  acceptedFormats?: readonly string[]

  /**
   * Progress callback.
   * @param percent   — 0–100 progress value.
   * @param elapsed   — Seconds elapsed since processing started.
   * @param remaining — Estimated seconds remaining.
   */
  onProgress?: (percent: number, elapsed: number, remaining: number) => void

  /** AbortSignal for cancellation support. */
  signal?: AbortSignal
}

export interface ProcessResult {
  /** The processed video as a Blob. */
  blob: Blob
  /** MIME type of the output. */
  mimeType: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_ACCEPTED_FORMATS = ['mp4', 'webm', 'mov', 'mkv', 'avi']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tempName(prefix: string, suffix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${suffix}`
}

// ─── Layer 1: Raw exec + progress + cancellation ─────────────────────────────

/**
 * Execute ffmpeg with progress tracking and cancellation support.
 *
 * This is the single source of truth for progress/cancellation handling.
 * Every video tool (single-file or multi-file) routes through here so there
 * is exactly ONE implementation, not separately maintained copies.
 *
 * Callers are responsible for:
 * - Writing input files to the virtual FS before calling
 * - Reading output files from the virtual FS after this resolves
 * - Cleaning up temp files
 *
 * @param ffmpeg      - Already-loaded ffmpeg instance.
 * @param args        - Full ffmpeg argument array (including -y outputName).
 * @param onProgress  - Optional progress callback (percent, elapsed, remaining).
 * @param signal      - Optional AbortSignal for cancellation.
 */
export async function execWithProgress(
  ffmpeg: FFmpeg,
  args: string[],
  onProgress?: (percent: number, elapsed: number, remaining: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException('Processing cancelled.', 'AbortError')
  }

  const started = performance.now()
  let cancelled = false

  const progressHandler = ({ progress }: { progress: number }) => {
    if (cancelled) return
    const pct = normalizeProgress(progress)
    const elapsed = (performance.now() - started) / 1000
    const remaining = pct > 0 ? (elapsed / pct) * 100 - elapsed : 0
    onProgress?.(pct, elapsed, remaining)
  }

  const onAbort = () => {
    cancelled = true
    terminateFFmpeg().catch(() => {})
  }

  signal?.addEventListener('abort', onAbort)

  try {
    ffmpeg.on('progress', progressHandler)

    const exitCode = await runExclusive(() => ffmpeg.exec(args))

    if (cancelled) {
      throw new DOMException('Processing cancelled.', 'AbortError')
    }

    if (exitCode !== 0) {
      throw new Error(
        `Processing failed (exit code ${exitCode}). The file may be corrupted or unsupported.`
      )
    }
  } catch (err) {
    // Cancelled operations always surface as AbortError, even if
    // ffmpeg.exec() threw because the worker was terminated mid-operation.
    if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) {
      throw new DOMException('Processing cancelled.', 'AbortError')
    }
    throw err
  } finally {
    ffmpeg.off('progress', progressHandler)
    signal?.removeEventListener('abort', onAbort)
  }
}

// ─── Layer 2: Single-file convenience wrapper ─────────────────────────────────

/**
 * Execute a single-file video processing operation.
 *
 * Convenience wrapper that handles validation, writing the input file,
 * calling execWithProgress(), reading the output, and cleanup.
 *
 * For multi-input tools (e.g. Merge Video), use execWithProgress() directly
 * and manage file I/O yourself.
 */
export async function processVideo(options: ProcessOptions): Promise<ProcessResult> {
  const {
    file,
    buildArgs,
    outputExt,
    outputMime,
    maxSize = 300 * 1024 * 1024,
    acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
    onProgress,
    signal,
  } = options

  // ── Validation ──────────────────────────────────────────────────────────
  validateFileSize(file, maxSize)
  validateInputFormat(file, acceptedFormats)

  if (signal?.aborted) {
    throw new DOMException('Processing cancelled.', 'AbortError')
  }

  // ── ffmpeg setup ────────────────────────────────────────────────────────
  const ffmpeg = await getFFmpeg()

  if (signal?.aborted) {
    throw new DOMException('Processing cancelled.', 'AbortError')
  }

  const inputExt = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
  const inputName = tempName('vproc_in', inputExt)
  const outputName = tempName('vproc_out', outputExt)

  try {
    // Write the source file into ffmpeg's virtual filesystem
    const fileBuffer = new Uint8Array(await file.arrayBuffer())
    await runExclusive(() => ffmpeg.writeFile(inputName, fileBuffer))

    // Build tool-specific args and execute
    const args = buildArgs(inputName, outputName)
    await execWithProgress(ffmpeg, args, onProgress, signal)

    // Read the output
    const outputData = (await runExclusive(() => ffmpeg.readFile(outputName))) as Uint8Array
    const blob = new Blob([outputData], { type: outputMime })

    return { blob, mimeType: outputMime }
  } finally {
    // Clean up virtual files — always, even on error or cancellation
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
