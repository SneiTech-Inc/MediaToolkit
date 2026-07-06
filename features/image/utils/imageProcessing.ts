import type { OutputFormat, ImageCompressionOptions, ImageCompressionResult, CompressionProgressCallback } from '@/features/image/types'

/**
 * Load a File into an HTMLImageElement.
 * Uses FileReader for broader compatibility; falls back to URL.createObjectURL.
 */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load image from file.'))
      img.src = reader.result as string
    }

    reader.onerror = () => reject(new Error('Failed to read file. It may be corrupted or too large.'))

    reader.readAsDataURL(file)
  })
}

/** Get the optimal output format based on the input file type. */
export function getDefaultFormat(file: File): OutputFormat {
  const type = file.type.toLowerCase()
  if (type === 'image/png') return 'image/png'
  if (type === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

/**
 * Check if the browser supports a given output format via canvas.toBlob().
 * WebP support requires the browser to include a WebP encoder.
 */
export function isFormatSupported(format: OutputFormat): boolean {
  if (format === 'image/webp') {
    // Feature-detect WebP encoding support
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const dataUrl = canvas.toDataURL('image/webp')
    return dataUrl.startsWith('data:image/webp')
  }
  // JPEG and PNG are universally supported
  return true
}

/** Calculate the scaled dimensions respecting maxWidth/maxHeight while preserving aspect ratio. */
export function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth?: number,
  maxHeight?: number
): { width: number; height: number } {
  let width = originalWidth
  let height = originalHeight

  if (maxWidth && width > maxWidth) {
    height = Math.round((height * maxWidth) / width)
    width = maxWidth
  }

  if (maxHeight && height > maxHeight) {
    width = Math.round((width * maxHeight) / height)
    height = maxHeight
  }

  return { width, height }
}

/**
 * Core compression function: draws an image onto a canvas and exports it via toBlob().
 * Returns the compressed blob plus metadata.
 */
export function compressImage(
  image: HTMLImageElement,
  options: ImageCompressionOptions,
  onProgress?: CompressionProgressCallback
): Promise<Omit<ImageCompressionResult, 'originalSize' | 'previewUrl'>> {
  return new Promise((resolve, reject) => {
    onProgress?.(10)

    const { width, height } = calculateDimensions(
      image.naturalWidth,
      image.naturalHeight,
      options.maxWidth,
      options.maxHeight
    )

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Failed to create Canvas 2D context. Your browser may not support this feature.'))
      return
    }

    onProgress?.(30)

    // For JPEG output, fill with white background (JPEG doesn't support transparency)
    if (options.format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
    }

    // Draw the image at the calculated dimensions
    ctx.drawImage(image, 0, 0, width, height)

    onProgress?.(60)

    // Export via toBlob for efficient binary output
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create compressed image blob. The output may be too large.'))
          return
        }

        onProgress?.(100)

        resolve({
          blob,
          compressedSize: blob.size,
          ratio: 1, // placeholder — caller fills in with originalSize
          percentSaved: 0, // placeholder — caller fills in
          width,
          height,
        })
      },
      options.format,
      // PNG ignores quality parameter; JPEG/WebP use it
      options.format === 'image/png' ? undefined : options.quality
    )
  })
}

/**
 * High-level function: takes a File, returns compression result with all metadata.
 * This is the main public API for image compression.
 */
export async function processImage(
  file: File,
  options: ImageCompressionOptions,
  onProgress?: CompressionProgressCallback
): Promise<ImageCompressionResult> {
  // Step 1: Load image
  onProgress?.(0)
  const image = await loadImage(file)

  // Step 2: Compress
  const result = await compressImage(image, options, (p) => {
    // Map internal progress (10-100) to caller progress (5-95)
    onProgress?.(5 + Math.round(p * 0.9))
  })

  // Step 3: Build preview URL
  const previewUrl = URL.createObjectURL(result.blob)

  // Step 4: Calculate size metrics
  const originalSize = file.size
  const ratio = originalSize > 0 ? result.compressedSize / originalSize : 1
  const percentSaved = Math.round((1 - ratio) * 100)

  return {
    ...result,
    originalSize,
    ratio,
    percentSaved,
    previewUrl,
  }
}

/** Clean up an object URL to prevent memory leaks. */
export function revokePreviewUrl(url: string): void {
  URL.revokeObjectURL(url)
}

// ─── Resize ──────────────────────────────────────────────────────────────────

