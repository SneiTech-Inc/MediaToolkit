'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Download, RotateCcw, Film, Play, Pause,
  ChevronLeft, ChevronRight, Scissors, Repeat,
} from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { processVideo } from '@/features/video/utils/videoProcessor'
import { getBasicMetadata, getAdvancedMetadata, preloadFFmpeg } from '@/features/video/utils/videoMetadata'
import { parseTimeInput, formatTime, formatDuration } from '@/features/video/utils/videoTimeline'
import { generateThumbnails } from '@/features/video/utils/videoThumbnail'
import { buildEncoderArgs } from '@/features/video/utils/videoEncoder'
import { canUseStreamCopy, buildTrimArgs } from '@/features/video/utils/videoTrimmer'
import { FORMAT_CONFIG, RESOLUTION_HEIGHT } from '@/features/video/types'
import { MAX_FILE_SIZE_TRIM } from '@/features/video/utils/videoValidation'
import { getSaveVexFileName } from '@/utils/fileNames'
import { formatBytes } from '@/utils/formatBytes'
import type {
  VideoOutputFormat,
  VideoPreset,
  VideoResolution,
  VideoFrameRate,
  VideoMetadata,
  ExtendedVideoMetadata,
  ThumbnailData,
  TrimResult,
} from '@/features/video/types'
import { DEFAULT_CRF, MIN_CRF, MAX_CRF } from '@/features/video/types'

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

const RESOLUTION_OPTIONS: { value: VideoResolution; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: '1080p', label: '1080p (Full HD)' },
  { value: '720p', label: '720p (HD)' },
  { value: '480p', label: '480p (SD)' },
  { value: '360p', label: '360p' },
]

const FRAMERATE_OPTIONS: { value: VideoFrameRate; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: '30', label: '30 fps' },
  { value: '24', label: '24 fps' },
]

const TOOL_FAQS = [
  {
    question: 'What video formats are supported?',
    answer:
      'You can upload MP4, WebM, MOV, AVI, and MKV files. Output formats are MP4, MOV, AVI, and MKV — all using industry-standard compression for wide compatibility.',
  },
  {
    question: 'How accurate is the trimming?',
    answer:
      'With Fast Trim, trimming occurs on the nearest keyframe rather than the exact frame — this is nearly instant but may be off by a few frames. For frame-accurate cuts, disable Fast Trim to use standard processing. Use the frame stepping buttons for precision when setting trim points.',
  },
  {
    question: 'Is my video uploaded to a server?',
    answer:
      'No. All video trimming happens entirely in your browser using advanced video processing technology. Your videos never leave your device — they remain 100% private and secure.',
  },
  {
    question: 'Why is trimming so fast sometimes?',
    answer:
      'Fast Trim uses advanced processing which copies the selected segment directly without re-processing. Standard processing only happens when you change the output format, resolution, frame rate, or disable Fast Trim for frame-accurate cuts.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Upload your video',
    desc: 'Click or drag and drop a video file (up to 500 MB). Preview and basic info appear instantly — no waiting for the processing engine to load.',
  },
  {
    step: 2,
    title: 'Set your trim points',
    desc: 'Drag the slider handles or type exact times to select your segment. Use frame stepping for precision. Preview the segment with the play button.',
  },
  {
    step: 3,
    title: 'Download your trimmed video',
    desc: 'Click Trim Video, wait for the progress bar, then preview and download your trimmed clip. Fast Trim is near-instant for same-format cuts.',
  },
]

// ─── Analytics ────────────────────────────────────────────────────────────────

function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    ;(window as any).gtag('event', name, props)
  }
}

// ─── Size Estimation ──────────────────────────────────────────────────────────

