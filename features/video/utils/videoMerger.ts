/**
 * Merge Video — concatenation logic.
 *
 * Two paths:
 * 1. Concat demuxer + stream copy (-c copy) — near-instant when all files
 *    share the same format, video codec, audio codec, resolution, and FPS.
 * 2. Concat filter + re-encode — full H.264 re-encoding when files differ
 *    or the user changes output format/resolution/frame rate.
 */

import { getFFmpeg, runExclusive } from '@/features/audio/utils/ffmpegClient'
import { execWithProgress } from '@/features/video/utils/videoProcessor'
import { buildEncoderArgs } from '@/features/video/utils/videoEncoder'
import { FORMAT_CONFIG, type MergeFileInfo, type MergeOptions } from '@/features/video/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_COUNT = 20
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB per file

// ─── Compatibility Check ──────────────────────────────────────────────────────

/**
 * Quick pre-check using only HTML5 metadata (no ffmpeg probe).
 * If files have different extensions or dimensions, stream copy is impossible —
 * no need to run expensive ffmpeg probes on every file.
 */
function quickCompatibilityCheck(fileInfos: MergeFileInfo[]): boolean {
  if (fileInfos.length < 2) return false

  const first = fileInfos[0]
  const firstExt = first.file.name.split('.').pop()?.toLowerCase()

  for (let i = 1; i < fileInfos.length; i++) {
    const ext = fileInfos[i].file.name.split('.').pop()?.toLowerCase()
    if (ext !== firstExt) return false

    const m = fileInfos[i].metadata
    if (m.width !== first.metadata.width || m.height !== first.metadata.height) return false
  }

  return true
}

/**
 * Full compatibility check for concat demuxer + stream copy.
 *
 * All files must share: format (extension), video codec, audio codec,
 * width, height, and FPS (±0.5 tolerance).
 *
 * IMPORTANT: Audio codec is checked because the concat demuxer splices raw
 * compressed streams. If audio codecs differ between clips, the merged audio
 * will be garbled or the muxer will reject the file outright.
 * Checking only video properties passes casual testing with similar files
 * and breaks on realistic mixed sources.
 */
