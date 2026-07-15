'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Download, RotateCcw, Film, Play } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { getBasicMetadata, getAdvancedMetadata, preloadFFmpeg } from '@/features/video/utils/videoMetadata'
import { MAX_FILE_SIZE_TRIM } from '@/features/video/utils/videoValidation'
import { getSaveVexFileName } from '@/utils/fileNames'
import { formatBytes } from '@/utils/formatBytes'
import { formatTime, formatDuration, parseTimeInput } from '@/features/video/utils/videoTimeline'
import {
  videoToGIF,
  QUALITY_PALETTE,
  estimateGIFSize,
  formatGIFSizeEstimate,
  computeGIFDimensions,
  snapEven,
  DEFAULT_FPS,
  MAX_GIF_DIMENSION,
} from '@/features/video/utils/videoToGIF'
import type {
  GIFQuality,
  GIFLoop,
  VideoMetadata,
  ExtendedVideoMetadata,
  VideoToGIFResult,
} from '@/features/video/types'

// ─── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED_FORMATS = ['mp4', 'webm', 'mov', 'mkv', 'avi']

const FPS_OPTIONS = [
  { value: 5, label: '5 fps' },
  { value: 8, label: '8 fps' },
  { value: 10, label: '10 fps' },
  { value: 12, label: '12 fps' },
  { value: 15, label: '15 fps' },
  { value: 20, label: '20 fps' },
  { value: 24, label: '24 fps' },
  { value: 30, label: '30 fps' },
]

const QUALITY_OPTIONS: { value: GIFQuality; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: '32 colors — smallest file, visible banding' },
  { value: 'medium', label: 'Medium', description: '128 colors — balanced quality and file size' },
  { value: 'high', label: 'High', description: '256 colors — best quality, larger file' },
]

const LOOP_OPTIONS: { value: GIFLoop; label: string }[] = [
  { value: 'infinite', label: 'Infinite (loop forever)' },
  { value: '1', label: 'Play once' },
  { value: '3', label: 'Loop 3 times' },
  { value: '5', label: 'Loop 5 times' },
  { value: '10', label: 'Loop 10 times' },
]

const TOOL_FAQS = [
  {
    question: 'What video formats are supported?',
    answer:
      'MP4, WebM, MOV, AVI, and MKV are supported. For best compatibility, we recommend using MP4 or WebM files.',
  },
  {
    question: 'How long can my GIF be?',
    answer:
      'For best results, keep GIFs under 10 seconds. Longer GIFs can have very large file sizes and may take significantly longer to process. A 5-second clip at 10 fps is usually a good sweet spot between quality and file size.',
  },
  {
    question: 'What quality options are available?',
    answer:
      'Low (32 colors) produces the smallest files with visible color banding. Medium (128 colors) provides a good balance. High (256 colors — the GIF format maximum) delivers the best visual fidelity at the cost of larger file sizes. More colors = better quality + larger file.',
  },
  {
    question: 'Is my video uploaded to a server?',
    answer:
      'No! All processing happens entirely in your browser using our video processing technology. Your videos never leave your device.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Upload your video',
    desc: 'Click or drag and drop a video file (up to 500 MB). File info appears instantly — duration, resolution, and format.',
  },
  {
    step: 2,
    title: 'Configure your GIF',
    desc: 'Set the start time and duration of your clip, choose the output size, frame rate (5–30 fps), quality level, and loop behavior.',
  },
  {
    step: 3,
    title: 'Convert and download',
    desc: 'Click Convert to GIF, wait for the progress bar to complete, then preview and download your animated GIF. The entire process runs locally in your browser.',
  },
]

// ─── Analytics ─────────────────────────────────────────────────────────────────

