import { getFFmpeg, extensionToFormat, tempName, normalizeProgress } from '@/features/audio/utils/ffmpegClient'
import { AUDIO_MIME_TYPES, type AudioFormat, type Bitrate, type SampleRate, type FLACCompression } from '@/features/audio/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChangeVolumeOptions {
  /** Target output format. */
  format: AudioFormat
  /** Volume ratio — 0.0 = mute, 1.0 = original, 2.0 = double, etc. */
  ratio: number
  /** Bitrate in kbps (MP3/AAC/OGG/M4A only). */
  bitrate?: Bitrate
  /** Sample rate in Hz (WAV/FLAC only). */
  sampleRate?: SampleRate
  /** FLAC compression level 0–8 (FLAC only). */
  compressionLevel?: FLACCompression
}

export interface ChangeVolumeResult {
  /** The volume-adjusted audio as a Blob. */
  blob: Blob
  /** MIME type of the output. */
  mimeType: string
  /** Original file size in bytes. */
  originalSize: number
  /** Adjusted output file size in bytes. */
  adjustedSize: number
  /** The ratio that was applied. */
  ratio: number
}

// ─── Conversion Math ──────────────────────────────────────────────────────────

/**
 * Convert a volume ratio to a percentage integer.
 * @example ratioToPercent(1.0) → 100
 * @example ratioToPercent(0.5) → 50
 */
export function ratioToPercent(ratio: number): number {
  return Math.round(ratio * 100)
}

/**
 * Convert a percentage integer to a volume ratio.
 * @example percentToRatio(100) → 1.0
 * @example percentToRatio(50) → 0.5
 */
export function percentToRatio(percent: number): number {
  return percent / 100
}

/**
 * Convert a volume ratio to decibels (dB).
 * @example ratioToDb(1.0) → 0
 * @example ratioToDb(0.5) → -6.0
 * @example ratioToDb(2.0) → 6.0
 * @example ratioToDb(0.0) → -Infinity
 */
export function ratioToDb(ratio: number): number {
  if (ratio <= 0) return -Infinity
  return 20 * Math.log10(ratio)
}

/**
 * Convert decibels to a volume ratio.
 * @example dbToRatio(0) → 1.0
 * @example dbToRatio(-6) → 0.5
 * @example dbToRatio(6) → 2.0
 */
export function dbToRatio(db: number): number {
  return Math.pow(10, db / 20)
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Sane upper bound for ratio — prevents ridiculously amplified noise. */
const MAX_RATIO = 3

// ─── Helpers ──────────────────────────────────────────────────────────────────

function appendQualityArgs(args: string[], options: ChangeVolumeOptions): void {
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
 * Adjust the volume (loudness) of an audio file using ffmpeg.wasm.
 *
 * Uses ffmpeg's `volume` audio filter. When boosting (ratio > 1.0),
 * chains an `alimiter` filter afterward to prevent hard clipping on source
 * material that's already near full scale.
 *
 * @param file - The source audio file.
 * @param options - Volume ratio, output format, and quality settings.
 * @param onProgress - Called with 0–100 as ffmpeg reports progress.
 * @returns A blob of the volume-adjusted audio plus metadata.
 */
export async function changeVolume(
  file: File,
  options: ChangeVolumeOptions,
  onProgress?: (percent: number) => void
): Promise<ChangeVolumeResult> {
  // ── Validation ──────────────────────────────────────────────────────────
  if (!isFinite(options.ratio)) {
    throw new Error('Volume ratio must be a valid number.')
  }
  if (options.ratio < 0) {
    throw new Error('Volume ratio cannot be negative.')
  }
  if (options.ratio > MAX_RATIO) {
    throw new Error(
      `Volume ratio cannot exceed ${MAX_RATIO}× (${ratioToPercent(MAX_RATIO)}%).`
    )
  }

  const ext = file.name.split('.').pop() ?? ''
  if (!extensionToFormat(ext)) {
    throw new Error(
      `Unsupported format: "${file.name}". Supported formats: MP3, WAV, AAC, OGG, FLAC, M4A.`
    )
  }

  const ffmpeg = await getFFmpeg()

  const inputFormat = extensionToFormat(ext)!
  const inputName = tempName('vol_input', inputFormat)
  const outputName = tempName('vol_output', options.format)

  // Write input to ffmpeg virtual FS
  const fileBuffer = new Uint8Array(await file.arrayBuffer())
  await ffmpeg.writeFile(inputName, fileBuffer)

  // Build the volume filter.
  // When boosting (ratio > 1.0), chain an alimiter to prevent clipping.
  const volumeValue = options.ratio.toFixed(6)
  const audioFilter =
    options.ratio > 1.0
      ? `volume=${volumeValue},alimiter=limit=0.95`
      : `volume=${volumeValue}`

  // Progress
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(normalizeProgress(progress))
  }

  try {
    ffmpeg.on('progress', progressHandler)

    const args: string[] = [
      '-i',
      inputName,
      '-af',
      audioFilter,
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
      adjustedSize: blob.size,
      ratio: options.ratio,
    }
  } finally {
    ffmpeg.off('progress', progressHandler)
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
}
