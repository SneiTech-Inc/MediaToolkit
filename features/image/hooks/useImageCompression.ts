'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ImageCompressionOptions, ImageCompressionResult, OutputFormat } from '@/features/image/types'
import { processImage, getDefaultFormat, isFormatSupported, revokePreviewUrl } from '@/features/image/utils/imageProcessing'

interface UseImageCompressionReturn {
  /** Trigger compression. Accepts a File and optional overrides. */
  compress: (file: File, overrides?: Partial<ImageCompressionOptions>) => Promise<void>
  /** The compression result, or null if not yet compressed. */
  result: ImageCompressionResult | null
  /** Whether compression is currently running. */
  isProcessing: boolean
  /** Error message if compression failed, or null. */
  error: string | null
  /** Current progress percentage (0–100). */
  progress: number
  /** Reset state back to idle. Cleans up object URLs. */
  reset: () => void
}

const DEFAULT_OPTIONS: ImageCompressionOptions = {
  quality: 0.8,
  format: 'image/jpeg',
}

const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/bmp']

/**
 * Custom hook encapsulating the full image compression flow.
 * Manages object URL lifecycle, progress reporting, and error handling.
 *
 * Structured so the pure processing functions (imageProcessing.ts) can be
 * unit-tested independently with mock image data.
 */
export function useImageCompression(): UseImageCompressionReturn {
  const [result, setResult] = useState<ImageCompressionResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  // Track object URLs for cleanup
  const previewUrlRef = useRef<string | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        revokePreviewUrl(previewUrlRef.current)
      }
    }
  }, [])

  const compress = useCallback(async (file: File, overrides?: Partial<ImageCompressionOptions>) => {
    // Validate file type
    if (!VALID_IMAGE_TYPES.includes(file.type) && !file.name.match(/\.(svg|bmp)$/i)) {
      setError(`Unsupported file type: ${file.type || 'unknown'}. Please upload a JPEG, PNG, WebP, GIF, SVG, or BMP image.`)
      return
    }

    // Reset previous state
    setError(null)
    setProgress(0)
    setIsProcessing(true)

    // Clean up previous preview URL
    if (previewUrlRef.current) {
      revokePreviewUrl(previewUrlRef.current)
      previewUrlRef.current = null
    }

    // Detect format
    const detectedFormat = overrides?.format || getDefaultFormat(file)

    // Check format support
    if (!isFormatSupported(detectedFormat)) {
      setError(`Your browser does not support ${detectedFormat} encoding. Try JPEG or PNG instead.`)
      setIsProcessing(false)
      return
    }

    const options: ImageCompressionOptions = {
      ...DEFAULT_OPTIONS,
      format: detectedFormat,
      ...overrides,
    }

    try {
      const compressionResult = await processImage(file, options, setProgress)

      // Store preview URL for cleanup
      previewUrlRef.current = compressionResult.previewUrl

      setResult(compressionResult)
      setProgress(100)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during compression.'
      setError(message)
      setResult(null)
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const reset = useCallback(() => {
    if (previewUrlRef.current) {
      revokePreviewUrl(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setResult(null)
    setError(null)
    setProgress(0)
    setIsProcessing(false)
  }, [])

  return { compress, result, isProcessing, error, progress, reset }
}
