'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Download, RotateCcw, Play, Pause } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { trimAudio } from '@/features/audio/utils/audioTrimmer'
import { getSaveVexFileName } from '@/utils/fileNames'
import { formatBytes } from '@/utils/formatBytes'
import type {
  AudioFormat,
  Bitrate,
  SampleRate,
  FLACCompression,
} from '@/features/audio/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_FORMATS = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a']

const OUTPUT_FORMATS: { value: AudioFormat; label: string }[] = [
  { value: 'mp3', label: 'MP3' },
  { value: 'wav', label: 'WAV' },
  { value: 'aac', label: 'AAC' },
  { value: 'ogg', label: 'OGG' },
  { value: 'flac', label: 'FLAC' },
  { value: 'm4a', label: 'M4A' },
]

const BITRATE_OPTIONS: { value: Bitrate; label: string }[] = [
  { value: '64', label: '64 kbps' },
  { value: '128', label: '128 kbps' },
  { value: '192', label: '192 kbps (Recommended)' },
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
    question: 'What audio formats can I trim?',
    answer:
      'You can trim MP3, WAV, AAC, OGG, FLAC, and M4A files. You can also export your trimmed segment in any of these formats — just select your preferred output format.',
  },
  {
    question: 'How accurate is the trim?',
    answer:
      'Trimming is accurate to approximately 0.1 seconds when outputting to lossy formats (MP3, AAC, OGG, M4A). For lossless formats (WAV, FLAC), trimming is frame-accurate. The start and end times you set will match what you hear in playback.',
  },
  {
    question: 'Is my audio uploaded to a server?',
    answer:
      'No. All audio trimming happens entirely in your browser. Your files are never uploaded to any server — they remain 100% private and secure on your device.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Upload your audio file',
    desc: 'Click or drag and drop an MP3, WAV, AAC, OGG, FLAC, or M4A file.',
  },
  {
    step: 2,
    title: 'Select the segment to keep',
    desc: 'Drag the slider handles or enter start and end times to choose the exact segment you want to extract.',
  },
  {
    step: 3,
    title: 'Preview, trim & download',
    desc: 'Play your selection to confirm, then click Trim to extract and download the segment.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format seconds to MM:SS (e.g. 125.7 → "2:06"). */
function secondsToMMSS(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return '0:00'
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Parse a MM:SS string to seconds. Returns NaN on invalid input.
 * Accepts 1–3 digit minutes (e.g. "0:05", "10:30", "120:45").
 */
function mmssToSeconds(mmss: string): number {
  const trimmed = mmss.trim()
  // Must match exactly: 1-3 digits, colon, two digits
  if (!/^(\d{1,3}):([0-5]\d)$/.test(trimmed)) return NaN
  const [m, s] = trimmed.split(':').map(Number)
  return m * 60 + s
}

/** Clamp a value to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Get audio duration using a native <audio> element. */
function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.preload = 'metadata'

    const cleanup = () => {
      URL.revokeObjectURL(url)
      audio.remove()
    }

    audio.onloadedmetadata = () => {
      const dur = audio.duration
      cleanup()
      resolve(isFinite(dur) && dur > 0 ? dur : 0)
    }

    audio.onerror = () => {
      cleanup()
      resolve(0)
    }

    audio.src = url
  })
}

