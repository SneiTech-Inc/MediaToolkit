'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Download, RotateCcw, Film } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { compressVideo } from '@/features/video/utils/videoCompressor'
import { getSaveVexFileName } from '@/utils/fileNames'
import { formatBytes } from '@/utils/formatBytes'
import type {
  VideoQuality,
  VideoResolution,
  VideoFrameRate,
  VideoMetadata,
  CompressionResult,
} from '@/features/video/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_FORMATS = ['mp4', 'mov', 'webm', 'mkv']

const MAX_FILE_SIZE = 300 * 1024 * 1024 // 300 MB

const QUALITY_OPTIONS: { value: VideoQuality; label: string; description: string }[] = [
  { value: 'low', label: 'Low (best quality)', description: 'Light compression — largest output file' },
  { value: 'medium', label: 'Medium (balanced)', description: 'Good quality with noticeable size reduction' },
  { value: 'high', label: 'High (smallest file)', description: 'Heavy compression — smallest output file' },
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
      'You can compress MP4, MOV, WebM, and MKV files. The compressed output is always MP4 (H.264 video + AAC audio), which offers the widest compatibility across devices, browsers, and media players.',
  },
  {
    question: 'How much will my video be compressed?',
    answer:
      'Compression results vary significantly by video content. A talking-head video or screen recording compresses far more than an action scene or music video at the same CRF setting. Typically, you can expect 40–70% size reduction, but the actual result is shown only after processing completes — we show you the real before-and-after numbers, never a guess.',
  },
  {
    question: 'Is my video uploaded to a server?',
    answer:
      'No. All video compression happens entirely in your browser using ffmpeg.wasm technology. Your videos never leave your device — they remain 100% private and secure. Because everything runs locally, there are no server uploads, no queues, and no file size limits beyond what your browser can handle.',
  },
  {
    question: 'How long does video compression take?',
    answer:
      'Processing time depends on your video\'s length, resolution, quality settings, and your device\'s CPU speed. Short clips (under a minute) typically finish in 30–90 seconds. Longer or high-resolution videos can take several minutes — a progress bar shows the current status throughout. Since everything runs in your browser without dedicated hardware acceleration, expect it to be slower than desktop video editing software.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Upload your video',
    desc: 'Click or drag and drop an MP4, MOV, WebM, or MKV file (up to 300 MB). File info like duration and resolution is read instantly from your browser — no processing needed.',
  },
  {
    step: 2,
    title: 'Choose compression settings',
    desc: 'Select your preferred quality level, resolution, and frame rate. Lower quality settings produce smaller files. Resolution and frame rate can be adjusted independently of quality.',
  },
  {
    step: 3,
    title: 'Download your compressed video',
    desc: 'Click Compress, wait for the progress bar to complete, then preview the result right in your browser and download your smaller video file.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

export function CompressVideo() {
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const [quality, setQuality] = useState<VideoQuality>('medium')
  const [resolution, setResolution] = useState<VideoResolution>('original')
  const [frameRate, setFrameRate] = useState<VideoFrameRate>('original')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<CompressionResult | null>(null)
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
    setQuality('medium')
    setResolution('original')
    setFrameRate('original')

    // Extract metadata via native <video> element (no ffmpeg involved)
    const metadata = await getVideoMetadata(file)
    setVideoMetadata(metadata)
  }, [])

  const handleCompress = useCallback(async () => {
    if (!originalFile) return

    setError(null)
    setIsProcessing(true)
    setProgress(0)
    setResult(null)

    try {
      const compressionResult = await compressVideo(
        originalFile,
        { quality, resolution, frameRate },
        (p) => setProgress(p)
      )

      // Attach the metadata we already extracted (avoids re-extracting)
      compressionResult.metadata = videoMetadata

      setResult(compressionResult)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Compression failed. Please try again with a different video file.'
      )
    } finally {
      setIsProcessing(false)
    }
  }, [originalFile, quality, resolution, frameRate, videoMetadata])

  const handleDownload = useCallback(() => {
    if (!result || !originalFile) return

    const baseName = originalFile.name.replace(/\.[^.]+$/, '')
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(`${baseName}.mp4`)
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
    setQuality('medium')
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

          {/* Error: processing failure (file is loaded, retry compression) */}
          {error && originalFile && (
            <ErrorCard
              title="Compression Failed"
              message={error}
              onRetry={handleCompress}
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

              {/* Size reduction hint */}
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-2">What to expect</h3>
                <p className="text-muted-foreground text-sm">
                  Compressed videos are typically <strong className="text-foreground">40–70% smaller</strong>{' '}
                  than the original. Results vary by content — simple videos (talking head, screen recording)
                  compress more than complex ones (action scenes, high-motion footage). The exact size
                  will be shown after processing.
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
              <ProcessingStatus message="Compressing video..." />
              <ProgressBar
                percent={progress}
                label="Compression Progress"
                detail={
                  progress < 5
                    ? 'Analyzing video...'
                    : progress < 95
                      ? 'Encoding video stream...'
                      : 'Finalizing output...'
                }
              />
            </div>
          )}

          {/* COMPLETE: result with preview player */}
          {result && (
            <div className="space-y-6">
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-4">Compression Complete</h3>

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
                    <div className="text-xs text-muted-foreground mb-1">Quality</div>
                    <div className="font-semibold text-sm capitalize">{quality}</div>
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
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Format</div>
                    <div className="font-semibold text-sm">MP4 (H.264)</div>
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
                    <div className="text-xs text-muted-foreground mb-1">Compressed</div>
                    <div className="text-2xl font-bold">{formatBytes(result.compressedSize)}</div>
                    {result.originalSize > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {result.compressedSize < result.originalSize
                          ? `${Math.round(((result.originalSize - result.compressedSize) / result.originalSize) * 100)}% smaller`
                          : result.compressedSize > result.originalSize
                            ? `${Math.round(((result.compressedSize - result.originalSize) / result.originalSize) * 100)}% larger`
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
                  Download Compressed MP4
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Compress Another
                </Button>
              </div>
            </div>
          )}

          {/* How To */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Compress a Video</h2>
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
            {originalFile && !isProcessing && !result && (
              <div className="border border-border rounded-xl p-6 bg-muted/30">
                <h3 className="font-semibold text-lg mb-6">Compression Settings</h3>

                {/* Quality selector */}
                <div className="mb-6">
                  <label className="text-sm font-medium flex justify-between">
                    <span>Quality</span>
                    <span className="text-primary font-semibold capitalize">{quality}</span>
                  </label>
                  <select
                    value={quality}
                    onChange={(e) => {
                      setQuality(e.target.value as VideoQuality)
                      setResult(null)
                    }}
                    className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    disabled={isProcessing}
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

                {/* Processing time reminder */}
                <p className="text-xs text-muted-foreground mb-4">
                  ⏱ Compression may take a few minutes for longer or high-resolution videos.
                </p>

                {/* Compress button */}
                <Button
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={!originalFile || isProcessing}
                  onClick={handleCompress}
                >
                  Compress Video
                </Button>
              </div>
            )}

            {/* PROCESSING state: disabled controls */}
            {isProcessing && (
              <div className="border border-border rounded-xl p-6 bg-muted/30">
                <h3 className="font-semibold text-lg mb-6">Compression Settings</h3>
                <div className="space-y-4 opacity-50 pointer-events-none">
                  <div>
                    <label className="text-sm font-medium">Quality</label>
                    <div className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm capitalize">
                      {quality}
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
                  Processing...
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
                    Download Compressed MP4
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleReset}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Compress Another Video
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
