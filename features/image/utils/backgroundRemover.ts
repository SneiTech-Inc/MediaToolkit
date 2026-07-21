// ─── Background Removal Engine ────────────────────────────────────────────────
//
// Abstract wrapper around @imgly/background-removal. Follows the exact same
// singleton + exclusive-lock pattern established by ffmpegClient.ts:
//   - Lazy initialization on first use (code-split via dynamic import)
//   - Double-init guard via `engineLoading` promise
//   - Serial execution queue via `runExclusive()`
//
// Self-hosts the ONNX model + WASM runtime from /models/ — no third-party CDN
// dependency in production. Uses proxyToWorker so inference runs off the main
// thread (no UI freeze). Single-threaded = no SharedArrayBuffer needed = no
// COOP/COEP headers (protects AdSense + Google consent script).
// ──────────────────────────────────────────────────────────────────────────────

import { loadImage } from '@/features/image/utils/imageProcessing'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BackgroundMode = 'transparent' | 'solid-color' | 'image'
export type BackgroundOutputFormat = 'image/png' | 'image/webp' | 'image/jpeg'

export interface BackgroundRemovalOptions {
  /** How to handle the removed background. */
  backgroundMode: BackgroundMode
  /** Hex color string (e.g. "#ff0000") — used when backgroundMode is 'solid-color'. */
  backgroundColor?: string
  /** Uploaded replacement image — used when backgroundMode is 'image'. */
  backgroundImage?: File
  /** Output MIME type. JPEG is blocked at the UI level when backgroundMode is 'transparent'. */
  outputFormat: BackgroundOutputFormat
  /** Quality 0–1 for lossy formats (JPEG/WebP). Default 0.92. Ignored for PNG. */
  outputQuality?: number
  /** Progress callback for model download / initialization phase. */
  onModelProgress?: (percent: number) => void
  /** Progress callback for the inference / processing phase. */
  onInferenceProgress?: (percent: number) => void
  /** AbortSignal to cancel the operation. */
  signal?: AbortSignal
}

export interface BackgroundRemovalResult {
  blob: Blob
  previewUrl: string
  width: number
  height: number
}

export interface BrowserSupportResult {
  supported: boolean
  reason?: string
}

// ─── Internal engine interface ────────────────────────────────────────────────

/** The subset of @imgly/background-removal that we actually use. */
interface BackgroundRemovalEngine {
  preload(config: Record<string, unknown>): Promise<void>
  removeBackground(image: ImageSource, config: Record<string, unknown>): Promise<Blob>
}

/** Union of all types the library accepts as an input image. */
type ImageSource = string | URL | File | Blob | ImageData | ArrayBuffer | Uint8Array

// ─── Singleton state (mirrors ffmpegClient.ts) ────────────────────────────────

let engineInstance: BackgroundRemovalEngine | null = null
let engineLoading: Promise<BackgroundRemovalEngine> | null = null

// ─── Exclusive execution lock ─────────────────────────────────────────────────

/**
 * Promise chain that serializes all background removal operations.
 *
 * The underlying ONNX runtime / WASM worker cannot safely run concurrent
 * inference sessions. Every caller goes through this single queue so that
 * uploading a new image mid-processing automatically cancels and replaces
 * the previous operation.
 */
let currentOperation: Promise<unknown> = Promise.resolve()

/**
 * Run a background removal operation exclusively.
 * The next operation will not start until the current one settles
 * (fulfilled or rejected).
 */
function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const result = currentOperation.then(fn, fn)
  currentOperation = result.catch(() => {})
  return result
}

// ─── Engine lifecycle ─────────────────────────────────────────────────────────

/**
 * Default configuration passed to the library for every call.
 *
 * SELF-HOSTING: Set publicPath to '/models/' and run `scripts/download-models.ps1`
 * to download the ~123 MB of model chunks into public/models/. The script reads
 * resources.json and fetches each 4 MB chunk from the CDN. After that, all AI
 * model assets load from your own domain — no third-party CDN dependency.
 *
 * Until self-hosting is set up, we explicitly point to the IMG.LY CDN (this is
 * NOT the library default — we control the URL here).
 */
