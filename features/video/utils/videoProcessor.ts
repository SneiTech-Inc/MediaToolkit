/**
 * Core ffmpeg execution pipeline.
 *
 * Abstracts away the repetitive writeFile → exec → readFile → cleanup cycle
 * that every video tool reimplements. Each tool provides a buildArgs callback;
 * this module handles everything else: validation, ffmpeg lifecycle, progress
 * tracking, cancellation, cleanup.
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessOptions {
  /** The source video file. */
  file: File

  /**
   * Callback that builds ffmpeg arguments given the input and output filenames.
   * Called by processVideo after writing the input file to the virtual filesystem.
   *
   * The input file has already been written — start with ['-i', inputName, ...].
   * The output file should be the last argument (ffmpeg convention).
   */
  buildArgs: (inputName: string, outputName: string) => string[]

  /** Output file extension (without dot), e.g. "mp4". */
  outputExt: string

  /** MIME type for the output Blob, e.g. "video/mp4". */
  outputMime: string

  /**
   * Maximum file size in bytes. Defaults to 300 MB.
   * Pass MAX_FILE_SIZE_TRIM from videoValidation for the Trim tool.
   */
  maxSize?: number

  /**
   * Accepted input format extensions (without dots).
   * Defaults to ['mp4', 'webm', 'mov', 'mkv', 'avi'].
   */
  acceptedFormats?: readonly string[]

  /**
   * Progress callback. Called whenever ffmpeg reports encoding progress.
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

/** Generate a unique filename for ffmpeg's virtual filesystem. */
function tempName(prefix: string, suffix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${suffix}`
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Execute a video processing operation using ffmpeg.wasm.
 *
 * This is the shared entry point for all video tools. Each tool provides
 * a buildArgs callback that constructs tool-specific ffmpeg arguments.
 * Everything else (validation, ffmpeg lifecycle, progress, cleanup) is handled here.
 *
 * All ffmpeg file operations are serialized through runExclusive() to prevent
 * concurrent writeFile/exec/readFile/deleteFile races on the virtual filesystem.
 *
 * @example
 * // Trim tool usage:
 * const result = await processVideo({
 *   file,
 *   buildArgs: (input, output) => [
 *     '-ss', String(startTime), '-i', input,
 *     '-t', String(endTime - startTime),
 *     '-c', 'copy', output,
 *   ],
 *   outputExt: 'mp4',
 *   outputMime: 'video/mp4',
 *   maxSize: MAX_FILE_SIZE_TRIM,
 *   onProgress: (pct, elapsed, remaining) => { ... },
 *   signal: abortController.signal,
 * })
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

  // ── Validation (runs outside the lock — no ffmpeg needed) ───────────────
  validateFileSize(file, maxSize)
  validateInputFormat(file, acceptedFormats)

  if (signal?.aborted) {
    throw new DOMException('Processing cancelled.', 'AbortError')
  }

  // ── ffmpeg setup (outside the lock — just gets the instance) ────────────
  const ffmpeg = await getFFmpeg()

  if (signal?.aborted) {
    throw new DOMException('Processing cancelled.', 'AbortError')
  }

  // ── Progress tracking ───────────────────────────────────────────────────
  const started = performance.now()
  let cancelled = false

  const progressHandler = ({ progress }: { progress: number }) => {
    if (cancelled) return
    const pct = normalizeProgress(progress)
    const elapsed = (performance.now() - started) / 1000
    const remaining = pct > 0 ? (elapsed / pct) * 100 - elapsed : 0
    onProgress?.(pct, elapsed, remaining)
  }

  // ── Cancellation ────────────────────────────────────────────────────────
  const onAbort = () => {
    cancelled = true
    // Terminate the worker to actually stop CPU work
    terminateFFmpeg().catch(() => {})
  }

  signal?.addEventListener('abort', onAbort)

  // Register progress listener outside the lock so it tracks from the start
  ffmpeg.on('progress', progressHandler)

  // ── Serialized ffmpeg operation ─────────────────────────────────────────
  try {
    const result = await runExclusive(async () => {
      // Check cancellation before starting the locked work
      if (cancelled) {
        throw new DOMException('Processing cancelled.', 'AbortError')
      }

      const inputExt = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
      const inputName = tempName('vproc_in', inputExt)
      const outputName = tempName('vproc_out', outputExt)

      // Write the source file into ffmpeg's virtual filesystem
      const fileBuffer = new Uint8Array(await file.arrayBuffer())
      await ffmpeg.writeFile(inputName, fileBuffer)

      try {
        // Build tool-specific args and execute
        const args = buildArgs(inputName, outputName)
        const exitCode = await ffmpeg.exec(args)

        if (cancelled) {
          throw new DOMException('Processing cancelled.', 'AbortError')
        }

        if (exitCode !== 0) {
          throw new Error(
            `Processing failed (exit code ${exitCode}). The file may be corrupted or in an unsupported format. Try a different video file.`
          )
        }

        // Read the output from the virtual filesystem
        const outputData = (await ffmpeg.readFile(outputName)) as Uint8Array
        const blob = new Blob([outputData], { type: outputMime })

        return { blob, mimeType: outputMime }
      } finally {
        // Clean up virtual files — always, even on error or cancellation
        try {
          await ffmpeg.deleteFile(inputName)
        } catch {
          // Best-effort
        }
        try {
          await ffmpeg.deleteFile(outputName)
        } catch {
          // Best-effort
        }
      }
    })

    return result
  } catch (err) {
    // Re-throw AbortError as-is so the caller can distinguish cancellation from failure
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err
    }
    throw err
  } finally {
    // ── Always remove the progress listener and abort handler ────────────
    ffmpeg.off('progress', progressHandler)
    signal?.removeEventListener('abort', onAbort)
  }
}
