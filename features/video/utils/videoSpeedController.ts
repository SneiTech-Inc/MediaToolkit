/**
 * Video Speed Controller utility — atempo chain builder and ffmpeg
 * filter_complex argument construction.
 *
 * Uses filter_complex (not -vf/-af) because both video AND audio streams
 * need coordinated processing:
 *   Video: setpts=(1/speed)*PTS  — adjusts frame timestamps
 *   Audio: atempo chain         — time-stretches without pitch change
 *
 * CRITICAL: atempo only accepts [0.5, 100.0]. For speeds outside
 * [0.5, 2.0], we chain multiple atempo= filters (e.g., 0.25x uses
 * atempo=0.5,atempo=0.5). The user provided the exact algorithm.
 *
 * Audio IS genuinely re-encoded here — not stream-copied — because
 * atempo modifies the decoded audio stream before the encoder receives it.
 * The encoder audio args from FORMAT_CONFIG (e.g., -c:a aac -b:a 128k)
 * apply normally.
 *
 * For video-only files (no audio stream), the filter_complex omits the
 * [0:a] branch and only maps [outv].
 */

import { buildEncoderArgs } from '@/features/video/utils/videoEncoder'
import type { EncoderOptions } from '@/features/video/utils/videoEncoder'
import type { VideoOutputFormat } from '@/features/video/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpeedArgOptions {
  /** Playback speed multiplier (0.25–4.0). Must be finite and positive. */
  speed: number
  /** Whether the source video has an audio stream. */
  hasAudio: boolean
  /** Target output container format. */
  targetFormat: VideoOutputFormat
  /** Encoder options for both video and audio re-encode. */
  encoderOptions: EncoderOptions
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_SPEED = 0.25
const MAX_SPEED = 4.0

// ─── Atempo Chain Builder ─────────────────────────────────────────────────────

/**
 * Build a comma-separated chain of atempo= filters to achieve the target speed.
 *
 * atempo only accepts values in [0.5, 100.0]. For speeds outside [0.5, 2.0],
 * we chain multiple atempo=N filters whose product equals the target speed.
 *
 * Algorithm (from the user's specification):
 * - 0.5 ≤ speed ≤ 2.0: single atempo=N
 * - speed > 2.0: chain 2.0's until remainder ≤ 2.0
 * - speed < 0.5: chain 0.5's until remainder ≥ 0.5
 *
 * @example 0.25 → "atempo=0.5000,atempo=0.5000"  (0.5 × 0.5 = 0.25)
 * @example 4.0  → "atempo=2.0000,atempo=2.0000"  (2.0 × 2.0 = 4.0)
 * @example 1.75 → "atempo=1.75"                   (single, within range)
 */
export function buildAtempoChain(speed: number): string {
  if (speed >= 0.5 && speed <= 2.0) {
    return `atempo=${speed}`
  }

  const factors: number[] = []
  let remaining = speed

  if (remaining > 2.0) {
    while (remaining > 2.0) {
      factors.push(2.0)
      remaining /= 2.0
    }
  } else if (remaining < 0.5) {
    while (remaining < 0.5) {
      factors.push(0.5)
      remaining /= 0.5
    }
  }

  factors.push(remaining)
  return factors.map((f) => `atempo=${f.toFixed(4)}`).join(',')
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate the speed value. Throws on invalid input.
 */
function validateSpeed(speed: number): void {
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error('Speed must be a finite positive number.')
  }
  if (speed < MIN_SPEED || speed > MAX_SPEED) {
    throw new Error(
      `Speed must be between ${MIN_SPEED}× and ${MAX_SPEED}×. Got ${speed}×.`,
    )
  }
}

// ─── Arg Builder ──────────────────────────────────────────────────────────────

/**
 * Build full ffmpeg arguments for a speed change operation.
 *
 * Uses filter_complex to process both video (setpts) and audio (atempo chain)
 * in a single coordinated filter graph, then maps the labeled outputs.
 *
 * For video-only files, only the video branch is included in the graph.
 *
 * @param inputName  — Virtual filesystem path of the input file.
 * @param outputName — Virtual filesystem path for the output file.
 * @param options    — Speed configuration.
 * @returns Full ffmpeg argument array.
 */
export function buildSpeedArgs(
  inputName: string,
  outputName: string,
  options: SpeedArgOptions,
): string[] {
  const { speed, hasAudio, targetFormat, encoderOptions } = options

  validateSpeed(speed)

  const args: string[] = ['-i', inputName]

  // ── Build filter_complex ──────────────────────────────────────────────
  const setptsExpr = (1 / speed).toFixed(6)
  const videoFilter = `[0:v]setpts=${setptsExpr}*PTS[outv]`

  if (hasAudio) {
    const atempoChain = buildAtempoChain(speed)
    const audioFilter = `[0:a]${atempoChain}[outa]`
    args.push('-filter_complex', `${videoFilter};${audioFilter}`)
    args.push('-map', '[outv]', '-map', '[outa]')
  } else {
    // Video-only: no audio branch in the filter graph
    args.push('-filter_complex', videoFilter)
    args.push('-map', '[outv]')
  }

  // ── Encoder args (video + audio) — always re-encode ───────────────────
  // Audio IS genuinely re-encoded (atempo modifies decoded audio before encoder)
  const encoderArgs = buildEncoderArgs({
    ...encoderOptions,
    resolution: 'original',
  })
  args.push(...encoderArgs)

  // ── Preserve metadata ─────────────────────────────────────────────────
  args.push('-map_metadata', '0')

  // ── Fast start for streaming-friendly containers ──────────────────────
  if (targetFormat === 'mp4' || targetFormat === 'mov') {
    args.push('-movflags', '+faststart')
  }

  args.push('-y', outputName)

  return args
}
