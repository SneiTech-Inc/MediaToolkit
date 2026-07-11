import type { FFmpeg } from '@ffmpeg/ffmpeg'
import type { AudioFormat } from '@/features/audio/types'

// ─── Singleton ffmpeg instance ────────────────────────────────────────────────
// Lazily initialized on first call. Never loaded at module scope — the ~31 MB
// WASM binary is only fetched when a tool actually triggers audio processing.
// Shared across all audio tools (Convert Audio, Merge Audio, etc.) so the core
// is loaded at most once per session.

let ffmpegInstance: FFmpeg | null = null
let ffmpegLoading: Promise<FFmpeg> | null = null

/**
 * Returns a lazily-initialized, shared ffmpeg.wasm instance.
 *
 * On first call: dynamically imports @ffmpeg/ffmpeg, creates the Web Worker,
 * and loads the single-threaded core from `/ffmpeg/`. Subsequent calls return
 * the already-loaded instance immediately.
 *
 * Single-threaded core = no SharedArrayBuffer needed = no COOP/COEP headers.
 */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance

  // If already loading, wait for that promise (avoids double-init races)
  if (ffmpegLoading) return ffmpegLoading

  ffmpegLoading = (async () => {
    // Dynamic import — code-split ffmpeg into its own chunk
    const { FFmpeg: FFmpegClass } = await import('@ffmpeg/ffmpeg')

    const ffmpeg = new FFmpegClass()

    // Load the single-threaded core from our self-hosted files.
    await ffmpeg.load({
      coreURL: '/ffmpeg/ffmpeg-core.js',
      wasmURL: '/ffmpeg/ffmpeg-core.wasm',
    })

    ffmpegInstance = ffmpeg
    return ffmpeg
  })()

  return ffmpegLoading
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map a file extension (without dot) to an AudioFormat. */
export function extensionToFormat(ext: string): AudioFormat | null {
  const map: Record<string, AudioFormat> = {
    mp3: 'mp3',
    wav: 'wav',
    wave: 'wav',
    aac: 'aac',
    ogg: 'ogg',
    oga: 'ogg',
    flac: 'flac',
    m4a: 'm4a',
    mp4: 'm4a',
  }
  return map[ext.toLowerCase()] ?? null
}

/** Generate a unique filename suitable for ffmpeg's virtual filesystem. */
export function tempName(prefix: string, format: AudioFormat): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${format}`
}

/**
 * Normalize ffmpeg.wasm progress values to 0–100.
 *
 * ffmpeg.wasm 0.12.x reports progress as 0–10000 (ratio × 10000).
 * Older versions report 0–1. This handles both.
 */
export function normalizeProgress(progress: number): number {
  const percent = progress > 1 ? progress / 100 : progress * 100
  return Math.min(100, Math.max(0, Math.round(percent)))
}
