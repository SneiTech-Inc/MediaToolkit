/**
 * Trim Video — tool-specific logic.
 *
 * This module only contains functions unique to the Trim Video tool:
 * stream copy detection and trim-specific ffmpeg argument construction.
 * The actual ffmpeg execution is handled by processVideo() from videoProcessor.ts.
 */

import { FORMAT_CONFIG, type VideoOutputFormat } from '@/features/video/types'
import { buildEncoderArgs, type EncoderOptions } from '@/features/video/utils/videoEncoder'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Determine whether stream copy can be used for trimming.
 *
 * Stream copy (`-c copy`) avoids re-encoding and is near-instant, but:
 * - Input file extension must match the target output format
 * - Stream copy trims on the nearest keyframe, not the exact frame
 * - For frame-accurate cuts, disable Fast Trim to force re-encoding
 *
 * @param file         - The source video file.
 * @param targetFormat - The desired output container format.
 * @returns true if stream copy is available for this combination.
 */
export function canUseStreamCopy(file: File, targetFormat: VideoOutputFormat): boolean {
  const inputExt = file.name.split('.').pop()?.toLowerCase()
  return inputExt === targetFormat.toLowerCase()
}

/**
 * Build ffmpeg arguments for the Trim Video operation.
 *
 * Two modes:
 * 1. **Stream copy** (useFastTrim=true, same input/output format):
 *    Uses `-c copy` — near-instant but keyframe-aligned.
 *    Args: -ss {start} -i {input} -t {duration} -c copy -reset_timestamps 1 -y {output}
 *
 * 2. **Re-encode** (useFastTrim=false or different format):
 *    Full H.264 re-encode for frame-accurate cuts.
 *    Args: -ss {start} -i {input} -t {duration} [encoder args] -y {output}
 *
 * @param inputName  - Filename in ffmpeg's virtual filesystem.
 * @param outputName - Output filename in ffmpeg's virtual filesystem.
 * @param startTime  - Trim start in seconds.
 * @param endTime    - Trim end in seconds.
 * @param options    - Format, fast-trim toggle, and encoder settings.
 * @returns ffmpeg argument array (to be passed to processVideo).
 */
export function buildTrimArgs(
  inputName: string,
  outputName: string,
  startTime: number,
  endTime: number,
  options: {
    targetFormat: VideoOutputFormat
    useFastTrim: boolean
    encoderOptions?: EncoderOptions
  }
): string[] {
  const duration = endTime - startTime
  const config = FORMAT_CONFIG[options.targetFormat]

  // Fast seek: -ss before -i for rapid seeking, then -t for duration
  const args: string[] = [
    '-ss', String(startTime),
    '-i', inputName,
    '-t', String(duration),
  ]

  if (options.useFastTrim) {
    // Stream copy — no re-encoding
    args.push('-c', 'copy')
  } else if (options.encoderOptions) {
    // Full re-encode with H.264
    const encoderArgs = buildEncoderArgs(options.encoderOptions)
    args.push(...encoderArgs)
  } else {
    // Fallback: should not happen, but default to stream copy
    args.push('-c', 'copy')
  }

  // Reset timestamps so the output starts at 0
  args.push('-reset_timestamps', '1')

  // Fast start for MP4/MOV (moov atom at beginning for streaming)
  if (options.targetFormat === 'mp4' || options.targetFormat === 'mov') {
    args.push('-movflags', '+faststart')
  }

  // Output file
  args.push('-y', outputName)

  return args
}
