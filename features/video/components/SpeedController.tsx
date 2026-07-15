'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Download, RotateCcw, Film, Gauge } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { processVideo } from '@/features/video/utils/videoProcessor'
import { getBasicMetadata, preloadFFmpeg } from '@/features/video/utils/videoMetadata'
import { buildSpeedArgs } from '@/features/video/utils/videoSpeedController'
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
  SpeedResult,
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

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

const TOOL_FAQS = [
  {
    question: 'What speed range is supported?',
    answer:
      '0.25× (quarter speed, slow motion) to 4× (quadruple speed). Speeds below 0.5× and above 2× use multi-stage audio processing to stay within the time-stretch filter\'s operating range while still producing accurate results.',
  },
  {
    question: 'Does changing speed affect audio pitch?',
    answer:
      'No! We use a genuine time-stretch algorithm (atempo) that preserves the original pitch at all speeds. Voices sound natural — not chipmunked at high speed or deep and slurred at low speed. The audio stays perfectly in sync with the video for the entire duration.',
  },
  {
    question: 'Does changing speed affect video quality?',
    answer:
      'Both video and audio must be re-encoded to adjust the speed while keeping everything in sync. We use high-quality H.264 encoding (CRF 23 by default) for video and the output format\'s standard audio codec. You can adjust the quality using the CRF slider.',
  },
  {
    question: 'Is my video uploaded to a server?',
    answer:
      'No. All video speed processing happens entirely in your browser. Your videos never leave your device — they remain 100% private and secure.',
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
    title: 'Set your desired speed',
    desc: 'Pick a preset (0.25× to 4×), drag the slider, or type a custom value. The live preview updates immediately — press play to hear the speed change. The duration preview shows how long the output will be.',
  },
  {
    step: 3,
    title: 'Download your video',
    desc: 'Click Change Speed, wait for the progress bar, then preview and download your speed-adjusted clip. The entire process runs locally in your browser.',
  },
]

// ─── Analytics ────────────────────────────────────────────────────────────────

