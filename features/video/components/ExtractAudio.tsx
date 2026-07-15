'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Download, RotateCcw, Film, Music, Headphones } from 'lucide-react'
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
import { formatTime, formatDuration } from '@/features/video/utils/videoTimeline'
import {
  estimateAudioSize,
  formatEstimatedSize,
  extractAudio,
  OGG_QUALITY_TO_KBPS,
} from '@/features/video/utils/audioExtractor'
import type { ExtractAudioOptions, AudioExtractFormat, AudioSizeEstimate } from '@/features/video/utils/audioExtractor'
import type {
  VideoMetadata,
  ExtendedVideoMetadata,
  ExtractAudioResult,
} from '@/features/video/types'
import type { Bitrate, SampleRate, FLACCompression } from '@/features/audio/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_FORMATS = ['mp4', 'webm', 'mov', 'mkv', 'avi']

const OUTPUT_FORMATS: { value: AudioExtractFormat; label: string; ext: string }[] = [
  { value: 'mp3', label: 'MP3', ext: 'mp3' },
  { value: 'wav', label: 'WAV', ext: 'wav' },
  { value: 'aac', label: 'AAC', ext: 'aac' },
  { value: 'ogg', label: 'OGG', ext: 'ogg' },
  { value: 'flac', label: 'FLAC', ext: 'flac' },
  { value: 'm4a', label: 'M4A', ext: 'm4a' },
]

const BITRATE_OPTIONS: { value: Bitrate; label: string }[] = [
  { value: '64', label: '64 kbps' },
  { value: '128', label: '128 kbps' },
  { value: '192', label: '192 kbps' },
  { value: '256', label: '256 kbps' },
  { value: '320', label: '320 kbps' },
]

const SAMPLE_RATE_OPTIONS: { value: SampleRate; label: string }[] = [
  { value: '44100', label: '44.1 kHz' },
  { value: '48000', label: '48 kHz' },
]

const COMPRESSION_OPTIONS: { value: FLACCompression; label: string }[] = [
  { value: '0', label: '0 — Fastest, largest file' },
  { value: '5', label: '5 — Balanced (recommended)' },
  { value: '8', label: '8 — Slowest, smallest file' },
]