function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    ;(window as any).gtag('event', name, props)
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function VideoToGIF() {
  // ── Core state ──────────────────────────────────────────────────────────
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const [advancedMetadata, setAdvancedMetadata] = useState<ExtendedVideoMetadata | null>(null)

  // ── Options ─────────────────────────────────────────────────────────────
  const [startTimeInput, setStartTimeInput] = useState('0')
  const [durationInput, setDurationInput] = useState('5')
  const [targetWidth, setTargetWidth] = useState(0)
  const [targetHeight, setTargetHeight] = useState(0)
  const [fps, setFps] = useState(DEFAULT_FPS)
  const [quality, setQuality] = useState<GIFQuality>('medium')
  const [loop, setLoop] = useState<GIFLoop>('infinite')

  // ── Processing state ────────────────────────────────────────────────────
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [estimatedRemaining, setEstimatedRemaining] = useState(0)
  const [result, setResult] = useState<VideoToGIFResult | null>(null)
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
  const sourceWidth = videoMetadata?.width ?? 0
  const sourceHeight = videoMetadata?.height ?? 0

  // Parse start time and segment duration
  const parsedStartTime = parseTimeInput(startTimeInput) ?? 0
  const parsedDuration = parseTimeInput(durationInput) ?? 5

  // Clamp to video bounds
  const clampedStartTime = Math.max(0, Math.min(parsedStartTime, Math.max(0, duration - 1)))
  const maxPossibleDuration = Math.max(1, duration - clampedStartTime)
  const clampedDuration = Math.max(1, Math.min(parsedDuration, maxPossibleDuration))

  // Compute effective output dimensions
  const effectiveDims = computeGIFDimensions(sourceWidth, sourceHeight, targetWidth, targetHeight)

  // Estimated output size
  const paletteColors = QUALITY_PALETTE[quality]
  const estimatedSize = estimateGIFSize(
    effectiveDims.width || sourceWidth,
    effectiveDims.height || sourceHeight,
    fps,
    clampedDuration,
    paletteColors,
  )

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

  // ── Seek video preview to start time ────────────────────────────────────
  const handleVideoLoaded = useCallback(() => {
    if (videoRef.current && clampedStartTime > 0) {
      videoRef.current.currentTime = clampedStartTime
    }
  }, [clampedStartTime])

  // ── File selection ──────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: File) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    abortControllerRef.current?.abort()

    setOriginalFile(null)
    setVideoMetadata(null)
    setAdvancedMetadata(null)
    setResult(null)
    setError(null)
    setIsCancelled(false)
    setProgress(0)

    // File size check
    if (file.size > MAX_FILE_SIZE_TRIM) {
      setError(
        'File too large for browser-based processing — try a shorter clip or lower resolution source. Maximum file size is 500 MB.',
      )
      return
    }

    setOriginalFile(file)

    const metadata = await getBasicMetadata(file)
    setVideoMetadata(metadata)
    metadataRef.current = metadata

    // Auto-set width/height from source
    if (metadata && metadata.width > 0 && metadata.height > 0) {
      // Default to source dimensions, capped at MAX_GIF_DIMENSION
      if (metadata.width > MAX_GIF_DIMENSION || metadata.height > MAX_GIF_DIMENSION) {
        const scale = MAX_GIF_DIMENSION / Math.max(metadata.width, metadata.height)
        setTargetWidth(snapEven(Math.round(metadata.width * scale)))
        setTargetHeight(snapEven(Math.round(metadata.height * scale)))
      } else {
        setTargetWidth(0)
        setTargetHeight(0)
      }
      // Auto-set duration to min(5s, video duration)
      if (metadata.duration > 0) {
        setDurationInput(String(Math.min(5, Math.floor(metadata.duration))))
      }
    }

    trackEvent('video_uploaded', {
      format: file.name.split('.').pop()?.toLowerCase(),
      size_mb: Math.round(file.size / (1024 * 1024)),
      tool: 'video-to-gif',
    })

    preloadFFmpeg()
  }, [])

  // ── Phase 2: Advanced metadata probe (background) ───────────────────────

  useEffect(() => {
    if (!originalFile || !videoMetadata) return

    let cancelled = false

    const probeAdvanced = async () => {
      try {
        const ffmpeg = (await import('@/features/audio/utils/ffmpegClient')).getFFmpeg
        const ffmpegInstance = await ffmpeg()
        if (cancelled) return

        const advanced = await getAdvancedMetadata(ffmpegInstance, originalFile, videoMetadata)
        if (cancelled) return

        setAdvancedMetadata(advanced)
      } catch {
        // Graceful degradation
      }
    }

    probeAdvanced()

    return () => {
      cancelled = true
    }
  }, [originalFile, videoMetadata])

  // ── Processing ──────────────────────────────────────────────────────────

  const handleProcess = useCallback(async () => {
    if (!originalFile) return

    setError(null)
    setIsCancelled(false)
    setIsProcessing(true)
    setProgress(0)
    setElapsedSeconds(0)
    setEstimatedRemaining(0)
    setResult(null)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    trackEvent('video_to_gif_started', {
      quality,
      fps,
      width: effectiveDims.width,
      height: effectiveDims.height,
      duration: clampedDuration,
    })

    try {
      const gifResult = await videoToGIF({
        file: originalFile,
        startTime: clampedStartTime,
        duration: clampedDuration,
        width: effectiveDims.width,
        height: effectiveDims.height,
        fps,
        quality,
        loop,
        onProgress: (pct, elapsed, remaining) => {
          setProgress(pct)
          setElapsedSeconds(elapsed)
          setEstimatedRemaining(remaining)
        },
        signal: abortController.signal,
      })

      // Attach metadata from component state
      const finalResult: VideoToGIFResult = {
        ...gifResult,
        metadata: videoMetadata,
      }

      setResult(finalResult)

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      previewUrlRef.current = URL.createObjectURL(gifResult.blob)

      trackEvent('video_to_gif_completed', {
        quality,
        fps,
        original_mb: Math.round(originalFile.size / (1024 * 1024)),
        output_mb: Math.round(gifResult.blob.size / (1024 * 1024)),
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setIsCancelled(true)
        trackEvent('video_to_gif_cancelled', { quality, fps })
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Conversion failed. Please try again with a different video file.',
        )
        trackEvent('video_to_gif_failed', {
          error: err instanceof Error ? err.message : 'unknown',
        })
      }
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }, [
    originalFile,
    clampedStartTime,
    clampedDuration,
    effectiveDims.width,
    effectiveDims.height,
    fps,
    quality,
    loop,
    videoMetadata,
  ])

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
    a.download = getSaveVexFileName(`${baseName}.gif`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)

    trackEvent('download_clicked', { format: 'gif', tool: 'video-to-gif' })
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
    setAdvancedMetadata(null)
    setStartTimeInput('0')
    setDurationInput('5')
    setTargetWidth(0)
    setTargetHeight(0)
    setFps(DEFAULT_FPS)
    setQuality('medium')
    setLoop('infinite')
    setResult(null)
    setError(null)
    setIsCancelled(false)
    setIsProcessing(false)
    setProgress(0)
  }, [])

  const handleRetryUpload = useCallback(() => {
    setError(null)
  }, [])

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
            title="Conversion Failed"
            message={error}
            onRetry={handleProcess}
          />
        )}

        {/* ── Cancelled ──────────────────────────────────────────────── */}
        {isCancelled && !error && !result && (
          <div className="border border-border rounded-xl p-8 text-center bg-card">
            <Play className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Conversion Cancelled</h3>
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
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <Film className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{originalFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(originalFile.size)}
                    {metadataAvailable && duration > 0 && (
                      <> · {formatDuration(duration)}</>
                    )}
                    {metadataAvailable && sourceWidth > 0 && (
                      <> · {sourceWidth}×{sourceHeight}</>
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Change File
                </Button>
              </div>

              {/* ── Video Preview ────────────────────────────────────── */}
              {!isProcessing && !result && (
                <div className="rounded-xl overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    src={previewUrlRef.current ?? undefined}
                    className="w-full max-h-96"
                    preload="auto"
                    controls
                    onLoadedMetadata={handleVideoLoaded}
                  >
                    Your browser does not support the video tag.
                  </video>
                  {clampedStartTime > 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2 bg-muted/30">
                      Preview starts at {formatTime(clampedStartTime)} · Segment length: {formatDuration(clampedDuration)}
                    </p>
                  )}
                </div>
              )}

              {/* ── Info Panel ────────────────────────────────────────── */}
              {!isProcessing && !result && originalFile && (
                <div className="border border-border rounded-xl p-6 bg-card space-y-4">
                  <h3 className="font-semibold text-lg">About Video to GIF</h3>
                  <p className="text-sm text-muted-foreground">
                    Convert any video clip into an animated GIF. We use a two-pass palette
                    technique for optimal color quality — first generating the best color
                    palette from your video segment, then applying it with dithering for
                    smooth gradients.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <div className="text-xs text-muted-foreground mb-1">Segment</div>
                      <div className="text-lg font-bold font-mono">
                        {clampedDuration > 0 ? formatDuration(clampedDuration) : '--:--'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">from {formatTime(clampedStartTime)}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <div className="text-xs text-muted-foreground mb-1">Estimated Size</div>
                      <div className="text-lg font-bold font-mono">
                        {formatGIFSizeEstimate(estimatedSize)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {paletteColors} colors · {fps} fps
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    GIF file size depends heavily on content complexity. The estimate above is approximate only.
                  </p>
                </div>
              )}

              {/* ── Progress ──────────────────────────────────────────── */}
              {isProcessing && (
                <div className="space-y-4">
                  <ProcessingStatus message="Converting video to GIF..." />
                  <ProgressBar
                    percent={progress}
                    label="Processing Progress"
                    detail={
                      progress < 5
                        ? 'Generating color palette...'
                        : progress < 95
                          ? 'Encoding GIF frames...'
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
                    <h3 className="font-semibold text-lg mb-4">GIF Ready</h3>

                    {previewUrlRef.current && (
                      <div className="mb-6 rounded-lg overflow-hidden bg-black flex items-center justify-center p-4">
                        <img
                          src={previewUrlRef.current}
                          alt="Animated GIF preview"
                          className="max-w-full max-h-96 object-contain"
                        />
                      </div>
                    )}

                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-center">
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Format</div>
                        <div className="font-semibold text-sm">GIF</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Dimensions</div>
                        <div className="font-semibold text-sm font-mono">
                          {result.width || sourceWidth}×{result.height || sourceHeight}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Duration</div>
                        <div className="font-semibold text-sm font-mono">
                          {formatDuration(result.duration)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Settings</div>
                        <div className="font-semibold text-sm">
                          {result.fps} fps · {quality}
                        </div>
                      </div>
                    </div>

                    {/* File size comparison */}
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">File Sizes</h4>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="p-4 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Original Video</div>
                        <div className="text-2xl font-bold">{formatBytes(result.originalSize)}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Output GIF</div>
                        <div className="text-2xl font-bold">{formatBytes(result.outputSize)}</div>
                        {result.originalSize > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {result.outputSize < result.originalSize
                              ? `${Math.round(((result.originalSize - result.outputSize) / result.originalSize) * 100)}% smaller`
                              : result.outputSize > result.originalSize
                                ? `${Math.round(((result.outputSize - result.originalSize) / result.originalSize) * 100)}% larger`
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
                      Download GIF
                    </Button>
                    <Button size="lg" variant="outline" onClick={handleReset}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Create Another
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right Column: Options Panel ─────────────────────────── */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                {originalFile && !isProcessing && !result && (
                  <div className="border border-border rounded-xl p-6 bg-muted/30 space-y-6">
                    <h3 className="font-semibold text-lg">GIF Settings</h3>

                    {/* Start Time */}
                    <div>
                      <label className="text-sm font-medium flex justify-between">
                        <span>Start Time</span>
                        <span className="text-primary font-semibold font-mono">
                          {formatTime(clampedStartTime)}
                        </span>
                      </label>
                      <input
                        type="text"
                        value={startTimeInput}
                        onChange={(e) => setStartTimeInput(e.target.value)}
                        placeholder="0 or 0:00"
                        className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Seconds (90) or MM:SS (1:30)
                      </p>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="text-sm font-medium flex justify-between">
                        <span>Duration</span>
                        <span className="text-primary font-semibold font-mono">
                          {formatDuration(clampedDuration)}
                        </span>
                      </label>
                      <input
                        type="text"
                        value={durationInput}
                        onChange={(e) => setDurationInput(e.target.value)}
                        placeholder="5 or 0:05"
                        className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Max: {formatDuration(maxPossibleDuration)}
                      </p>
                    </div>

                    {/* Width */}
                    <div>
                      <label className="text-sm font-medium flex justify-between">
                        <span>Width (px)</span>
                        <span className="text-primary font-semibold font-mono">
                          {targetWidth === 0 ? 'Auto' : targetWidth}
                        </span>
                      </label>
                      <input
                        type="number"
                        value={targetWidth}
                        onChange={(e) => {
                          const v = parseInt(e.target.value) || 0
                          setTargetWidth(Math.max(0, Math.min(v, MAX_GIF_DIMENSION)))
                        }}
                        placeholder="0 = auto"
                        min={0}
                        max={MAX_GIF_DIMENSION}
                        step={2}
                        className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        0 = auto-derive from height
                      </p>
                    </div>

                    {/* Height */}
                    <div>
                      <label className="text-sm font-medium flex justify-between">
                        <span>Height (px)</span>
                        <span className="text-primary font-semibold font-mono">
                          {targetHeight === 0 ? 'Auto' : targetHeight}
                        </span>
                      </label>
                      <input
                        type="number"
                        value={targetHeight}
                        onChange={(e) => {
                          const v = parseInt(e.target.value) || 0
                          setTargetHeight(Math.max(0, Math.min(v, MAX_GIF_DIMENSION)))
                        }}
                        placeholder="0 = auto"
                        min={0}
                        max={MAX_GIF_DIMENSION}
                        step={2}
                        className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        0 = auto-derive from width
                      </p>
                    </div>

                    {/* Effective dimensions preview */}
                    {sourceWidth > 0 && sourceHeight > 0 && (
                      <div className="text-xs text-muted-foreground text-center p-2 rounded-lg bg-background/50">
                        Output: {effectiveDims.width || sourceWidth}×{effectiveDims.height || sourceHeight}
                        {sourceWidth > 0 && (
                          <> · Source: {sourceWidth}×{sourceHeight}</>
                        )}
                      </div>
                    )}

                    {/* Frame Rate */}
                    <div>
                      <label className="text-sm font-medium flex justify-between">
                        <span>Frame Rate</span>
                        <span className="text-primary font-semibold">{fps} fps</span>
                      </label>
                      <select
                        value={fps}
                        onChange={(e) => setFps(Number(e.target.value))}
                        className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      >
                        {FPS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quality */}
                    <div>
                      <label className="text-sm font-medium flex justify-between">
                        <span>Quality</span>
                        <span className="text-primary font-semibold">{quality}</span>
                      </label>
                      <select
                        value={quality}
                        onChange={(e) => setQuality(e.target.value as GIFQuality)}
                        className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      >
                        {QUALITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {QUALITY_OPTIONS.find((o) => o.value === quality)?.description}
                      </p>
                    </div>

                    {/* Loop */}
                    <div>
                      <label className="text-sm font-medium flex justify-between">
                        <span>Loop</span>
                        <span className="text-primary font-semibold">
                          {loop === 'infinite' ? 'Forever' : `${loop}×`}
                        </span>
                      </label>
                      <select
                        value={loop}
                        onChange={(e) => setLoop(e.target.value as GIFLoop)}
                        className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      >
                        {LOOP_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Estimate notice */}
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                      <p className="text-xs text-green-800 dark:text-green-200">
                        All processing happens in your browser. The estimated output size
                        depends on content complexity and may differ from the actual result.
                      </p>
                    </div>

                    {/* Action button */}
                    <Button
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={!originalFile || clampedDuration < 1}
                      onClick={handleProcess}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {clampedDuration < 1 ? 'Duration too short' : 'Convert to GIF'}
                    </Button>

                    {/* Size estimate footnote */}
                    {estimatedSize > 0 && (
                      <p className="text-xs text-muted-foreground text-center">
                        Estimated output: {formatGIFSizeEstimate(estimatedSize)}
                      </p>
                    )}
                  </div>
                )}

                {/* PROCESSING */}
                {isProcessing && (
                  <div className="border border-border rounded-xl p-6 bg-muted/30">
                    <h3 className="font-semibold text-lg mb-6">GIF Settings</h3>
                    <div className="space-y-3 opacity-50 pointer-events-none">
                      <div>
                        <label className="text-sm font-medium">Segment</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono">
                          {formatTime(clampedStartTime)} – {formatDuration(clampedDuration)}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Dimensions</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono">
                          {effectiveDims.width || sourceWidth}×{effectiveDims.height || sourceHeight}
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
                        Download GIF
                      </Button>
                      <Button className="w-full" variant="outline" onClick={handleReset}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Create Another GIF
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── How To ──────────────────────────────────────────────────────── */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6">How to Create a GIF from Video</h2>
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

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
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
