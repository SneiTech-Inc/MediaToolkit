'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Download, RotateCcw, Film, Maximize2, Lock, Unlock,
} from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { processVideo } from '@/features/video/utils/videoProcessor'
import { getBasicMetadata, preloadFFmpeg } from '@/features/video/utils/videoMetadata'
import { buildResizeArgs, computePresetDimensions, roundEven } from '@/features/video/utils/videoResizer'
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
  ResizeResult,
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

const RESOLUTION_PRESETS = [240, 360, 480, 720, 1080]

const TOOL_FAQS = [
  {
    question: 'What video formats are supported for resizing?',
    answer:
      'You can upload MP4, WebM, MOV, AVI, and MKV files. Output formats are MP4, MOV, AVI, and MKV — all using high-quality H.264 encoding for wide compatibility.',
  },
  {
    question: 'What do Fit and Fill mean?',
    answer:
      '"Fit" scales the video to fit within the target resolution while preserving the original aspect ratio. Black bars (letterbox or pillarbox) are added where needed so the entire frame is visible. "Fill" scales the video to completely cover the target resolution, cropping any excess content that extends beyond the frame. Both produce output at exactly the dimensions you specify.',
  },
  {
    question: 'Does resizing a video affect quality?',
    answer:
      'Yes, resizing requires re-encoding the video, which can affect quality. Our advanced video processing technology uses high-quality settings to minimize quality loss.',
  },
  {
    question: 'Are portrait videos handled correctly?',
    answer:
      'Yes! The preset buttons automatically detect portrait vs. landscape orientation using the source video\'s actual dimensions. A vertical video with the "1080p" preset will produce 1080 as the height (tall edge), preserving the portrait orientation rather than forcing it into a landscape frame.',
  },
  {
    question: 'Is my video uploaded to a server?',
    answer:
      'No! All processing happens entirely in your browser. Your videos never leave your device.',
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
    title: 'Set your target resolution',
    desc: 'Pick a preset (240p–1080p) that automatically preserves your video\'s orientation, or enter custom dimensions. Toggle the aspect ratio lock to keep the original shape, or unlock for free adjustments. Choose "Fit" to see the full frame with bars, or "Fill" to crop the frame.',
  },
  {
    step: 3,
    title: 'Download your resized video',
    desc: 'Click Resize Video, wait for the progress bar, then preview and download your resized clip. The entire process runs locally in your browser.',
  },
]

// ─── Analytics ────────────────────────────────────────────────────────────────

