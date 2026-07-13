'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Download, RotateCcw, Film } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { convertVideo } from '@/features/video/utils/videoConverter'
import { getSaveVexFileName } from '@/utils/fileNames'
import { formatBytes } from '@/utils/formatBytes'
import type {
  VideoOutputFormat,
  VideoPreset,
  VideoResolution,
  VideoFrameRate,
  VideoMetadata,
  ConversionResult,
} from '@/features/video/types'
import {
  DEFAULT_CRF,
  MIN_CRF,
  MAX_CRF,
  RESOLUTION_HEIGHT,
} from '@/features/video/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_FORMATS = ['mp4', 'webm', 'mov', 'mkv', 'avi']

const MAX_FILE_SIZE = 300 * 1024 * 1024 // 300 MB

const OUTPUT_FORMAT_OPTIONS: { value: VideoOutputFormat; label: string }[] = [
  { value: 'mp4', label: 'MP4 (H.264 + AAC)' },
  { value: 'mov', label: 'MOV (H.264 + AAC)' },
  { value: 'avi', label: 'AVI (H.264 + MP3)' },
  { value: 'mkv', label: 'MKV (H.264 + AAC)' },
]

const PRESET_OPTIONS: { value: VideoPreset; label: string; description: string }[] = [
  { value: 'fast', label: 'Fast', description: 'Faster encoding, larger file size' },
  { value: 'medium', label: 'Medium', description: 'Balanced speed and file size' },
  { value: 'slow', label: 'Slow', description: 'Slower encoding, smallest file size' },
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
      'You can upload MP4, WebM, MOV, AVI, and MKV files. Output formats are MP4, MOV, AVI, and MKV — all using H.264 video encoding for wide compatibility. WebM (VP9) output support is coming in a future update.',
  },
  {
    question: 'What does the CRF slider do?',
    answer:
      'CRF (Constant Rate Factor) controls the balance between quality and file size. Lower values (18) produce the best quality and largest files. Higher values (32) produce smaller files with lower quality. The default of 23 is a well-balanced setting suitable for most videos.',
  },
  {
    question: 'Is my video uploaded to a server?',
    answer:
      'No. All video conversion happens entirely in your browser using ffmpeg.wasm technology. Your videos never leave your device — they remain 100% private and secure. Because everything runs locally, there are no server uploads, no queues, and no file size limits beyond what your browser can handle.',
  },
  {
    question: 'How long does video conversion take?',
    answer:
      'Processing time depends on your video\'s length, resolution, settings, and your device\'s CPU speed. Short clips (under a minute) typically finish in 30–90 seconds. Longer or high-resolution videos can take several minutes — a progress bar shows the current status throughout. Since everything runs in your browser without dedicated hardware acceleration, expect it to be slower than desktop video editing software.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Upload your video',
    desc: 'Click or drag and drop an MP4, WebM, MOV, AVI, or MKV file (up to 300 MB). File info like duration and resolution is read instantly from your browser.',
  },
  {
    step: 2,
    title: 'Choose your output settings',
    desc: 'Select your target format, quality (CRF), encoding preset, resolution, and frame rate. An estimated output size is shown before you start processing.',
  },
  {
    step: 3,
    title: 'Download your converted video',
    desc: 'Click Convert, wait for the progress bar to complete, then preview the result right in your browser and download your converted video file.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface SizeEstimate {
  min: number
  max: number
}

/**
 * Estimate the output file size based on CRF, resolution, and frame rate.
 * This is a rough heuristic — actual results vary significantly by video content.
 * Returns null if metadata is unavailable.
 */
function estimateOutputSize(
  originalSize: number,
  videoMetadata: VideoMetadata | null,
  crf: number,
  resolution: VideoResolution,
  frameRate: VideoFrameRate
): SizeEstimate | null {
  if (!videoMetadata || videoMetadata.height === 0) return null

  // CRF-based ratio: CRF 18 produces ~30% of original, CRF 32 produces ~80%
  // (lower CRF = better quality = larger file, so ratio increases with CRF)
  const crfRatio = 0.3 + ((crf - 18) / (32 - 18)) * 0.5

  // Resolution factor: if downscaling, reduce proportionally (squared for pixel count)
  let resolutionFactor = 1
  if (resolution !== 'original' && videoMetadata.height > 0) {
    const targetHeight = RESOLUTION_HEIGHT[resolution as Exclude<VideoResolution, 'original'>]
    if (targetHeight < videoMetadata.height) {
      resolutionFactor = (targetHeight / videoMetadata.height) ** 2
    }
  }

  // Frame rate factor: if reducing from assumed ~30fps, scale linearly
  let frameRateFactor = 1
  if (frameRate !== 'original') {
    const targetFps = parseInt(frameRate, 10)
    if (targetFps < 30) {
      frameRateFactor = targetFps / 30
    }
  }

  const estimatedRatio = crfRatio * resolutionFactor * frameRateFactor
  const center = originalSize * estimatedRatio

  return {
    min: Math.round(center * 0.7),
    max: Math.round(center * 1.3),
  }
}

