'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Download, RotateCcw, Film, Crop, Scissors,
} from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { processVideo } from '@/features/video/utils/videoProcessor'
import { getBasicMetadata, preloadFFmpeg } from '@/features/video/utils/videoMetadata'
import { buildCropArgs, nativeToDisplay } from '@/features/video/utils/videoCropper'
import { FORMAT_CONFIG, DEFAULT_CRF, MIN_CRF, MAX_CRF } from '@/features/video/types'
import { MAX_FILE_SIZE_TRIM } from '@/features/video/utils/videoValidation'
import { cn } from '@/lib/utils'
import { getSaveVexFileName } from '@/utils/fileNames'
import { formatBytes } from '@/utils/formatBytes'
import { formatTime, formatDuration } from '@/features/video/utils/videoTimeline'
import type {
  VideoOutputFormat,
  VideoPreset,
  VideoFrameRate,
  VideoMetadata,
  CropResult,
  CropArea,
} from '@/features/video/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_FORMATS = ['mp4', 'webm', 'mov', 'mkv', 'avi']

const OUTPUT_FORMAT_OPTIONS: { value: VideoOutputFormat; label: string }[] = [
  { value: 'mp4', label: 'MP4' },
  { value: 'mov', label: 'MOV' },
  { value: 'avi', label: 'AVI' },
  { value: 'mkv', label: 'MKV' },
]

const PRESET_OPTIONS: { value: VideoPreset; label: string; description: string }[] = [
  { value: 'fast', label: 'Fast', description: 'Faster processing, larger file size' },
  { value: 'medium', label: 'Medium', description: 'Balanced speed and file size' },
  { value: 'slow', label: 'Slow', description: 'Slower processing, smallest file size' },
]

const FRAMERATE_OPTIONS: { value: VideoFrameRate; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: '30', label: '30 fps' },
  { value: '24', label: '24 fps' },
]

