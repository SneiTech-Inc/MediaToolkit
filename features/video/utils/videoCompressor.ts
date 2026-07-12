import { getFFmpeg, normalizeProgress } from '@/features/audio/utils/ffmpegClient'
import {
  CRF_MAP,
  RESOLUTION_HEIGHT,
  type VideoFormat,
  type CompressionOptions,
  type CompressionResult,
} from '@/features/video/types'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum file size accepted for browser-based video compression. */
const MAX_FILE_SIZE = 300 * 1024 * 1024 // 300 MB

/** Video formats supported by the UploadDropzone and this processor. */
const SUPPORTED_FORMATS: VideoFormat[] = ['mp4', 'mov', 'webm', 'mkv']

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a unique filename for ffmpeg's virtual filesystem.
 * Mirrors the tempName helper in ffmpegClient but accepts any string suffix.
 */
function tempName(prefix: string, suffix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${suffix}`
}

/** Validate that a file extension is in our supported list. */
function validateFormat(file: File): void {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !(SUPPORTED_FORMATS as string[]).includes(ext)) {
    throw new Error(
      `Unsupported format: "${file.name}". Supported formats: MP4, MOV, WebM, MKV.`
    )
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compress a video file using ffmpeg.wasm (H.264 + AAC, CRF-based quality).
 *
 * All processing happens in the browser via the shared single-threaded ffmpeg
 * singleton. Encoding is CPU-bound — expect seconds to minutes depending on
 * video length, resolution, and device speed.
 *
 * @param file       - The source video file (≤ 300 MB).
 * @param options    - Quality, resolution, and frame-rate settings.
 * @param onProgress - Called with 0–100 as ffmpeg reports progress.
 * @returns A blob of the compressed MP4 video plus size metadata.
 */
export async function compressVideo(
  file: File,
  options: CompressionOptions,
  onProgress?: (percent: number) => void
): Promise<CompressionResult> {
  // ── Validation ──────────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      'File too large for browser-based processing — try a shorter clip or lower resolution source. Maximum file size is 300 MB.'
    )
  }

  validateFormat(file)

  if (!(options.quality in CRF_MAP)) {
    throw new Error(`Invalid quality level: "${options.quality}". Use "low", "medium", or "high".`)
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

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
  const inputName = tempName('vcompress_in', ext)
  const outputName = tempName('vcompress_out', 'mp4')

  // Write the source file into ffmpeg's virtual filesystem
  const fileBuffer = new Uint8Array(await file.arrayBuffer())
  await ffmpeg.writeFile(inputName, fileBuffer)

  // ── Build ffmpeg arguments ──────────────────────────────────────────────
  const args: string[] = [
    '-i', inputName,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', String(CRF_MAP[options.quality]),
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

  // Audio: re-encode to AAC at a reasonable bitrate
  args.push('-c:a', 'aac', '-b:a', '128k')

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
        `Compression failed (exit code ${exitCode}). The file may be corrupted or in an unsupported format. Try a different video file.`
      )
    }

    // Read the compressed output from the virtual filesystem
    const outputData = (await ffmpeg.readFile(outputName)) as Uint8Array
    const blob = new Blob([outputData], { type: 'video/mp4' })

    return {
      blob,
      mimeType: 'video/mp4',
      originalSize: file.size,
      compressedSize: blob.size,
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