export function canUseConcatDemuxer(fileInfos: MergeFileInfo[]): boolean {
  if (fileInfos.length < 2) return false

  // All files must have advanced metadata (ffmpeg probe) loaded
  if (fileInfos.some((f) => !f.advanced)) return false

  // Quick check first — fail fast if extensions or dimensions differ
  if (!quickCompatibilityCheck(fileInfos)) return false

  const first = fileInfos[0].advanced!

  return fileInfos.every((info) => {
    const a = info.advanced!
    return (
      a.codec === first.codec &&
      a.audioCodec === first.audioCodec &&
      a.width === first.width &&
      a.height === first.height &&
      Math.abs(a.fps - first.fps) < 0.5
    )
  })
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateMergeInputs(fileInfos: MergeFileInfo[]): void {
  if (fileInfos.length < 2) {
    throw new Error('At least 2 videos are required for merging.')
  }

  if (fileInfos.length > MAX_FILE_COUNT) {
    throw new Error(`Maximum ${MAX_FILE_COUNT} files allowed. You selected ${fileInfos.length}.`)
  }

  for (const info of fileInfos) {
    if (info.file.size > MAX_FILE_SIZE) {
      const maxMB = Math.round(MAX_FILE_SIZE / (1024 * 1024))
      throw new Error(
        `"${info.file.name}" exceeds the maximum file size of ${maxMB} MB.`
      )
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Merge multiple video files into one.
 *
 * Uses concat-demuxer stream copy when all files are compatible (same format,
 * codec, resolution, FPS, and audio codec). Falls back to concat-filter
 * re-encode when files differ or the user changes output settings.
 *
 * @param fileInfos   - Array of file info objects (with basic metadata).
 * @param options     - Output format, quality, and fast-merge settings.
 * @param onProgress  - Progress callback (percent, elapsed, remaining).
 * @param signal      - AbortSignal for cancellation.
 * @returns Merged video blob with total input size and stream-copy flag.
 */
export async function mergeVideos(
  fileInfos: MergeFileInfo[],
  options: MergeOptions,
  onProgress?: (percent: number, elapsed: number, remaining: number) => void,
  signal?: AbortSignal,
): Promise<{ blob: Blob; totalInputSize: number; usedStreamCopy: boolean }> {
  // ── Validation ──────────────────────────────────────────────────────────
  validateMergeInputs(fileInfos)

  if (signal?.aborted) {
    throw new DOMException('Processing cancelled.', 'AbortError')
  }

  const totalInputSize = fileInfos.reduce((sum, f) => sum + f.file.size, 0)
  const config = FORMAT_CONFIG[options.outputFormat]
  const ffmpeg = await getFFmpeg()

  if (signal?.aborted) {
    throw new DOMException('Processing cancelled.', 'AbortError')
  }

  // ── Determine path ─────────────────────────────────────────────────────
  const useStreamCopy = options.fastMerge && canUseConcatDemuxer(fileInfos)
  const outputName = `merged_${Date.now()}.${config.ext}`
  const inputNames: string[] = []

  try {
    // ── Write all input files ────────────────────────────────────────────
    for (let i = 0; i < fileInfos.length; i++) {
      const ext = fileInfos[i].file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
      const name = `vmerge_in_${i}_${Date.now()}.${ext}`
      inputNames.push(name)
      const buf = new Uint8Array(await fileInfos[i].file.arrayBuffer())
      await runExclusive(() => ffmpeg.writeFile(name, buf))
    }

    if (signal?.aborted) {
      throw new DOMException('Processing cancelled.', 'AbortError')
    }

    // ── Build args ──────────────────────────────────────────────────────
    let args: string[]

    if (useStreamCopy) {
      // Concat demuxer: create a listing file, then -c copy
      const concatContent = inputNames.map((n) => `file '${n}'`).join('\n')
      const concatFileName = `vmerge_concat_${Date.now()}.txt`
      await runExclusive(() =>
        ffmpeg.writeFile(concatFileName, new TextEncoder().encode(concatContent))
      )
      inputNames.push(concatFileName) // ensure cleanup

      args = [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatFileName,
        '-c', 'copy',
        '-reset_timestamps', '1',
      ]

      // Fast start for MP4/MOV
      if (options.outputFormat === 'mp4' || options.outputFormat === 'mov') {
        args.push('-movflags', '+faststart')
      }

      args.push('-y', outputName)
    } else {
      // Concat filter: N inputs → filter_complex → re-encode
      args = []
      for (const name of inputNames) {
        args.push('-i', name)
      }

      // Build filter: concat=n=N:v=1:a=1 [v] [a]
      const concatFilter = `concat=n=${fileInfos.length}:v=1:a=1 [v] [a]`
      args.push('-filter_complex', concatFilter)
      args.push('-map', '[v]', '-map', '[a]')

      // Encoder args
      const encoderArgs = buildEncoderArgs({
        preset: options.preset,
        crf: options.crf,
        resolution: options.resolution,
        frameRate: options.frameRate,
        audioCodec: config.audioCodec,
        audioBitrate: config.audioBitrate,
      })
      args.push(...encoderArgs)

      // Reset timestamps
      args.push('-reset_timestamps', '1')

      // Fast start for MP4/MOV
      if (options.outputFormat === 'mp4' || options.outputFormat === 'mov') {
        args.push('-movflags', '+faststart')
      }

      args.push('-y', outputName)
    }

    // ── Execute ─────────────────────────────────────────────────────────
    await execWithProgress(ffmpeg, args, onProgress, signal)

    // CRITICAL: Read output BEFORE deleting it
    const outputData = (await runExclusive(() => ffmpeg.readFile(outputName))) as Uint8Array
    const blob = new Blob([outputData], { type: config.mime })

    return { blob, totalInputSize, usedStreamCopy: useStreamCopy }
  } finally {
    // ── Cleanup all temp files ──────────────────────────────────────────
    for (const name of inputNames) {
      try {
        await runExclusive(() => ffmpeg.deleteFile(name))
      } catch {
        // Best-effort
      }
    }
    try {
      await runExclusive(() => ffmpeg.deleteFile(outputName))
    } catch {
      // Best-effort
    }
  }
}