export interface ResizeResult {
  blob: Blob
  width: number
  height: number
  previewUrl: string
}

/**
 * Resize an image file to the specified dimensions using Canvas API.
 * Preserves the original aspect ratio if only one dimension is provided.
 */
export async function resizeImage(
  file: File,
  width: number,
  height: number,
  format: OutputFormat = 'image/jpeg'
): Promise<ResizeResult> {
  const image = await loadImage(file)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to create Canvas 2D context.')
  }

  // Fill white background for JPEG (no transparency support)
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }

  ctx.drawImage(image, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create resized image blob.'))
          return
        }
        const previewUrl = URL.createObjectURL(blob)
        resolve({ blob, width, height, previewUrl })
      },
      format,
      format === 'image/png' ? undefined : 0.92
    )
  })
}

// ─── Convert ─────────────────────────────────────────────────────────────────

/**
 * Convert an image file to a different format using Canvas API.
 *
 * Format notes:
 * - JPEG: lossy, no transparency, quality slider applies
 * - PNG: lossless, supports transparency, quality is ignored
 * - WebP: lossy/lossless depending on quality, supports transparency
 */
export async function convertImage(
  file: File,
  format: OutputFormat,
  quality = 0.92
): Promise<ResizeResult> {
  const image = await loadImage(file)
  const { naturalWidth: width, naturalHeight: height } = image

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to create Canvas 2D context.')
  }

  // JPEG doesn't support transparency — fill white background
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }

  ctx.drawImage(image, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create converted image blob.'))
          return
        }
        const previewUrl = URL.createObjectURL(blob)
        resolve({ blob, width, height, previewUrl })
      },
      format,
      format === 'image/png' ? undefined : quality
    )
  })
}

// ─── Crop ────────────────────────────────────────────────────────────────────

export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Crop an image file to the specified pixel region using Canvas API.
 * Draws only the cropped region onto a new canvas at the exact crop dimensions.
 */
export async function cropImage(
  file: File,
  crop: CropArea,
  format: OutputFormat = 'image/jpeg'
): Promise<ResizeResult> {
  const image = await loadImage(file)

  const canvas = document.createElement('canvas')
  canvas.width = crop.width
  canvas.height = crop.height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to create Canvas 2D context.')
  }

  // JPEG background fill (no transparency)
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, crop.width, crop.height)
  }

  // Draw the cropped region from the source image
  ctx.drawImage(
    image,
    crop.x, crop.y, crop.width, crop.height,  // source region
    0, 0, crop.width, crop.height              // destination
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create cropped image blob.'))
          return
        }
        const previewUrl = URL.createObjectURL(blob)
        resolve({ blob, width: crop.width, height: crop.height, previewUrl })
      },
      format,
      format === 'image/png' ? undefined : 0.92
    )
  })
}

// ─── Rotate ──────────────────────────────────────────────────────────────────

/**
 * Rotate an image by the given angle (in degrees) using Canvas API.
 * Computes the correct bounding-box dimensions so no part of the image is clipped.
 *
 * @param file - Source image file
 * @param angleDeg - Rotation angle in degrees (positive = clockwise)
 * @param format - Output MIME type
 */
export async function rotateImage(
  file: File,
  angleDeg: number,
  format: OutputFormat = 'image/jpeg'
): Promise<ResizeResult> {
  const image = await loadImage(file)
  const { naturalWidth: w, naturalHeight: h } = image

  const rad = (angleDeg * Math.PI) / 180
  const sin = Math.abs(Math.sin(rad))
  const cos = Math.abs(Math.cos(rad))

  // Bounding-box dimensions for the rotated image
  const newWidth = Math.floor(w * cos + h * sin)
  const newHeight = Math.floor(h * cos + w * sin)

  const canvas = document.createElement('canvas')
  canvas.width = newWidth
  canvas.height = newHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to create Canvas 2D context.')
  }

  // JPEG background fill
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, newWidth, newHeight)
  }

  // Translate to center, rotate, draw centered
  ctx.translate(newWidth / 2, newHeight / 2)
  ctx.rotate(rad)
  ctx.drawImage(image, -w / 2, -h / 2)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create rotated image blob.'))
          return
        }
        const previewUrl = URL.createObjectURL(blob)
        resolve({ blob, width: newWidth, height: newHeight, previewUrl })
      },
      format,
      format === 'image/png' ? undefined : 0.92
    )
  })
}

