import {
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFArray,
  PDFDict,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
} from 'pdf-lib'

export type CompressionLevel = 'low' | 'medium' | 'high'

export interface CompressionResult {
  data: Uint8Array
  originalSize: number
  compressedSize: number
  percentSaved: number
  imagesFound: number
  imagesCompressed: number
}

// ─── Quality & Dimension Maps ──────────────────────────────────────────────

const QUALITY_MAP: Record<CompressionLevel, number> = {
  low: 0.85,
  medium: 0.50,
  high: 0.25,
}

const MAX_DIMENSION_MAP: Record<CompressionLevel, number | null> = {
  low: null,
  medium: 2000,
  high: 1440,
}

/** Skip images smaller than this — JPEG re-encoding overhead may increase their size */
const MIN_IMAGE_DIMENSION = 100

/** Filters we can process */
const SUPPORTED_FILTERS = new Set<string>(['DCTDecode', 'FlateDecode'])

// ─── Image Stream Info ─────────────────────────────────────────────────────

interface ImageInfo {
  ref: PDFRef
  width: number
  height: number
  bitsPerComponent: number
  colorSpace: string
  filter: string
  hasSMask: boolean
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Compress a PDF by re-encoding embedded images at lower quality via Canvas API
 * and applying structural optimizations (object streams, metadata stripping).
 *
 * Strategy (per compression level):
 * - Low:   quality=0.85, no downsampling, structural save
 * - Medium: quality=0.50, max 2000px, object streams enabled
 * - High:  quality=0.25, max 1440px, object streams + metadata stripped
 */
export async function compressPDF(
  file: File,
  level: CompressionLevel,
): Promise<CompressionResult> {
  const originalSize = file.size
  const buf = await file.arrayBuffer()
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true })

  const quality = QUALITY_MAP[level]
  const maxDimension = MAX_DIMENSION_MAP[level]

  // ── Pass 1: Discover image streams ──────────────────────────────────
  const images = findImageStreams(pdf)

  // ── Pass 2: Recompress each image in-place ──────────────────────────
  let imagesCompressed = 0

  for (const img of images) {
    try {
      const success = await recompressImage(pdf, img, quality, maxDimension)
      if (success) imagesCompressed++
    } catch {
      // Non-fatal: skip this image, continue with others
    }
  }

  // ── Pass 3: Strip metadata (high compression only) ──────────────────
  if (level === 'high') {
    try {
      pdf.setTitle('')
      pdf.setAuthor('')
      pdf.setSubject('')
      pdf.setKeywords([])
      pdf.setProducer('')
      pdf.setCreator('')
    } catch {
      // Non-fatal
    }
  }

  // ── Pass 4: Save with structural optimization ───────────────────────
  const data = await pdf.save({
    useObjectStreams: true,
  })

  const compressedSize = data.byteLength
  const percentSaved = Math.round((1 - compressedSize / originalSize) * 100)

  // Guard against negative (output larger than input)
  const finalPercentSaved = Math.max(0, percentSaved)

  return {
    data,
    originalSize,
    compressedSize,
    percentSaved: finalPercentSaved,
    imagesFound: images.length,
    imagesCompressed,
  }
}

// ─── Image Stream Discovery ────────────────────────────────────────────────

/**
 * Walk all indirect objects in the PDF and collect info about image XObject streams.
 * Uses `pdf.context.enumerateIndirectObjects()` — the low-level PDF object iterator.
 */
function findImageStreams(pdf: PDFDocument): ImageInfo[] {
  const context = pdf.context
  const objects = context.enumerateIndirectObjects()
  const images: ImageInfo[] = []

  for (const [ref, obj] of objects) {
    try {
      // Duck-type check: only PDFStream/PDFRawStream have getContents()
      if (typeof (obj as { getContents?: unknown }).getContents !== 'function') continue

      const stream = obj as PDFRawStream
      const { dict } = stream

      // Check /Subtype /Image
      const subtype = dict.lookupMaybe(PDFName.of('Subtype'), PDFName)
      if (!subtype || subtype !== PDFName.of('Image')) continue

      // Check filter
      const filter = readFilterName(dict)
      if (!filter || !SUPPORTED_FILTERS.has(filter)) continue

      // Extract dimensions
      const width = dict.lookupMaybe(PDFName.of('Width'), PDFNumber)?.asNumber()
      const height = dict.lookupMaybe(PDFName.of('Height'), PDFNumber)?.asNumber()
      if (!width || !height) continue

      // Skip tiny images (JPEG overhead may increase size)
      if (width < MIN_IMAGE_DIMENSION && height < MIN_IMAGE_DIMENSION) continue

      // Extract remaining metadata
      const bitsPerComponent =
        dict.lookupMaybe(PDFName.of('BitsPerComponent'), PDFNumber)?.asNumber() ?? 8
      const colorSpace = readColorSpaceName(dict)
      const hasSMask = dict.lookupMaybe(PDFName.of('SMask'), PDFName) !== undefined
        || dict.lookupMaybe(PDFName.of('SMask'), PDFArray) !== undefined
        || dict.lookupMaybe(PDFName.of('SMask'), PDFRef) !== undefined

      images.push({ ref, width, height, bitsPerComponent, colorSpace, filter, hasSMask })
    } catch {
      // Skip malformed objects — non-fatal
      continue
    }
  }

  return images
}