function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    ;(window as any).gtag('event', name, props)
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ResizeVideo() {
  // ── Core state ──────────────────────────────────────────────────────────
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)

  // ── Resolution state ────────────────────────────────────────────────────
  const [targetWidth, setTargetWidth] = useState(1920)
  const [targetHeight, setTargetHeight] = useState(1080)
  const [widthInput, setWidthInput] = useState('1920')
  const [heightInput, setHeightInput] = useState('1080')
  const [aspectLocked, setAspectLocked] = useState(true)
  const [scaleMethod, setScaleMethod] = useState<'fit' | 'fill'>('fit')

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
  const [result, setResult] = useState<ResizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCancelled, setIsCancelled] = useState(false)

  // ── Refs ────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const metadataRef = useRef<VideoMetadata | null>(null)

  // ── Derived ─────────────────────────────────────────────────────────────
  const metadataAvailable = videoMetadata !== null
  const duration = videoMetadata?.duration ?? 0
  const originalAspectRatio = videoMetadata && videoMetadata.height > 0
    ? videoMetadata.width / videoMetadata.height
    : 16 / 9

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

  // ── Initialize target dimensions from source ────────────────────────────
  const initFromSource = useCallback((metadata: VideoMetadata) => {
    const w = roundEven(metadata.width)
    const h = roundEven(metadata.height)
    setTargetWidth(w)
    setTargetHeight(h)
    setWidthInput(String(w))
    setHeightInput(String(h))
  }, [])

  // ── File selection ──────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: File) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    abortControllerRef.current?.abort()

    setOriginalFile(null)
    setVideoMetadata(null)
    setResult(null)
    setError(null)
    setIsCancelled(false)
    setProgress(0)
    setScaleMethod('fit')
    setAspectLocked(true)

    if (file.size > MAX_FILE_SIZE_TRIM) {
      setError(
        'File too large for browser-based processing — try a shorter clip or lower resolution source. Maximum file size is 500 MB.'
      )
      return
    }

    setOriginalFile(file)

    const metadata = await getBasicMetadata(file)
    setVideoMetadata(metadata)
    metadataRef.current = metadata

    if (metadata && metadata.width > 0 && metadata.height > 0) {
      initFromSource(metadata)
    }

    trackEvent('video_uploaded', {
      format: file.name.split('.').pop()?.toLowerCase(),
      size_mb: Math.round(file.size / (1024 * 1024)),
    })

    preloadFFmpeg()
  }, [initFromSource])

  // ── Preset button ───────────────────────────────────────────────────────

  const handlePreset = useCallback((presetValue: number) => {
    const metadata = metadataRef.current
    if (!metadata || metadata.width <= 0 || metadata.height <= 0) return
    const dims = computePresetDimensions(presetValue, metadata.width, metadata.height)
    setTargetWidth(dims.width)
    setTargetHeight(dims.height)
    setWidthInput(String(dims.width))
    setHeightInput(String(dims.height))
  }, [])

  // ── Width change (aspect-locked) ────────────────────────────────────────

  const handleWidthChange = useCallback((raw: string) => {
    setWidthInput(raw)
    const w = parseInt(raw, 10)
    if (isNaN(w) || w <= 0) return
    if (aspectLocked && videoMetadata && videoMetadata.height > 0) {
      const h = roundEven(w / originalAspectRatio)
      if (h > 0 && h <= 8192) {
        setTargetHeight(h)
        setHeightInput(String(h))
      }
    }
    setTargetWidth(w)
  }, [aspectLocked, videoMetadata, originalAspectRatio])

  // ── Height change (aspect-locked) ───────────────────────────────────────

  const handleHeightChange = useCallback((raw: string) => {
    setHeightInput(raw)
    const h = parseInt(raw, 10)
    if (isNaN(h) || h <= 0) return
    if (aspectLocked && videoMetadata && videoMetadata.height > 0) {
      const w = roundEven(h * originalAspectRatio)
      if (w > 0 && w <= 8192) {
        setTargetWidth(w)
        setWidthInput(String(w))
      }
    }
    setTargetHeight(h)
  }, [aspectLocked, videoMetadata, originalAspectRatio])

  // ── Blur/Enter: finalize even rounding ──────────────────────────────────

  const handleWidthBlur = useCallback(() => {
    const w = roundEven(targetWidth)
    setTargetWidth(w)
    setWidthInput(String(w))
    if (aspectLocked && videoMetadata && videoMetadata.height > 0) {
      const h = roundEven(w / originalAspectRatio)
      setTargetHeight(h)
      setHeightInput(String(h))
    }
  }, [targetWidth, aspectLocked, videoMetadata, originalAspectRatio])

  const handleHeightBlur = useCallback(() => {
    const h = roundEven(targetHeight)
    setTargetHeight(h)
    setHeightInput(String(h))
    if (aspectLocked && videoMetadata && videoMetadata.height > 0) {
      const w = roundEven(h * originalAspectRatio)
      setTargetWidth(w)
      setWidthInput(String(w))
    }
  }, [targetHeight, aspectLocked, videoMetadata, originalAspectRatio])

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent, field: 'w' | 'h') => {
    if (e.key === 'Enter') {
      if (field === 'w') handleWidthBlur()
      else handleHeightBlur()
    }
  }, [handleWidthBlur, handleHeightBlur])

  // ── Toggle aspect lock ──────────────────────────────────────────────────

  const handleToggleLock = useCallback(() => {
    setAspectLocked((prev) => !prev)
  }, [])

  // ── Reset to source dimensions ──────────────────────────────────────────

  const handleResetDimensions = useCallback(() => {
    const metadata = metadataRef.current
    if (!metadata || metadata.width <= 0 || metadata.height <= 0) return
    initFromSource(metadata)
  }, [initFromSource])

  // ── Processing ──────────────────────────────────────────────────────────

  const handleResize = useCallback(async () => {
    if (!originalFile) return

    setError(null)
    setIsCancelled(false)
    setIsProcessing(true)
    setProgress(0)
    setElapsedSeconds(0)
    setEstimatedRemaining(0)
    setResult(null)

    const finalW = roundEven(targetWidth)
    const finalH = roundEven(targetHeight)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    trackEvent('resize_started', {
      format: targetFormat,
      target: `${finalW}x${finalH}`,
      method: scaleMethod,
    })

    try {
      const config = FORMAT_CONFIG[targetFormat]

      const buildArgs = (inputName: string, outputName: string) =>
        buildResizeArgs(inputName, outputName, {
          targetWidth: finalW,
          targetHeight: finalH,
          scaleMethod,
          targetFormat,
          encoderOptions: {
            preset,
            crf,
            resolution: 'original', // we handle scaling via our own filter chain
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

      const resizeResult: ResizeResult = {
        blob: processResult.blob,
        mimeType: processResult.mimeType,
        targetFormat,
        originalSize: originalFile.size,
        resizedSize: processResult.blob.size,
        targetWidth: finalW,
        targetHeight: finalH,
        scaleMethod,
        metadata: videoMetadata,
      }

      setResult(resizeResult)

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      previewUrlRef.current = URL.createObjectURL(processResult.blob)

      trackEvent('resize_completed', {
        format: targetFormat,
        original_mb: Math.round(originalFile.size / (1024 * 1024)),
        resized_mb: Math.round(processResult.blob.size / (1024 * 1024)),
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setIsCancelled(true)
        trackEvent('resize_cancelled', { format: targetFormat })
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Resizing failed. Please try again with a different video file.'
        )
        trackEvent('resize_failed', { error: err instanceof Error ? err.message : 'unknown' })
      }
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }, [originalFile, videoMetadata, targetWidth, targetHeight, scaleMethod, targetFormat, preset, crf, frameRate])

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
    setTargetWidth(1920)
    setTargetHeight(1080)
    setWidthInput('1920')
    setHeightInput('1080')
    setAspectLocked(true)
    setScaleMethod('fit')
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

  // ── Is this a preset match? ─────────────────────────────────────────────

  const activePreset = (() => {
    const metadata = metadataRef.current
    if (!metadata || metadata.width <= 0 || metadata.height <= 0) return null
    for (const p of RESOLUTION_PRESETS) {
      const dims = computePresetDimensions(p, metadata.width, metadata.height)
      if (dims.width === targetWidth && dims.height === targetHeight) return p
    }
    return null
  })()

  // ── Is resolution changed from source? ──────────────────────────────────

  const isChanged = videoMetadata
    ? roundEven(targetWidth) !== roundEven(videoMetadata.width) ||
      roundEven(targetHeight) !== roundEven(videoMetadata.height)
    : true

  // ── Preview style ───────────────────────────────────────────────────────

  const previewObjectFit = scaleMethod === 'fit' ? 'contain' : 'cover'

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
            title="Resize Failed"
            message={error}
            onRetry={handleResize}
          />
        )}

        {/* ── Cancelled ──────────────────────────────────────────────── */}
        {isCancelled && !error && !result && (
          <div className="border border-border rounded-xl p-8 text-center bg-card">
            <Maximize2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Resize Cancelled</h3>
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

              {/* ── Video Preview ────────────────────────────────────── */}
              {!isProcessing && !result && (
                <div
                  className="rounded-xl overflow-hidden bg-black"
                  style={{
                    aspectRatio: `${targetWidth}/${targetHeight}`,
                    maxHeight: '480px',
                  }}
                >
                  <video
                    ref={videoRef}
                    src={previewUrlRef.current ?? undefined}
                    className="w-full h-full block"
                    preload="auto"
                    controls={false}
                    draggable={false}
                    style={{ objectFit: previewObjectFit }}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              {/* ── Resolution Controls ──────────────────────────────── */}
              {!isProcessing && !result && originalFile && (
                <div className="border border-border rounded-xl p-6 bg-card space-y-5">
                  <h3 className="font-semibold text-lg">Resolution</h3>

                  {/* Preset buttons */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Presets (orientation-aware)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {RESOLUTION_PRESETS.map((presetValue) => {
                        const isActive = activePreset === presetValue
                        const metadata = metadataRef.current
                        const label = metadata && metadata.width >= metadata.height
                          ? `${presetValue}p`
                          : `${presetValue}p`
                        return (
                          <button
                            key={presetValue}
                            onClick={() => handlePreset(presetValue)}
                            className={cn(
                              'px-4 py-2 text-sm rounded-lg border transition-colors',
                              isActive
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border bg-card hover:bg-muted/50 text-foreground',
                            )}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Presets set the longer edge. Portrait videos get portrait output.
                    </p>
                  </div>

                  {/* Custom width/height with aspect lock */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Custom Dimensions
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={widthInput}
                          onChange={(e) => handleWidthChange(e.target.value)}
                          onBlur={handleWidthBlur}
                          onKeyDown={(e) => handleInputKeyDown(e, 'w')}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-center font-mono"
                          disabled={isProcessing}
                          aria-label="Target width"
                        />
                      </div>
                      <span className="text-muted-foreground text-sm">×</span>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={heightInput}
                          onChange={(e) => handleHeightChange(e.target.value)}
                          onBlur={handleHeightBlur}
                          onKeyDown={(e) => handleInputKeyDown(e, 'h')}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm text-center font-mono"
                          disabled={isProcessing}
                          aria-label="Target height"
                        />
                      </div>
                      <button
                        onClick={handleToggleLock}
                        className={cn(
                          'p-2 rounded-lg border transition-colors shrink-0',
                          aspectLocked
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border bg-card hover:bg-muted/50 text-foreground',
                        )}
                        title={aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                        aria-label={aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                      >
                        {aspectLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                    </div>
                    {aspectLocked && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Aspect ratio locked ({originalAspectRatio.toFixed(2)}:1) — dimensions stay proportional.
                      </p>
                    )}
                  </div>

                  {/* Scale method selector */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Scale Method
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setScaleMethod('fit')}
                        className={cn(
                          'flex-1 px-4 py-2 text-sm rounded-lg border transition-colors',
                          scaleMethod === 'fit'
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border bg-card hover:bg-muted/50 text-foreground',
                        )}
                      >
                        Fit
                      </button>
                      <button
                        onClick={() => setScaleMethod('fill')}
                        className={cn(
                          'flex-1 px-4 py-2 text-sm rounded-lg border transition-colors',
                          scaleMethod === 'fill'
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border bg-card hover:bg-muted/50 text-foreground',
                        )}
                      >
                        Fill
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {scaleMethod === 'fit'
                        ? 'Scales to fit within the target. Adds black bars if the aspect ratio differs.'
                        : 'Scales to fill the entire target. Crops excess content if the aspect ratio differs.'}
                    </p>
                  </div>

                  {/* Reset to source */}
                  <div>
                    <Button variant="outline" size="sm" onClick={handleResetDimensions}>
                      Reset to Original ({videoMetadata ? `${videoMetadata.width}×${videoMetadata.height}` : '—'})
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Progress ──────────────────────────────────────────── */}
              {isProcessing && (
                <div className="space-y-4">
                  <ProcessingStatus message="Resizing video..." />
                  <ProgressBar
                    percent={progress}
                    label="Resize Progress"
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
                    <h3 className="font-semibold text-lg mb-4">Resize Complete</h3>

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
                          {result.targetWidth}×{result.targetHeight}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Method</div>
                        <div className="font-semibold text-sm capitalize">{result.scaleMethod}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Encoding</div>
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
                        <div className="text-xs text-muted-foreground mb-1">Resized</div>
                        <div className="text-2xl font-bold">{formatBytes(result.resizedSize)}</div>
                        {result.originalSize > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {result.resizedSize < result.originalSize
                              ? `${Math.round(((result.originalSize - result.resizedSize) / result.originalSize) * 100)}% smaller`
                              : result.resizedSize > result.originalSize
                                ? `${Math.round(((result.resizedSize - result.originalSize) / result.originalSize) * 100)}% larger`
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
                      Resize Another
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
                        <span>Encoding Preset</span>
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

                    {/* Target info */}
                    <div className="p-3 rounded-lg bg-background border border-border">
                      <div className="text-xs text-muted-foreground mb-1">Output Resolution</div>
                      <div className="text-lg font-bold font-mono">
                        {roundEven(targetWidth)} × {roundEven(targetHeight)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {scaleMethod === 'fit' ? 'Fit — black bars if needed' : 'Fill — cropped to fit'}
                      </p>
                    </div>

                    {/* Re-encode notice */}
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        Resizing always re-encodes the video stream. Audio is passed through without re-encoding.
                      </p>
                    </div>

                    {/* Resize button */}
                    <Button
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={!originalFile || !isChanged}
                      onClick={handleResize}
                    >
                      <Maximize2 className="w-4 h-4 mr-2" />
                      {isChanged ? 'Resize Video' : 'No change needed'}
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
                        <label className="text-sm font-medium">Target</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                          {roundEven(targetWidth)}×{roundEven(targetHeight)} ({scaleMethod})
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Method</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                          Re-encode (required for resize)
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
                        Resize Another Video
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
          <h2 className="text-2xl font-bold mb-6">How to Resize a Video</h2>
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
