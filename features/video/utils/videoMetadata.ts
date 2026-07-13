/**
 * Two-phase video metadata extraction.
 *
 * Phase 1 (immediate): Uses HTML5 <video> element — returns duration, width, height.
 *   No ffmpeg needed. The UI becomes usable immediately after upload.
 *
 * Phase 2 (background): Uses ffmpeg.wasm to probe stream details — returns
 *   FPS, codec names, bitrate, aspect ratio. Runs after getFFmpeg() resolves.
 *   Accepts the basic metadata from Phase 1 to avoid re-extracting it.
 */

import type { FFmpeg } from '@ffmpeg/ffmpeg'
import type { VideoMetadata, ExtendedVideoMetadata } from '@/features/video/types'
import { getFFmpeg, runExclusive } from '@/features/audio/utils/ffmpegClient'

// ─── Phase 1: Basic Metadata (HTML5, immediate) ──────────────────────────────

/**
 * Extract basic video metadata using a native <video> element.
 *
 * Runs immediately after file upload — no ffmpeg needed. The UI (slider,
 * time inputs, preview, segment playback) is fully functional with this data.
 *
 * @returns VideoMetadata with duration/width/height, or null if unreadable.
 */
export function getBasicMetadata(file: File): Promise<VideoMetadata | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.remove()
    }

    video.onloadedmetadata = () => {
      const metadata: VideoMetadata = {
        duration: isFinite(video.duration) && video.duration > 0 ? video.duration : 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
      }
      cleanup()
      resolve(metadata)
    }

    video.onerror = () => {
      cleanup()
      resolve(null)
    }

    // Timeout — don't hang forever if metadata never loads
    setTimeout(() => {
      cleanup()
      resolve(null)
    }, 30_000)

    video.src = url
  })
}

// ─── Phase 2: Advanced Metadata (ffmpeg probe, background) ────────────────────

/**
 * Extract advanced video metadata using ffmpeg to probe stream information.
 *
 * This is called in the background after getFFmpeg() resolves. It does NOT
 * block the UI — the trim tool is already interactive from Phase 1 data.
 *
 * The ffmpeg probe is serialized through runExclusive() to avoid conflicts
 * with any in-progress video processing.
 *
 * @param ffmpeg - Already-loaded ffmpeg instance (from getFFmpeg()).
 * @param file   - The source video file.
 * @param basic  - Basic metadata from Phase 1 (avoid re-extracting).
 * @returns ExtendedVideoMetadata with all available fields.
 */
export async function getAdvancedMetadata(
  ffmpeg: FFmpeg,
  file: File,
  basic: VideoMetadata
): Promise<ExtendedVideoMetadata> {
  const inputExt = file.name.split('.').pop()?.toLowerCase() ?? 'mp4'
  const inputName = `vmeta_in_${Date.now()}.${inputExt}`

  // Default values
  let fps = 30
  let codec = 'unknown'
  let audioCodec = 'unknown'
  let bitrate = 0

  try {
    // Serialize the probe through the exclusive lock to avoid virtual FS races
    await runExclusive(async () => {
      // Write the file into ffmpeg's virtual filesystem
      const fileBuffer = new Uint8Array(await file.arrayBuffer())
      await ffmpeg.writeFile(inputName, fileBuffer)

      // Run ffmpeg with null output — it reads stream headers but doesn't encode.
      // The log output (stderr) contains stream info we can parse.
      const logLines: string[] = []

      const logHandler = ({ message }: { message: string }) => {
        logLines.push(message)
      }

      try {
        ffmpeg.on('log', logHandler)

        // -f null — just reads headers, no encoding
        try {
          await ffmpeg.exec(['-i', inputName, '-f', 'null', '-'])
        } catch {
          // ffmpeg will exit with an error for -f null (no output file written).
          // This is expected — we just need the log output.
        }
      } finally {
        // Always remove the log listener
        ffmpeg.off('log', logHandler)
      }

      // Parse stream info from log lines
      const logText = logLines.join('\n')

      // Try to extract video stream info
      // ffmpeg log format: "Stream #0:0: Video: h264 (avc1), yuv420p, 1920x1080, 30 fps, ..."
      const videoStreamMatch = logText.match(/Stream #\d+:\d+:\s*Video:\s*([^,\n]+(?:,[^,\n]+)*)/i)
      if (videoStreamMatch) {
        const streamInfo = videoStreamMatch[1]

        // Extract codec name — first word after "Video:"
        const codecMatch = streamInfo.match(/^(\S+)/)
        if (codecMatch) codec = codecMatch[1].toLowerCase()

        // Extract FPS — look for "30 fps" or "29.97 fps" or "30000/1001"
        const fpsMatch = streamInfo.match(/(\d+(?:\.\d+)?)\s*fps/)
        if (fpsMatch) fps = parseFloat(fpsMatch[1])
      }

      // Try to extract audio stream info
      const audioStreamMatch = logText.match(/Stream #\d+:\d+:\s*Audio:\s*([^,\n]+)/i)
      if (audioStreamMatch) {
        audioCodec = audioStreamMatch[1].toLowerCase()
      }
    })
  } catch {
    // If probing fails, fall back to defaults — the tool still works
  } finally {
    // Clean up virtual file
    try {
      await ffmpeg.deleteFile(inputName)
    } catch {
      // Best-effort
    }
  }

  // Compute bitrate from file size and duration (no ffmpeg needed)
  if (basic.duration > 0) {
    bitrate = Math.round((file.size * 8) / basic.duration)
  }

  // Compute aspect ratio from basic metadata
  let aspectRatio = '16:9'
  if (basic.width > 0 && basic.height > 0) {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
    const divisor = gcd(basic.width, basic.height)
    aspectRatio = `${basic.width / divisor}:${basic.height / divisor}`
  }

  return {
    duration: basic.duration,
    width: basic.width,
    height: basic.height,
    fps,
    codec,
    bitrate,
    audioCodec,
    aspectRatio,
  }
}

// ─── Convenience ──────────────────────────────────────────────────────────────

/**
 * Load ffmpeg in the background (do NOT await — fire-and-forget).
 * Use this to pre-warm the ffmpeg singleton while the user is interacting with the UI.
 */
export function preloadFFmpeg(): void {
  getFFmpeg().catch(() => {
    // Silently ignore — ffmpeg load failure is surfaced when the user clicks Trim
  })
}