/**
 * Read the `/Filter` entry from an image dict.
 * Returns the filter name as a string, or null if unreadable.
 * Handles both single-name (`/DCTDecode`) and array (`[/FlateDecode /DCTDecode]`) forms.
 */
function readFilterName(dict: PDFDict): string | null {
  // Try single name first
  const single = dict.lookupMaybe(PDFName.of('Filter'), PDFName)
  if (single) return single.decodeText()

  // Try array form — grab the last filter (innermost)
  const arr = dict.lookupMaybe(PDFName.of('Filter'), PDFArray)
  if (arr && arr.size() > 0) {
    const last = arr.lookupMaybe(arr.size() - 1, PDFName)
    if (last) return last.decodeText()
  }

  return null
}

/**
 * Read the `/ColorSpace` entry from an image dict.
 * Returns a human-readable name like "DeviceRGB", "DeviceCMYK", "DeviceGray", or "Unknown".
 */
function readColorSpaceName(dict: PDFDict): string {
  const cs = dict.lookupMaybe(PDFName.of('ColorSpace'), PDFName)
  if (cs) return cs.decodeText()

  // Could be an array like [/ICCBased ...] — grab first element
  const csArr = dict.lookupMaybe(PDFName.of('ColorSpace'), PDFArray)
  if (csArr && csArr.size() > 0) {
    const first = csArr.lookupMaybe(0, PDFName)
    if (first) return first.decodeText()
  }

  return 'Unknown'
}

// ─── Image Recompression ───────────────────────────────────────────────────

/**
 * Recompress a single image from the PDF at the given quality.
 * Replaces the image stream in-place using `context.assign()`.
 *
 * @returns true if the image was successfully recompressed, false if skipped
 */
async function recompressImage(
  pdf: PDFDocument,
  img: ImageInfo,
  quality: number,
  maxDimension: number | null,
): Promise<boolean> {
  // Re-resolve the stream by ref to get a fresh reference
  const obj = pdf.context.lookup(img.ref)
  if (!obj) return false

  // Verify it's a stream-like object (has getContents method)
  if (typeof (obj as { getContents?: unknown }).getContents !== 'function') return false

  const stream = obj as PDFRawStream

  // Extract raw bytes
  let imageBytes: Uint8Array

  if (img.filter === 'DCTDecode') {
    // JPEG: raw stream contents ARE the JPEG file
    imageBytes = stream.getContents()
  } else if (img.filter === 'FlateDecode') {
    // FlateDecode: decode the raw pixel data, convert to RGBA pixels, then re-encode
    try {
      const decoded = decodePDFRawStream(stream)
      const pixels = decoded.decode()
      imageBytes = await flatePixelsToJPEG(pixels, img, quality, maxDimension)
    } catch {
      return false
    }
  } else {
    return false
  }

  // Recompress JPEG data (or already-rendered FlateDecode data) via Canvas
  if (img.filter === 'DCTDecode') {
    imageBytes = await recompressJPEGViaCanvas(imageBytes, quality, maxDimension)
  }

  // Compute new dimensions after potential downsampling
  const newDimensions = maxDimension
    ? clampDimensions(img.width, img.height, maxDimension)
    : { width: img.width, height: img.height }

  // Replace the stream in the document context
  try {
    const newStream = pdf.context.stream(imageBytes, {
      Type: 'XObject',
      Subtype: 'Image',
      Width: newDimensions.width,
      Height: newDimensions.height,
      BitsPerComponent: 8,
      ColorSpace: 'DeviceRGB',
      Filter: 'DCTDecode',
    })
    pdf.context.assign(img.ref, newStream)
    return true
  } catch {
    return false
  }
}

// ─── Canvas-Based Image Processing ─────────────────────────────────────────

/**
 * Take raw JPEG bytes, redraw on a Canvas at the target quality,
 * optionally downsampling to maxDimension.
 */