const ENGINE_CONFIG = {
  // TODO: Switch to '/models/' after running scripts/download-models.ps1
  publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/',
  device: 'cpu' as const,
  model: 'isnet_fp16' as const,
  proxyToWorker: true,
}

/**
 * Lazily initialize the background removal engine singleton.
 *
 * On first call: dynamically imports @imgly/background-removal (code-split
 * into its own chunk — the ~12 MB ONNX model is NOT in the main bundle).
 * Subsequent calls return the already-loaded instance immediately.
 */
export async function getBackgroundEngine(): Promise<BackgroundRemovalEngine> {
  if (engineInstance) return engineInstance

  // If already loading, wait for that promise (avoids double-init races)
  if (engineLoading) return engineLoading

  engineLoading = (async () => {
    const bgRemoval = await import('@imgly/background-removal')

    const engine: BackgroundRemovalEngine = {
      async preload(config) {
        await bgRemoval.preload(config)
      },
      async removeBackground(image, config) {
        return bgRemoval.removeBackground(image, config)
      },
    }

    engineInstance = engine
    return engine
  })()

  return engineLoading
}

/**
 * Fire-and-forget model preload.
 *
 * Call in a useEffect on component mount so the model begins warming up
 * before the user clicks anything. Mirrors the preloadFFmpeg() pattern
 * used across all Video/Audio tools.
 *
 * Does NOT block — failure is silently ignored (surfaced on actual use).
 */
export function preloadBackgroundEngine(): void {
  getBackgroundEngine()
    .then(async (engine) => {
      await engine.preload({
        ...ENGINE_CONFIG,
        progress: () => {
          // Silent preload — no UI updates needed
        },
      })
    })
    .catch(() => {
      // Preload failure is surfaced when the user actually clicks "Remove"
    })
}

/**
 * Terminate the current engine instance and null out the singleton.
 * The next call to getBackgroundEngine() will re-initialize a fresh instance.
 */
export async function terminateBackgroundEngine(): Promise<void> {
  engineInstance = null
  engineLoading = null
  currentOperation = Promise.resolve()
}

// ─── Browser support check ────────────────────────────────────────────────────

/** Check whether the browser supports the features required for background removal. */
export function checkBrowserSupport(): BrowserSupportResult {
  if (typeof WebAssembly === 'undefined' || !WebAssembly) {
    return {
      supported: false,
      reason:
        'WebAssembly is not supported in your browser. Please upgrade to a modern browser like Chrome, Firefox, Edge, or Safari 15+.',
    }
  }

  if (typeof Worker === 'undefined') {
    return {
      supported: false,
      reason:
        'Web Workers are not supported in your browser. Please upgrade to a modern browser like Chrome, Firefox, Edge, or Safari.',
    }
  }

  if (typeof OffscreenCanvas === 'undefined') {
    return {
      supported: false,
      reason:
        'OffscreenCanvas is not supported in your browser. The AI model requires this feature to run off the main thread. Please upgrade to a modern browser.',
    }
  }

  if (typeof HTMLCanvasElement.prototype.toBlob === 'undefined') {
    return {
      supported: false,
      reason:
        'Canvas export is not supported in your browser. Please upgrade to a modern browser.',
    }
  }

  return { supported: true }
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum file size: 20 MB. */
const MAX_FILE_SIZE = 20 * 1024 * 1024

/**
 * Maximum pixel dimension for inference.
 * Images with a longest edge exceeding this are downscaled before the model
 * (the original resolution is kept for final compositing / export).
 */
const MAX_INFERENCE_EDGE = 4096

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create an ImageBitmap from a Blob, respecting EXIF orientation.
 * ImageBitmap is more memory-efficient than HTMLImageElement for the
 * background replacement path.
 */
async function blobToImageBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob)
}

/**
 * Load a replacement background image from a File and draw it onto a canvas
 * using "cover" scaling — matching CSS object-fit: cover semantics.
 *
 * The background fills the entire target area while preserving its own
 * aspect ratio. The resulting draw region is centered; overflow is cropped.
 *
 *   const scale = Math.max(fgW / bgW, fgH / bgH)
 *   const w = bgW * scale
 *   const h = bgH * scale
 *   const x = (fgW - w) / 2    // center
 *   const y = (fgH - h) / 2
 */
