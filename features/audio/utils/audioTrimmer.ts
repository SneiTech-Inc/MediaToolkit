import { getFFmpeg, extensionToFormat, tempName, normalizeProgress } from '@/features/audio/utils/ffmpegClient'
import { AUDIO_MIME_TYPES, type AudioFormat, type Bitrate, type SampleRate, type FLACCompression } from '@/features/audio/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrimAudioOptions {
  /** Target output format. */
  format: AudioFormat
  /** Trim start time in seconds. */
  startTime: number
  /** Trim end time in seconds. */
  endTime: number
  /** Bitrate in kbps (MP3/AAC/OGG/M4A only). */
  bitrate?: Bitrate
  /** Sample rate in Hz (WAV/FLAC only). */
  sampleRate?: SampleRate
  /** FLAC compression level 0–8 (FLAC only). */
  compressionLevel?: FLACCompression
}

export interface TrimAudioResult {
  /** The trimmed audio as a Blob (ready for download). */
  blob: Blob
  /** MIME type of the trimmed audio. */
  mimeType: string
  /** Original file size in bytes. */
  originalSize: number
  /** Trimmed output file size in bytes. */
  trimmedSize: number
  /** Original audio duration in seconds. */
  originalDuration: number
  /** Trimmed segment duration in seconds (endTime - startTime). */
  trimmedDuration: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum allowed segment duration in seconds. */
const MIN_SEGMENT_DURATION = 0.1

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Append quality/encoding flags for the output format. */
function appendQualityArgs(args: string[], options: TrimAudioOptions): void {
  if (
    options.format === 'mp3' ||
    options.format === 'aac' ||
    options.format === 'ogg' ||
    options.format === 'm4a'
  ) {
    const bitrate = options.bitrate ?? '192'
    args.push('-b:a', `${bitrate}k`)
  } else if (options.format === 'wav') {
    const sampleRate = options.sampleRate ?? '44100'
    args.push('-ar', sampleRate)
  } else if (options.format === 'flac') {
    const level = options.compressionLevel ?? '5'
    args.push('-compression_level', level)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Trim (extract a segment from) an audio file using ffmpeg.wasm.
 *
 * Uses `-ss` before `-i` for fast seeking — ffmpeg seeks to the start point
 * in the encoded stream without decoding from the beginning, which is much
 * faster on long files with the single-threaded WASM core.
 *
 * @param file - The source audio file.
 * @param options - Trim segment and output format/quality settings.
 * @param fileDuration - The file's total duration in seconds (pre-measured by
 *   the caller using a native <audio> element — no ffmpeg needed for this).
 * @param onProgress - Called with 0–100 as ffmpeg reports progress.
 * @returns A blob of the trimmed audio plus metadata.
 */
export async function trimAudio(
  file: File,
  options: TrimAudioOptions,
  fileDuration: number,
  onProgress?: (percent: number) => void
): Promise<TrimAudioResult> {
  // ── Validation ──────────────────────────────────────────────────────────
  if (!isFinite(options.startTime) || !isFinite(options.endTime)) {
    throw new Error('Start and end times must be valid numbers.')
  }
  if (options.startTime < 0) {
    throw new Error('Start time cannot be negative.')
  }
  if (options.endTime <= options.startTime) {
    throw new Error('End time must be greater than start time.')
  }
  if (options.endTime - options.startTime < MIN_SEGMENT_DURATION) {
    throw new Error(
      `Selected segment must be at least ${MIN_SEGMENT_DURATION} second${MIN_SEGMENT_DURATION === 1 ? '' : 's'} long.`
    )
  }
  if (options.endTime > fileDuration) {
    throw new Error(
      `End time (${options.endTime.toFixed(1)}s) exceeds file duration (${fileDuration.toFixed(1)}s).`
    )
  }

  // Validate file extension
  const ext = file.name.split('.').pop() ?? ''
  const inputFormat = extensionToFormat(ext)
  if (!inputFormat) {
    throw new Error(
      `Unsupported format: "${file.name}". Supported formats: MP3, WAV, AAC, OGG, FLAC, M4A.`
    )
  }

  const ffmpeg = await getFFmpeg()

  const inputName = tempName('trim_input', inputFormat)
  const outputName = tempName('trim_output', options.format)
  const segmentDuration = options.endTime - options.startTime

  // Write the input file to ffmpeg's virtual filesystem
  const fileBuffer = new Uint8Array(await file.arrayBuffer())
  await ffmpeg.writeFile(inputName, fileBuffer)

  // Wire up progress
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(normalizeProgress(progress))
  }

  try {
    ffmpeg.on('progress', progressHandler)

    // Build ffmpeg args.
    // CRITICAL: -ss BEFORE -i for fast seeking (doesn't decode from start).
    // -t specifies output duration, not -to.
    const args: string[] = [
      '-ss',
      options.startTime.toFixed(3),
      '-i',
      inputName,
      '-t',
      segmentDuration.toFixed(3),
    ]

    appendQualityArgs(args, options)

    args.push('-y', outputName)

    const exitCode = await ffmpeg.exec(args)

    if (exitCode !== 0) {
      throw new Error(
        `FFmpeg exited with code ${exitCode}. The file may be corrupted or in an unsupported format.`
      )
    }

    const outputData = (await ffmpeg.readFile(outputName)) as Uint8Array
    const mimeType = AUDIO_MIME_TYPES[options.format]
    const blob = new Blob([outputData], { type: mimeType })

    return {
      blob,
      mimeType,
      originalSize: file.size,
      trimmedSize: blob.size,
      originalDuration: fileDuration,
      trimmedDuration: segmentDuration,
    }
  } finally {
    ffmpeg.off('progress', progressHandler)
    try {
      await ffmpeg.deleteFile(inputName)
    } catch {
      // Best-effort cleanup
    }
    try {
      await ffmpeg.deleteFile(outputName)
    } catch {
      // Best-effort cleanup
    }
  }
}