async function recompressJPEGViaCanvas(
  jpegBytes: Uint8Array,
  quality: number,
  maxDimension: number | null,
): Promise<Uint8Array> {
  const img = await loadImageFromBytes(jpegBytes, 'image/jpeg')

  const { width, height } = maxDimension
    ? clampDimensions(img.naturalWidth, img.naturalHeight, maxDimension)
    : { width: img.naturalWidth, height: img.naturalHeight }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to create Canvas 2D context.')

  // White background (JPEG doesn't support transparency)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
  const buf = await blob.arrayBuffer()

  // Clean up the image element's resources
  revokeImageSource(img)

  return new Uint8Array(buf)
}

/**
 * Convert raw FlateDecoded pixel data to a JPEG via Canvas.
 * Handles DeviceRGB (3 bytes/pixel) and DeviceGray (1 byte/pixel) at 8 bpc.
 */
async function flatePixelsToJPEG(
  pixels: Uint8Array,
  img: ImageInfo,
  quality: number,
  maxDimension: number | null,
): Promise<Uint8Array> {
  const clamped = rawPixelsToRGBA(pixels, img.width, img.height, img.colorSpace, img.bitsPerComponent)

  const { width, height } = maxDimension
    ? clampDimensions(img.width, img.height, maxDimension)
    : { width: img.width, height: img.height }

  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to create Canvas 2D context.')

  const imageData = new ImageData(clamped, img.width, img.height)
  ctx.putImageData(imageData, 0, 0)

  // If downsampling is needed, draw scaled
  let finalBlob: Blob
  if (width !== img.width || height !== img.height) {
    const scaledCanvas = document.createElement('canvas')
    scaledCanvas.width = width
    scaledCanvas.height = height
    const scaledCtx = scaledCanvas.getContext('2d')
    if (!scaledCtx) throw new Error('Failed to create Canvas 2D context.')
    scaledCtx.fillStyle = '#ffffff'
    scaledCtx.fillRect(0, 0, width, height)
    scaledCtx.drawImage(canvas, 0, 0, width, height)
    finalBlob = await canvasToBlob(scaledCanvas, 'image/jpeg', quality)
  } else {
    finalBlob = await canvasToBlob(canvas, 'image/jpeg', quality)
  }

  const buf = await finalBlob.arrayBuffer()
  return new Uint8Array(buf)
}

/**
 * Convert raw pixel bytes to an RGBA Uint8ClampedArray.
 * Supported: DeviceRGB (3B/px), DeviceGray (1B/px), both at 8 bpc.
 */
function rawPixelsToRGBA(
  pixels: Uint8Array,
  width: number,
  height: number,
  colorSpace: string,
  bpc: number,
): Uint8ClampedArray {
  const totalPixels = width * height
  const rgba = new Uint8ClampedArray(totalPixels * 4)

  if (bpc !== 8) {
    throw new Error(`Unsupported bits per component: ${bpc}. Only 8 bpc is supported.`)
  }

  if (colorSpace === 'DeviceRGB') {
    const expectedLen = totalPixels * 3
    if (pixels.length < expectedLen) {
      throw new Error(`Expected ${expectedLen} bytes for DeviceRGB, got ${pixels.length}`)
    }
    for (let i = 0, j = 0; i < totalPixels; i++, j += 3) {
      const r = pixels[j]
      const g = pixels[j + 1]
      const b = pixels[j + 2]
      const outIdx = i * 4
      rgba[outIdx] = r
      rgba[outIdx + 1] = g
      rgba[outIdx + 2] = b
      rgba[outIdx + 3] = 255
    }
  } else if (colorSpace === 'DeviceGray') {
    const expectedLen = totalPixels
    if (pixels.length < expectedLen) {
      throw new Error(`Expected ${expectedLen} bytes for DeviceGray, got ${pixels.length}`)
    }
    for (let i = 0; i < totalPixels; i++) {
      const gray = pixels[i]
      const outIdx = i * 4
      rgba[outIdx] = gray
      rgba[outIdx + 1] = gray
      rgba[outIdx + 2] = gray
      rgba[outIdx + 3] = 255
    }
  } else {
    throw new Error(`Unsupported color space: ${colorSpace}. Only DeviceRGB and DeviceGray are supported.`)
  }

  return rgba
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function clampDimensions(
  w: number,
  h: number,
  maxDim: number,
): { width: number; height: number } {
  const longEdge = Math.max(w, h)
  if (longEdge <= maxDim) return { width: w, height: h }

  const scale = maxDim / longEdge
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  }
}

function loadImageFromBytes(bytes: Uint8Array, mimeType: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([bytes], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Failed to load image (${mimeType}).`))
    }

    img.src = url
  })
}

function revokeImageSource(img: HTMLImageElement): void {
  if (img.src && img.src.startsWith('blob:')) {
    URL.revokeObjectURL(img.src)
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Canvas.toBlob returned null. The image may be too large.'))
        }
      },
      format,
      quality,
    )
  })
}