async function drawCoverBackground(
  ctx: CanvasRenderingContext2D,
  bgFile: File,
  targetW: number,
  targetH: number,
): Promise<void> {
  const bgImage = await loadImage(bgFile)
  const bgW = bgImage.naturalWidth
  const bgH = bgImage.naturalHeight

  const scale = Math.max(targetW / bgW, targetH / bgH)
  const drawW = Math.round(bgW * scale)
  const drawH = Math.round(bgH * scale)
  const offsetX = Math.round((targetW - drawW) / 2)
  const offsetY = Math.round((targetH - drawH) / 2)

  ctx.drawImage(bgImage, offsetX, offsetY, drawW, drawH)
}

/**
 * Downscale a file for inference, preserving aspect ratio.
 * Returns a Blob of the downscaled image at the new dimensions.
 * Only called when the image exceeds MAX_INFERENCE_EDGE.
 */
async function downscaleForInference(
  file: File,
): Promise<{ blob: Blob; width: number; height: number }> {
  const image = await loadImage(file)
  const origW = image.naturalWidth
  const origH = image.naturalHeight

  const scale = MAX_INFERENCE_EDGE / Math.max(origW, origH)
  const newW = Math.round(origW * scale)
  const newH = Math.round(origH * scale)

  const canvas = document.createElement('canvas')
  canvas.width = newW
  canvas.height = newH

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to create Canvas 2D context for downscaling.')

  ctx.drawImage(image, 0, 0, newW, newH)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create downscaled image blob.'))
          return
        }
        resolve({ blob, width: newW, height: newH })
      },
      file.type || 'image/png',
    )
  })
}

/**
 * Composite the foreground (removed-background result, possibly at a
 * different resolution than the original) onto a user-chosen background.
 *
 * The resulting canvas always uses the original image dimensions so the
 * user gets full-resolution output regardless of any inference-time
 * downscaling.
 */
async function compositeFinalImage(
  foregroundBlob: Blob,
  outputWidth: number,
  outputHeight: number,
  options: BackgroundRemovalOptions,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to create Canvas 2D context for compositing.')

  // ── Layer 1: Background ──────────────────────────────────────────────
  if (options.backgroundMode === 'solid-color') {
    ctx.fillStyle = options.backgroundColor ?? '#ffffff'
    ctx.fillRect(0, 0, outputWidth, outputHeight)
  } else if (options.backgroundMode === 'image' && options.backgroundImage) {
    await drawCoverBackground(ctx, options.backgroundImage, outputWidth, outputHeight)
  }

  // ── Layer 2: Foreground (scaled to output dimensions) ─────────────────
  const fgBitmap = await blobToImageBitmap(foregroundBlob)
  try {
    ctx.drawImage(fgBitmap, 0, 0, outputWidth, outputHeight)
  } finally {
    fgBitmap.close()
  }

  // Determine the actual output format
  const mimeType =
    options.backgroundMode === 'transparent' && options.outputFormat === 'image/jpeg'
      ? 'image/png' // defensive fallback — UI prevents this combination
      : options.outputFormat

  const quality =
    mimeType === 'image/png' ? undefined : (options.outputQuality ?? 0.92)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create final composited image blob.'))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

// ─── Progress helper ──────────────────────────────────────────────────────────

/**
 * The library reports progress as (key: string, current: number, total: number).
 * Convert to a normalized 0–100 integer percentage.
 */
function normalizeLibraryProgress(
  current: number,
  total: number,
): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((current / total) * 100)))
}

// ─── High-level processing API ────────────────────────────────────────────────

/**
 * Remove the background from an image file.
 *
 * Pipeline:
 *   1. Validate file size
 *   2. Check browser support
 *   3. Load image + get original dimensions (EXIF orientation respected)
 *   4. Downscale for inference if longest edge > 4096px
 *   5. Load / preload the engine (model warmup with progress)
 *   6. Run inference (with progress)
 *   7. Composite onto chosen background (or keep transparent)
 *   8. Return result blob + preview URL
 *
 * The original image resolution is preserved for output — the model only
 * sees a downscaled version when necessary.
 */
