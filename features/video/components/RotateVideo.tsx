'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Download, RotateCcw, Film, RotateCw, FlipHorizontal, FlipVertical,
} from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { processVideo } from '@/features/video/utils/videoProcessor'
import { getBasicMetadata, preloadFFmpeg } from '@/features/video/utils/videoMetadata'
import { buildRotateArgs } from '@/features/video/utils/videoRotator'
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
  RotateResult,
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

const SNAP_POINTS = [0, 90, 180, 270, 360]
const SNAP_THRESHOLD = 3

const FILL_COLORS = [
  { value: 'black', label: 'Black', swatch: '#000000', requiresAlpha: false },
  { value: 'white', label: 'White', swatch: '#ffffff', requiresAlpha: false },
  { value: 'black@0', label: 'Transparent', swatch: 'transparent', requiresAlpha: true },
]

const TOOL_FAQS = [
  {
    question: 'What video formats are supported for rotating?',
    answer:
      'You can upload MP4, WebM, MOV, AVI, and MKV files. Output formats are MP4, MOV, AVI, and MKV — all using high-quality H.264 encoding for wide compatibility.',
  },
  {
    question: 'What rotation options are available?',
    answer:
      'Use the quick buttons for 90° clockwise, 90° counter-clockwise, or 180° rotation. Toggle Flip Horizontal or Flip Vertical independently — flips can be combined with any rotation. For full control, drag the angle slider (0–360°) which snaps to 0°, 90°, 180°, 270°, and 360° for quick selection of standard angles.',
  },
  {
    question: 'Does rotating a video affect quality?',
    answer:
      'Rotation always requires re-encoding the video stream — stream copy is not possible with rotation. We use a dedicated, lossless transpose filter for exact 90°/180°/270° angles, so there is no quality loss beyond what the re-encode itself introduces. We encode at CRF 23 (high quality) by default. The audio stream is passed through without re-encoding, so audio quality is preserved.',
  },
  {
    question: 'Why do custom angles add black corners?',
    answer:
      'When rotating by an angle that is not a multiple of 90° (e.g., 45°), the video frame must grow to contain the rotated image. The empty triangular corners are filled with your selected fill color — black by default, or choose white/transparent. For exact 90°/180°/270° rotations, the frame dimensions stay the same and there are no added borders. Enable the Auto-crop option to automatically remove the corner fill for custom angles.',
  },
  {
    question: 'Is my video uploaded to a server?',
    answer:
      'No. All video rotating and flipping happens entirely in your browser using FFmpeg compiled to WebAssembly. Your videos never leave your device — they remain 100% private and secure.',
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
    title: 'Choose your rotation',
    desc: 'Use the quick buttons (90° CW, 90° CCW, 180°) for common angles, toggle Flip Horizontal or Flip Vertical for mirroring, or drag the angle slider for precise control. The live preview updates in real time so you can see exactly what the output will look like.',
  },
  {
    step: 3,
    title: 'Download your rotated video',
    desc: 'Click Rotate Video, wait for the progress bar, then preview and download your rotated clip. The entire process runs locally in your browser.',
  },
]

// ─── Snap helper ─────────────────────────────────────────────────────────────