const TOOL_FAQS = [
  {
    question: 'What video formats are supported?',
    answer:
      'MP4, WebM, MOV, AVI, and MKV are supported as input formats. If your video has an audio track, it will be detected and extracted automatically.',
  },
  {
    question: 'What audio formats can I extract?',
    answer:
      'MP3, WAV, AAC, OGG, FLAC, and M4A. MP3 offers the best compatibility, WAV provides uncompressed audio, AAC/M4A offer better quality at lower bitrates, OGG is a free open-source format, and FLAC provides lossless compression.',
  },
  {
    question: 'What quality options are available?',
    answer:
      'Quality options depend on the format. MP3, AAC, and M4A support bitrate selection from 64 to 320 kbps. WAV supports sample rate selection (44.1 kHz or 48 kHz). OGG uses a quality slider (0–10) that balances quality and file size. FLAC offers compression levels from 0 (fastest) to 8 (smallest file size) — since FLAC is lossless, compression level only affects file size and encoding time, not audio quality.',
  },
  {
    question: 'Is my video uploaded to a server?',
    answer:
      'No! All audio extraction happens entirely in your browser using WebAssembly. Your video files never leave your device — they remain 100% private and secure.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Upload your video',
    desc: 'Click or drag and drop a video file (up to 500 MB). File info and audio track detection happen instantly.',
  },
  {
    step: 2,
    title: 'Choose your output format and quality',
    desc: 'Select from MP3, WAV, AAC, OGG, FLAC, or M4A. Quality controls change based on the selected format — choose the right balance of quality and file size.',
  },
  {
    step: 3,
    title: 'Extract and download',
    desc: 'Click Extract Audio, wait for the progress bar, then preview your audio and download it. Everything runs locally in your browser.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isBitrateFormat(format: AudioExtractFormat): boolean {
  return format === 'mp3' || format === 'aac' || format === 'm4a'
}

function isOggFormat(format: AudioExtractFormat): boolean {
  return format === 'ogg'
}

function isWavFormat(format: AudioExtractFormat): boolean {
  return format === 'wav'
}

function isFlacFormat(format: AudioExtractFormat): boolean {
  return format === 'flac'
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    ;(window as any).gtag('event', name, props)
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExtractAudio() {
  // ── Core state ──────────────────────────────────────────────────────────
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null)
  const [advancedMetadata, setAdvancedMetadata] = useState<ExtendedVideoMetadata | null>(null)
  const [hasAudio, setHasAudio] = useState(true) // default: assume audio

  // ── Format & quality state ──────────────────────────────────────────────
  const [outputFormat, setOutputFormat] = useState<AudioExtractFormat>('mp3')
  const [bitrate, setBitrate] = useState<Bitrate>('192')
  const [sampleRate, setSampleRate] = useState<SampleRate>('44100')
  const [oggQuality, setOggQuality] = useState(5)
  const [flacCompression, setFlacCompression] = useState<FLACCompression>('5')
  const [estimatedSize, setEstimatedSize] = useState<AudioSizeEstimate | null>(null)

  // ── Processing state ────────────────────────────────────────────────────
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [estimatedRemaining, setEstimatedRemaining] = useState(0)
  const [result, setResult] = useState<ExtractAudioResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCancelled, setIsCancelled] = useState(false)

  // ── Refs ────────────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // ── Derived ─────────────────────────────────────────────────────────────
  const metadataAvailable = videoMetadata !== null
  const duration = videoMetadata?.duration ?? 0
  const showBitrateControl = isBitrateFormat(outputFormat)
  const showSampleRateControl = isWavFormat(outputFormat)
  const showOggQualityControl = isOggFormat(outputFormat)
  const showFlacCompressionControl = isFlacFormat(outputFormat)

  // ── Recompute estimated size when options change ────────────────────────
  useEffect(() => {
    if (duration > 0) {
      const options: ExtractAudioOptions = {
        format: outputFormat,
        bitrate,
        sampleRate,
        oggQuality,
        flacCompression,
      }
      const est = estimateAudioSize(outputFormat, options, duration)
      setEstimatedSize(est)
    } else {
      setEstimatedSize(null)
    }
  }, [outputFormat, bitrate, sampleRate, oggQuality, flacCompression, duration])

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
    setAdvancedMetadata(null)
    setHasAudio(true)
    setResult(null)
    setError(null)
    setIsCancelled(false)
    setProgress(0)

    if (file.size > MAX_FILE_SIZE_TRIM) {
      setError(
        'File too large for browser-based processing — try a shorter clip or lower resolution source. Maximum file size is 500 MB.',
      )
      return
    }

    setOriginalFile(file)

    const metadata = await getBasicMetadata(file)
    setVideoMetadata(metadata)

    trackEvent('video_uploaded', {
      format: file.name.split('.').pop()?.toLowerCase(),
      size_mb: Math.round(file.size / (1024 * 1024)),
      tool: 'extract-audio',
    })

    preloadFFmpeg()
  }, [])

  // ── Background: probe for audio track via ffmpeg ────────────────────────

  useEffect(() => {
    if (!originalFile || !videoMetadata) return

    let cancelled = false

    const probeAudio = async () => {
      try {
        const { getFFmpeg: getFfmpeg } = await import('@/features/audio/utils/ffmpegClient')
        const ffmpegInstance = await getFfmpeg()
        if (cancelled) return

        const advanced = await getAdvancedMetadata(ffmpegInstance, originalFile, videoMetadata)
        if (cancelled) return

        setAdvancedMetadata(advanced)

        // Detect audio presence from ffmpeg probe
        if (advanced.audioCodec && advanced.audioCodec !== 'none' && advanced.audioCodec !== '') {
          setHasAudio(true)
        } else {
          setHasAudio(false)
        }
      } catch {
        // Graceful degradation — default hasAudio=true is safe
      }
    }

    probeAudio()

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

    trackEvent('extract_started', {
      format: outputFormat,
    })

    try {
      const options: ExtractAudioOptions = {
        format: outputFormat,
        bitrate,
        sampleRate,
        oggQuality,
        flacCompression,
      }

      const extractResult = await extractAudio(
        originalFile,
        options,
        (pct, elapsed, remaining) => {
          setProgress(pct)
          setElapsedSeconds(elapsed)
          setEstimatedRemaining(remaining)
        },
        abortController.signal,
      )

      // Attach metadata from component state
      const finalResult: ExtractAudioResult = {
        ...extractResult,
        duration,
        hasAudio,
      }

      setResult(finalResult)

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      previewUrlRef.current = URL.createObjectURL(extractResult.blob)

      trackEvent('extract_completed', {
        format: outputFormat,
        original_mb: Math.round(originalFile.size / (1024 * 1024)),
        output_mb: Math.round(extractResult.blob.size / (1024 * 1024)),
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setIsCancelled(true)
        trackEvent('extract_cancelled', { format: outputFormat })
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Audio extraction failed. Please try again with a different video file.',
        )
        trackEvent('extract_failed', { error: err instanceof Error ? err.message : 'unknown' })
      }
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }, [originalFile, outputFormat, bitrate, sampleRate, oggQuality, flacCompression, duration, hasAudio])

  // ── Cancel ──────────────────────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  // ── Download ────────────────────────────────────────────────────────────

  const handleDownload = useCallback(() => {
    if (!result || !originalFile) return

    const baseName = originalFile.name.replace(/\.[^.]+$/, '')
    const ext = OUTPUT_FORMATS.find((f) => f.value === result.outputFormat)?.ext ?? result.outputFormat
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(`${baseName}.${ext}`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)

    trackEvent('download_clicked', { format: result.outputFormat })
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
    setOutputFormat('mp3')
    setBitrate('192')
    setSampleRate('44100')
    setOggQuality(5)
    setFlacCompression('5')
    setEstimatedSize(null)
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
            title="Audio Extraction Failed"
            message={error}
            onRetry={handleProcess}
          />
        )}

        {/* ── Cancelled ──────────────────────────────────────────────── */}
        {isCancelled && !error && !result && (
          <div className="border border-border rounded-xl p-8 text-center bg-card">
            <Headphones className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Extraction Cancelled</h3>
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
                    {metadataAvailable && videoMetadata!.width > 0 && (
                      <> · {videoMetadata!.width}×{videoMetadata!.height}</>
                    )}
                    {advancedMetadata ? (
                      <> · {hasAudio ? 'Audio detected' : 'No audio track'}</>
                    ) : (
                      <> · Checking audio...</>
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Change File
                </Button>
              </div>

              {/* ── No Audio Warning ─────────────────────────────────── */}
              {!hasAudio && advancedMetadata && !isProcessing && !result && (
                <div className="border border-amber-200 dark:border-amber-800 rounded-xl p-6 bg-amber-50 dark:bg-amber-950/30">
                  <div className="flex items-start gap-3">
                    <Headphones className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                        No Audio Track Detected
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        This video file does not appear to contain an audio track. You can still
                        attempt extraction, but the output file may be empty or contain only silence.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Info Panel ────────────────────────────────────────── */}
              {!isProcessing && !result && originalFile && (
                <div className="border border-border rounded-xl p-6 bg-card space-y-4">
                  <h3 className="font-semibold text-lg">About Audio Extraction</h3>
                  <p className="text-sm text-muted-foreground">
                    Extracts the audio track from your video and saves it as a standalone audio file.
                    The original video is not modified. Choose from 6 output formats with quality
                    options tailored to each format.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <div className="text-xs text-muted-foreground mb-1">Duration</div>
                      <div className="text-lg font-bold font-mono">
                        {duration > 0 ? formatDuration(duration) : '--:--'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Same as video</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30 text-center">
                      <div className="text-xs text-muted-foreground mb-1">Estimated Size</div>
                      <div className="text-lg font-bold font-mono">
                        {estimatedSize ? formatEstimatedSize(estimatedSize) : '--'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {(outputFormat === 'ogg' || outputFormat === 'flac')
                          ? 'Approximate'
                          : outputFormat === 'wav'
                            ? 'Uncompressed PCM'
                            : `${bitrate} kbps`}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Progress ──────────────────────────────────────────── */}
              {isProcessing && (
                <div className="space-y-4">
                  <ProcessingStatus message="Extracting audio..." />
                  <ProgressBar
                    percent={progress}
                    label="Processing Progress"
                    detail={
                      progress < 5
                        ? 'Initializing...'
                        : progress < 95
                          ? 'Extracting audio track...'
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
                    <h3 className="font-semibold text-lg mb-4">Extraction Complete</h3>

                    {previewUrlRef.current && (
                      <div className="mb-6 p-4 rounded-lg bg-muted/30">
                        <audio
                          ref={audioRef}
                          src={previewUrlRef.current}
                          controls
                          className="w-full"
                          preload="auto"
                        >
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                    )}

                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-center">
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Format</div>
                        <div className="font-semibold text-sm uppercase">{result.outputFormat}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Duration</div>
                        <div className="font-semibold text-sm font-mono">
                          {result.duration > 0 ? formatDuration(result.duration) : '--:--'}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Audio</div>
                        <div className="font-semibold text-sm">
                          {result.hasAudio ? 'Extracted' : 'None'}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">Method</div>
                        <div className="font-semibold text-sm">
                          {outputFormat === 'wav'
                            ? 'PCM'
                            : outputFormat === 'flac'
                              ? 'Lossless'
                              : 'Lossy'}
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
                        <div className="text-xs text-muted-foreground mb-1">Extracted Audio</div>
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
                      Download {result.outputFormat.toUpperCase()}
                    </Button>
                    <Button size="lg" variant="outline" onClick={handleReset}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Extract Another
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
                        <span className="text-primary font-semibold uppercase">{outputFormat}</span>
                      </label>
                      <select
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value as AudioExtractFormat)}
                        className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      >
                        {OUTPUT_FORMATS.map((fmt) => (
                          <option key={fmt.value} value={fmt.value}>
                            {fmt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Bitrate selector (MP3/AAC/M4A) */}
                    {showBitrateControl && (
                      <div>
                        <label className="text-sm font-medium flex justify-between">
                          <span>Bitrate</span>
                          <span className="text-primary font-semibold">{bitrate} kbps</span>
                        </label>
                        <select
                          value={bitrate}
                          onChange={(e) => setBitrate(e.target.value as Bitrate)}
                          className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                        >
                          {BITRATE_OPTIONS.map((opt) => (
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
                    )}

                    {/* Sample rate (WAV) */}
                    {showSampleRateControl && (
                      <div>
                        <label className="text-sm font-medium flex justify-between">
                          <span>Sample Rate</span>
                          <span className="text-primary font-semibold">
                            {sampleRate === '44100' ? '44.1 kHz' : '48 kHz'}
                          </span>
                        </label>
                        <select
                          value={sampleRate}
                          onChange={(e) => setSampleRate(e.target.value as SampleRate)}
                          className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                        >
                          {SAMPLE_RATE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* OGG Quality slider */}
                    {showOggQualityControl && (
                      <div>
                        <label className="text-sm font-medium flex justify-between">
                          <span>Quality (Vorbis)</span>
                          <span className="text-primary font-semibold">{oggQuality}/10</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          step={1}
                          value={oggQuality}
                          onChange={(e) => setOggQuality(Number(e.target.value))}
                          className="w-full mt-2 accent-primary"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>Smaller file</span>
                          <span>Better quality</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 text-center">
                          ~{OGG_QUALITY_TO_KBPS[oggQuality]} kbps nominal
                        </p>
                      </div>
                    )}

                    {/* FLAC Compression */}
                    {showFlacCompressionControl && (
                      <div>
                        <label className="text-sm font-medium flex justify-between">
                          <span>Compression</span>
                          <span className="text-primary font-semibold">Level {flacCompression}</span>
                        </label>
                        <select
                          value={flacCompression}
                          onChange={(e) => setFlacCompression(e.target.value as FLACCompression)}
                          className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                        >
                          {COMPRESSION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Lossless — compression affects file size and encode time, not audio quality.
                        </p>
                      </div>
                    )}

                    {/* Estimated size */}
                    {estimatedSize && estimatedSize.bytes > 0 && (
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <div className="text-xs text-muted-foreground mb-1">
                          {estimatedSize.isApproximate ? 'Approximate Size' : 'Estimated Size'}
                        </div>
                        <div className="text-lg font-bold font-mono">
                          {formatEstimatedSize(estimatedSize)}
                        </div>
                      </div>
                    )}

                    {/* Format info notice */}
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        {outputFormat === 'mp3'
                          ? 'MP3 — Best compatibility, lossy compression. Good balance of quality and file size.'
                          : outputFormat === 'wav'
                            ? 'WAV — Uncompressed PCM audio. Largest file size, perfect quality. No quality loss.'
                            : outputFormat === 'aac'
                              ? 'AAC — Better quality than MP3 at the same bitrate. Widely supported.'
                              : outputFormat === 'ogg'
                                ? 'OGG Vorbis — Free open-source format. Quality-based encoding, good efficiency.'
                                : outputFormat === 'flac'
                                  ? 'FLAC — Lossless compression. Perfect quality, smaller than WAV. Best for archiving.'
                                  : 'M4A — AAC audio in MP4 container. Great for Apple devices and iTunes.'}
                      </p>
                    </div>

                    {/* No-audio warning in options */}
                    {!hasAudio && advancedMetadata && (
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          No audio track detected in this video. Extraction may produce an empty file.
                        </p>
                      </div>
                    )}

                    {/* Action button */}
                    <Button
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={!originalFile}
                      onClick={handleProcess}
                    >
                      <Music className="w-4 h-4 mr-2" />
                      Extract Audio
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
                          {outputFormat}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Quality</label>
                        <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                          {showBitrateControl
                            ? `${bitrate} kbps`
                            : showSampleRateControl
                              ? `${sampleRate === '44100' ? '44.1' : '48'} kHz`
                              : showOggQualityControl
                                ? `Quality ${oggQuality}/10`
                                : `Level ${flacCompression}`}
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
                        Download {result.outputFormat.toUpperCase()}
                      </Button>
                      <Button className="w-full" variant="outline" onClick={handleReset}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Extract Another Audio
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
          <h2 className="text-2xl font-bold mb-6">How to Extract Audio from Video</h2>
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