/** Determine whether a format uses bitrate-based quality. */
function isBitrateFormat(format: AudioFormat): boolean {
  return format === 'mp3' || format === 'aac' || format === 'ogg' || format === 'm4a'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TrimAudio() {
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [duration, setDuration] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [outputFormat, setOutputFormat] = useState<AudioFormat>('mp3')
  const [bitrate, setBitrate] = useState<Bitrate>('192')
  const [sampleRate, setSampleRate] = useState<SampleRate>('44100')
  const [compressionLevel, setCompressionLevel] = useState<FLACCompression>('5')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPlayTime, setCurrentPlayTime] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{
    blob: Blob
    originalSize: number
    trimmedSize: number
    originalDuration: number
    trimmedDuration: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const lastValidStartRef = useRef('0:00')
  const lastValidEndRef = useRef('0:00')

  /** Initialize endTime when duration becomes available. */
  useEffect(() => {
    if (duration > 0 && endTime === 0) {
      setEndTime(duration)
      lastValidEndRef.current = secondsToMMSS(duration)
    }
  }, [duration, endTime])

  /** Cleanup audio + animation frame on unmount. */
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [])

  /** Animation loop callback while playing segment. */
  const updateCurrentTime = useCallback(() => {
    if (!audioRef.current) return
    const ct = audioRef.current.currentTime

    if (ct >= endTime) {
      // Auto-pause at segment end
      audioRef.current.pause()
      setIsPlaying(false)
      setCurrentPlayTime(endTime)
      return
    }

    setCurrentPlayTime(ct)
    animationRef.current = requestAnimationFrame(updateCurrentTime)
  }, [endTime])

  /** Handle file upload — measure duration, reset state. */
  const handleFileSelect = useCallback(async (file: File) => {
    setOriginalFile(file)
    setResult(null)
    setError(null)
    setStartTime(0)
    setEndTime(0)
    setCurrentPlayTime(0)
    setIsPlaying(false)
    setProgress(0)

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }

    const dur = await getAudioDuration(file)
    setDuration(dur)
    if (dur > 0) {
      setEndTime(dur)
      lastValidEndRef.current = secondsToMMSS(dur)
    }
    lastValidStartRef.current = '0:00'
  }, [])

  /** Handle slider change — clamp values to valid range. */
  const handleSliderChange = useCallback(
    (value: [number, number]) => {
      const [s, e] = value
      const clampedStart = clamp(s, 0, Math.max(0, duration - 0.1))
      const clampedEnd = clamp(e, clampedStart + 0.1, duration)
      setStartTime(clampedStart)
      setEndTime(clampedEnd)
      lastValidStartRef.current = secondsToMMSS(clampedStart)
      lastValidEndRef.current = secondsToMMSS(clampedEnd)
      setResult(null)
    },
    [duration]
  )

  /** Handle start time input — parse, validate, clamp. */
  const handleStartInput = useCallback(
    (raw: string) => {
      const seconds = mmssToSeconds(raw)
      if (isNaN(seconds)) {
        // Invalid input — reset to last valid value
        return
      }
      const clamped = clamp(seconds, 0, endTime - 0.1)
      setStartTime(clamped)
      lastValidStartRef.current = secondsToMMSS(clamped)
      setResult(null)
    },
    [endTime]
  )

  /** Handle end time input — parse, validate, clamp. */
  const handleEndInput = useCallback(
    (raw: string) => {
      const seconds = mmssToSeconds(raw)
      if (isNaN(seconds)) {
        return
      }
      const clamped = clamp(seconds, startTime + 0.1, duration)
      setEndTime(clamped)
      lastValidEndRef.current = secondsToMMSS(clamped)
      setResult(null)
    },
    [startTime, duration]
  )

  /** Play only the selected segment. */
  const handlePlay = useCallback(() => {
    if (!originalFile || duration <= 0) return

    // Create or reuse audio element
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'metadata'
    }

    const audio = audioRef.current

    // If already playing, pause
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      return
    }

    // Ensure src is set
    if (!audio.src || audio.src === '') {
      const url = URL.createObjectURL(originalFile)
      audio.src = url
    }

    // Seek to start and play
    audio.currentTime = startTime
    setCurrentPlayTime(startTime)
    audio.play().catch(() => {
      // Browser blocked autoplay or other error
    })

    setIsPlaying(true)
    animationRef.current = requestAnimationFrame(updateCurrentTime)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalFile, duration, startTime, endTime, isPlaying, updateCurrentTime])

  /** Pause playback. */
  const handlePause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setIsPlaying(false)
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
  }, [])

  /** Execute the trim operation. */
  const handleTrim = useCallback(async () => {
    if (!originalFile || duration <= 0) return

    setError(null)
    setIsProcessing(true)
    setProgress(0)
    setResult(null)

    try {
      const trimResult = await trimAudio(
        originalFile,
        {
          format: outputFormat,
          startTime,
          endTime,
          bitrate: isBitrateFormat(outputFormat) ? bitrate : undefined,
          sampleRate: outputFormat === 'wav' || outputFormat === 'flac' ? sampleRate : undefined,
          compressionLevel: outputFormat === 'flac' ? compressionLevel : undefined,
        },
        duration,
        (p) => setProgress(p)
      )

      setResult({
        blob: trimResult.blob,
        originalSize: trimResult.originalSize,
        trimmedSize: trimResult.trimmedSize,
        originalDuration: trimResult.originalDuration,
        trimmedDuration: trimResult.trimmedDuration,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trim failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }, [originalFile, duration, outputFormat, startTime, endTime, bitrate, sampleRate, compressionLevel])

  /** Handle download. */
  const handleDownload = useCallback(() => {
    if (!result || !originalFile) return

    const baseName = originalFile.name.replace(/\.[^.]+$/, '')
    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(`${baseName}.${outputFormat}`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result, outputFormat, originalFile])

  /** Reset to initial state. */
  const handleReset = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    setOriginalFile(null)
    setDuration(0)
    setStartTime(0)
    setEndTime(0)
    setCurrentPlayTime(0)
    setIsPlaying(false)
    setResult(null)
    setError(null)
    setProgress(0)
    setOutputFormat('mp3')
    setBitrate('192')
    setSampleRate('44100')
    setCompressionLevel('5')
    lastValidStartRef.current = '0:00'
    lastValidEndRef.current = '0:00'
  }, [])

  // ─── Derived values ─────────────────────────────────────────────────────

  const showBitrateControl = isBitrateFormat(outputFormat)
  const showSampleRateControl = outputFormat === 'wav' || outputFormat === 'flac'
  const showCompressionControl = outputFormat === 'flac'
  const segmentDuration = endTime - startTime
  const canTrim = originalFile !== null && duration > 0 && !isProcessing

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left Column ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {error && (
            <ErrorCard
              title="Trim Failed"
              message={error}
              onRetry={handleTrim}
            />
          )}

          {!originalFile ? (
            <UploadDropzone
              acceptedFormats={ACCEPTED_FORMATS}
              onFileSelect={handleFileSelect}
            />
          ) : isProcessing ? (
            <div className="space-y-4">
              <ProcessingStatus message="Trimming your audio..." />
              <ProgressBar
                percent={progress}
                label="Trim Progress"
                detail={
                  progress < 100
                    ? 'Extracting segment with advanced audio technology...'
                    : 'Finalizing output...'
                }
              />
            </div>
          ) : result ? (
            /* ── Result state ──────────────────────────────────────────── */
            <div className="space-y-6">
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-4">Trim Complete</h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-center">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Original Duration</div>
                    <div className="font-semibold text-sm">
                      {secondsToMMSS(result.originalDuration)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Trimmed Duration</div>
                    <div className="font-semibold text-sm">
                      {secondsToMMSS(result.trimmedDuration)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Output Format</div>
                    <div className="font-semibold text-sm">{outputFormat.toUpperCase()}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Quality</div>
                    <div className="font-semibold text-sm">
                      {showBitrateControl
                        ? `${bitrate} kbps`
                        : showSampleRateControl
                          ? `${sampleRate === '44100' ? '44.1' : '48'} kHz`
                          : `Level ${compressionLevel}`}
                    </div>
                  </div>
                </div>

                <h4 className="text-sm font-medium text-muted-foreground mb-3">File Sizes</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Original</div>
                    <div className="text-2xl font-bold text-foreground">
                      {formatBytes(result.originalSize)}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Trimmed</div>
                    <div className="text-2xl font-bold text-foreground">
                      {formatBytes(result.trimmedSize)}
                    </div>
                    {result.originalSize > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {result.trimmedSize < result.originalSize
                          ? `${Math.round(
                              ((result.originalSize - result.trimmedSize) / result.originalSize) * 100
                            )}% smaller`
                          : 'Same size'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 flex-1"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Trimmed {outputFormat.toUpperCase()}
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Trim Another
                </Button>
              </div>
            </div>
          ) : (
            /* ── Upload + Segment Selection state ──────────────────────── */
            <div className="space-y-6">
              {/* File info bar */}
              <div className="flex items-center gap-4 p-4 border border-border rounded-xl bg-card">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{originalFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(originalFile.size)} • {secondsToMMSS(duration)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Change File
                </Button>
              </div>

              {/* Segment Selection */}
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-6">Select Segment</h3>

                {/* Dual-handle slider */}
                <div className="mb-6">
                  <Slider
                    min={0}
                    max={duration}
                    step={0.1}
                    value={[startTime, endTime]}
                    onValueChange={handleSliderChange}
                  />
                </div>

                {/* Time labels under slider */}
                <div className="flex justify-between text-xs text-muted-foreground mb-6">
                  <span>0:00</span>
                  <span>{secondsToMMSS(duration)}</span>
                </div>

                {/* Time inputs + segment info */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">Start</label>
                    <input
                      type="text"
                      value={secondsToMMSS(startTime)}
                      onChange={(e) => handleStartInput(e.target.value)}
                      onBlur={(e) => {
                        // Reset to last valid on blur if current is invalid
                        const parsed = mmssToSeconds(e.target.value)
                        if (isNaN(parsed)) {
                          setStartTime(
                            clamp(
                              mmssToSeconds(lastValidStartRef.current) || 0,
                              0,
                              endTime - 0.1
                            )
                          )
                        }
                      }}
                      className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm text-center font-mono"
                      disabled={duration <= 0}
                    />
                  </div>

                  <div className="text-center pt-5">
                    <span className="text-muted-foreground text-sm">to</span>
                  </div>

                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground">End</label>
                    <input
                      type="text"
                      value={secondsToMMSS(endTime)}
                      onChange={(e) => handleEndInput(e.target.value)}
                      onBlur={(e) => {
                        const parsed = mmssToSeconds(e.target.value)
                        if (isNaN(parsed)) {
                          setEndTime(
                            clamp(
                              mmssToSeconds(lastValidEndRef.current) || duration,
                              startTime + 0.1,
                              duration
                            )
                          )
                        }
                      }}
                      className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm text-center font-mono"
                      disabled={duration <= 0}
                    />
                  </div>
                </div>

                {/* Segment duration display */}
                <div className="text-center mt-4">
                  <span className="text-sm text-muted-foreground">
                    Segment duration:{' '}
                    <span className="font-semibold text-foreground">
                      {secondsToMMSS(segmentDuration)}
                    </span>
                  </span>
                </div>
              </div>

              {/* Playback controls */}
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-4">Preview Segment</h3>

                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={isPlaying ? handlePause : handlePlay}
                    disabled={duration <= 0}
                    className="gap-2"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Play Segment
                      </>
                    )}
                  </Button>

                  {/* Mini progress bar for playback position */}
                  <div className="flex-1">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-75"
                        style={{
                          width: duration > 0
                            ? `${((currentPlayTime - startTime) / Math.max(0.1, segmentDuration)) * 100}%`
                            : '0%',
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 text-center">
                      {secondsToMMSS(currentPlayTime)} / {secondsToMMSS(endTime)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* How To Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Trim Audio</h2>
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
            <FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" />
          </div>
        </div>

        {/* ── Right Column: Options ────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-6">Trim Options</h3>

              {/* Output Format */}
              <div className="mb-6">
                <label className="text-sm font-medium">Output Format</label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as AudioFormat)}
                  className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  disabled={isProcessing}
                >
                  {OUTPUT_FORMATS.map((fmt) => (
                    <option key={fmt.value} value={fmt.value}>
                      {fmt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bitrate (MP3/AAC/OGG/M4A) */}
              {showBitrateControl && (
                <div className="mb-6">
                  <label className="text-sm font-medium flex justify-between">
                    <span>Bitrate</span>
                    <span className="text-primary font-semibold">{bitrate} kbps</span>
                  </label>
                  <select
                    value={bitrate}
                    onChange={(e) => setBitrate(e.target.value as Bitrate)}
                    className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    disabled={isProcessing}
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

              {/* Sample rate (WAV/FLAC) */}
              {showSampleRateControl && (
                <div className="mb-6">
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
                    disabled={isProcessing}
                  >
                    {SAMPLE_RATE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {outputFormat === 'flac'
                      ? 'FLAC is lossless — sample rate is the primary quality control.'
                      : 'WAV is lossless — sample rate is the primary quality control.'}
                  </p>
                </div>
              )}

              {/* Compression level (FLAC) */}
              {showCompressionControl && (
                <div className="mb-6">
                  <label className="text-sm font-medium flex justify-between">
                    <span>Compression Level</span>
                    <span className="text-primary font-semibold">Level {compressionLevel}</span>
                  </label>
                  <select
                    value={compressionLevel}
                    onChange={(e) => setCompressionLevel(e.target.value as FLACCompression)}
                    className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    disabled={isProcessing}
                  >
                    {COMPRESSION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    FLAC is lossless — higher compression = smaller file, slower encoding.
                  </p>
                </div>
              )}

              <Button
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!canTrim}
                onClick={handleTrim}
              >
                {isProcessing ? 'Trimming...' : 'Trim Audio'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