/** Extract video metadata (duration, resolution) using a native <video> element. */
function getVideoMetadata(file: File): Promise<VideoMetadata | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.remove()
    }

    video.onloadedmetadata = () => {
      const metadata: VideoMetadata = {
        duration: isFinite(video.duration) && video.duration > 0 ? video.duration : 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
      }
      cleanup()
      resolve(metadata)
    }

    video.onerror = () => {
      cleanup()
      resolve(null)
    }

    // Set a timeout — if metadata never loads, don't hang forever
    setTimeout(() => {
      cleanup()
      resolve(null)
    }, 30_000)

    video.src = url
  })
}

/** Format seconds as mm:ss. */
function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConvertVideo() {
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const [targetFormat, setTargetFormat] = useState<VideoOutputFormat>('mp4')
  const [preset, setPreset] = useState<VideoPreset>('medium')
  const [crf, setCrf] = useState<number>(DEFAULT_CRF)
  const [resolution, setResolution] = useState<VideoResolution>('original')
  const [frameRate, setFrameRate] = useState<VideoFrameRate>('original')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Blob URL for the result preview video — must be cleaned up
  const previewUrlRef = useRef<string | null>(null)

  // Cleanup preview blob URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: File) => {
    // Clean up previous preview URL
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    // Validate file size BEFORE setting state
    if (file.size > MAX_FILE_SIZE) {
      setError(
        'File too large for browser-based processing — try a shorter clip or lower resolution source. Maximum file size is 300 MB.'
      )
      setOriginalFile(null)
      setVideoMetadata(null)
      return
    }

    // Reset state for new file
    setOriginalFile(file)
    setVideoMetadata(null)
    setResult(null)
    setError(null)
    setProgress(0)
    setTargetFormat('mp4')
    setPreset('medium')
    setCrf(DEFAULT_CRF)
    setResolution('original')
    setFrameRate('original')

    // Extract metadata via native <video> element (no ffmpeg involved)
    const metadata = await getVideoMetadata(file)
    setVideoMetadata(metadata)
  }, [])

  const handleConvert = useCallback(async () => {
    if (!originalFile) return

    setError(null)
    setIsProcessing(true)
    setProgress(0)
    setResult(null)

    try {
      const conversionResult = await convertVideo(
        originalFile,
        { targetFormat, preset, crf, resolution, frameRate },
        (p) => setProgress(p)
      )

      // Attach the metadata we already extracted (avoids re-extracting)
      conversionResult.metadata = videoMetadata

      setResult(conversionResult)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Conversion failed. Please try again with a different video file.'
      )
    } finally {
      setIsProcessing(false)
    }
  }, [originalFile, targetFormat, preset, crf, resolution, frameRate, videoMetadata])

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
  }, [result, originalFile])

  const handleReset = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setOriginalFile(null)
    setVideoMetadata(null)
    setTargetFormat('mp4')
    setPreset('medium')
    setCrf(DEFAULT_CRF)
    setResolution('original')
    setFrameRate('original')
    setResult(null)
    setError(null)
    setProgress(0)
    setIsProcessing(false)
  }, [])

  const handleRetryUpload = useCallback(() => {
    setError(null)
  }, [])

  // ── Derived ─────────────────────────────────────────────────────────────

  const metadataAvailable = videoMetadata !== null

  // Compute estimated output size whenever options or file change
  const sizeEstimate = originalFile && !result
    ? estimateOutputSize(originalFile.size, videoMetadata, crf, resolution, frameRate)
    : null

  // Build the preview URL when result is ready
  useEffect(() => {
    if (result) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      previewUrlRef.current = URL.createObjectURL(result.blob)
    }
  }, [result])

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left Column ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {/* Error: file size rejection (no file loaded) */}
          {error && !originalFile && (
            <ErrorCard
              title="File Too Large"
              message={error}
              onRetry={handleRetryUpload}
            />
          )}

          {/* Error: processing failure (file is loaded, retry conversion) */}
          {error && originalFile && (
            <ErrorCard
              title="Conversion Failed"
              message={error}
              onRetry={handleConvert}
            />
          )}

          {/* IDLE: no file uploaded */}
          {!originalFile && !error && (
            <UploadDropzone
              acceptedFormats={ACCEPTED_FORMATS}
              onFileSelect={handleFileSelect}
            />
          )}

          {/* FILE_LOADED: file selected, show info */}
          {originalFile && !isProcessing && !result && (
            <div className="space-y-6">
              {/* File info bar */}
              <div className="flex items-center gap-4 p-4 border border-border rounded-xl bg-card">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <Film className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{originalFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(originalFile.size)}
                    {metadataAvailable && videoMetadata!.duration > 0 && (
                      <>
                        {' · '}
                        {formatDuration(videoMetadata!.duration)}
                      </>
                    )}
                    {metadataAvailable && videoMetadata!.width > 0 && (
                      <>
                        {' · '}
                        {videoMetadata!.width}×{videoMetadata!.height}
                      </>
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Change File
                </Button>
              </div>

              {/* What to expect */}
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-2">What to expect</h3>
                <p className="text-muted-foreground text-sm">
                  Convert Video changes your video&apos;s format to{' '}
                  <strong className="text-foreground">MP4, MOV, AVI, or MKV</strong>. Use the
                  CRF slider to balance quality and file size (lower = better quality, larger).
                  The preset controls encoding speed vs. efficiency. All processing happens
                  locally in your browser — your videos never leave your device.{' '}
                  <strong className="text-foreground">WebM support is planned</strong> for a
                  future update.
                </p>
              </div>

              {/* Processing time notice */}
              <div className="border border-border rounded-xl p-6 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">⏱ This may take a few minutes</strong> for longer
                  or high-resolution videos. Everything runs in your browser without dedicated hardware
                  acceleration. You can keep using other tabs while it works.
                </p>
              </div>
            </div>
          )}

          {/* PROCESSING: encoding in progress */}
          {isProcessing && (
            <div className="space-y-4">
              <ProcessingStatus message="Converting video..." />
              <ProgressBar
                percent={progress}
                label="Conversion Progress"
                detail={
                  progress < 5
                    ? 'Initializing encoder...'
                    : progress < 10
                      ? 'Analyzing video...'
                      : progress < 95
                        ? 'Converting video stream...'
                        : 'Finalizing output...'
                }
              />
            </div>
          )}

          {/* COMPLETE: result with preview player */}
          {result && (
            <div className="space-y-6">
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-4">Conversion Complete</h3>

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
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6 text-center">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Format</div>
                    <div className="font-semibold text-sm uppercase">{result.targetFormat}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Preset</div>
                    <div className="font-semibold text-sm capitalize">{preset}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">CRF</div>
                    <div className="font-semibold text-sm">{crf}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Resolution</div>
                    <div className="font-semibold text-sm">
                      {resolution === 'original'
                        ? result.metadata?.width
                          ? `${result.metadata.width}×${result.metadata.height}`
                          : 'Original'
                        : resolution}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Frame Rate</div>
                    <div className="font-semibold text-sm">
                      {frameRate === 'original' ? 'Original' : `${frameRate} fps`}
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
                    <div className="text-xs text-muted-foreground mb-1">Converted</div>
                    <div className="text-2xl font-bold">{formatBytes(result.convertedSize)}</div>
                    {result.originalSize > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {result.convertedSize < result.originalSize
                          ? `${Math.round(((result.originalSize - result.convertedSize) / result.originalSize) * 100)}% smaller`
                          : result.convertedSize > result.originalSize
                            ? `${Math.round(((result.convertedSize - result.originalSize) / result.originalSize) * 100)}% larger`
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
                  Convert Another
                </Button>
              </div>
            </div>
          )}

          {/* How To */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Convert a Video</h2>
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

          {/* FAQ */}
          <div className="mt-12">
            <FAQSection
              faqs={TOOL_FAQS}
              title="Frequently Asked Questions"
              description=""
            />
          </div>
        </div>

        {/* ── Right Column ────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            {/* FILE_LOADED: options panel */}
            {originalFile && !isProcessing && !result && (
              <div className="border border-border rounded-xl p-6 bg-muted/30">
                <h3 className="font-semibold text-lg mb-6">Conversion Settings</h3>

                {/* Output Format selector */}
                <div className="mb-6">
                  <label className="text-sm font-medium flex justify-between">
                    <span>Output Format</span>
                    <span className="text-primary font-semibold uppercase">{targetFormat}</span>
                  </label>
                  <select
                    value={targetFormat}
                    onChange={(e) => {
                      setTargetFormat(e.target.value as VideoOutputFormat)
                      setResult(null)
                    }}
                    className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    disabled={isProcessing}
                  >
                    {OUTPUT_FORMAT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preset selector */}
                <div className="mb-6">
                  <label className="text-sm font-medium flex justify-between">
                    <span>Preset</span>
                    <span className="text-primary font-semibold capitalize">{preset}</span>
                  </label>
                  <select
                    value={preset}
                    onChange={(e) => {
                      setPreset(e.target.value as VideoPreset)
                      setResult(null)
                    }}
                    className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    disabled={isProcessing}
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

                {/* CRF slider */}
                <div className="mb-6">
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
                    onChange={(e) => {
                      setCrf(Number(e.target.value))
                      setResult(null)
                    }}
                    disabled={isProcessing}
                    className="w-full mt-2 accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Better quality</span>
                    <span>Smaller file</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Lower = better quality + larger file. Higher = smaller file + lower
                    quality. Default {DEFAULT_CRF} is well-balanced.
                  </p>
                </div>

                {/* Resolution selector */}
                <div className="mb-6">
                  <label className="text-sm font-medium flex justify-between">
                    <span>Resolution</span>
                    <span className="text-primary font-semibold">
                      {resolution === 'original' ? 'Original' : resolution}
                    </span>
                  </label>
                  <select
                    value={resolution}
                    onChange={(e) => {
                      setResolution(e.target.value as VideoResolution)
                      setResult(null)
                    }}
                    className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    disabled={isProcessing}
                  >
                    {RESOLUTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Smaller file</span>
                    <span>Better quality</span>
                  </div>
                </div>

                {/* Frame rate selector */}
                <div className="mb-6">
                  <label className="text-sm font-medium flex justify-between">
                    <span>Frame Rate</span>
                    <span className="text-primary font-semibold">
                      {frameRate === 'original' ? 'Original' : `${frameRate} fps`}
                    </span>
                  </label>
                  <select
                    value={frameRate}
                    onChange={(e) => {
                      setFrameRate(e.target.value as VideoFrameRate)
                      setResult(null)
                    }}
                    className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    disabled={isProcessing}
                  >
                    {FRAMERATE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Smaller file</span>
                    <span>Smoother motion</span>
                  </div>
                </div>

                {/* Estimated output size */}
                {sizeEstimate && (
                  <div className="mb-6 p-4 rounded-lg bg-background border border-border">
                    <div className="text-xs text-muted-foreground mb-1">
                      Estimated Output Size
                    </div>
                    <div className="text-lg font-bold text-foreground">
                      {formatBytes(sizeEstimate.min)} – {formatBytes(sizeEstimate.max)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Approximate — actual size varies by video content.
                    </p>
                  </div>
                )}

                {/* Processing time reminder */}
                <p className="text-xs text-muted-foreground mb-4">
                  ⏱ Conversion may take a few minutes for longer or high-resolution videos.
                </p>

                {/* Convert button */}
                <Button
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={!originalFile || isProcessing}
                  onClick={handleConvert}
                >
                  Convert Video
                </Button>
              </div>
            )}

            {/* PROCESSING state: disabled controls */}
            {isProcessing && (
              <div className="border border-border rounded-xl p-6 bg-muted/30">
                <h3 className="font-semibold text-lg mb-6">Conversion Settings</h3>
                <div className="space-y-4 opacity-50 pointer-events-none">
                  <div>
                    <label className="text-sm font-medium">Output Format</label>
                    <div className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm uppercase">
                      {targetFormat}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Preset</label>
                    <div className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm capitalize">
                      {preset}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">CRF</label>
                    <div className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                      {crf}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Resolution</label>
                    <div className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                      {resolution === 'original' ? 'Original' : resolution}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Frame Rate</label>
                    <div className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                      {frameRate === 'original' ? 'Original' : `${frameRate} fps`}
                    </div>
                  </div>
                </div>
                <Button className="w-full bg-primary hover:bg-primary/90 mt-4" disabled>
                  Converting...
                </Button>
              </div>
            )}

            {/* COMPLETE state: download / reset */}
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
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleReset}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Convert Another Video
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
