/**
 * Canvas-based timeline thumbnail generation.
 * Used by Trim, Crop, Video-to-GIF, and any tool needing video frame previews.
 */

import type { ThumbnailData } from '@/features/video/types'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Output thumbnail dimensions (width × height in pixels). */
const THUMB_WIDTH = 120
const THUMB_HEIGHT = 68

/** JPEG quality for thumbnail export (0–1). Lower = smaller data URLs. */
const THUMB_QUALITY = 0.6

/** Maximum number of thumbnails regardless of video length. Prevents memory bloat. */
const MAX_THUMBNAILS = 40

/** Timeout per frame capture in milliseconds. Prevents hanging on problematic seeks. */
const FRAME_CAPTURE_TIMEOUT = 3000

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate evenly-spaced thumbnail images from a video file.
 *
 * Creates a hidden <video> element, seeks to evenly-spaced positions across
 * the video duration, draws each frame to an offscreen canvas, and exports
 * as a low-quality JPEG data URL.
 *
 * Degrades gracefully: if the browser cannot decode the video (unsupported
 * codec, corrupted file), returns an empty array instead of throwing.
 *
 * @param file     - The source video file.
 * @param duration - Total video duration in seconds.
 * @param count    - Desired number of thumbnails (clamped to 1–MAX_THUMBNAILS).
 * @returns Array of { time, dataUrl } objects, one per thumbnail position.
 */
export async function generateThumbnails(
  file: File,
  duration: number,
  count: number
): Promise<ThumbnailData[]> {
  try {
    // Clamp count
    const thumbCount = Math.max(1, Math.min(count, MAX_THUMBNAILS))
    const interval = duration / thumbCount

    // Create elements
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true

    const canvas = document.createElement('canvas')
    canvas.width = THUMB_WIDTH
    canvas.height = THUMB_HEIGHT
    const ctx = canvas.getContext('2d')

    const url = URL.createObjectURL(file)

    const results: ThumbnailData[] = []

    try {
      // Wait for the video to be ready
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('Failed to load video for thumbnails'))
        video.src = url
      })

      // Generate thumbnails sequentially
      for (let i = 0; i < thumbCount; i++) {
        const time = i * interval + interval / 2 // middle of each interval

        // Skip if beyond duration
        if (time >= duration) break

        try {
          const dataUrl = await captureFrame(video, canvas, ctx, time)
          if (dataUrl) {
            results.push({ time, dataUrl })
          }
        } catch {
          // Skip frames that fail to capture (may happen near end of video)
          continue
        }
      }
    } finally {
      // Cleanup
      URL.revokeObjectURL(url)
      video.remove()
    }

    return results
  } catch (error) {
    // Graceful degradation: if the browser can't decode the video at all
    // (unsupported codec, corrupted file), return empty array instead of crashing.
    console.warn('[VideoThumbnail] Unable to generate thumbnails:', error)
    return []
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Seek to a specific time and capture the frame to a data URL.
 *
 * Includes a 3-second timeout — if the 'seeked' event never fires
 * (can happen with corrupted or unusual codecs), the promise resolves
 * to null instead of hanging forever.
 */
function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D | null,
  time: number
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!ctx) {
      resolve(null)
      return
    }

    let settled = false

    const finish = (result: string | null) => {
      if (settled) return
      settled = true
      video.removeEventListener('seeked', onSeeked)
      clearTimeout(timeoutId)
      resolve(result)
    }

    const onSeeked = () => {
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        finish(canvas.toDataURL('image/jpeg', THUMB_QUALITY))
      } catch {
        finish(null)
      }
    }

    // Timeout: if seek never completes, don't hang
    const timeoutId = setTimeout(() => finish(null), FRAME_CAPTURE_TIMEOUT)

    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}