function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    ;(window as any).gtag('event', name, props)
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SpeedController() {
  // ── Core state ──────────────────────────────────────────────────────────
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const [hasAudio, setHasAudio] = useState(true) // default: assume audio

  // ── Speed state ─────────────────────────────────────────────────────────
  const [speed, setSpeed] = useState(1)
  const [speedInput, setSpeedInput] = useState('1')

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
  const [result, setResult] = useState<SpeedResult | null>(null)
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
  const outputDuration = speed > 0 ? duration / speed : 0

  // ── Sync metadata ref ───────────────────────────────────────────────────
  useEffect(() => {
    metadataRef.current = videoMetadata
  }, [videoMetadata])

  // ── Sync playbackRate ───────────────────────────────────────────────────
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed
    }
  }, [speed])

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
      // Reset playbackRate on unmount
      if (videoRef.current) {
        videoRef.current.playbackRate = 1
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  // ── Detect audio presence ──────────────────────────────────────────────

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
    setHasAudio(true)
    setResult(null)
    setError(null)
    setIsCancelled(false)
    setProgress(0)
    setSpeed(1)
    setSpeedInput('1')

    // Reset playbackRate on new file
    if (videoRef.current) {
      videoRef.current.playbackRate = 1
    }

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

    trackEvent('video_uploaded', {
      format: file.name.split('.').pop()?.toLowerCase(),
      size_mb: Math.round(file.size / (1024 * 1024)),
    })

    preloadFFmpeg()
  }, [])

  // ── Detect audio after video element mounts ─────────────────────────────

  const handleVideoLoaded = useCallback(() => {
    if (videoRef.current) {
      setHasAudio(detectAudio(videoRef.current))
    }
  }, [detectAudio])

  // ── Speed handlers ──────────────────────────────────────────────────────

  const handleSpeedChange = useCallback((newSpeed: number) => {
    const clamped = Math.max(0.25, Math.min(4, Math.round(newSpeed * 100) / 100))
    setSpeed(clamped)
    setSpeedInput(String(clamped))
  }, [])

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleSpeedChange(Number(e.target.value))
  }, [handleSpeedChange])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSpeedInput(e.target.value)
  }, [])

  const handleInputBlur = useCallback(() => {
    const parsed = parseFloat(speedInput)
    if (isNaN(parsed) || parsed <= 0) {
      // Reset to current valid speed
      setSpeedInput(String(speed))
    } else {
      handleSpeedChange(parsed)
    }
  }, [speedInput, speed, handleSpeedChange])

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur()
    }
  }, [])

  const handlePreset = useCallback((presetSpeed: number) => {
    handleSpeedChange(presetSpeed)
  }, [handleSpeedChange])

  // ── Reset speed ─────────────────────────────────────────────────────────

  const handleResetSpeed = useCallback(() => {
    handleSpeedChange(1)
  }, [handleSpeedChange])

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

    trackEvent('speed_started', {
      format: targetFormat,
      speed,
    })

    try {
      const config = FORMAT_CONFIG[targetFormat]

      const buildArgs = (inputName: string, outputName: string) =>
        buildSpeedArgs(inputName, outputName, {
          speed,
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

      const speedResult: SpeedResult = {
        blob: processResult.blob,
        mimeType: processResult.mimeType,
        targetFormat,
        originalSize: originalFile.size,
        outputSize: processResult.blob.size,
        speed,
        originalDuration: duration,
        outputDuration,
        metadata: videoMetadata,
      }

      setResult(speedResult)

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      previewUrlRef.current = URL.createObjectURL(processResult.blob)

      trackEvent('speed_completed', {
        format: targetFormat,
        speed,
        original_mb: Math.round(originalFile.size / (1024 * 1024)),
        output_mb: Math.round(processResult.blob.size / (1024 * 1024)),
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setIsCancelled(true)
        trackEvent('speed_cancelled', { format: targetFormat })
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Speed adjustment failed. Please try again with a different video file.'
        )
        trackEvent('speed_failed', { error: err instanceof Error ? err.message : 'unknown' })
      }
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }, [originalFile, videoMetadata, speed, hasAudio, targetFormat, preset, crf, frameRate, duration, outputDuration])

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
    if (videoRef.current) {
      videoRef.current.playbackRate = 1
    }
    setOriginalFile(null)
    setVideoMetadata(null)
    setHasAudio(true)
    setSpeed(1)
    setSpeedInput('1')
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
            title="Speed Change Failed"
            message={error}
            onRetry={handleProcess}
          />
        )}

        {/* ── Cancelled ──────────────────────────────────────────────── */}
        {isCancelled && !error && !result && (
          <div className="border border-border rounded-xl p-8 text-center bg-card">
            <Gauge className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Speed Change Cancelled</h3>
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
                    {metadataAvailable && (
                      <> · {hasAudio ? 'Audio' : 'No audio'}</>
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
                </div>
              )}

              {/* ── Speed Controls ───────────────────────────────────── */}
              {!isProcessing && !result && originalFile && (
                <div className="border border-border rounded-xl p-6 bg-card space-y-5">
                  <h3 className="font-semibold text-lg">Playback Speed</h3>

                  {/* Preset buttons */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Presets
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SPEED_PRESETS.map((presetSpeed) => (
                        <button
                          key={presetSpeed}
                          onClick={() => handlePreset(presetSpeed)}
                          className={cn(
                            'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                            speed === presetSpeed
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border bg-card hover:bg-muted/50 text-foreground',
                          )}
                        >
                          {presetSpeed}×
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Slider */}
                  <div>
                    <label className="text-sm font-medium flex justify-between mb-2">
                      <span className="text-muted-foreground">Custom Speed</span>
                      <span className="font-semibold font-mono">{speed.toFixed(2)}×</span>
                    </label>
                    <input
                      type="range"
                      min={0.25}
                      max={4}
                      step={0.05}
                      value={speed}
                      onChange={handleSliderChange}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>0.25×</span>
                      <span>1×</span>
                      <span>2×</span>
                      <span>3×</span>
                      <span>4×</span>
                    </div>
                  </div>

                  {/* Manual input + reset */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={speedInput}
                        onChange={handleInputChange}
                        onBlur={handleInputBlur}
                        onKeyDown={handleInputKeyDown}
                        className="w-20 px-2 py-1.5 border border-border rounded-lg bg-background text-sm text-center font-mono"
                        aria-label="Speed value"
                      />
                      <span className="text-muted-foreground text-sm">×</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleResetSpeed}>
                      Reset to 1×
                    </Button>
                  </div>

                  {/* Duration preview */}
                  {duration > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-muted/30 text-center">
                        <div className="text-xs text-muted-foreground mb-1">Original Duration</div>
                        <div className="text-lg font-bold font-mono">{formatDuration(duration)}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30 text-center">
                        <div className="text-xs text-muted-foreground mb-1">
                          New Duration ({speed.toFixed(2)}×)
                        </div>
                        <div className="text-lg font-bold font-mono">{formatDuration(outputDuration)}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Progress ──────────────────────────────────────────── */}
              {isProcessing && (
                <div className="space-y-4">
                  <ProcessingStatus message="Changing video speed..." />
                  <ProgressBar
                    percent={progress}
                    label="Processing Progress"
                    detail={
                      progress < 5
                        ? 'Initializing...'
                        : progress < 95
                          ? 'Processing video and audio...'
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
                    <h3 className="font-semibold text-lg mb-4">Speed Change Complete</h3>

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
                        <div className="text-xs text-muted-foreground mb-1">Speed</div>
                        <div className="font-semibold text-sm font-mono">{result.speed.toFixed(2)}×</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Duration</div>
                        <div className="font-semibold text-sm font-mono">{formatDuration(result.outputDuration)}</div>
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
                      Change Another
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
                        Speed changes require re-encoding both video and audio.
                        {!hasAudio && ' No audio stream detected — processing video only.'}
                      </p>
                    </div>

                    {/* Action button */}
                    <Button
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={!originalFile || speed === 1}
                      onClick={handleProcess}
                    >
                      <Gauge className="w-4 h-4 mr-2" />
                      {speed === 1 ? 'No change needed' : `Change Speed to ${speed.toFixed(2)}×`}
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
                        <label className="text-sm font-medium">Speed</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono">
                          {speed.toFixed(2)}×
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
                        Change Another Video
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
          <h2 className="text-2xl font-bold mb-6">How to Change Video Speed</h2>
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
