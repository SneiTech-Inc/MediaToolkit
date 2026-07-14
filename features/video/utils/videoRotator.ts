/**
 * Rotate Video utility — ffmpeg filter construction and argument building.
 *
 * Uses dedicated transpose/hflip/vflip filters for exact 90°/180°/270°
 * rotations (no quality loss, no corner fill). Falls back to the generic
 * rotate= filter ONLY for arbitrary angles that aren't multiples of 90.
 *
 * CRITICAL RULES:
 * - NEVER use -c:v copy — rotation always requires video re-encoding.
 * - -c:a copy for audio (audio is untouched by rotation/flips).
 * - The angle expression in rotw()/roth() must be IDENTICAL to the one
 *   in rotate= (not iw/ih — that was a bug in an earlier draft).
 * - NO getAdvancedMetadata needed — rotation only uses basic dimensions.
 */

import { buildEncoderArgs } from '@/features/video/utils/videoEncoder'
import type { EncoderOptions } from '@/features/video/utils/videoEncoder'
import type { VideoOutputFormat } from '@/features/video/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RotateArgOptions {
  /** Rotation angle in degrees (0–360). */
  angle: number
  /** Whether to flip horizontally. */
  flipH: boolean
  /** Whether to flip vertically. */
  flipV: boolean
  /** Fill color for border areas at non-90° angles (default "black"). */
  fillColor?: string
  /** Whether to auto-crop empty borders after rotation. */
  autoCrop?: boolean
  /** Target output container format. */
  targetFormat: VideoOutputFormat
  /** Encoder options for the mandatory video re-encode. */
  encoderOptions: EncoderOptions
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SNAP_ANGLES = [0, 90, 180, 270, 360]

// ─── Angle Normalization ──────────────────────────────────────────────────────

/**
 * Normalize an angle to [0, 360).
 */
function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360
}

/**
 * Check whether an angle is an exact multiple of 90 (0, 90, 180, 270).
 */
function isExactMultiple(angle: number): boolean {
  const norm = normalizeAngle(angle)
  return SNAP_ANGLES.some((a) => Math.abs(norm - a) < 0.001)
}

// ─── Filter Builder ───────────────────────────────────────────────────────────

/**
 * Build the ffmpeg -vf filter string for a rotation and/or flip operation.
 *
 * Uses dedicated transpose/hflip/vflip filters for exact 90° multiples
 * (no quality loss, no corner fill). Falls back to the generic rotate=
 * filter with identical angle expressions in rotw()/roth() for arbitrary
 * angles.
 *
 * Filter order matches CSS transform right-to-left evaluation:
 *   CSS:  rotate(Xdeg) scaleX(-1) scaleY(-1)
 *         → rightmost first: scaleY → scaleX → rotate
 *   ffmpeg: hflip,vflip,transpose=N   (flips applied first, then rotation)
 *
 * @param angle     — Rotation angle in degrees (0–360).
 * @param flipH     — Whether to flip horizontally.
 * @param flipV     — Whether to flip vertically.
 * @param fillColor — Fill color for non-90° angles (default "black").
 * @returns A comma-separated ffmpeg filter string, or "" for passthrough.
 */