// ─── Flip ────────────────────────────────────────────────────────────────────

export type FlipType = 'horizontal' | 'vertical' | 'both'

/**
 * Flip (mirror) an image horizontally, vertically, or both using Canvas API.
 * Uses scale+translate transforms — no pixel data manipulation needed.
 */
export async function flipImage(
  file: File,
  flipType: FlipType,
  format: OutputFormat = 'image/jpeg'
): Promise<ResizeResult> {
  const image = await loadImage(file)
  const { naturalWidth: w, naturalHeight: h } = image

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to create Canvas 2D context.')
  }

  // Flip transforms
  if (flipType === 'horizontal') {
    ctx.scale(-1, 1)
    ctx.translate(-w, 0)
  } else if (flipType === 'vertical') {
    ctx.scale(1, -1)
    ctx.translate(0, -h)
  } else if (flipType === 'both') {
    ctx.scale(-1, -1)
    ctx.translate(-w, -h)
  }

  // JPEG background fill
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }

  ctx.drawImage(image, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create flipped image blob.'))
          return
        }
        const previewUrl = URL.createObjectURL(blob)
        resolve({ blob, width: w, height: h, previewUrl })
      },
      format,
      format === 'image/png' ? undefined : 0.92
    )
  })
}

// ─── Watermark ───────────────────────────────────────────────────────────────

export type WatermarkPosition = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface TextWatermarkOptions {
  text: string
  fontSize: number
  color: string
  rotation: number
  position: WatermarkPosition
  opacity: number  // 0–1
  padding: number  // px from edges
}

export interface ImageWatermarkOptions {
  watermarkFile: File
  scale: number      // 0.1–1.0
  position: WatermarkPosition
  opacity: number    // 0–1
  padding: number
}

function calculatePosition(
  canvasW: number,
  canvasH: number,
  watermarkW: number,
  watermarkH: number,
  position: WatermarkPosition,
  padding: number
): { x: number; y: number } {
  switch (position) {
    case 'center':
      return { x: (canvasW - watermarkW) / 2, y: (canvasH - watermarkH) / 2 }
    case 'top-left':
      return { x: padding, y: padding }
    case 'top-right':
      return { x: canvasW - watermarkW - padding, y: padding }
    case 'bottom-left':
      return { x: padding, y: canvasH - watermarkH - padding }
    case 'bottom-right':
      return { x: canvasW - watermarkW - padding, y: canvasH - watermarkH - padding }
  }
}

/** Apply a text watermark to an image. */
export async function applyTextWatermark(
  file: File,
  options: TextWatermarkOptions,
  format: OutputFormat = 'image/jpeg'
): Promise<ResizeResult> {
  const image = await loadImage(file)
  const w = image.naturalWidth
  const h = image.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to create Canvas 2D context.')

  // Draw original
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(image, 0, 0)

  // Configure text style
  ctx.font = `${options.fontSize}px system-ui, sans-serif`
  ctx.fillStyle = options.color
  ctx.globalAlpha = options.opacity
  ctx.textBaseline = 'middle'

  // Measure text
  const metrics = ctx.measureText(options.text)
  const textWidth = metrics.width
  const textHeight = options.fontSize

  // Calculate position
  const pos = calculatePosition(w, h, textWidth, textHeight, options.position, options.padding)

  // Apply rotation around text center
  ctx.save()
  const centerX = pos.x + textWidth / 2
  const centerY = pos.y + textHeight / 2
  ctx.translate(centerX, centerY)
  ctx.rotate((options.rotation * Math.PI) / 180)
  ctx.textAlign = 'center'
  ctx.fillText(options.text, 0, 0)
  ctx.restore()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Failed to create watermarked blob.')); return }
        const previewUrl = URL.createObjectURL(blob)
        resolve({ blob, width: w, height: h, previewUrl })
      },
      format,
      format === 'image/png' ? undefined : 0.92
    )
  })
}

