/**
 * Shared H.264 encoding argument builder.
 * Used by all video tools that need re-encoding (Compress, Convert, Trim, etc.).
 */

import { RESOLUTION_HEIGHT, type VideoPreset, type VideoResolution, type VideoFrameRate } from '@/features/video/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EncoderOptions {
  /** Encoding speed preset. */
  preset: VideoPreset
  /** CRF quality value (18–32). */
  crf: number
  /** Target resolution ("original" to keep source dimensions). */
  resolution: VideoResolution
  /** Target frame rate ("original" to keep source frame rate). */
  frameRate: VideoFrameRate
  /** Audio codec name (e.g. "aac", "mp3"). */
  audioCodec: string
  /** Audio bitrate string (e.g. "128k"). */
  audioBitrate: string
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the ffmpeg argument fragment for H.264 re-encoding.
 *
 * Returns arguments that should be spliced into the ffmpeg args array
 * after the input file and before the output file.
 *
 * Includes: video codec, preset, CRF, pixel format, optional resolution
 * scaling, optional frame rate override, audio codec, and audio bitrate.
 */
export function buildEncoderArgs(options: EncoderOptions): string[] {
  const args: string[] = [
    '-c:v', 'libx264',
    '-preset', options.preset,
    '-crf', String(options.crf),
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

  // Audio codec and bitrate
  args.push('-c:a', options.audioCodec, '-b:a', options.audioBitrate)

  return args
}