function estimateOutputSize(
  originalSize: number,
  duration: number,
  startTime: number,
  endTime: number,
  crf: number,
  resolution: VideoResolution,
  frameRate: VideoFrameRate,
  metadata: VideoMetadata | null
): { min: number; max: number } | null {
  const segmentDuration = endTime - startTime
  if (segmentDuration <= 0 || duration <= 0) return null

  // Base: proportion of original size by duration
  const segmentRatio = segmentDuration / duration
  let size = originalSize * segmentRatio

  // If re-encoding (not stream copy), apply CRF and resolution factors
  const crfRatio = 0.3 + ((crf - 18) / (32 - 18)) * 0.5
  size = size * crfRatio

  if (resolution !== 'original' && metadata && metadata.height > 0) {
    const targetHeight = RESOLUTION_HEIGHT[resolution as Exclude<VideoResolution, 'original'>]
    if (targetHeight < metadata.height) {
      size = size * (targetHeight / metadata.height) ** 2
    }
  }

  if (frameRate !== 'original') {
    size = size * (parseInt(frameRate, 10) / 30)
  }

  return {
    min: Math.round(size * 0.7),
    max: Math.round(size * 1.3),
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TrimVideo() {
  // ── Core state ──────────────────────────────────────────────────────────
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const [advancedMetadata, setAdvancedMetadata] = useState<ExtendedVideoMetadata | null>(null)

  // ── Trim range ──────────────────────────────────────────────────────────
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [startInput, setStartInput] = useState('0:00')
  const [endInput, setEndInput] = useState('0:00')

  // ── Options ─────────────────────────────────────────────────────────────
  const [targetFormat, setTargetFormat] = useState<VideoOutputFormat>('mp4')
  const [useFastTrim, setUseFastTrim] = useState(true)
  const [preset, setPreset] = useState<VideoPreset>('medium')
  const [crf, setCrf] = useState<number>(DEFAULT_CRF)
  const [resolution, setResolution] = useState<VideoResolution>('original')
  const [frameRate, setFrameRate] = useState<VideoFrameRate>('original')

  // ── Processing state ────────────────────────────────────────────────────
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [estimatedRemaining, setEstimatedRemaining] = useState(0)
  const [result, setResult] = useState<TrimResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCancelled, setIsCancelled] = useState(false)

  // ── Preview state ───────────────────────────────────────────────────────
  const [isLoopPreview, setIsLoopPreview] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isVideoFocused, setIsVideoFocused] = useState(false)
  const [thumbnails, setThumbnails] = useState<ThumbnailData[]>([])
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState(false)

  // ── Refs ────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeUpdateHandlerRef = useRef<(() => void) | null>(null)
  const metadataRef = useRef<VideoMetadata | null>(null)

  // ── Derived ─────────────────────────────────────────────────────────────
  const metadataAvailable = videoMetadata !== null
  const duration = videoMetadata?.duration ?? 0
  const segmentDuration = endTime - startTime
  const isStreamCopyPossible = originalFile ? canUseStreamCopy(originalFile, targetFormat) : false
  const effectiveFastTrim = useFastTrim && isStreamCopyPossible
  const needsReencode = !effectiveFastTrim
  const fps = advancedMetadata?.fps ?? 30

  // ── Initialize endTime when duration becomes available ───────────────────
  useEffect(() => {
    if (duration > 0 && endTime === 0) {
      setEndTime(duration)
      setEndInput(formatTime(duration))
    }
  }, [duration, endTime])

  // ── Segment-only playback effect ────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      if (video.currentTime >= endTime) {
        video.pause()
        setIsPlaying(false)
        if (isLoopPreview) {
          video.currentTime = startTime
          video.play().catch(() => {})
        } else {
          video.currentTime = startTime
        }
      }
    }

    timeUpdateHandlerRef.current = handleTimeUpdate
    video.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      if (timeUpdateHandlerRef.current) {
        video.removeEventListener('timeupdate', timeUpdateHandlerRef.current)
      }
    }
  }, [startTime, endTime, isLoopPreview])

  // ── Build/refresh preview URL when file changes ─────────────────────────
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

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: File) => {
    // Clean up previous state
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    abortControllerRef.current?.abort()

    // Reset
    setOriginalFile(null)
    setVideoMetadata(null)
    setAdvancedMetadata(null)
    setResult(null)
    setError(null)
    setIsCancelled(false)
    setProgress(0)
    setStartTime(0)
    setEndTime(0)
    setThumbnails([])

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
    if (metadata && metadata.duration > 0) {
      setEndTime(metadata.duration)
      setEndInput(formatTime(metadata.duration))
      setStartInput('0:00')
    }

    trackEvent('video_uploaded', {
      format: file.name.split('.').pop()?.toLowerCase(),
      size_mb: Math.round(file.size / (1024 * 1024)),
    })

    // Phase 2: Preload ffmpeg in background (non-blocking)
    preloadFFmpeg()

    // Phase 3: Background thumbnail generation
    if (metadata && metadata.duration > 0) {
      setIsGeneratingThumbs(true)
      generateThumbnails(file, metadata.duration, 30).then((thumbs) => {
        setThumbnails(thumbs)
        setIsGeneratingThumbs(false)
      }).catch(() => {
        setIsGeneratingThumbs(false)
      })
    }
  }, [])

  // ── Load advanced metadata when ffmpeg becomes ready and we have a file ──
  useEffect(() => {
    if (!originalFile) return

    let cancelled = false

    const loadAdvanced = async () => {
      try {
        const basic = metadataRef.current
        if (!basic || cancelled) return
        // getFFmpeg is a singleton — if already loaded, returns immediately
        const { getFFmpeg: getFFmpegInstance } = await import('@/features/audio/utils/ffmpegClient')
        const ffmpeg = await getFFmpegInstance()
        if (cancelled) return
        const advanced = await getAdvancedMetadata(ffmpeg, originalFile, basic)
        if (!cancelled) setAdvancedMetadata(advanced)
      } catch {
        // Silently ignore — advanced metadata is a nice-to-have
      }
    }

    loadAdvanced()

    return () => { cancelled = true }
  }, [originalFile])

  // ── Slider → input sync ─────────────────────────────────────────────────
  const handleSliderChange = useCallback(([s, e]: readonly [number, number]) => {
    setStartTime(s)
    setEndTime(e)
    setStartInput(formatTime(s))
    setEndInput(formatTime(e))
  }, [])

  // ── Input → slider sync ─────────────────────────────────────────────────
  const handleStartInputBlur = useCallback(() => {
    const parsed = parseTimeInput(startInput)
    if (parsed !== null) {
      const clamped = Math.max(0, Math.min(parsed, endTime - 1))
      setStartTime(clamped)
      setStartInput(formatTime(clamped))
    } else {
      setStartInput(formatTime(startTime))
    }
  }, [startInput, endTime, startTime])

  const handleEndInputBlur = useCallback(() => {
    const parsed = parseTimeInput(endInput)
    if (parsed !== null) {
      const clamped = Math.max(startTime + 1, Math.min(parsed, duration))
      setEndTime(clamped)
      setEndInput(formatTime(clamped))
    } else {
      setEndInput(formatTime(endTime))
    }
  }, [endInput, startTime, duration, endTime])

  const handleStartInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur()
    }
  }, [])

  // ── Video playback controls ─────────────────────────────────────────────
  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.currentTime = startTime
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [startTime])

  // ── Frame stepping ──────────────────────────────────────────────────────
  const stepBack = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, video.currentTime - 1 / fps)
  }, [fps])

  const stepForward = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.min(duration, video.currentTime + 1 / fps)
  }, [fps, duration])

  // ── Keyboard shortcuts (video element only) ─────────────────────────────
  const handleVideoKeyDown = useCallback((e: React.KeyboardEvent<HTMLVideoElement>) => {
    if (e.key === ' ') {
      e.preventDefault()
      handleTogglePlay()
    } else if (e.key === 'ArrowLeft' && e.shiftKey) {
      e.preventDefault()
      const video = videoRef.current
      if (video) video.currentTime = Math.max(0, video.currentTime - 5)
    } else if (e.key === 'ArrowRight' && e.shiftKey) {
      e.preventDefault()
      const video = videoRef.current
      if (video) video.currentTime = Math.min(duration, video.currentTime + 5)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const video = videoRef.current
      if (video) video.currentTime = Math.max(0, video.currentTime - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      const video = videoRef.current
      if (video) video.currentTime = Math.min(duration, video.currentTime + 1)
    }
  }, [handleTogglePlay, duration])

  // ── Trim processing ─────────────────────────────────────────────────────
  const handleTrim = useCallback(async () => {
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

    trackEvent('trim_started', {
      format: targetFormat,
      fast_trim: effectiveFastTrim,
      duration_s: Math.round(segmentDuration),
    })

    try {
      const config = FORMAT_CONFIG[targetFormat]

      const buildArgs = (inputName: string, outputName: string) =>
        buildTrimArgs(inputName, outputName, startTime, endTime, {
          targetFormat,
          useFastTrim: effectiveFastTrim,
          encoderOptions: !effectiveFastTrim
            ? {
                preset,
                crf,
                resolution,
                frameRate,
                audioCodec: config.audioCodec,
                audioBitrate: config.audioBitrate,
              }
            : undefined,
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

      const trimResult: TrimResult = {
        blob: processResult.blob,
        mimeType: processResult.mimeType,
        targetFormat,
        originalSize: originalFile.size,
        trimmedSize: processResult.blob.size,
        trimmedDuration: segmentDuration,
        metadata: videoMetadata,
        usedStreamCopy: effectiveFastTrim,
      }

      setResult(trimResult)

      // Build preview URL for the trimmed result
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      previewUrlRef.current = URL.createObjectURL(processResult.blob)

      trackEvent('trim_completed', {
        format: targetFormat,
        fast_trim: effectiveFastTrim,
        original_mb: Math.round(originalFile.size / (1024 * 1024)),
        trimmed_mb: Math.round(processResult.blob.size / (1024 * 1024)),
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setIsCancelled(true)
        trackEvent('trim_cancelled', { format: targetFormat })
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Trimming failed. Please try again with a different video file.'
        )
        trackEvent('trim_failed', { error: err instanceof Error ? err.message : 'unknown' })
      }
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }, [
    originalFile, targetFormat, effectiveFastTrim, segmentDuration,
    startTime, endTime, preset, crf, resolution, frameRate, videoMetadata,
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
    setAdvancedMetadata(null)
    setStartTime(0)
    setEndTime(0)
    setStartInput('0:00')
    setEndInput('0:00')
    setTargetFormat('mp4')
    setUseFastTrim(true)
    setPreset('medium')
    setCrf(DEFAULT_CRF)
    setResolution('original')
    setFrameRate('original')
    setResult(null)
    setError(null)
    setIsCancelled(false)
    setIsProcessing(false)
    setProgress(0)
    setThumbnails([])
  }, [])

  const handleRetryUpload = useCallback(() => {
    setError(null)
  }, [])

  // ── Size estimate ──────────────────────────────────────────────────────
  const sizeEstimate = originalFile && !result && needsReencode
    ? estimateOutputSize(
        originalFile.size, duration, startTime, endTime,
        crf, resolution, frameRate, videoMetadata
      )
    : null

  // ── Quick selection presets ──────────────────────────────────────────────
  const handleSelectFirstHalf = useCallback(() => {
    setStartTime(0)
    setEndTime(duration / 2)
    setStartInput('0:00')
    setEndInput(formatTime(duration / 2))
  }, [duration])

  const handleSelectSecondHalf = useCallback(() => {
    setStartTime(duration / 2)
    setEndTime(duration)
    setStartInput(formatTime(duration / 2))
    setEndInput(formatTime(duration))
  }, [duration])

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
            title="Trim Failed"
            message={error}
            onRetry={handleTrim}
          />
        )}

        {/* ── Cancelled ──────────────────────────────────────────────── */}
        {isCancelled && !error && !result && (
          <div className="border border-border rounded-xl p-8 text-center bg-card">
            <Scissors className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Trim Cancelled</h3>
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
                    {advancedMetadata && (
                      <> · {advancedMetadata.fps} fps · {advancedMetadata.codec}</>
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Change File
                </Button>
              </div>

              {/* ── Video Preview ────────────────────────────────────── */}
              <div className="rounded-xl overflow-hidden bg-black relative">
                <video
                  ref={videoRef}
                  src={previewUrlRef.current ?? undefined}
                  className="w-full max-h-96"
                  preload="auto"
                  controls={false}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  onFocus={() => setIsVideoFocused(true)}
                  onBlur={() => setIsVideoFocused(false)}
                  onKeyDown={handleVideoKeyDown}
                  tabIndex={0}
                  aria-label="Video preview player — use arrow keys to seek, Space to play/pause"
                >
                  Your browser does not support the video tag.
                </video>

                {/* Play/Pause overlay button */}
                {!isProcessing && !result && (
                  <button
                    onClick={handleTogglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                    aria-label={isPlaying ? 'Pause' : 'Play selected segment'}
                  >
                    <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
                      {isPlaying ? (
                        <Pause className="w-8 h-8 text-primary-foreground" />
                      ) : (
                        <Play className="w-8 h-8 text-primary-foreground ml-1" />
                      )}
                    </div>
                  </button>
                )}

                {/* Focus indicator */}
                {isVideoFocused && (
                  <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 text-white text-xs">
                    Keyboard controls active
                  </div>
                )}
              </div>

              {/* ── Timeline Editor ──────────────────────────────────── */}
              {!isProcessing && !result && metadataAvailable && duration > 0 && (
                <div className="border border-border rounded-xl p-6 bg-card space-y-4">
                  <h3 className="font-semibold text-lg">Timeline</h3>

                  {/* Thumbnails row */}
                  {thumbnails.length > 0 && (
                    <div className="flex gap-0.5 overflow-hidden rounded-md">
                      {thumbnails.map((thumb, i) => (
                        <img
                          key={i}
                          src={thumb.dataUrl}
                          alt={`Frame at ${formatTime(thumb.time)}`}
                          className="flex-1 h-12 object-cover"
                          style={{ maxWidth: `${100 / thumbnails.length}%` }}
                        />
                      ))}
                    </div>
                  )}
                  {isGeneratingThumbs && (
                    <div className="flex gap-0.5 overflow-hidden rounded-md">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 h-12 bg-muted animate-pulse"
                          style={{ maxWidth: '16.6%' }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Slider */}
                  <Slider
                    min={0}
                    max={duration}
                    step={0.1}
                    value={[startTime, endTime]}
                    onValueChange={handleSliderChange}
                    disabled={isProcessing}
                  />

                  {/* Time inputs row */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-muted-foreground">Start</label>
                      <input
                        type="text"
                        value={startInput}
                        onChange={(e) => setStartInput(e.target.value)}
                        onBlur={handleStartInputBlur}
                        onKeyDown={handleStartInputKeyDown}
                        className="w-24 px-2 py-1 border border-border rounded bg-background text-sm text-center font-mono"
                        disabled={isProcessing}
                        aria-label="Start time"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-muted-foreground">End</label>
                      <input
                        type="text"
                        value={endInput}
                        onChange={(e) => setEndInput(e.target.value)}
                        onBlur={handleEndInputBlur}
                        onKeyDown={handleStartInputKeyDown}
                        className="w-24 px-2 py-1 border border-border rounded bg-background text-sm text-center font-mono"
                        disabled={isProcessing}
                        aria-label="End time"
                      />
                    </div>

                    <div className="text-sm text-muted-foreground">
                      Duration: <span className="font-semibold text-foreground">{formatTime(segmentDuration)}</span>
                    </div>

                    <div className="flex gap-1 ml-auto">
                      <Button variant="outline" size="xs" onClick={handleSelectFirstHalf} disabled={isProcessing}>
                        First Half
                      </Button>
                      <Button variant="outline" size="xs" onClick={handleSelectSecondHalf} disabled={isProcessing}>
                        Second Half
                      </Button>
                    </div>
                  </div>

                  {/* Playback controls */}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon-sm" onClick={handleTogglePlay} disabled={isProcessing} aria-label={isPlaying ? 'Pause' : 'Play segment'}>
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant={isLoopPreview ? 'default' : 'outline'}
                      size="icon-sm"
                      onClick={() => setIsLoopPreview(!isLoopPreview)}
                      disabled={isProcessing}
                      aria-label="Toggle loop preview"
                    >
                      <Repeat className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-6 bg-border mx-1" />
                    <Button variant="outline" size="icon-sm" onClick={stepBack} disabled={isProcessing} aria-label={`Step back 1 frame (${fps} fps)`}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">Frame</span>
                    <Button variant="outline" size="icon-sm" onClick={stepForward} disabled={isProcessing} aria-label={`Step forward 1 frame (${fps} fps)`}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground ml-2">
                      ←→ 1s · Shift 5s · Space play
                    </span>
                  </div>
                </div>
              )}

              {/* ── Progress ──────────────────────────────────────────── */}
              {isProcessing && (
                <div className="space-y-4">
                  <ProcessingStatus message="Trimming video..." />
                  <ProgressBar
                    percent={progress}
                    label="Trim Progress"
                    detail={
                      progress < 5
                        ? 'Initializing...'
                        : progress < 95
                          ? effectiveFastTrim
                            ? 'Copying selected segment...'
                            : 'Processing video...'
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
                    <h3 className="font-semibold text-lg mb-4">Trim Complete</h3>

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
                        <div className="text-xs text-muted-foreground mb-1">Duration</div>
                        <div className="font-semibold text-sm">{formatTime(result.trimmedDuration)}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Method</div>
                        <div className="font-semibold text-sm">
                          {result.usedStreamCopy ? 'Fast Trim' : 'Standard'}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Resolution</div>
                        <div className="font-semibold text-sm">
                          {result.metadata?.width
                            ? `${result.metadata.width}×${result.metadata.height}`
                            : '—'}
                        </div>
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
                        <div className="text-xs text-muted-foreground mb-1">Trimmed</div>
                        <div className="text-2xl font-bold">{formatBytes(result.trimmedSize)}</div>
                        {result.originalSize > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {result.trimmedSize < result.originalSize
                              ? `${Math.round(((result.originalSize - result.trimmedSize) / result.originalSize) * 100)}% smaller`
                              : result.trimmedSize > result.originalSize
                                ? `${Math.round(((result.trimmedSize - result.originalSize) / result.originalSize) * 100)}% larger`
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
                      Trim Another
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
                    <h3 className="font-semibold text-lg">Trim Settings</h3>

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

                    {/* Fast Trim toggle */}
                    <div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useFastTrim}
                          onChange={(e) => setUseFastTrim(e.target.checked)}
                          className="w-4 h-4 accent-primary"
                          disabled={!isStreamCopyPossible}
                        />
                        <div>
                          <span className="text-sm font-medium">Fast Trim (instant processing)</span>
                          {!isStreamCopyPossible && (
                            <p className="text-xs text-muted-foreground">
                              Unavailable — input format differs from output format.
                            </p>
                          )}
                        </div>
                      </label>
                      {effectiveFastTrim && (
                        <div className="mt-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                          <p className="text-xs text-green-800 dark:text-green-200">
                            ⚡ Fast Trim: near-instant, trims on nearest keyframe.
                            Disable for frame-accurate cuts.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Re-encode options (only when not using fast trim) */}
                    {needsReencode && (
                      <>
                        <div className="border-t border-border pt-4">
                          <p className="text-xs text-muted-foreground mb-4">
                            Standard processing is needed for this trim. Configure quality options below.
                          </p>

                          {/* Preset */}
                          <div className="mb-4">
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
                          <div className="mb-4">
                            <label className="text-sm font-medium flex justify-between">
                              <span>Quality</span>
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

                          {/* Resolution */}
                          <div className="mb-4">
                            <label className="text-sm font-medium flex justify-between">
                              <span>Resolution</span>
                              <span className="text-primary font-semibold">
                                {resolution === 'original' ? 'Original' : resolution}
                              </span>
                            </label>
                            <select
                              value={resolution}
                              onChange={(e) => setResolution(e.target.value as VideoResolution)}
                              className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                            >
                              {RESOLUTION_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Frame Rate */}
                          <div className="mb-4">
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

                          {/* Estimated size */}
                          {sizeEstimate && (
                            <div className="p-3 rounded-lg bg-background border border-border">
                              <div className="text-xs text-muted-foreground mb-1">
                                Estimated Output Size
                              </div>
                              <div className="text-lg font-bold">
                                {formatBytes(sizeEstimate.min)} – {formatBytes(sizeEstimate.max)}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Approximate — actual size varies by content.
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Trim button */}
                    <Button
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={!originalFile || segmentDuration < 1}
                      onClick={handleTrim}
                    >
                      <Scissors className="w-4 h-4 mr-2" />
                      {segmentDuration < 1 ? 'Select at least 1 second' : 'Trim Video'}
                    </Button>
                  </div>
                )}

                {/* PROCESSING */}
                {isProcessing && (
                  <div className="border border-border rounded-xl p-6 bg-muted/30">
                    <h3 className="font-semibold text-lg mb-6">Trim Settings</h3>
                    <div className="space-y-3 opacity-50 pointer-events-none">
                      <div>
                        <label className="text-sm font-medium">Output Format</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm uppercase">
                          {targetFormat}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Method</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                          {effectiveFastTrim ? 'Fast Trim' : 'Standard Processing'}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Segment</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                          {formatTime(startTime)} – {formatTime(endTime)}
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
                        Trim Another Video
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
          <h2 className="text-2xl font-bold mb-6">How to Trim a Video</h2>
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