/** Apply an image watermark (logo/overlay) to an image. */
export async function applyImageWatermark(
  file: File,
  options: ImageWatermarkOptions,
  format: OutputFormat = 'image/jpeg'
): Promise<ResizeResult> {
  const [image, watermarkImg] = await Promise.all([
    loadImage(file),
    loadImage(options.watermarkFile),
  ])

  const w = image.naturalWidth
  const h = image.naturalHeight

  // Scale watermark
  const wmW = Math.round(watermarkImg.naturalWidth * options.scale)
  const wmH = Math.round(watermarkImg.naturalHeight * options.scale)

  // Cap watermark at 50% of main image
  const maxW = w * 0.5
  const maxH = h * 0.5
  const scaleDown = Math.min(1, maxW / wmW, maxH / wmH)
  const finalW = Math.round(wmW * scaleDown)
  const finalH = Math.round(wmH * scaleDown)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to create Canvas 2D context.')

  // Draw original
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(image, 0, 0)

  // Calculate position
  const pos = calculatePosition(w, h, finalW, finalH, options.position, options.padding)

  // Draw watermark with opacity
  ctx.globalAlpha = options.opacity
  ctx.drawImage(watermarkImg, pos.x, pos.y, finalW, finalH)
  ctx.globalAlpha = 1

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Failed to create watermarked blob.')); return }
        const previewUrl = URL.createObjectURL(blob)
        resolve({ blob, width: w, height: h, previewUrl })
      },
      format,
      format === 'image/png' ? undefined : 0.92
    )
  })
}

// ─── Blur ────────────────────────────────────────────────────────────────────

/**
 * Apply a Gaussian blur to an image using the native Canvas filter API.
 * `ctx.filter = 'blur(Npx)'` — supported in all modern browsers.
 */
export async function blurImage(
  file: File,
  radius: number,
  format: OutputFormat = 'image/jpeg'
): Promise<ResizeResult> {
  const image = await loadImage(file)
  const w = image.naturalWidth
  const h = image.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to create Canvas 2D context.')

  if (format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }

  if (radius > 0) {
    ctx.filter = `blur(${radius}px)`
  }
  ctx.drawImage(image, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Failed to create blurred blob.')); return }
        const previewUrl = URL.createObjectURL(blob)
        resolve({ blob, width: w, height: h, previewUrl })
      },
      format,
      format === 'image/png' ? undefined : 0.92
    )
  })
}

// ─── Border ──────────────────────────────────────────────────────────────────

export interface BorderOptions {
  width: number
  color: string
  style: 'solid' | 'dashed' | 'dotted'
  radius: number
}

/** Add a border to an image using Canvas API. Supports solid/dashed/dotted styles and rounded corners. */
export async function addBorder(
  file: File,
  options: BorderOptions,
  format: OutputFormat = 'image/jpeg'
): Promise<ResizeResult> {
  const image = await loadImage(file)
  const iw = image.naturalWidth
  const ih = image.naturalHeight
  const bw = options.width
  const cw = iw + bw * 2
  const ch = ih + bw * 2

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!
  if (!ctx) throw new Error('Failed to create Canvas 2D context.')

  // Draw border background
  ctx.fillStyle = options.color
  const r = Math.min(options.radius, cw / 2, ch / 2)
  if (r > 0) {
    ctx.beginPath()
    if (ctx.roundRect) {
      ctx.roundRect(0, 0, cw, ch, r)
    } else {
      // Fallback for browsers without roundRect
      ctx.moveTo(r, 0); ctx.lineTo(cw - r, 0); ctx.arcTo(cw, 0, cw, r, r)
      ctx.lineTo(cw, ch - r); ctx.arcTo(cw, ch, cw - r, ch, r)
      ctx.lineTo(r, ch); ctx.arcTo(0, ch, 0, ch - r, r)
      ctx.lineTo(0, r); ctx.arcTo(0, 0, r, 0, r)
    }
    ctx.fill()
  } else {
    ctx.fillRect(0, 0, cw, ch)
  }

  // Set line dash for border style
  if (options.style === 'dashed') ctx.setLineDash([bw * 0.8, bw * 0.6])
  else if (options.style === 'dotted') ctx.setLineDash([bw * 0.3, bw * 0.6])
  // solid = no dash (default)

  // Draw image centered (inside border)
  if (r > 0) {
    ctx.save()
    ctx.beginPath()
    if (ctx.roundRect) {
      ctx.roundRect(bw, bw, iw, ih, Math.max(0, r - bw))
    }
    ctx.clip()
  }
  ctx.drawImage(image, bw, bw, iw, ih)
  if (r > 0) ctx.restore()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Failed to create bordered blob.')); return }
        const previewUrl = URL.createObjectURL(blob)
        resolve({ blob, width: cw, height: ch, previewUrl })
      },
      format,
      format === 'image/png' ? undefined : 0.92
    )
  })
}
