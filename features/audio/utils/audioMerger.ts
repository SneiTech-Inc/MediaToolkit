import { getFFmpeg, extensionToFormat, tempName, normalizeProgress } from '@/features/audio/utils/ffmpegClient'
import { AUDIO_MIME_TYPES, type AudioFormat, type Bitrate, type SampleRate, type FLACCompression } from '@/features/audio/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MergeAudioOptions {
  /** Target output format. */
  format: AudioFormat
  /** Bitrate in kbps (MP3/AAC/OGG/M4A only). */
  bitrate?: Bitrate
  /** Sample rate in Hz (WAV/FLAC only). */
  sampleRate?: SampleRate
  /** FLAC compression level 0–8 (FLAC only). */
  compressionLevel?: FLACCompression
}

export interface MergeAudioResult {
  /** The merged audio as a Blob (ready for download). */
  blob: Blob
  /** MIME type of the merged audio. */
  mimeType: string
  /** Sum of all input file sizes in bytes. */
  totalInputSize: number
  /** Merged output file size in bytes. */
  outputSize: number
  /** Number of files that were merged. */
  fileCount: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILES = 20
const MIN_FILES = 2

/** Default sample rate used for normalization when the output format doesn't
 *  expose a sample rate control (bitrate-based formats: MP3/AAC/OGG/M4A). */
const DEFAULT_NORM_SAMPLE_RATE = '44100'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Determine the normalization sample rate for the aformat filter. */
function getNormSampleRate(options: MergeAudioOptions): string {
  // For WAV and FLAC, the user picks a sample rate — use it as the norm target
  if (options.format === 'wav' || options.format === 'flac') {
    return options.sampleRate ?? '44100'
  }
  // For bitrate-based formats, use a sensible default
  return DEFAULT_NORM_SAMPLE_RATE
}

/**
 * Build the filter_complex string for ffmpeg concat with aformat normalization.
 *
 * Produces a graph like:
 *   [0:a]aformat=sr=44100:cl=stereo[a0];
 *   [1:a]aformat=sr=44100:cl=stereo[a1];
 *   [a0][a1]concat=n=2:v=0:a=1[out]
 */
function buildConcatFilter(fileCount: number, sampleRate: string): string {
  const parts: string[] = []

  // Per-input aformat normalization
  for (let i = 0; i < fileCount; i++) {
    parts.push(
      `[${i}:a]aformat=sample_rates=${sampleRate}:channel_layouts=stereo[a${i}]`
    )
  }

  // Concat all normalized streams
  const pads = Array.from({ length: fileCount }, (_, i) => `[a${i}]`).join('')
  parts.push(`${pads}concat=n=${fileCount}:v=0:a=1[out]`)

  return parts.join(';')
}

/** Append quality/encoding flags for the output format. */
function appendQualityArgs(args: string[], options: MergeAudioOptions): void {
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
 * Merge multiple audio files into a single track using ffmpeg.wasm.
 *
 * All processing happens client-side. Files are normalized to a common sample
 * rate and stereo channel layout before concatenation, so mismatched inputs
 * (e.g. a 48kHz WAV and a 44.1kHz MP3) produce a glitch-free output.
 *
 * @param files - 2–20 audio files in the desired merge order.
 * @param options - Output format and quality settings.
 * @param onProgress - Called with 0–100 as ffmpeg reports progress.
 * @returns A blob of the merged audio plus metadata.
 */
export async function mergeAudioFiles(
  files: File[],
  options: MergeAudioOptions,
  onProgress?: (percent: number) => void
): Promise<MergeAudioResult> {
  // ── Validation ──────────────────────────────────────────────────────────
  if (files.length < MIN_FILES) {
    throw new Error(`Please select at least ${MIN_FILES} files to merge.`)
  }
  if (files.length > MAX_FILES) {
    throw new Error(`You can merge up to ${MAX_FILES} files at a time.`)
  }

  // Validate all file extensions
  for (const file of files) {
    const ext = file.name.split('.').pop() ?? ''
    if (!extensionToFormat(ext)) {
      throw new Error(
        `Unsupported format: "${file.name}". Supported formats: MP3, WAV, AAC, OGG, FLAC, M4A.`
      )
    }
  }

  const ffmpeg = await getFFmpeg()

  const sampleRate = getNormSampleRate(options)
  const outputName = tempName('merged', options.format)

  // Write all input files to ffmpeg's virtual filesystem.
  // Use indexed names so the filter graph can reference streams by index.
  const inputNames: string[] = []
  const totalInputSize = files.reduce((sum, f) => sum + f.size, 0)

  for (let i = 0; i < files.length; i++) {
    const inputFormat = extensionToFormat(files[i].name.split('.').pop() ?? '')!
    const name = tempName(`input${i}`, inputFormat)
    const buffer = new Uint8Array(await files[i].arrayBuffer())
    await ffmpeg.writeFile(name, buffer)
    inputNames.push(name)
  }

  // Wire up progress reporting
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(normalizeProgress(progress))
  }

  try {
    ffmpeg.on('progress', progressHandler)

    // Build the ffmpeg argument list.
    // CRITICAL: each -i and filename are separate array entries — never
    // combine them into a single string with an embedded space.
    const args: string[] = []

    // Input files
    for (const name of inputNames) {
      args.push('-i', name)
    }

    // Concat filter with aformat normalization
    const filterGraph = buildConcatFilter(files.length, sampleRate)
    args.push('-filter_complex', filterGraph)
    args.push('-map', '[out]')

    // Quality / encoding flags
    appendQualityArgs(args, options)

    args.push('-y', outputName)

    // Execute
    const exitCode = await ffmpeg.exec(args)

    if (exitCode !== 0) {
      throw new Error(
        `FFmpeg exited with code ${exitCode}. The files may be corrupted or in an unsupported format.`
      )
    }

    // Read the merged output
    const outputData = (await ffmpeg.readFile(outputName)) as Uint8Array
    const mimeType = AUDIO_MIME_TYPES[options.format]
    const blob = new Blob([outputData], { type: mimeType })

    return {
      blob,
      mimeType,
      totalInputSize,
      outputSize: blob.size,
      fileCount: files.length,
    }
  } finally {
    // Cleanup: remove progress listener and delete all temp files
    ffmpeg.off('progress', progressHandler)

    for (const name of inputNames) {
      try {
        await ffmpeg.deleteFile(name)
      } catch {
        // Best-effort cleanup
      }
    }
    try {
      await ffmpeg.deleteFile(outputName)
    } catch {
      // Best-effort cleanup
    }
  }
}
