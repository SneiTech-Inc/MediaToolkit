/**
 * Resize Video utility — two-step scale filter chains and ffmpeg argument
 * building for the Resize Video tool.
 *
 * CRITICAL: Neither "Fit" nor "Fill" is complete with a bare scale= filter.
 * Both require a second step to produce EXACT target dimensions:
 *
 *   Fit (contain):  scale → pad   (add black bars to reach exact size)
 *   Fill (cover):   scale → crop  (trim overflow to reach exact size)
 *
 * CRITICAL RULES:
 * - NEVER use -c:v copy — resizing always requires video re-encoding.
 * - -c:a copy for audio (audio is untouched by resize).
 * - All output dimensions must be even (H.264 / yuv420p requirement).
 * - Pass resolution: 'original' to buildEncoderArgs — we handle scaling via
 *   our own filter chain to avoid a conflicting second -vf.
 */

import { buildEncoderArgs } from '@/features/video/utils/videoEncoder'
import type { EncoderOptions } from '@/features/video/utils/videoEncoder'
import type { VideoOutputFormat } from '@/features/video/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResizeArgOptions {
  /** Target width in pixels (must be even, > 0). */
  targetWidth: number
  /** Target height in pixels (must be even, > 0). */
  targetHeight: number
  /** Scale method: 'fit' = letterbox, 'fill' = cover-crop. */
  scaleMethod: 'fit' | 'fill'
  /** Target output container format. */
  targetFormat: VideoOutputFormat
  /** Encoder options for the mandatory video re-encode. */
  encoderOptions: EncoderOptions
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Round a number to the nearest even integer.
 * Required by H.264 with yuv420p pixel format.
 */
export function roundEven(n: number): number {
  return Math.round(n / 2) * 2
}

// ─── Filter Builder ───────────────────────────────────────────────────────────

/**
 * Build the two-step ffmpeg scale filter chain for resizing.
 *
 * Fit (contain):
 *   1. scale=W:H:force_original_aspect_ratio=decrease
 *      → scales down to fit within W×H, preserving aspect ratio
 *   2. pad=W:H:(ow-iw)/2:(oh-ih)/2:color=black
 *      → pads to exact W×H, centering the content, black bars
 *
 * Fill (cover):
 *   1. scale=W:H:force_original_aspect_ratio=increase
 *      → scales up to cover W×H, preserving aspect ratio
 *   2. crop=W:H
 *      → crops to exact W×H, centered (default crop anchor)
 *
 * @param targetWidth  — Exact output width in pixels.
 * @param targetHeight — Exact output height in pixels.
 * @param scaleMethod  — 'fit' (letterbox) or 'fill' (cover-crop).
 * @returns A comma-separated ffmpeg filter string.
 */
export function buildScaleFilter(
  targetWidth: number,
  targetHeight: number,
  scaleMethod: 'fit' | 'fill',
): string {
  if (scaleMethod === 'fit') {
    return (
      `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,` +
      `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=black`
    )
  }
  // Fill: scale to cover, then crop overflow to exact dimensions
  return (
    `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,` +
    `crop=${targetWidth}:${targetHeight}`
  )
}

// ─── Preset Computation ───────────────────────────────────────────────────────

/**
 * Compute target dimensions from a preset value, preserving source orientation.
 *
 * - Landscape (srcW >= srcH): preset → target width, height derived from ratio
 * - Portrait  (srcH >  srcW): preset → target height, width derived from ratio
 *
 * @param preset — The preset resolution value (e.g., 1080).
 * @param srcW   — Source video width in pixels.
 * @param srcH   — Source video height in pixels.
 * @returns Even target width and height.
 */
export function computePresetDimensions(
  preset: number,
  srcW: number,
  srcH: number,
): { width: number; height: number } {
  const aspectRatio = srcW / srcH

  if (srcW >= srcH) {
    // Landscape or square: preset is the width
    return {
      width: preset,
      height: roundEven(preset / aspectRatio),
    }
  }
  // Portrait: preset is the height
  return {
    width: roundEven(preset * aspectRatio),
    height: preset,
  }
}

// ─── Arg Builder ──────────────────────────────────────────────────────────────

/**
 * Build full ffmpeg arguments for a resize operation.
 *
 * Pipeline:
 * 1. Validate dimensions (> 0, must be even)
 * 2. Build two-step scale filter chain
 * 3. Add encoder args (resolution always 'original' — we handle scaling)
 * 4. -c:a copy (audio untouched)
 * 5. -map_metadata 0 (preserve metadata)
 * 6. Container-specific flags
 *
 * @param inputName  — Virtual filesystem path of the input file.
 * @param outputName — Virtual filesystem path for the output file.
 * @param options    — Resize configuration.
 * @returns Full ffmpeg argument array.
 * @throws If dimensions are invalid.
 */
export function buildResizeArgs(
  inputName: string,
  outputName: string,
  options: ResizeArgOptions,
): string[] {
  const { targetWidth, targetHeight, scaleMethod, targetFormat, encoderOptions } = options

  // Validate
  if (targetWidth <= 0 || targetHeight <= 0) {
    throw new Error('Target dimensions must be greater than zero.')
  }
  if (targetWidth % 2 !== 0 || targetHeight % 2 !== 0) {
    throw new Error(
      `Target dimensions must be even numbers (H.264 requirement). Got ${targetWidth}×${targetHeight}.`,
    )
  }

  const args: string[] = ['-i', inputName]

  // Build filter chain: always a two-step scale→pad or scale→crop
  const filterString = buildScaleFilter(targetWidth, targetHeight, scaleMethod)
  args.push('-vf', filterString)

  // Always re-encode video — NEVER -c:v copy
  // Pass resolution: 'original' since our filter chain already handles scaling
  const encoderArgs = buildEncoderArgs({
    ...encoderOptions,
    resolution: 'original',
  })
  args.push(...encoderArgs)

  // Audio: stream copy (audio untouched by resize)
  args.push('-c:a', 'copy')

  // Preserve metadata
  args.push('-map_metadata', '0')

  // Fast start for streaming-friendly containers
  if (targetFormat === 'mp4' || targetFormat === 'mov') {
    args.push('-movflags', '+faststart')
  }

  args.push('-y', outputName)

  return args
}
