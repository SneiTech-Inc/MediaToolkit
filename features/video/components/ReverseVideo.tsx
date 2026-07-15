'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Download, RotateCcw, Film, Rewind, AlertTriangle } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { getBasicMetadata, getAdvancedMetadata, preloadFFmpeg } from '@/features/video/utils/videoMetadata'
import { FORMAT_CONFIG, DEFAULT_CRF, MIN_CRF, MAX_CRF } from '@/features/video/types'
import { MAX_FILE_SIZE_TRIM } from '@/features/video/utils/videoValidation'
import { cn } from '@/lib/utils'
import { getSaveVexFileName } from '@/utils/fileNames'
import { formatBytes } from '@/utils/formatBytes'
import { formatTime, formatDuration } from '@/features/video/utils/videoTimeline'
import {
  estimateReverseMemoryUsage,
  canSafelyReverse,
  formatReverseMemoryEstimate,
  reverseVideo,
} from '@/features/video/utils/videoReverser'
import type {
  VideoOutputFormat,
  VideoPreset,
  VideoFrameRate,
  VideoMetadata,
  ExtendedVideoMetadata,
  ReverseResult,
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

const TOOL_FAQS = [
  {
    question: 'What video formats are supported?',
    answer:
      'MP4, WebM, MOV, AVI, and MKV are supported as input formats. Output formats include MP4, MOV, AVI, and MKV.',
  },
  {
    question: 'Does reversing a video affect audio?',
    answer:
      'Yes! If your video has an audio track, the audio is also reversed to stay perfectly in sync with the reversed video. For video-only files (like screen recordings or security footage), only the video stream is processed.',
  },
  {
    question: 'Does reversing change the video duration?',
    answer:
      'No, the duration stays exactly the same — the video just plays backwards from end to start. A 30-second video reversed is still 30 seconds long.',
  },
  {
    question: 'Why might my video be blocked from reversing?',
    answer:
      'Reversing video is uniquely memory-intensive — our video processing technology must buffer the entire decoded video in browser memory before it can produce any output (unlike trimming, cropping, or speed changes which process frame-by-frame). A 1080p video needs roughly 90 MB of buffer memory per second. Very long or high-resolution videos may exceed safe browser memory limits. The recommended workaround is to trim your video to a shorter segment first using our Trim Video tool, then reverse the shorter clip.',
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
    desc: 'Click or drag and drop a video file (up to 500 MB). File info appears instantly — we check resolution and duration to ensure reversing will fit in browser memory.',
  },
  {
    step: 2,
    title: 'Configure output settings',
    desc: 'Choose your output format, encoding preset, quality level (CRF), and frame rate. All options work the same as our other video tools.',
  },
  {
    step: 3,
    title: 'Reverse and download',
    desc: 'Click Reverse Video, wait for the progress bar to complete, then preview and download your reversed video. The entire process runs locally in your browser.',
  },
]

// ─── Analytics ────────────────────────────────────────────────────────────────

function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    ;(window as any).gtag('event', name, props)
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReverseVideo() {
  // ── Core state ──────────────────────────────────────────────────────────
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const [advancedMetadata, setAdvancedMetadata] = useState<ExtendedVideoMetadata | null>(null)
  const [hasAudio, setHasAudio] = useState(true) // default: assume audio (safe fallback)

  // ── Memory guard state ───────────────────────────────────────────────────
  const [memoryEstimate, setMemoryEstimate] = useState<number | null>(null)
  const [canReverse, setCanReverse] = useState(true)
  const [memoryWarning, setMemoryWarning] = useState<string | null>(null)
  const [isProbingFps, setIsProbingFps] = useState(false)

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
  const [result, setResult] = useState<ReverseResult | null>(null)
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

  // ── Compute memory estimate from metadata ───────────────────────────────

  const computeMemoryGuard = useCallback(
    (metadata: VideoMetadata, realFps?: number) => {
      const { width, height, duration: dur } = metadata
      if (width <= 0 || height <= 0 || dur <= 0) {
        setCanReverse(true)
        setMemoryEstimate(null)
        setMemoryWarning(null)
        return
      }

      const fps = realFps ?? 30
      const estimate = estimateReverseMemoryUsage(width, height, dur, fps)
      const safe = canSafelyReverse(width, height, dur, fps)

      setMemoryEstimate(estimate)
      setCanReverse(safe)

      if (!safe) {
        const formattedEstimate = formatReverseMemoryEstimate(estimate)
        const maxMb = 1024
        setMemoryWarning(
          `This video requires approximately ${formattedEstimate} of decoded memory to reverse. Reversing requires buffering the entire video in browser memory (~90 MB per second at 1080p), and this clip exceeds the safe limit of ~${maxMb} MB. Try trimming a shorter segment first using our Trim Video tool, then reverse the shorter clip.`,
        )
      } else {
        setMemoryWarning(null)
      }
    },
    [],
  )

  // ── Detect audio presence from video element ────────────────────────────

  const detectAudio = useCallback((video: HTMLVideoElement): boolean => {
    // Firefox
    if (typeof (video as any).mozHasAudio === 'boolean') {
      return (video as any).mozHasAudio
    }
    // Chrome/Edge/Safari — audioTracks API
    const audioTracks = (video as any).audioTracks
    if (audioTracks && audioTracks.length !== undefined) {
      return audioTracks.length > 0
    }
    // Fallback: assume audio exists (safe — filter_complex handles it)
    return true
  }, [])

  // ── File selection ──────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: File) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    abortControllerRef.current?.abort()

    setOriginalFile(null)
    setVideoMetadata(null)
    setAdvancedMetadata(null)
    setHasAudio(true)
    setMemoryEstimate(null)
    setCanReverse(true)
    setMemoryWarning(null)
    setIsProbingFps(false)
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

    if (metadata) {
      // Phase 1: conservative memory check with fps=30
      computeMemoryGuard(metadata)
    }

    trackEvent('video_uploaded', {
      format: file.name.split('.').pop()?.toLowerCase(),
      size_mb: Math.round(file.size / (1024 * 1024)),
      tool: 'reverse-video',
    })

    preloadFFmpeg()
  }, [computeMemoryGuard])

  // ── Phase 2: Advanced metadata probe (background) ───────────────────────

  useEffect(() => {
    if (!originalFile || !videoMetadata) return

    let cancelled = false

    const probeAdvanced = async () => {
      setIsProbingFps(true)
      try {
        const ffmpeg = (await import('@/features/audio/utils/ffmpegClient')).getFFmpeg
        const ffmpegInstance = await ffmpeg()
        if (cancelled) return

        const advanced = await getAdvancedMetadata(ffmpegInstance, originalFile, videoMetadata)
        if (cancelled) return

        setAdvancedMetadata(advanced)

        // Update audio detection from ffmpeg probe (more reliable than DOM API)
        if (advanced.audioCodec && advanced.audioCodec !== 'none') {
          setHasAudio(true)
        } else if (advanced.audioCodec === 'none') {
          setHasAudio(false)
        }

        // Re-check memory estimate with real FPS
        computeMemoryGuard(videoMetadata, advanced.fps)
      } catch {
        // Graceful degradation — keep the conservative estimate
      } finally {
        if (!cancelled) {
          setIsProbingFps(false)
        }
      }
    }

    probeAdvanced()

    return () => {
      cancelled = true
    }
  }, [originalFile, videoMetadata, computeMemoryGuard])

  // ── Detect audio after video element mounts ─────────────────────────────

  const handleVideoLoaded = useCallback(() => {
    if (videoRef.current) {
      // DOM-based detection as a fallback; ffmpeg probe overrides this
      setHasAudio(detectAudio(videoRef.current))
    }
  }, [detectAudio])

  // ── Processing ──────────────────────────────────────────────────────────

  const handleProcess = useCallback(async () => {
    if (!originalFile || !canReverse) return

    setError(null)
    setIsCancelled(false)
    setIsProcessing(true)
    setProgress(0)
    setElapsedSeconds(0)
    setEstimatedRemaining(0)
    setResult(null)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    trackEvent('reverse_started', {
      format: targetFormat,
    })

    try {
      const config = FORMAT_CONFIG[targetFormat]

      const reverseResult = await reverseVideo({
        file: originalFile,
        hasAudio,
        targetFormat,
        encoderOptions: {
          preset,
          crf,
          resolution: 'original',
          frameRate,
          audioCodec: config.audioCodec,
          audioBitrate: config.audioBitrate,
        },
        onProgress: (pct, elapsed, remaining) => {
          setProgress(pct)
          setElapsedSeconds(elapsed)
          setEstimatedRemaining(remaining)
        },
        signal: abortController.signal,
      })

      // Attach metadata from component state
      const finalResult: ReverseResult = {
        ...reverseResult,
        metadata: videoMetadata,
      }

      setResult(finalResult)

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      previewUrlRef.current = URL.createObjectURL(reverseResult.blob)

      trackEvent('reverse_completed', {
        format: targetFormat,
        original_mb: Math.round(originalFile.size / (1024 * 1024)),
        output_mb: Math.round(reverseResult.blob.size / (1024 * 1024)),
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setIsCancelled(true)
        trackEvent('reverse_cancelled', { format: targetFormat })
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Reverse failed. Please try again with a different video file.',
        )
        trackEvent('reverse_failed', { error: err instanceof Error ? err.message : 'unknown' })
      }
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }, [originalFile, canReverse, hasAudio, targetFormat, preset, crf, frameRate, videoMetadata])

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
    setHasAudio(true)
    setMemoryEstimate(null)
    setCanReverse(true)
    setMemoryWarning(null)
    setIsProbingFps(false)
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
            title="Reverse Failed"
            message={error}
            onRetry={handleProcess}
          />
        )}

        {/* ── Cancelled ──────────────────────────────────────────────── */}
        {isCancelled && !error && !result && (
          <div className="border border-border rounded-xl p-8 text-center bg-card">
            <Rewind className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Reverse Cancelled</h3>
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
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                  <Film className="w-5 h-5 text-purple-600 dark:text-purple-400" />
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
                    {metadataAvailable && (
                      <> · {hasAudio ? 'Audio' : 'No audio'}</>
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Change File
                </Button>
              </div>

              {/* ── Memory Warning ───────────────────────────────────── */}
              {memoryWarning && !isProcessing && !result && (
                <div className="border border-amber-200 dark:border-amber-800 rounded-xl p-6 bg-amber-50 dark:bg-amber-950/30">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                        Memory Limit Exceeded
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        {memoryWarning}
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        <a
                          href="/tools/video/trim-video"
                          className="font-medium underline hover:no-underline"
                        >
                          Open Trim Video →
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── FPS probing indicator ─────────────────────────────── */}
              {isProbingFps && !memoryWarning && !isProcessing && !result && (
                <div className="border border-border rounded-xl p-4 bg-muted/30 text-center">
                  <p className="text-sm text-muted-foreground">
                    Analyzing video properties to confirm reverse compatibility...
                  </p>
                </div>
              )}

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
                </div>
              )}

              {/* ── Info Panel ────────────────────────────────────────── */}
              {!isProcessing && !result && originalFile && !memoryWarning && (
                <div className="border border-border rounded-xl p-6 bg-card space-y-4">
                  <h3 className="font-semibold text-lg">About Reverse Video</h3>
                  <p className="text-sm text-muted-foreground">
                    Reversing plays your video backwards — from end to start. The duration
                    stays exactly the same. If your video has audio, it will also be reversed
                    to stay in sync.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <div className="text-xs text-muted-foreground mb-1">Duration</div>
                      <div className="text-lg font-bold font-mono">
                        {duration > 0 ? formatDuration(duration) : '--:--'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Stays the same</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <div className="text-xs text-muted-foreground mb-1">Encoding</div>
                      <div className="text-lg font-bold">Re-encode</div>
                      <div className="text-xs text-muted-foreground mt-1">Full re-encode required</div>
                    </div>
                  </div>
                  {memoryEstimate !== null && memoryEstimate > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      Estimated buffer: {formatReverseMemoryEstimate(memoryEstimate)} · Safe limit: ~1,024 MB
                    </p>
                  )}
                </div>
              )}

              {/* ── Progress ──────────────────────────────────────────── */}
              {isProcessing && (
                <div className="space-y-4">
                  <ProcessingStatus message="Reversing video..." />
                  <ProgressBar
                    percent={progress}
                    label="Processing Progress"
                    detail={
                      progress < 5
                        ? 'Initializing...'
                        : progress < 95
                          ? 'Reversing video and audio...'
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
                    <h3 className="font-semibold text-lg mb-4">Reverse Complete</h3>

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
                        <div className="font-semibold text-sm font-mono">
                          {duration > 0 ? formatDuration(duration) : '--:--'}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Audio</div>
                        <div className="font-semibold text-sm">
                          {result.hasAudio ? 'Reversed' : 'None'}
                        </div>
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
                        <div className="text-xs text-muted-foreground mb-1">Output</div>
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
                      Download {result.targetFormat.toUpperCase()}
                    </Button>
                    <Button size="lg" variant="outline" onClick={handleReset}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reverse Another
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

                    {/* Re-encode notice */}
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        Reversing always requires full re-encoding of both video and audio.
                        {!hasAudio && ' No audio stream detected — processing video only.'}
                      </p>
                    </div>

                    {/* Action button */}
                    <Button
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={!originalFile || !canReverse || isProbingFps}
                      onClick={handleProcess}
                    >
                      <Rewind className="w-4 h-4 mr-2" />
                      {!canReverse
                        ? 'Video too long to reverse'
                        : isProbingFps
                          ? 'Analyzing video...'
                          : 'Reverse Video'}
                    </Button>

                    {/* Memory estimate footnote */}
                    {memoryEstimate !== null && memoryEstimate > 0 && canReverse && (
                      <p className="text-xs text-muted-foreground text-center">
                        Estimated memory: {formatReverseMemoryEstimate(memoryEstimate)}
                      </p>
                    )}
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
                        <label className="text-sm font-medium">Audio</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                          {hasAudio ? 'Reversing audio too' : 'Video only'}
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
                        Reverse Another Video
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
          <h2 className="text-2xl font-bold mb-6">How to Reverse a Video</h2>
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