function snapAngle(raw: number): number {
  for (const point of SNAP_POINTS) {
    if (Math.abs(raw - point) <= SNAP_THRESHOLD) return point
  }
  return raw
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    ;(window as any).gtag('event', name, props)
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RotateVideo() {
  // ── Core state ──────────────────────────────────────────────────────────
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)

  // ── Rotation state ──────────────────────────────────────────────────────
  const [angle, setAngle] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [fillColor, setFillColor] = useState('black')
  const [autoCrop, setAutoCrop] = useState(false)

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
  const [result, setResult] = useState<RotateResult | null>(null)
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
  const isFreeAngle = !SNAP_POINTS.includes(((angle % 360) + 360) % 360)

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
    setAngle(0)
    setFlipH(false)
    setFlipV(false)
    setFillColor('black')
    setAutoCrop(false)

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

  // ── Quick rotate buttons ────────────────────────────────────────────────

  const handleQuickRotate = useCallback((degrees: number) => {
    setAngle(degrees)
  }, [])

  // ── Angle slider ────────────────────────────────────────────────────────

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Number(e.target.value)
    setAngle(snapAngle(raw))
  }, [])

  // ── Processing ──────────────────────────────────────────────────────────

  const handleRotate = useCallback(async () => {
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

    trackEvent('rotate_started', {
      format: targetFormat,
      angle,
      flipH,
      flipV,
    })

    try {
      const config = FORMAT_CONFIG[targetFormat]

      const buildArgs = (inputName: string, outputName: string) =>
        buildRotateArgs(inputName, outputName, {
          angle,
          flipH,
          flipV,
          fillColor,
          autoCrop,
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

      const rotateResult: RotateResult = {
        blob: processResult.blob,
        mimeType: processResult.mimeType,
        targetFormat,
        originalSize: originalFile.size,
        rotatedSize: processResult.blob.size,
        angle,
        flipH,
        flipV,
        metadata: videoMetadata,
      }

      setResult(rotateResult)

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      previewUrlRef.current = URL.createObjectURL(processResult.blob)

      trackEvent('rotate_completed', {
        format: targetFormat,
        angle,
        original_mb: Math.round(originalFile.size / (1024 * 1024)),
        rotated_mb: Math.round(processResult.blob.size / (1024 * 1024)),
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setIsCancelled(true)
        trackEvent('rotate_cancelled', { format: targetFormat })
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Rotation failed. Please try again with a different video file.'
        )
        trackEvent('rotate_failed', { error: err instanceof Error ? err.message : 'unknown' })
      }
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }, [originalFile, videoMetadata, angle, flipH, flipV, fillColor, autoCrop, targetFormat, preset, crf, frameRate])

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
    setAngle(0)
    setFlipH(false)
    setFlipV(false)
    setFillColor('black')
    setAutoCrop(false)
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

  // ── CSS transform for live preview ──────────────────────────────────────

  const previewTransform = `rotate(${angle}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`

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
            title="Rotation Failed"
            message={error}
            onRetry={handleRotate}
          />
        )}

        {/* ── Cancelled ──────────────────────────────────────────────── */}
        {isCancelled && !error && !result && (
          <div className="border border-border rounded-xl p-8 text-center bg-card">
            <RotateCw className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Rotation Cancelled</h3>
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
                  style={{ overflow: 'hidden' }}
                >
                  <video
                    ref={videoRef}
                    src={previewUrlRef.current ?? undefined}
                    className="w-full block"
                    preload="auto"
                    controls={false}
                    draggable={false}
                    style={{ transform: previewTransform }}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              {/* ── Rotation Controls ────────────────────────────────── */}
              {!isProcessing && !result && originalFile && (
                <div className="border border-border rounded-xl p-6 bg-card space-y-5">
                  <h3 className="font-semibold text-lg">Rotation Controls</h3>

                  {/* Quick rotate buttons */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Quick Rotate
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={angle === 90 ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleQuickRotate(90)}
                      >
                        <RotateCw className="w-4 h-4 mr-1" />
                        90° CW
                      </Button>
                      <Button
                        variant={angle === 270 ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleQuickRotate(270)}
                      >
                        <RotateCw className="w-4 h-4 mr-1 rotate-180" />
                        90° CCW
                      </Button>
                      <Button
                        variant={angle === 180 ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleQuickRotate(180)}
                      >
                        180°
                      </Button>
                      <Button
                        variant={angle === 0 ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleQuickRotate(0)}
                      >
                        0° (Reset)
                      </Button>
                    </div>
                  </div>

                  {/* Flip toggles */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Flip
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setFlipH(!flipH)}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm',
                          flipH
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border bg-card hover:bg-muted/50 text-foreground',
                        )}
                      >
                        <FlipHorizontal className="w-4 h-4" />
                        Flip Horizontal
                      </button>
                      <button
                        onClick={() => setFlipV(!flipV)}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm',
                          flipV
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border bg-card hover:bg-muted/50 text-foreground',
                        )}
                      >
                        <FlipVertical className="w-4 h-4" />
                        Flip Vertical
                      </button>
                    </div>
                  </div>

                  {/* Angle slider */}
                  <div>
                    <label className="text-sm font-medium flex justify-between mb-2">
                      <span className="text-muted-foreground">Custom Angle</span>
                      <span className="font-semibold">
                        {angle}°
                        {!isFreeAngle && angle !== 0 && (
                          <span className="ml-1 text-xs text-green-600 dark:text-green-400 font-normal">
                            (optimized)
                          </span>
                        )}
                      </span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      step={1}
                      value={angle}
                      onChange={handleSliderChange}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>0°</span>
                      <span>90°</span>
                      <span>180°</span>
                      <span>270°</span>
                      <span>360°</span>
                    </div>
                    {isFreeAngle && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        Custom angle — will add {fillColor === 'black@0' ? 'transparent' : fillColor} corner fill.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Progress ──────────────────────────────────────────── */}
              {isProcessing && (
                <div className="space-y-4">
                  <ProcessingStatus message="Rotating video..." />
                  <ProgressBar
                    percent={progress}
                    label="Rotation Progress"
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
                    <h3 className="font-semibold text-lg mb-4">Rotation Complete</h3>

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
                        <div className="text-xs text-muted-foreground mb-1">Angle</div>
                        <div className="font-semibold text-sm">
                          {result.angle}°
                          {result.flipH && ' + H'}
                          {result.flipV && ' + V'}
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
                        <div className="text-xs text-muted-foreground mb-1">Rotated</div>
                        <div className="text-2xl font-bold">{formatBytes(result.rotatedSize)}</div>
                        {result.originalSize > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {result.rotatedSize < result.originalSize
                              ? `${Math.round(((result.originalSize - result.rotatedSize) / result.originalSize) * 100)}% smaller`
                              : result.rotatedSize > result.originalSize
                                ? `${Math.round(((result.rotatedSize - result.originalSize) / result.originalSize) * 100)}% larger`
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
                      Rotate Another
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

                    {/* Fill Color */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Corner Fill Color
                      </label>
                      <div className="flex gap-2">
                        {FILL_COLORS.map((color) => {
                          const disabled = color.requiresAlpha && targetFormat === 'mp4'
                          return (
                            <button
                              key={color.value}
                              onClick={() => setFillColor(color.value)}
                              disabled={disabled}
                              className={cn(
                                'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors',
                                fillColor === color.value
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : disabled
                                    ? 'border-border bg-muted/30 text-muted-foreground cursor-not-allowed'
                                    : 'border-border bg-card hover:bg-muted/50 text-foreground',
                              )}
                              title={
                                disabled
                                  ? 'Transparent fill requires WebM output (MP4 does not support alpha)'
                                  : color.label
                              }
                            >
                              <span
                                className="w-4 h-4 rounded border border-border shrink-0"
                                style={{
                                  background:
                                    color.swatch === 'transparent'
                                      ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                                      : color.swatch,
                                }}
                              />
                              {color.label}
                            </button>
                          )
                        })}
                      </div>
                      {isFreeAngle && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Only applies to custom (non-90°) angles.
                        </p>
                      )}
                    </div>

                    {/* Auto-crop toggle */}
                    <div className="space-y-2">
                      <label
                        className={cn(
                          'flex items-center gap-2',
                          !isFreeAngle ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={autoCrop}
                          onChange={(e) => setAutoCrop(e.target.checked)}
                          disabled={!isFreeAngle}
                          className="w-4 h-4 accent-primary"
                        />
                        <span className="text-sm font-medium">Auto-crop black borders</span>
                      </label>
                      <p className="text-xs text-muted-foreground ml-6">
                        Removes the corner fill for custom angles by cropping to the largest
                        centered rectangle without borders.
                      </p>
                    </div>

                    {/* Re-encode notice */}
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        Rotation always re-encodes the video stream. Audio is passed through
                        without re-encoding.
                        {!isFreeAngle && angle !== 0 && (
                          <> Exact 90° multiples use optimized transpose — no quality loss beyond the re-encode.</>
                        )}
                      </p>
                    </div>

                    {/* Rotate button */}
                    <Button
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={!originalFile}
                      onClick={handleRotate}
                    >
                      <RotateCw className="w-4 h-4 mr-2" />
                      Rotate Video
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
                        <label className="text-sm font-medium">Angle</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                          {angle}°{flipH && ' + Flip H'}{flipV && ' + Flip V'}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Method</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                          Re-encode (required for rotation)
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
                        Rotate Another Video
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
          <h2 className="text-2xl font-bold mb-6">How to Rotate a Video</h2>
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
