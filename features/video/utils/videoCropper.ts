/**
 * Crop Video utility — coordinate scaling, dimension validation, and ffmpeg
 * argument building for the Crop Video tool.
 *
 * All coordinates flow in one direction:
 *   display coords (drag UI) → native coords (ffmpeg crop filter)
 *
 * Conversion happens ONLY here, at arg-build time — never in the component.
 *
 * CRITICAL RULE: Crop ALWAYS re-encodes video. The crop filter (-vf crop)
 * is incompatible with -c:v copy. Only audio can be stream-copied.
 */

import { buildEncoderArgs } from '@/features/video/utils/videoEncoder'
import type { EncoderOptions } from '@/features/video/utils/videoEncoder'
import type { VideoOutputFormat } from '@/features/video/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CropOptions {
  /** Crop rectangle in DISPLAY coordinates (relative to the container element). */
  displayCrop: { x: number; y: number; width: number; height: number }
  /** The <video> element's intrinsic width (videoWidth). */
  nativeWidth: number
  /** The <video> element's intrinsic height (videoHeight). */
  nativeHeight: number
  /** The container element's rendered width (clientWidth). */
  containerWidth: number
  /** The container element's rendered height (clientHeight). */
  containerHeight: number
  /** Target output container format. */
  targetFormat: VideoOutputFormat
  /** Encoder options for the mandatory video re-encode. */
  encoderOptions: EncoderOptions
}

// ─── Scale Conversion ─────────────────────────────────────────────────────────

/**
 * Convert a value from display (container) coordinates to native video coordinates.
 *
 * @example
 * // Video is 1920×1080 native, container renders at 640×360
 * displayToNative(320, 640, 1920)  // → 960
 */
export function displayToNative(
  displayValue: number,
  displayTotal: number,
  nativeTotal: number,
): number {
  if (displayTotal <= 0 || nativeTotal <= 0) return 0
  return (displayValue / displayTotal) * nativeTotal
}

/**
 * Convert a value from native video coordinates to display (container) coordinates.
 *
 * @example
 * // Video is 1920×1080 native, container renders at 640×360
 * nativeToDisplay(960, 1920, 640)  // → 320
 */
export function nativeToDisplay(
  nativeValue: number,
  nativeTotal: number,
  displayTotal: number,
): number {
  if (nativeTotal <= 0 || displayTotal <= 0) return 0
  return (nativeValue / nativeTotal) * displayTotal
}

// ─── Dimension Rounding ───────────────────────────────────────────────────────

/**
 * Round a number to the nearest even integer.
 *
 * libx264 with yuv420p pixel format requires both width and height to be
 * even numbers. Odd dimensions will cause ffmpeg to fail or produce
 * distorted output.
 */
function roundEven(n: number): number {
  return Math.round(n / 2) * 2
}

// ─── Arg Builder ──────────────────────────────────────────────────────────────

/** Minimum allowed crop dimension in native pixels. */
const MIN_CROP_PIXELS = 16

/**
 * Build ffmpeg arguments for a crop operation.
 *
 * The pipeline:
 * 1. Scale display crop rect → native video coordinates
 * 2. Clamp to video bounds
 * 3. Enforce minimum dimensions
 * 4. Round width/height to even numbers
 * 5. Build args: crop filter → encoder args → -c:a copy → output
 *
 * **NEVER** includes -c:v copy — the crop filter requires re-encoding.
 *
 * @param inputName  — Virtual filesystem path of the input file.
 * @param outputName — Virtual filesystem path for the output file.
 * @param options    — Crop configuration including display rect and encoder settings.
 * @returns Full ffmpeg argument array ready for execWithProgress / processVideo.
 */
export function buildCropArgs(
  inputName: string,
  outputName: string,
  options: CropOptions,
): string[] {
  const {
    displayCrop,
    nativeWidth,
    nativeHeight,
    containerWidth,
    containerHeight,
    targetFormat,
    encoderOptions,
  } = options

  // ── Step 1: Compute scale factors ────────────────────────────────────────
  const scaleX = nativeWidth / containerWidth
  const scaleY = nativeHeight / containerHeight

  // ── Step 2: Convert display crop to native pixels ─────────────────────────
  let cropX = Math.round(displayCrop.x * scaleX)
  let cropY = Math.round(displayCrop.y * scaleY)
  let cropW = Math.round(displayCrop.width * scaleX)
  let cropH = Math.round(displayCrop.height * scaleY)

  // ── Step 3: Clamp to [0, nativeWidth] × [0, nativeHeight] ────────────────
  cropX = Math.max(0, Math.min(cropX, nativeWidth - 1))
  cropY = Math.max(0, Math.min(cropY, nativeHeight - 1))
  cropW = Math.max(MIN_CROP_PIXELS, Math.min(cropW, nativeWidth - cropX))
  cropH = Math.max(MIN_CROP_PIXELS, Math.min(cropH, nativeHeight - cropY))

  // ── Step 4: Round to even (required by libx264 + yuv420p) ────────────────
  cropW = roundEven(cropW)
  cropH = roundEven(cropH)

  // ── Step 5: Validate (defensive) ──────────────────────────────────────────
  if (cropW < MIN_CROP_PIXELS || cropH < MIN_CROP_PIXELS) {
    throw new Error(
      `Crop area too small — minimum ${MIN_CROP_PIXELS}×${MIN_CROP_PIXELS} pixels. ` +
      `Got ${cropW}×${cropH}.`,
    )
  }
  if (cropX + cropW > nativeWidth || cropY + cropH > nativeHeight) {
    throw new Error('Crop area exceeds video dimensions after clamping and rounding.')
  }

  // ── Step 6: Build args ───────────────────────────────────────────────────
  const args: string[] = [
    '-i', inputName,
    '-vf', `crop=${cropW}:${cropH}:${cropX}:${cropY}`,
  ]

  // Always re-encode video — NEVER -c:v copy (incompatible with crop filter)
  const encoderArgs = buildEncoderArgs(encoderOptions)
  args.push(...encoderArgs)

  // Audio: stream copy (audio is untouched by a video crop)
  args.push('-c:a', 'copy')

  // Fast start / web-optimized for streaming-friendly containers
  if (targetFormat === 'mp4' || targetFormat === 'mov') {
    args.push('-movflags', '+faststart')
  }

  args.push('-y', outputName)

  return args
}