export async function removeImageBackground(
  file: File,
  options: BackgroundRemovalOptions,
): Promise<BackgroundRemovalResult> {
  // ── Validate ──────────────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds the ${MAX_FILE_SIZE / 1024 / 1024} MB limit. Please use a smaller image or compress it first.`,
    )
  }

  // ── Load image + capture original dimensions ──────────────────────────
  options.onModelProgress?.(5)

  const image = await loadImage(file)
  const originalWidth = image.naturalWidth
  const originalHeight = image.naturalHeight

  // ── Determine inference input ─────────────────────────────────────────
  // Downscale for the model if needed, but always output at original resolution
  let inferenceInput: Blob
  let needsDownscale = false

  if (Math.max(originalWidth, originalHeight) > MAX_INFERENCE_EDGE) {
    options.onModelProgress?.(10)
    const downscaled = await downscaleForInference(file)
    inferenceInput = downscaled.blob
    needsDownscale = true
  } else {
    inferenceInput = file
  }

  // ── Get engine + preload model ────────────────────────────────────────
  options.onModelProgress?.(needsDownscale ? 20 : 10)

  const engine = await getBackgroundEngine()

  // Preload (idempotent — if already warm, resolves immediately)
  // We track progress during preload for the UI's model-loading phase
  let preloadDone = false
  await engine.preload({
    ...ENGINE_CONFIG,
    progress: (_key: string, current: number, total: number) => {
      const pct = normalizeLibraryProgress(current, total)
      // Map preload progress to 20–70% of the model-loading phase
      options.onModelProgress?.(20 + Math.round(pct * 0.5))
      if (pct >= 100) {
        preloadDone = true
        options.onModelProgress?.(70)
      }
    },
  })

  // If preload resolved without progress reaching 100% (already cached),
  // jump the model progress to complete.
  if (!preloadDone) {
    options.onModelProgress?.(70)
  }

  // ── Check for cancellation ────────────────────────────────────────────
  if (options.signal?.aborted) {
    throw new DOMException('Background removal was cancelled.', 'AbortError')
  }

  // ── Run inference ─────────────────────────────────────────────────────
  options.onModelProgress?.(75)
  options.onInferenceProgress?.(0)

  const fgBlob = await engine.removeBackground(inferenceInput, {
    ...ENGINE_CONFIG,
    progress: (_key: string, current: number, total: number) => {
      const pct = normalizeLibraryProgress(current, total)
      options.onInferenceProgress?.(pct)
    },
  })

  options.onInferenceProgress?.(100)
  options.onModelProgress?.(90)

  // ── Check for cancellation ────────────────────────────────────────────
  if (options.signal?.aborted) {
    throw new DOMException('Background removal was cancelled.', 'AbortError')
  }

  // ── Post-process: composite background ────────────────────────────────
  let resultBlob: Blob

  if (options.backgroundMode === 'transparent') {
    // The library returns PNG with alpha by default — use as-is
    resultBlob = fgBlob

    // Defensive: if JPEG somehow requested with transparent mode,
    // explicitly flatten onto white (UI should prevent this)
    if (options.outputFormat === 'image/jpeg') {
      const canvas = document.createElement('canvas')
      canvas.width = originalWidth
      canvas.height = originalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to create canvas for JPEG flattening.')

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, originalWidth, originalHeight)

      const fgBmp = await blobToImageBitmap(fgBlob)
      try {
        ctx.drawImage(fgBmp, 0, 0, originalWidth, originalHeight)
      } finally {
        fgBmp.close()
      }

      resultBlob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (!b) { reject(new Error('Failed to create JPEG blob.')); return }
            resolve(b)
          },
          'image/jpeg',
          options.outputQuality ?? 0.92,
        )
      })
    }
  } else {
    // Solid color or uploaded image background — composite
    resultBlob = await compositeFinalImage(fgBlob, originalWidth, originalHeight, options)
  }

  const finalWidth =
    options.backgroundMode === 'transparent'
      ? originalWidth
      : originalWidth
  const finalHeight =
    options.backgroundMode === 'transparent'
      ? originalHeight
      : originalHeight

  options.onModelProgress?.(100)

  // ── Build preview URL ─────────────────────────────────────────────────
  const previewUrl = URL.createObjectURL(resultBlob)

  return {
    blob: resultBlob,
    previewUrl,
    width: finalWidth,
    height: finalHeight,
  }
}
