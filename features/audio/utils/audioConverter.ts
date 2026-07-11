import {
  getFFmpeg,
  extensionToFormat,
  tempName,
  normalizeProgress,
} from '@/features/audio/utils/ffmpegClient'
import type { AudioFormat, AudioConversionOptions, AudioConversionResult } from '@/features/audio/types'
import { AUDIO_MIME_TYPES } from '@/features/audio/types'

/** Build ffmpeg args for the given options. */
function buildArgs(
  inputName: string,
  outputName: string,
  options: AudioConversionOptions
): string[] {
  const args: string[] = ['-i', inputName]

  // Quality / encoding flags per output format
  if (
    options.format === 'mp3' ||
    options.format === 'aac' ||
    options.format === 'ogg' ||
    options.format === 'm4a'
  ) {
    // Lossy formats — bitrate controls quality
    const bitrate = options.bitrate ?? '192'
    args.push('-b:a', `${bitrate}k`)
  } else if (options.format === 'wav') {
    // WAV — sample rate controls quality, PCM is lossless
    const sampleRate = options.sampleRate ?? '44100'
    args.push('-ar', sampleRate)
  } else if (options.format === 'flac') {
    // FLAC — lossless, compression_level controls file size vs encode speed
    const level = options.compressionLevel ?? '5'
    args.push('-compression_level', level)
  }

  args.push('-y') // overwrite output without prompting
  args.push(outputName)

  return args
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Convert an audio file to another format using ffmpeg.wasm.
 *
 * All processing happens client-side in a Web Worker. The ~31 MB WASM binary
 * is lazy-loaded on the first call and reused for subsequent conversions.
 *
 * @param file - The source audio file (MP3, WAV, AAC, OGG, FLAC, or M4A).
 * @param options - Target format and quality settings.
 * @param onProgress - Called with 0–100 as ffmpeg reports progress.
 * @returns A blob of the converted audio plus metadata.
 */
export async function convertAudio(
  file: File,
  options: AudioConversionOptions,
  onProgress?: (percent: number) => void
): Promise<AudioConversionResult> {
  const ffmpeg = await getFFmpeg()

  // Determine input format from file extension
  const inputExt = file.name.split('.').pop() ?? ''
  const inputFormat = extensionToFormat(inputExt)
  if (!inputFormat) {
    throw new Error(
      `Unsupported input format: ".${inputExt}". Supported formats: MP3, WAV, AAC, OGG, FLAC, M4A.`
    )
  }

  const inputName = tempName('input', inputFormat)
  const outputName = tempName('output', options.format)

  // Write the uploaded file into ffmpeg's virtual filesystem
  const fileBuffer = new Uint8Array(await file.arrayBuffer())
  await ffmpeg.writeFile(inputName, fileBuffer)

  // Wire up progress reporting
  const progressCleanup = new AbortController()
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(normalizeProgress(progress))
  }

  try {
    ffmpeg.on('progress', progressHandler)

    // Execute conversion
    const args = buildArgs(inputName, outputName, options)
    const exitCode = await ffmpeg.exec(args, undefined, {
      signal: progressCleanup.signal,
    })

    if (exitCode !== 0) {
      throw new Error(
        `FFmpeg exited with code ${exitCode}. The file may be corrupted or in an unsupported format.`
      )
    }

    // Read the output file from ffmpeg's virtual filesystem
    const outputData = (await ffmpeg.readFile(outputName)) as Uint8Array
    const mimeType = AUDIO_MIME_TYPES[options.format]
    const blob = new Blob([outputData], { type: mimeType })

    // Parse duration from file using ffprobe
    let duration = 0
    try {
      const durFileName = tempName('duration', 'txt')
      await ffmpeg.ffprobe([
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        inputName,
        '-o',
        durFileName,
      ])
      const durData = (await ffmpeg.readFile(durFileName)) as Uint8Array
      const durText = new TextDecoder().decode(durData).trim()
      duration = parseFloat(durText) || 0
      await ffmpeg.deleteFile(durFileName)
    } catch {
      // Duration extraction is best-effort; don't fail the conversion
      duration = 0
    }

    return {
      blob,
      mimeType,
      originalSize: file.size,
      convertedSize: blob.size,
      duration,
    }
  } finally {
    // Cleanup: remove progress listener and temp files
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