const ASPECT_RATIO_PRESETS: { label: string; value: number | null }[] = [
  { label: 'Free', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:2', value: 3 / 2 },
  { label: '21:9', value: 21 / 9 },
]

const TOOL_FAQS = [
  {
    question: 'What video formats are supported for cropping?',
    answer:
      'You can upload MP4, WebM, MOV, AVI, and MKV files. Output formats are MP4, MOV, AVI, and MKV — all using high-quality H.264 encoding for wide compatibility.',
  },
  {
    question: 'Can I crop to a specific aspect ratio?',
    answer:
      'Yes! Use the aspect ratio presets (1:1, 4:3, 16:9, 3:2, 21:9) to lock the crop selection to a specific shape. Switch to "Free" mode for unrestricted cropping. The Center Crop button computes the largest crop window matching your selected ratio, centered on the video.',
  },
  {
    question: 'Does cropping affect video quality?',
    answer:
      'Cropping requires re-encoding the video stream to trim the edges — stream copy is not possible with crop operations. We use high-quality H.264 encoding (CRF 23 by default) to maintain excellent quality. You can adjust the quality level using the CRF slider: lower values for better quality and larger files, higher values for smaller files.',
  },
  {
    question: 'Is my video uploaded to a server?',
    answer:
      'No. All video cropping happens entirely in your browser using advanced video processing technology. Your videos never leave your device — they remain 100% private and secure.',
  },
  {
    question: 'Why are the crop dimensions rounded to even numbers?',
    answer:
      'The H.264 video codec with the widely-compatible YUV 4:2:0 pixel format requires both width and height to be even numbers. Our tool automatically rounds the output dimensions to the nearest even values to ensure compatibility with all media players.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Upload your video',
    desc: 'Click or drag and drop a video file (up to 500 MB). Preview and file info appear instantly.',
  },
  {
    step: 2,
    title: 'Select your crop area',
    desc: 'Click and drag on the video to define a crop rectangle. Use the resize handles to fine-tune, aspect ratio presets to lock a shape, or enter exact dimensions manually. The dimmed area outside the selection will be removed.',
  },
  {
    step: 3,
    title: 'Download your cropped video',
    desc: 'Click Crop Video, wait for the progress bar, then preview and download your cropped clip. The entire process runs locally in your browser.',
  },
]

// ─── Drag mode ────────────────────────────────────────────────────────────────

type DragMode =
  | 'create'
  | 'move'
  | 'resize-nw'
  | 'resize-ne'
  | 'resize-sw'
  | 'resize-se'
  | 'resize-n'
  | 'resize-s'
  | 'resize-e'
  | 'resize-w'

// ─── Analytics ────────────────────────────────────────────────────────────────

function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    ;(window as any).gtag('event', name, props)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CropVideo() {
  // ── Core state ──────────────────────────────────────────────────────────
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)

  // ── Crop area in DISPLAY coordinates (relative to the container element) ──
  const [cropRect, setCropRect] = useState<CropArea | null>(null)

  // ── Drag state (only non-null during active drag/resize) ────────────────
  const [dragMode, setDragMode] = useState<DragMode | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragOrigRectRef = useRef<CropArea | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingMoveRef = useRef<PointerEvent | null>(null)

  // ── Aspect ratio ────────────────────────────────────────────────────────
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)

  // ── Manual inputs (in NATIVE pixels, two-way synced with cropRect) ──────
  const [inputX, setInputX] = useState('')
  const [inputY, setInputY] = useState('')
  const [inputW, setInputW] = useState('')
  const [inputH, setInputH] = useState('')

  // ── Options ─────────────────────────────────────────────────────────────
  const [targetFormat, setTargetFormat] = useState<VideoOutputFormat>('mp4')
  const [preset, setPreset] = useState<VideoPreset>('medium')
  const [crf, setCrf] = useState(DEFAULT_CRF)
  const [frameRate, setFrameRate] = useState<VideoFrameRate>('original')

  // ── Processing state ────────────────────────────────────────────────────
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [estimatedRemaining, setEstimatedRemaining] = useState(0)
  const [result, setResult] = useState<CropResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCancelled, setIsCancelled] = useState(false)

  // ── Refs ────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const metadataRef = useRef<VideoMetadata | null>(null)

  // ── Derived ─────────────────────────────────────────────────────────────
  const metadataAvailable = videoMetadata !== null
  const duration = videoMetadata?.duration ?? 0

  // ── Sync metadata ref ───────────────────────────────────────────────────
  useEffect(() => {
    metadataRef.current = videoMetadata
  }, [videoMetadata])

  // ── Build/refresh preview URL ───────────────────────────────────────────
  useEffect(() => {
    if (originalFile) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      previewUrlRef.current = URL.createObjectURL(originalFile)
    }
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [originalFile])

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  // ── Initialize full-frame crop when the video element is ready ──────────
  const initializeFullFrame = useCallback(() => {
    const container = containerRef.current
    const metadata = metadataRef.current
    if (!container || !metadata || metadata.width <= 0 || metadata.height <= 0) return

    const fullRect: CropArea = {
      x: 0,
      y: 0,
      width: container.clientWidth,
      height: container.clientHeight,
    }
    setCropRect(fullRect)
    setInputX('0')
    setInputY('0')
    setInputW(String(metadata.width))
    setInputH(String(metadata.height))
  }, [])

  // ── Sync inputs from crop rect ──────────────────────────────────────────
  const syncInputsFromCrop = useCallback((rect: CropArea) => {
    const container = containerRef.current
    const metadata = metadataRef.current
    if (!container || !metadata || metadata.width <= 0 || metadata.height <= 0) return

    const scaleX = metadata.width / container.clientWidth
    const scaleY = metadata.height / container.clientHeight

    setInputX(String(Math.round(rect.x * scaleX)))
    setInputY(String(Math.round(rect.y * scaleY)))
    setInputW(String(Math.round(rect.width * scaleX)))
    setInputH(String(Math.round(rect.height * scaleY)))
  }, [])

  // ── Pointer event handlers for crop overlay ─────────────────────────────

  /** Get the pointer position relative to the container element. */
  const getContainerCoords = useCallback((e: PointerEvent): { x: number; y: number } => {
    const container = containerRef.current
    if (!container) return { x: 0, y: 0 }
    const rect = container.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  /** Apply aspect ratio constraint to a crop rectangle. */
  const constrainAspect = useCallback(
    (rect: CropArea, ratio: number, mode: DragMode): CropArea => {
      let { x, y, width, height } = rect

      // Determine anchor corner based on drag mode
      const anchorRight = mode === 'resize-nw' || mode === 'resize-w' || mode === 'resize-n'
      const anchorBottom = mode === 'resize-nw' || mode === 'resize-n' || mode === 'resize-ne'

      // Which dimension drives?
      const currentAspect = width / (height || 1)
      if (currentAspect >= ratio) {
        // Current rect is wider than target — height drives, adjust width
        width = height * ratio
      } else {
        // Current rect is taller than target — width drives, adjust height
        height = width / ratio
      }

      // Re-anchor
      if (anchorRight) {
        x = rect.x + rect.width - width
      }
      if (anchorBottom) {
        y = rect.y + rect.height - height
      }

      return { x, y, width, height }
    },
    [],
  )

  /** Clamp a crop rectangle to stay within the container bounds with minimum size. */
  const clampToContainer = useCallback(
    (rect: CropArea): CropArea => {
      const container = containerRef.current
      if (!container) return rect

      const minDisplay = 8 // minimum display pixels
      const maxW = container.clientWidth
      const maxH = container.clientHeight

      let { x, y, width, height } = rect

      width = clamp(width, minDisplay, maxW)
      height = clamp(height, minDisplay, maxH)
      x = clamp(x, 0, maxW - width)
      y = clamp(y, 0, maxH - height)

      return { x, y, width, height }
    },
    [],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: DragMode) => {
      e.preventDefault()
      e.stopPropagation()

      const coords = getContainerCoords(e.nativeEvent)
      dragStartRef.current = coords
      dragOrigRectRef.current = cropRect ? { ...cropRect } : null
      setDragMode(mode)

      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)
    },
    [cropRect, getContainerCoords],
  )

  /** Handle pointer-down on the video background (start a new crop). */
  const handleVideoPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only create new crop on primary button, directly on the video background
      if (e.button !== 0) return
      handlePointerDown(e, 'create')
    },
    [handlePointerDown],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragMode || !dragStartRef.current) return

      // Throttle to rAF
      pendingMoveRef.current = e.nativeEvent
      if (rafRef.current !== null) return

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const evt = pendingMoveRef.current
        if (!evt || !dragMode || !dragStartRef.current) return

        const coords = getContainerCoords(evt)
        const dx = coords.x - dragStartRef.current.x
        const dy = coords.y - dragStartRef.current.y
        const origRect = dragOrigRectRef.current
        const activeRatio = aspectRatio

        let newRect: CropArea

        if (dragMode === 'create') {
          newRect = {
            x: Math.min(dragStartRef.current.x, coords.x),
            y: Math.min(dragStartRef.current.y, coords.y),
            width: Math.abs(dx),
            height: Math.abs(dy),
          }
          if (activeRatio !== null) {
            newRect = constrainAspect(newRect, activeRatio, 'create')
          }
        } else if (dragMode === 'move') {
          if (!origRect) return
          newRect = {
            x: origRect.x + dx,
            y: origRect.y + dy,
            width: origRect.width,
            height: origRect.height,
          }
          // Aspect already correct for move — no constraint needed
        } else {
          // Resize handles
          if (!origRect) return
          newRect = { ...origRect }

          switch (dragMode) {
            case 'resize-se':
              newRect.width = origRect.width + dx
              newRect.height = origRect.height + dy
              break
            case 'resize-nw':
              newRect.x = origRect.x + dx
              newRect.y = origRect.y + dy
              newRect.width = origRect.width + (origRect.x - newRect.x)
              newRect.height = origRect.height + (origRect.y - newRect.y)
              break
            case 'resize-ne':
              newRect.y = origRect.y + dy
              newRect.width = origRect.width + dx
              newRect.height = origRect.height + (origRect.y - newRect.y)
              break
            case 'resize-sw':
              newRect.x = origRect.x + dx
              newRect.width = origRect.width + (origRect.x - newRect.x)
              newRect.height = origRect.height + dy
              break
            case 'resize-n':
              newRect.y = origRect.y + dy
              newRect.height = origRect.height + (origRect.y - newRect.y)
              break
            case 'resize-s':
              newRect.height = origRect.height + dy
              break
            case 'resize-e':
              newRect.width = origRect.width + dx
              break
            case 'resize-w':
              newRect.x = origRect.x + dx
              newRect.width = origRect.width + (origRect.x - newRect.x)
              break
          }

          if (activeRatio !== null) {
            newRect = constrainAspect(newRect, activeRatio, dragMode)
          }
        }

        newRect = clampToContainer(newRect)
        setCropRect(newRect)
        syncInputsFromCrop(newRect)
      })
    },
    [dragMode, aspectRatio, getContainerCoords, clampToContainer, constrainAspect, syncInputsFromCrop],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragMode) return

      const target = e.currentTarget as HTMLElement
      try {
        target.releasePointerCapture(e.pointerId)
      } catch {
        // Capture may already be released
      }

      setDragMode(null)
      dragStartRef.current = null
      dragOrigRectRef.current = null
      pendingMoveRef.current = null
    },
    [dragMode],
  )

  // ── File selection ──────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: File) => {
    // Clean up previous state
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    abortControllerRef.current?.abort()

    // Reset
    setOriginalFile(null)
    setVideoMetadata(null)
    setCropRect(null)
    setResult(null)
    setError(null)
    setIsCancelled(false)
    setProgress(0)
    setInputX('')
    setInputY('')
    setInputW('')
    setInputH('')

    // Validate size immediately
    if (file.size > MAX_FILE_SIZE_TRIM) {
      setError(
        'File too large for browser-based processing — try a shorter clip or lower resolution source. Maximum file size is 500 MB.'
      )
      return
    }

    setOriginalFile(file)

    // Phase 1: Immediate metadata (no ffmpeg needed)
    const metadata = await getBasicMetadata(file)
    setVideoMetadata(metadata)
    metadataRef.current = metadata

    // Initialize full-frame crop after a tick (container needs to render)
    if (metadata && metadata.width > 0 && metadata.height > 0) {
      // Use requestAnimationFrame to wait for the container to be laid out
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const container = containerRef.current
          if (!container) return
          const fullRect: CropArea = {
            x: 0,
            y: 0,
            width: container.clientWidth,
            height: container.clientHeight,
          }
          setCropRect(fullRect)
          setInputX('0')
          setInputY('0')
          setInputW(String(metadata.width))
          setInputH(String(metadata.height))
        })
      })
    }

    trackEvent('video_uploaded', {
      format: file.name.split('.').pop()?.toLowerCase(),
      size_mb: Math.round(file.size / (1024 * 1024)),
    })

    // Phase 2: Preload ffmpeg in background
    preloadFFmpeg()
  }, [])

  // ── Aspect ratio preset ─────────────────────────────────────────────────

  const handleAspectRatioChange = useCallback(
    (ratio: number | null) => {
      setAspectRatio(ratio)
      // If switching to a ratio, constrain the current crop rect
      if (ratio !== null && cropRect) {
        const constrained = constrainAspect(cropRect, ratio, 'create')
        setCropRect(clampToContainer(constrained))
        syncInputsFromCrop(clampToContainer(constrained))
      }
    },
    [cropRect, constrainAspect, clampToContainer, syncInputsFromCrop],
  )

  // ── Center Crop ─────────────────────────────────────────────────────────

  const handleCenterCrop = useCallback(() => {
    const container = containerRef.current
    const metadata = metadataRef.current
    if (!container || !metadata || metadata.width <= 0 || metadata.height <= 0) return

    const nativeW = metadata.width
    const nativeH = metadata.height
    const ratio = aspectRatio ?? nativeW / nativeH
    const nativeAspect = nativeW / nativeH

    let cropNativeW: number, cropNativeH: number
    if (ratio >= nativeAspect) {
      // Crop is wider than source — fit to height, crop sides
      cropNativeH = nativeH
      cropNativeW = nativeH * ratio
    } else {
      // Crop is taller than source — fit to width, crop top/bottom
      cropNativeW = nativeW
      cropNativeH = nativeW / ratio
    }

    // Ensure even dimensions
    cropNativeW = Math.round(cropNativeW / 2) * 2
    cropNativeH = Math.round(cropNativeH / 2) * 2

    const cropNativeX = Math.round((nativeW - cropNativeW) / 2)
    const cropNativeY = Math.round((nativeH - cropNativeH) / 2)

    // Convert to display coordinates
    const displayX = nativeToDisplay(cropNativeX, nativeW, container.clientWidth)
    const displayY = nativeToDisplay(cropNativeY, nativeH, container.clientHeight)
    const displayW = nativeToDisplay(cropNativeW, nativeW, container.clientWidth)
    const displayH = nativeToDisplay(cropNativeH, nativeH, container.clientHeight)

    const newRect: CropArea = {
      x: Math.round(displayX),
      y: Math.round(displayY),
      width: Math.round(displayW),
      height: Math.round(displayH),
    }

    setCropRect(newRect)
    syncInputsFromCrop(newRect)
  }, [aspectRatio, syncInputsFromCrop])

  // ── Reset crop to full frame ────────────────────────────────────────────

  const handleResetCrop = useCallback(() => {
    initializeFullFrame()
  }, [initializeFullFrame])

  // ── Manual input handlers ───────────────────────────────────────────────

  const handleInputCommit = useCallback(
    (field: 'x' | 'y' | 'w' | 'h', value: string) => {
      const container = containerRef.current
      const metadata = metadataRef.current
      if (!container || !metadata || metadata.width <= 0 || metadata.height <= 0) return

      const parsed = parseInt(value, 10)
      if (isNaN(parsed) || parsed < 0) {
        // Reset to current value
        syncInputsFromCrop(cropRect!)
        return
      }

      const nativeW = metadata.width
      const nativeH = metadata.height

      // Convert native value to display
      let displayVal: number
      if (field === 'x' || field === 'w') {
        displayVal = Math.round((parsed / nativeW) * container.clientWidth)
      } else {
        displayVal = Math.round((parsed / nativeH) * container.clientHeight)
      }

      // Update the appropriate field
      const newRect = cropRect ? { ...cropRect } : { x: 0, y: 0, width: container.clientWidth, height: container.clientHeight }

      switch (field) {
        case 'x':
          newRect.x = clamp(displayVal, 0, container.clientWidth - newRect.width)
          break
        case 'y':
          newRect.y = clamp(displayVal, 0, container.clientHeight - newRect.height)
          break
        case 'w': {
          const maxW = container.clientWidth - newRect.x
          newRect.width = clamp(displayVal, 8, maxW)
          if (aspectRatio !== null) {
            newRect.height = newRect.width / aspectRatio
          }
          break
        }
        case 'h': {
          const maxH = container.clientHeight - newRect.y
          newRect.height = clamp(displayVal, 8, maxH)
          if (aspectRatio !== null) {
            newRect.width = newRect.height * aspectRatio
          }
          break
        }
      }

      setCropRect(newRect)
      syncInputsFromCrop(newRect)
    },
    [cropRect, aspectRatio, syncInputsFromCrop],
  )

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent, field: 'x' | 'y' | 'w' | 'h', value: string) => {
    if (e.key === 'Enter') {
      handleInputCommit(field, value)
    }
  }, [handleInputCommit])

  // ── Crop processing ─────────────────────────────────────────────────────

  const handleCrop = useCallback(async () => {
    if (!originalFile || !videoMetadata || !containerRef.current || !cropRect) return

    setError(null)
    setIsCancelled(false)
    setIsProcessing(true)
    setProgress(0)
    setElapsedSeconds(0)
    setEstimatedRemaining(0)
    setResult(null)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    trackEvent('crop_started', {
      format: targetFormat,
    })

    try {
      const config = FORMAT_CONFIG[targetFormat]
      const container = containerRef.current

      const buildArgs = (inputName: string, outputName: string) =>
        buildCropArgs(inputName, outputName, {
          displayCrop: cropRect,
          nativeWidth: videoMetadata.width,
          nativeHeight: videoMetadata.height,
          containerWidth: container.clientWidth,
          containerHeight: container.clientHeight,
          targetFormat,
          encoderOptions: {
            preset,
            crf,
            resolution: 'original', // Crop doesn't independently resize
            frameRate,
            audioCodec: config.audioCodec,
            audioBitrate: config.audioBitrate,
          },
        })

      const processResult = await processVideo({
        file: originalFile,
        buildArgs,
        outputExt: config.ext,
        outputMime: config.mime,
        maxSize: MAX_FILE_SIZE_TRIM,
        acceptedFormats: ACCEPTED_FORMATS,
        onProgress: (pct, elapsed, remaining) => {
          setProgress(pct)
          setElapsedSeconds(elapsed)
          setEstimatedRemaining(remaining)
        },
        signal: abortController.signal,
      })

      // Compute output dimensions (always even)
      const scaleX = videoMetadata.width / container.clientWidth
      const scaleY = videoMetadata.height / container.clientHeight
      const outW = Math.round(cropRect.width * scaleX / 2) * 2
      const outH = Math.round(cropRect.height * scaleY / 2) * 2

      const cropResult: CropResult = {
        blob: processResult.blob,
        mimeType: processResult.mimeType,
        targetFormat,
        originalSize: originalFile.size,
        croppedSize: processResult.blob.size,
        cropRegion: {
          x: Math.round(cropRect.x * scaleX),
          y: Math.round(cropRect.y * scaleY),
          width: outW,
          height: outH,
        },
        outputWidth: outW,
        outputHeight: outH,
        metadata: videoMetadata,
      }

      setResult(cropResult)

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      previewUrlRef.current = URL.createObjectURL(processResult.blob)

      trackEvent('crop_completed', {
        format: targetFormat,
        original_mb: Math.round(originalFile.size / (1024 * 1024)),
        cropped_mb: Math.round(processResult.blob.size / (1024 * 1024)),
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setIsCancelled(true)
        trackEvent('crop_cancelled', { format: targetFormat })
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Cropping failed. Please try again with a different video file.'
        )
        trackEvent('crop_failed', { error: err instanceof Error ? err.message : 'unknown' })
      }
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }, [originalFile, videoMetadata, cropRect, targetFormat, preset, crf, frameRate])

  // ── Cancel ──────────────────────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  // ── Download ────────────────────────────────────────────────────────────

  const handleDownload = useCallback(() => {
    if (!result || !originalFile) return

    const baseName = originalFile.name.replace(/\.[^.]+$/, '')
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(`${baseName}.${result.targetFormat}`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)

    trackEvent('download_clicked', { format: result.targetFormat })
  }, [result, originalFile])

  // ── Reset ───────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    abortControllerRef.current?.abort()
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setOriginalFile(null)
    setVideoMetadata(null)
    setCropRect(null)
    setAspectRatio(null)
    setInputX('')
    setInputY('')
    setInputW('')
    setInputH('')
    setTargetFormat('mp4')
    setPreset('medium')
    setCrf(DEFAULT_CRF)
    setFrameRate('original')
    setResult(null)
    setError(null)
    setIsCancelled(false)
    setIsProcessing(false)
    setProgress(0)
  }, [])

  const handleRetryUpload = useCallback(() => {
    setError(null)
  }, [])

  // ── Computed native dimensions for the label ────────────────────────────

  const nativeLabel = (() => {
    if (!cropRect || !videoMetadata || !containerRef.current) return null
    const scaleX = videoMetadata.width / containerRef.current.clientWidth
    const scaleY = videoMetadata.height / containerRef.current.clientHeight
    return {
      w: Math.round(cropRect.width * scaleX / 2) * 2,
      h: Math.round(cropRect.height * scaleY / 2) * 2,
    }
  })()

  // ── Cursor for the overlay ──────────────────────────────────────────────

  const overlayCursor = dragMode
    ? dragMode === 'move'
      ? 'grabbing'
      : dragMode === 'create'
        ? 'crosshair'
        : undefined
    : cropRect
      ? 'grab'
      : 'crosshair'

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ── Error: file size rejection ──────────────────────────────── */}
        {error && !originalFile && (
          <ErrorCard
            title="File Too Large"
            message={error}
            onRetry={handleRetryUpload}
          />
        )}

        {/* ── Error: processing failure ──────────────────────────────── */}
        {error && originalFile && (
          <ErrorCard
            title="Crop Failed"
            message={error}
            onRetry={handleCrop}
          />
        )}

        {/* ── Cancelled ──────────────────────────────────────────────── */}
        {isCancelled && !error && !result && (
          <div className="border border-border rounded-xl p-8 text-center bg-card">
            <Scissors className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Crop Cancelled</h3>
            <p className="text-muted-foreground mb-4">
              Processing was cancelled. Temporary files have been cleaned up.
            </p>
            <Button variant="outline" onClick={() => setIsCancelled(false)}>
              Try Again
            </Button>
          </div>
        )}

        {/* ── IDLE: upload dropzone ──────────────────────────────────── */}
        {!originalFile && !error && !isCancelled && (
          <UploadDropzone
            acceptedFormats={ACCEPTED_FORMATS}
            onFileSelect={handleFileSelect}
          />
        )}

        {/* ── FILE LOADED / PROCESSING / COMPLETE ──────────────────────── */}
        {originalFile && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ── Left Column ────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">
              {/* File info bar */}
              <div className="flex items-center gap-4 p-4 border border-border rounded-xl bg-card">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <Film className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{originalFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(originalFile.size)}
                    {metadataAvailable && duration > 0 && (
                      <> · {formatDuration(duration)}</>
                    )}
                    {metadataAvailable && videoMetadata!.width > 0 && (
                      <> · {videoMetadata!.width}×{videoMetadata!.height}</>
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Change File
                </Button>
              </div>

              {/* ── Video Preview + Interactive Crop Overlay ──────────── */}
              {!isProcessing && !result && (
                <div
                  ref={containerRef}
                  className="rounded-xl overflow-hidden bg-black relative select-none"
                  style={{ position: 'relative', cursor: overlayCursor }}
                  onPointerDown={handleVideoPointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  <video
                    ref={videoRef}
                    src={previewUrlRef.current ?? undefined}
                    className="w-full block"
                    preload="auto"
                    controls={false}
                    draggable={false}
                    style={{ pointerEvents: 'none' }}
                  >
                    Your browser does not support the video tag.
                  </video>

                  {/* Crop overlay */}
                  {cropRect && (
                    <>
                      {/* Dimmed overlay using box-shadow */}
                      <div
                        style={{
                          position: 'absolute',
                          left: cropRect.x,
                          top: cropRect.y,
                          width: cropRect.width,
                          height: cropRect.height,
                          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                          border: '2px solid rgba(255, 255, 255, 0.9)',
                          borderRadius: '2px',
                          pointerEvents: 'none',
                        }}
                      >
                        {/* Inner grid lines for visual reference */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage:
                              'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
                            backgroundSize: '33.33% 33.33%',
                          }}
                        />

                        {/* Native dimension label */}
                        {nativeLabel && (
                          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/75 text-white text-xs rounded font-mono">
                            {nativeLabel.w} × {nativeLabel.h}
                          </div>
                        )}

                        {/* Move handle (entire crop area interior) */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: '12px',
                            cursor: dragMode === 'move' ? 'grabbing' : 'grab',
                            pointerEvents: 'auto',
                          }}
                          onPointerDown={(e) => handlePointerDown(e, 'move')}
                        />
                      </div>

                      {/* ── Resize handles ──────────────────────────── */}

                      {/* NW corner */}
                      <div
                        style={{
                          position: 'absolute',
                          left: cropRect.x - 5,
                          top: cropRect.y - 5,
                          width: 12,
                          height: 12,
                          cursor: 'nwse-resize',
                          backgroundColor: 'white',
                          border: '2px solid rgba(0,0,0,0.5)',
                          borderRadius: '2px',
                          pointerEvents: 'auto',
                        }}
                        onPointerDown={(e) => handlePointerDown(e, 'resize-nw')}
                      />

                      {/* NE corner */}
                      <div
                        style={{
                          position: 'absolute',
                          left: cropRect.x + cropRect.width - 7,
                          top: cropRect.y - 5,
                          width: 12,
                          height: 12,
                          cursor: 'nesw-resize',
                          backgroundColor: 'white',
                          border: '2px solid rgba(0,0,0,0.5)',
                          borderRadius: '2px',
                          pointerEvents: 'auto',
                        }}
                        onPointerDown={(e) => handlePointerDown(e, 'resize-ne')}
                      />

                      {/* SW corner */}
                      <div
                        style={{
                          position: 'absolute',
                          left: cropRect.x - 5,
                          top: cropRect.y + cropRect.height - 7,
                          width: 12,
                          height: 12,
                          cursor: 'nesw-resize',
                          backgroundColor: 'white',
                          border: '2px solid rgba(0,0,0,0.5)',
                          borderRadius: '2px',
                          pointerEvents: 'auto',
                        }}
                        onPointerDown={(e) => handlePointerDown(e, 'resize-sw')}
                      />

                      {/* SE corner */}
                      <div
                        style={{
                          position: 'absolute',
                          left: cropRect.x + cropRect.width - 7,
                          top: cropRect.y + cropRect.height - 7,
                          width: 12,
                          height: 12,
                          cursor: 'nwse-resize',
                          backgroundColor: 'white',
                          border: '2px solid rgba(0,0,0,0.5)',
                          borderRadius: '2px',
                          pointerEvents: 'auto',
                        }}
                        onPointerDown={(e) => handlePointerDown(e, 'resize-se')}
                      />

                      {/* N edge */}
                      <div
                        style={{
                          position: 'absolute',
                          left: cropRect.x + 12,
                          top: cropRect.y - 3,
                          width: cropRect.width - 24,
                          height: 8,
                          cursor: 'n-resize',
                          pointerEvents: 'auto',
                        }}
                        onPointerDown={(e) => handlePointerDown(e, 'resize-n')}
                      />

                      {/* S edge */}
                      <div
                        style={{
                          position: 'absolute',
                          left: cropRect.x + 12,
                          top: cropRect.y + cropRect.height - 5,
                          width: cropRect.width - 24,
                          height: 8,
                          cursor: 's-resize',
                          pointerEvents: 'auto',
                        }}
                        onPointerDown={(e) => handlePointerDown(e, 'resize-s')}
                      />

                      {/* E edge */}
                      <div
                        style={{
                          position: 'absolute',
                          left: cropRect.x + cropRect.width - 3,
                          top: cropRect.y + 12,
                          width: 8,
                          height: cropRect.height - 24,
                          cursor: 'e-resize',
                          pointerEvents: 'auto',
                        }}
                        onPointerDown={(e) => handlePointerDown(e, 'resize-e')}
                      />

                      {/* W edge */}
                      <div
                        style={{
                          position: 'absolute',
                          left: cropRect.x - 5,
                          top: cropRect.y + 12,
                          width: 8,
                          height: cropRect.height - 24,
                          cursor: 'w-resize',
                          pointerEvents: 'auto',
                        }}
                        onPointerDown={(e) => handlePointerDown(e, 'resize-w')}
                      />
                    </>
                  )}
                </div>
              )}

              {/* ── Crop controls ──────────────────────────────────────── */}
              {!isProcessing && !result && originalFile && (
                <div className="border border-border rounded-xl p-6 bg-card space-y-4">
                  <h3 className="font-semibold text-lg">Crop Selection</h3>

                  {/* Aspect ratio presets */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Aspect Ratio
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ASPECT_RATIO_PRESETS.map((preset) => {
                        const isActive = aspectRatio === preset.value
                        return (
                          <button
                            key={preset.label}
                            onClick={() => handleAspectRatioChange(preset.value)}
                            className={cn(
                              'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                              isActive
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border bg-card hover:bg-muted/50 text-foreground',
                            )}
                          >
                            {preset.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Manual dimension inputs */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Position & Size (pixels)
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">X</label>
                        <input
                          type="text"
                          value={inputX}
                          onChange={(e) => setInputX(e.target.value)}
                          onBlur={() => handleInputCommit('x', inputX)}
                          onKeyDown={(e) => handleInputKeyDown(e, 'x', inputX)}
                          className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm text-center font-mono"
                          disabled={isProcessing}
                          aria-label="Crop X position"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Y</label>
                        <input
                          type="text"
                          value={inputY}
                          onChange={(e) => setInputY(e.target.value)}
                          onBlur={() => handleInputCommit('y', inputY)}
                          onKeyDown={(e) => handleInputKeyDown(e, 'y', inputY)}
                          className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm text-center font-mono"
                          disabled={isProcessing}
                          aria-label="Crop Y position"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Width</label>
                        <input
                          type="text"
                          value={inputW}
                          onChange={(e) => setInputW(e.target.value)}
                          onBlur={() => handleInputCommit('w', inputW)}
                          onKeyDown={(e) => handleInputKeyDown(e, 'w', inputW)}
                          className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm text-center font-mono"
                          disabled={isProcessing}
                          aria-label="Crop width"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Height</label>
                        <input
                          type="text"
                          value={inputH}
                          onChange={(e) => setInputH(e.target.value)}
                          onBlur={() => handleInputCommit('h', inputH)}
                          onKeyDown={(e) => handleInputKeyDown(e, 'h', inputH)}
                          className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm text-center font-mono"
                          disabled={isProcessing}
                          aria-label="Crop height"
                        />
                      </div>
                    </div>
                    {nativeLabel && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Output: {nativeLabel.w} × {nativeLabel.h} pixels
                      </p>
                    )}
                  </div>

                  {/* Reset / Center Crop buttons */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleResetCrop}>
                      Reset to Full Frame
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCenterCrop}>
                      <Crop className="w-4 h-4 mr-1" />
                      Center Crop
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Progress ──────────────────────────────────────────── */}
              {isProcessing && (
                <div className="space-y-4">
                  <ProcessingStatus message="Cropping video..." />
                  <ProgressBar
                    percent={progress}
                    label="Crop Progress"
                    detail={
                      progress < 5
                        ? 'Initializing...'
                        : progress < 95
                          ? 'Processing video...'
                          : 'Finalizing output...'
                    }
                  />
                  {elapsedSeconds > 0 && (
                    <div className="text-sm text-muted-foreground text-center">
                      Elapsed: {formatTime(elapsedSeconds)}
                      {estimatedRemaining > 0 && <> · Remaining: ~{formatTime(estimatedRemaining)}</>}
                    </div>
                  )}
                  <div className="flex justify-center">
                    <Button variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Result ────────────────────────────────────────────── */}
              {result && (
                <div className="space-y-6">
                  <div className="border border-border rounded-xl p-6 bg-card">
                    <h3 className="font-semibold text-lg mb-4">Crop Complete</h3>

                    {/* Video preview player */}
                    {previewUrlRef.current && (
                      <div className="mb-6 rounded-lg overflow-hidden bg-black">
                        <video
                          src={previewUrlRef.current}
                          controls
                          className="w-full max-h-96"
                          preload="auto"
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    )}

                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-center">
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Format</div>
                        <div className="font-semibold text-sm uppercase">{result.targetFormat}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Resolution</div>
                        <div className="font-semibold text-sm">
                          {result.outputWidth}×{result.outputHeight}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Preset</div>
                        <div className="font-semibold text-sm capitalize">{preset}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Method</div>
                        <div className="font-semibold text-sm">Re-encode</div>
                      </div>
                    </div>

                    {/* File size comparison */}
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">File Sizes</h4>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="p-4 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Original</div>
                        <div className="text-2xl font-bold">{formatBytes(result.originalSize)}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Cropped</div>
                        <div className="text-2xl font-bold">{formatBytes(result.croppedSize)}</div>
                        {result.originalSize > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {result.croppedSize < result.originalSize
                              ? `${Math.round(((result.originalSize - result.croppedSize) / result.originalSize) * 100)}% smaller`
                              : result.croppedSize > result.originalSize
                                ? `${Math.round(((result.croppedSize - result.originalSize) / result.originalSize) * 100)}% larger`
                                : 'Same size'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Download / Reset buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      size="lg"
                      className="bg-primary hover:bg-primary/90 flex-1"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download {result.targetFormat.toUpperCase()}
                    </Button>
                    <Button size="lg" variant="outline" onClick={handleReset}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Crop Another
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right Column: Options Panel ─────────────────────────── */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                {/* FILE_LOADED: options */}
                {originalFile && !isProcessing && !result && (
                  <div className="border border-border rounded-xl p-6 bg-muted/30 space-y-6">
                    <h3 className="font-semibold text-lg">Output Settings</h3>

                    {/* Output Format */}
                    <div>
                      <label className="text-sm font-medium flex justify-between">
                        <span>Output Format</span>
                        <span className="text-primary font-semibold uppercase">{targetFormat}</span>
                      </label>
                      <select
                        value={targetFormat}
                        onChange={(e) => setTargetFormat(e.target.value as VideoOutputFormat)}
                        className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      >
                        {OUTPUT_FORMAT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Preset */}
                    <div>
                      <label className="text-sm font-medium flex justify-between">
                        <span>Preset</span>
                        <span className="text-primary font-semibold capitalize">{preset}</span>
                      </label>
                      <select
                        value={preset}
                        onChange={(e) => setPreset(e.target.value as VideoPreset)}
                        className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      >
                        {PRESET_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {PRESET_OPTIONS.find((o) => o.value === preset)?.description}
                      </p>
                    </div>

                    {/* CRF */}
                    <div>
                      <label className="text-sm font-medium flex justify-between">
                        <span>Quality (CRF)</span>
                        <span className="text-primary font-semibold">{crf}</span>
                      </label>
                      <input
                        type="range"
                        min={MIN_CRF}
                        max={MAX_CRF}
                        step={1}
                        value={crf}
                        onChange={(e) => setCrf(Number(e.target.value))}
                        className="w-full mt-2 accent-primary"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Better quality</span>
                        <span>Smaller file</span>
                      </div>
                    </div>

                    {/* Frame Rate */}
                    <div>
                      <label className="text-sm font-medium flex justify-between">
                        <span>Frame Rate</span>
                        <span className="text-primary font-semibold">
                          {frameRate === 'original' ? 'Original' : `${frameRate} fps`}
                        </span>
                      </label>
                      <select
                        value={frameRate}
                        onChange={(e) => setFrameRate(e.target.value as VideoFrameRate)}
                        className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      >
                        {FRAMERATE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Re-encode notice */}
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        Cropping always re-encodes the video stream (required by the crop operation).
                        Audio is passed through without re-encoding.
                      </p>
                    </div>

                    {/* Crop button */}
                    <Button
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={!originalFile || !cropRect}
                      onClick={handleCrop}
                    >
                      <Crop className="w-4 h-4 mr-2" />
                      Crop Video
                    </Button>
                  </div>
                )}

                {/* PROCESSING */}
                {isProcessing && (
                  <div className="border border-border rounded-xl p-6 bg-muted/30">
                    <h3 className="font-semibold text-lg mb-6">Output Settings</h3>
                    <div className="space-y-3 opacity-50 pointer-events-none">
                      <div>
                        <label className="text-sm font-medium">Output Format</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm uppercase">
                          {targetFormat}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Preset</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm capitalize">
                          {preset}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Method</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                          Re-encode (required for crop)
                        </div>
                      </div>
                    </div>
                    <Button className="w-full mt-4" disabled>
                      Processing...
                    </Button>
                  </div>
                )}

                {/* COMPLETE */}
                {result && (
                  <div className="border border-border rounded-xl p-6 bg-muted/30">
                    <h3 className="font-semibold text-lg mb-6">Done!</h3>
                    <div className="space-y-3">
                      <Button
                        className="w-full bg-primary hover:bg-primary/90"
                        onClick={handleDownload}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download {result.targetFormat.toUpperCase()}
                      </Button>
                      <Button className="w-full" variant="outline" onClick={handleReset}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Crop Another Video
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── How To ────────────────────────────────────────────────────── */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6">How to Crop a Video</h2>
          <ol className="space-y-4">
            {HOW_TO_STEPS.map((item) => (
              <li key={item.step} className="flex gap-4">
                <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                  {item.step}
                </span>
                <div>
                  <h4 className="font-semibold">{item.title}</h4>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <div className="mt-12">
          <FAQSection
            faqs={TOOL_FAQS}
            title="Frequently Asked Questions"
            description=""
          />
        </div>
      </div>
    </section>
  )
}