export function buildRotateFilter(
  angle: number,
  flipH: boolean,
  flipV: boolean,
  fillColor: string = 'black',
): string {
  const norm = normalizeAngle(angle)
  const exact = isExactMultiple(norm)
  const filters: string[] = []

  if (exact) {
    // ── Exact multiple of 90° — use dedicated transpose/hflip/vflip ──────

    // Add flips first (CSS right-to-left: flips then rotation)
    if (flipH) filters.push('hflip')
    if (flipV) filters.push('vflip')

    // Add rotation/transpose
    if (norm === 0 || norm === 360) {
      // No rotation — just flips (already added above)
    } else if (norm === 90) {
      if (flipV && !flipH) {
        // transpose=3 = 90° CW + vertical flip (built-in, optimal)
        // Replace the vflip we already pushed with the combined filter
        const vflipIdx = filters.lastIndexOf('vflip')
        if (vflipIdx >= 0) filters.splice(vflipIdx, 1)
        filters.push('transpose=3')
      } else {
        filters.push('transpose=1')
      }
    } else if (norm === 180) {
      if (flipH && flipV) {
        // hflip + vflip + hflip + vflip = identity (all cancel)
        // Remove the hflip and vflip we already pushed
        const len = filters.length
        filters.length = 0 // clear all — passthrough
        // Re-add nothing — all ops cancel
      } else if (flipH && !flipV) {
        // hflip + hflip,vflip = vflip only
        filters.length = 0
        filters.push('vflip')
      } else if (!flipH && flipV) {
        // vflip + hflip,vflip = hflip only
        filters.length = 0
        filters.push('hflip')
      } else {
        // Pure 180° = hflip,vflip
        filters.push('hflip', 'vflip')
      }
    } else if (norm === 270) {
      if (flipV && !flipH) {
        // transpose=0 = 90° CCW + vertical flip (built-in, optimal)
        const vflipIdx = filters.lastIndexOf('vflip')
        if (vflipIdx >= 0) filters.splice(vflipIdx, 1)
        filters.push('transpose=0')
      } else {
        filters.push('transpose=2')
      }
    }
  } else {
    // ── Arbitrary angle — use generic rotate= filter ────────────────────
    // Flips first (prepended to filter chain, matching CSS order)

    if (flipH) filters.push('hflip')
    if (flipV) filters.push('vflip')

    const rad = (norm * Math.PI) / 180
    // CRITICAL: angle in rotate=, rotw(), and roth() must be IDENTICAL
    const angleExpr = rad.toFixed(6)
    filters.push(
      `rotate=${angleExpr}:ow=rotw(${angleExpr}):oh=roth(${angleExpr}):c=${fillColor}`,
    )
  }

  return filters.join(',')
}

// ─── Arg Builder ──────────────────────────────────────────────────────────────

/**
 * Build full ffmpeg arguments for a rotate/flip operation.
 *
 * Pipeline:
 * 1. Build the rotation/flip filter chain via buildRotateFilter()
 * 2. Optionally append auto-crop filter for arbitrary angles
 * 3. Add encoder args (ALWAYS re-encode video — NEVER -c:v copy)
 * 4. -c:a copy (audio untouched by rotation)
 * 5. -map_metadata 0 (preserve metadata)
 * 6. Container-specific flags
 *
 * @param inputName  — Virtual filesystem path of the input file.
 * @param outputName — Virtual filesystem path for the output file.
 * @param options    — Rotation configuration.
 * @returns Full ffmpeg argument array.
 */
export function buildRotateArgs(
  inputName: string,
  outputName: string,
  options: RotateArgOptions,
): string[] {
  const {
    angle,
    flipH,
    flipV,
    fillColor = 'black',
    autoCrop = false,
    targetFormat,
    encoderOptions,
  } = options

  const args: string[] = ['-i', inputName]

  // ── Build filter chain ─────────────────────────────────────────────────
  let filterString = buildRotateFilter(angle, flipH, flipV, fillColor)

  // Auto-crop: only meaningful for arbitrary angles (non-90° multiples)
  // Crops to a centered square matching the smaller dimension
  if (autoCrop && !isExactMultiple(angle) && filterString) {
    filterString +=
      ",crop='min(iw,ih)':'min(iw,ih)':(iw-min(iw,ih))/2:(ih-min(iw,ih))/2"
  }

  if (filterString) {
    args.push('-vf', filterString)
  }

  // ── Always re-encode video — NEVER -c:v copy ───────────────────────────
  const encoderArgs = buildEncoderArgs(encoderOptions)
  args.push(...encoderArgs)

  // ── Audio: stream copy (audio untouched by rotation/flips) ─────────────
  args.push('-c:a', 'copy')

  // ── Preserve metadata ──────────────────────────────────────────────────
  args.push('-map_metadata', '0')

  // ── Fast start for streaming-friendly containers ───────────────────────
  if (targetFormat === 'mp4' || targetFormat === 'mov') {
    args.push('-movflags', '+faststart')
  }

  args.push('-y', outputName)

  return args
}
