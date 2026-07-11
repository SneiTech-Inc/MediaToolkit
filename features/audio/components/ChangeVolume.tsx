'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Download, RotateCcw, Play, Pause } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import {
  changeVolume,
  ratioToPercent,
  percentToRatio,
  ratioToDb,
} from '@/features/audio/utils/audioVolumeChanger'
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

type DisplayMode = 'percent' | 'db'

interface Preset {
  label: string
  ratio: number
  variant?: 'default' | 'secondary'
}

const PRESETS: Preset[] = [
  { label: 'Mute', ratio: 0 },
  { label: '25%', ratio: 0.25 },
  { label: '50%', ratio: 0.5 },
  { label: 'Normal', ratio: 1.0 },
  { label: '150%', ratio: 1.5 },
  { label: '200%', ratio: 2.0 },
]

const TOOL_FAQS = [
  {
    question: 'What audio formats can I adjust volume for?',
    answer:
      'You can adjust the volume of MP3, WAV, AAC, OGG, FLAC, and M4A files. You can also export the result in any of these formats.',
  },
  {
    question: 'What volume range is supported?',
    answer:
      'You can adjust from 0% (complete silence) up to 200% (double the original level). When boosting above 100%, a limiter is automatically applied to prevent clipping and distortion — so even loud source files won\'t sound cracked or harsh after boosting.',
  },
  {
    question: 'Is my audio uploaded to a server?',
    answer:
      'No. All volume processing happens entirely in your browser using advanced audio processing technology. Your files are never uploaded to any server — they remain 100% private and secure on your device.',
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
    title: 'Adjust the volume',
    desc: 'Use the slider or preset buttons to set your desired volume level. Preview the result in real time — no re-encoding needed.',
  },
  {
    step: 3,
    title: 'Export & download',
    desc: 'Click Apply Volume to render the change and download your adjusted audio file.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format volume value for display based on mode. */
function formatVolume(ratio: number, mode: DisplayMode): string {
  if (mode === 'percent') return `${ratioToPercent(ratio)}%`
  const db = ratioToDb(ratio)
  if (!isFinite(db)) return '-∞ dB'
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`
}

/** Get audio duration using native <audio> element. */
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

function isBitrateFormat(format: AudioFormat): boolean {
  return format === 'mp3' || format === 'aac' || format === 'ogg' || format === 'm4a'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChangeVolume() {
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [duration, setDuration] = useState(0)
  const [ratio, setRatio] = useState(1.0)
  const [displayMode, setDisplayMode] = useState<DisplayMode>('percent')
  const [outputFormat, setOutputFormat] = useState<AudioFormat>('mp3')
  const [bitrate, setBitrate] = useState<Bitrate>('192')
  const [sampleRate, setSampleRate] = useState<SampleRate>('44100')
  const [compressionLevel, setCompressionLevel] = useState<FLACCompression>('5')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{
    blob: Blob
    originalSize: number
    adjustedSize: number
    ratio: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Web Audio graph — built ONCE per file, cached in refs
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const graphBuiltRef = useRef(false)

  /** Build (or reuse) the Web Audio graph for this audio element. */
  const ensureAudioGraph = useCallback(
    (audioEl: HTMLAudioElement) => {
      if (graphBuiltRef.current) return // Already built for current element

      // Resume context if suspended (browser autoplay policy)
      const ctx = audioCtxRef.current || new AudioContext()
      audioCtxRef.current = ctx

      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const source = ctx.createMediaElementSource(audioEl)
      sourceRef.current = source

      const gain = ctx.createGain()
      gain.gain.value = ratio
      gainNodeRef.current = gain

      source.connect(gain)
      gain.connect(ctx.destination)

      graphBuiltRef.current = true
    },
    [ratio]
  )

  /** Sync gain node to current ratio. */
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = ratio
    }
  }, [ratio])

  /** Cleanup audio graph and element on unmount. */
  useEffect(() => {
    return () => {
      if (audioElRef.current) {
        audioElRef.current.pause()
        audioElRef.current.src = ''
      }
      // Don't close AudioContext — it may be reused. Just clean up refs.
    }
  }, [])

  /** Handle file upload. */
  const handleFileSelect = useCallback(async (file: File) => {
    // Reset audio graph for new file
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current.src = ''
    }
    graphBuiltRef.current = false
    audioElRef.current = null
    audioCtxRef.current = null
    gainNodeRef.current = null
    sourceRef.current = null

    setOriginalFile(file)
    setResult(null)
    setError(null)
    setRatio(1.0)
    setIsPlaying(false)

    const dur = await getAudioDuration(file)
    setDuration(dur)
  }, [])

  /** Handle slider change — convert 0-200 to ratio. */
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const percent = parseInt(e.target.value, 10)
    setRatio(percentToRatio(percent))
    setResult(null)
  }, [])

  /** Handle preset click. */
  const handlePreset = useCallback((newRatio: number) => {
    setRatio(newRatio)
    setResult(null)
  }, [])

  /** Toggle percent / dB display. */
  const toggleDisplayMode = useCallback(() => {
    setDisplayMode((prev) => (prev === 'percent' ? 'db' : 'percent'))
  }, [])

  /** Play/pause preview. */
  const handlePreviewToggle = useCallback(() => {
    if (!originalFile) return

    // Create audio element once
    if (!audioElRef.current) {
      audioElRef.current = new Audio()
      audioElRef.current.preload = 'auto'
    }

    const audioEl = audioElRef.current

    if (isPlaying) {
      audioEl.pause()
      setIsPlaying(false)
      return
    }

    // Set source if needed
    if (!audioEl.src || audioEl.src === '') {
      audioEl.src = URL.createObjectURL(originalFile)
    }

    ensureAudioGraph(audioEl)

    audioEl.play().catch(() => {
      // Browser blocked autoplay
    })
    setIsPlaying(true)

    audioEl.onended = () => setIsPlaying(false)
    audioEl.onpause = () => setIsPlaying(false)
  }, [originalFile, isPlaying, ensureAudioGraph])

  /** Apply volume and process via ffmpeg. */
  const handleApply = useCallback(async () => {
    if (!originalFile) return

    setError(null)
    setIsProcessing(true)
    setProgress(0)
    setResult(null)

    try {
      const volResult = await changeVolume(
        originalFile,
        {
          format: outputFormat,
          ratio,
          bitrate: isBitrateFormat(outputFormat) ? bitrate : undefined,
          sampleRate: outputFormat === 'wav' || outputFormat === 'flac' ? sampleRate : undefined,
          compressionLevel: outputFormat === 'flac' ? compressionLevel : undefined,
        },
        (p) => setProgress(p)
      )

      setResult({
        blob: volResult.blob,
        originalSize: volResult.originalSize,
        adjustedSize: volResult.adjustedSize,
        ratio: volResult.ratio,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Volume adjustment failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }, [originalFile, outputFormat, ratio, bitrate, sampleRate, compressionLevel])

  /** Download. */
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

  /** Reset. */
  const handleReset = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current.src = ''
    }
    graphBuiltRef.current = false
    audioElRef.current = null
    audioCtxRef.current = null
    gainNodeRef.current = null
    sourceRef.current = null
    setOriginalFile(null)
    setDuration(0)
    setRatio(1.0)
    setDisplayMode('percent')
    setIsPlaying(false)
    setResult(null)
    setError(null)
    setProgress(0)
    setOutputFormat('mp3')
    setBitrate('192')
    setSampleRate('44100')
    setCompressionLevel('5')
  }, [])

  // ─── Derived ─────────────────────────────────────────────────────────────

  const showBitrateControl = isBitrateFormat(outputFormat)
  const showSampleRateControl = outputFormat === 'wav' || outputFormat === 'flac'
  const showCompressionControl = outputFormat === 'flac'
  const sliderValue = ratioToPercent(ratio)

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left Column ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {error && (
            <ErrorCard title="Volume Adjustment Failed" message={error} onRetry={handleApply} />
          )}

          {!originalFile ? (
            <UploadDropzone acceptedFormats={ACCEPTED_FORMATS} onFileSelect={handleFileSelect} />
          ) : isProcessing ? (
            <div className="space-y-4">
              <ProcessingStatus message="Applying volume adjustment..." />
              <ProgressBar
                percent={progress}
                label="Processing Progress"
                detail={progress < 100 ? 'Adjusting audio levels...' : 'Finalizing output...'}
              />
            </div>
          ) : result ? (
            /* ── Result ──────────────────────────────────────────────── */
            <div className="space-y-6">
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-4">Volume Adjusted</h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-center">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Duration</div>
                    <div className="font-semibold text-sm">
                      {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Volume</div>
                    <div className="font-semibold text-sm">{formatVolume(result.ratio, displayMode)}</div>
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
                    <div className="text-2xl font-bold">{formatBytes(result.originalSize)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Adjusted</div>
                    <div className="text-2xl font-bold">{formatBytes(result.adjustedSize)}</div>
                    {result.originalSize > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {result.adjustedSize < result.originalSize
                          ? `${Math.round(((result.originalSize - result.adjustedSize) / result.originalSize) * 100)}% smaller`
                          : result.adjustedSize > result.originalSize
                            ? `${Math.round(((result.adjustedSize - result.originalSize) / result.originalSize) * 100)}% larger`
                            : 'Same size'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" className="bg-primary hover:bg-primary/90 flex-1" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Download {outputFormat.toUpperCase()}
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Adjust Another
                </Button>
              </div>
            </div>
          ) : (
            /* ── Upload + Volume Controls ────────────────────────────── */
            <div className="space-y-6">
              {/* File info bar */}
              <div className="flex items-center gap-4 p-4 border border-border rounded-xl bg-card">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{originalFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(originalFile.size)}
                    {duration > 0 && (
                      <>
                        {' '}&middot;{' '}
                        {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
                      </>
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Change File
                </Button>
              </div>

              {/* Volume controls */}
              <div className="border border-border rounded-xl p-6 bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Volume</h3>
                  <button
                    onClick={toggleDisplayMode}
                    className="text-sm text-primary hover:underline"
                  >
                    {displayMode === 'percent' ? 'Show dB' : 'Show %'}
                  </button>
                </div>

                {/* Slider */}
                <div className="mb-6">
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={1}
                    value={sliderValue}
                    onChange={handleSliderChange}
                    className="w-full h-2 rounded-full bg-muted appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0%</span>
                    <span className="font-semibold text-foreground text-base">
                      {formatVolume(ratio, displayMode)}
                    </span>
                    <span>200%</span>
                  </div>
                </div>

                {/* Presets */}
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      variant={ratio === preset.ratio ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePreset(preset.ratio)}
                      className={ratio === preset.ratio ? 'bg-primary' : ''}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-4">Preview</h3>
                <Button
                  variant="outline"
                  onClick={handlePreviewToggle}
                  disabled={!originalFile}
                  className="gap-2"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" /> Play at {formatVolume(ratio, displayMode)}
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Preview uses real-time gain adjustment — no re-encoding needed.
                  Sounds exactly like the final output.
                </p>
              </div>
            </div>
          )}

          {/* How To */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Change Audio Volume</h2>
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

        {/* ── Right Column ────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-6">Export Options</h3>

              <div className="mb-6">
                <label className="text-sm font-medium">Output Format</label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as AudioFormat)}
                  className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  disabled={isProcessing}
                >
                  {OUTPUT_FORMATS.map((fmt) => (
                    <option key={fmt.value} value={fmt.value}>{fmt.label}</option>
                  ))}
                </select>
              </div>

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
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Smaller file</span>
                    <span>Better quality</span>
                  </div>
                </div>
              )}

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
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {outputFormat === 'flac'
                      ? 'FLAC is lossless — sample rate is the primary quality control.'
                      : 'WAV is lossless — sample rate is the primary quality control.'}
                  </p>
                </div>
              )}

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
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    FLAC is lossless — higher compression = smaller file, slower encoding.
                  </p>
                </div>
              )}

              <Button
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!originalFile || isProcessing}
                onClick={handleApply}
              >
                {isProcessing ? 'Processing...' : 'Apply Volume'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
