import { getFFmpeg, normalizeProgress } from '@/features/audio/utils/ffmpegClient'
import {
  FORMAT_CONFIG,
  RESOLUTION_HEIGHT,
  type VideoOutputFormat,
  type ConversionOptions,
  type ConversionResult,
} from '@/features/video/types'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum file size accepted for browser-based video conversion. */
const MAX_FILE_SIZE = 300 * 1024 * 1024 // 300 MB

/** Input video formats supported by this converter. */
const SUPPORTED_INPUT_FORMATS: string[] = ['mp4', 'webm', 'mov', 'mkv', 'avi']

/** Valid CRF range for H.264 encoding. */
const CRF_MIN = 18
const CRF_MAX = 32

/** Valid encoding presets. */
const VALID_PRESETS: string[] = ['fast', 'medium', 'slow']

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a unique filename for ffmpeg's virtual filesystem.
 * Mirrors the tempName helper in ffmpegClient but accepts any string suffix.
 */
function tempName(prefix: string, suffix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${suffix}`
}

/** Validate that a file extension is in our supported list. */
function validateInputFormat(file: File): void {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !SUPPORTED_INPUT_FORMATS.includes(ext)) {
    throw new Error(
      `Unsupported format: ".${ext || 'unknown'}". Supported input formats: ${SUPPORTED_INPUT_FORMATS.map(f => f.toUpperCase()).join(', ')}.`
    )
  }
}

/** Type guard: check that a string is a valid output format key. */
function isValidOutputFormat(format: string): format is VideoOutputFormat {
  return format in FORMAT_CONFIG
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert a video file to the specified output format using ffmpeg.wasm.
 *
 * All processing happens in the browser via the shared single-threaded ffmpeg
 * singleton. Encoding is CPU-bound — expect seconds to minutes depending on
 * video length, resolution, and device speed.
 *
 * @param file       - The source video file (≤ 300 MB).
 * @param options    - Output format, preset, CRF, resolution, and frame-rate settings.
 * @param onProgress - Called with 0–100 as ffmpeg reports progress.
 * @returns A blob of the converted video plus size metadata.
 */
export async function convertVideo(
  file: File,
  options: ConversionOptions,
  onProgress?: (percent: number) => void
): Promise<ConversionResult> {
  // ── Validation ──────────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      'File too large for browser-based processing — try a shorter clip or lower resolution source. Maximum file size is 300 MB.'
    )
  }

  validateInputFormat(file)

  if (!isValidOutputFormat(options.targetFormat)) {
    throw new Error(
      `Unsupported output format: "${options.targetFormat}". Supported formats: MP4, MOV, AVI, MKV.`
    )
  }

  if (!VALID_PRESETS.includes(options.preset)) {
    throw new Error(
      `Invalid preset: "${options.preset}". Use "fast", "medium", or "slow".`
    )
  }

  if (typeof options.crf !== 'number' || options.crf < CRF_MIN || options.crf > CRF_MAX) {
    throw new Error(
      `Invalid CRF value: ${options.crf}. CRF must be between ${CRF_MIN} and ${CRF_MAX}.`
    )
  }

  if (
    options.resolution !== 'original' &&
    !(options.resolution in RESOLUTION_HEIGHT)
  ) {
    throw new Error(
      `Invalid resolution: "${options.resolution}". Use "original", "1080p", "720p", "480p", or "360p".`
    )
  }

  if (
    options.frameRate !== 'original' &&
    options.frameRate !== '30' &&
    options.frameRate !== '24'
  ) {
    throw new Error(
      `Invalid frame rate: "${options.frameRate}". Use "original", "30", or "24".`
    )
  }

  // ── ffmpeg setup ────────────────────────────────────────────────────────
  const ffmpeg = await getFFmpeg()
  const config = FORMAT_CONFIG[options.targetFormat]

  const inputExt = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
  const inputName = tempName('vconvert_in', inputExt)
  const outputName = tempName('vconvert_out', config.ext)

  // Write the source file into ffmpeg's virtual filesystem
  const fileBuffer = new Uint8Array(await file.arrayBuffer())
  await ffmpeg.writeFile(inputName, fileBuffer)

  // ── Build ffmpeg arguments ──────────────────────────────────────────────
  const args: string[] = [
    '-i', inputName,
    '-c:v', 'libx264',
    '-preset', options.preset,
    '-crf', String(options.crf),
    // Ensure browser-compatible pixel format (handles unusual source formats)
    '-pix_fmt', 'yuv420p',
  ]

  // Resolution scaling (only when user selects a specific resolution)
  if (options.resolution !== 'original') {
    const height = RESOLUTION_HEIGHT[options.resolution]
    args.push('-vf', `scale=-2:${height}`)
  }

  // Frame rate override (only when user selects a specific frame rate)
  if (options.frameRate !== 'original') {
    args.push('-r', options.frameRate)
  }

  // Audio codec and bitrate per output format
  args.push('-c:a', config.audioCodec, '-b:a', config.audioBitrate)

  // Overwrite output if it exists
  args.push('-y', outputName)

  // ── Progress ────────────────────────────────────────────────────────────
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(normalizeProgress(progress))
  }

  try {
    ffmpeg.on('progress', progressHandler)

    const exitCode = await ffmpeg.exec(args)

    if (exitCode !== 0) {
      throw new Error(
        `Conversion failed (exit code ${exitCode}). The file may be corrupted or in an unsupported format. Try a different video file.`
      )
    }

    // Read the converted output from the virtual filesystem
    const outputData = (await ffmpeg.readFile(outputName)) as Uint8Array
    const blob = new Blob([outputData], { type: config.mime })

    return {
      blob,
      mimeType: config.mime,
      targetFormat: options.targetFormat,
      originalSize: file.size,
      convertedSize: blob.size,
      metadata: null, // populated by the caller from the native <video> element
    }
  } finally {
    // ── Cleanup ──────────────────────────────────────────────────────────
    ffmpeg.off('progress', progressHandler)

    try {
      await ffmpeg.deleteFile(inputName)
    } catch {
      // Best-effort — the virtual FS may have already been cleaned
    }

    try {
      await ffmpeg.deleteFile(outputName)
    } catch {
      // Best-effort
    }
  }
}
