'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { convertAudio } from '@/features/audio/utils/audioConverter'
import { getSaveVexFileName } from '@/utils/fileNames'
import { formatBytes } from '@/utils/formatBytes'
import {
  AUDIO_MIME_TYPES,
  type AudioFormat,
  type Bitrate,
  type SampleRate,
  type FLACCompression,
  type AudioConversionResult,
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
    question: 'What audio formats are supported?',
    answer:
      'Audio Converter supports converting between MP3, WAV, AAC, OGG, FLAC, and M4A formats. All processing happens locally in your browser using advanced audio processing technology — your files never leave your device.',
  },
  {
    question: 'What quality options are available?',
    answer:
      'For lossy formats (MP3, AAC, OGG, M4A), you can select the bitrate from 64 kbps (smallest file) to 320 kbps (highest quality). For WAV output, you can choose the sample rate (44.1 kHz or 48 kHz). For FLAC, you can set the compression level from 0 (fastest) to 8 (smallest file size).',
  },
  {
    question: 'Is my audio uploaded to a server?',
    answer:
      'No. All audio conversion happens entirely in your browser. Your files are never uploaded to any server — they remain 100% private and secure on your device.',
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
    title: 'Choose your output format',
    desc: 'Select your desired format (MP3, WAV, AAC, OGG, FLAC, or M4A) and adjust quality settings.',
  },
  {
    step: 3,
    title: 'Convert & download',
    desc: 'Click Convert and download your converted audio file with a single click.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format duration in seconds to a human-readable string (e.g. "3:42"). */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Determine whether the given format uses a bitrate-based quality control. */
function isBitrateFormat(format: AudioFormat): boolean {
  return format === 'mp3' || format === 'aac' || format === 'ogg' || format === 'm4a'
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Audio Converter tool.
 *
 * Flow: Upload → Select format & quality → Convert → Download
 * Uses ffmpeg.wasm (lazy-loaded) for all format conversions.
 */
export function ConvertAudio() {
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [outputFormat, setOutputFormat] = useState<AudioFormat>('mp3')
  const [bitrate, setBitrate] = useState<Bitrate>('192')
  const [sampleRate, setSampleRate] = useState<SampleRate>('44100')
  const [compressionLevel, setCompressionLevel] = useState<FLACCompression>('5')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<AudioConversionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Track whether we should auto-convert when options change
  const hasAutoConverted = useRef(false)

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (result?.blob) {
        // No blob URL to revoke — we create it on demand for download
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Run the conversion with current settings. */
  const runConversion = useCallback(
    async (file: File, format: AudioFormat, br: Bitrate, sr: SampleRate, cl: FLACCompression) => {
      setError(null)
      setIsProcessing(true)
      setProgress(0)
      setResult(null)

      try {
        const conversionResult = await convertAudio(
          file,
          { format, bitrate: br, sampleRate: sr, compressionLevel: cl },
          (p) => setProgress(p)
        )
        setResult(conversionResult)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Conversion failed. Please try again.')
      } finally {
        setIsProcessing(false)
      }
    },
    []
  )

  /** Handle file upload — auto-convert on selection. */
  const handleFileSelect = useCallback(
    (file: File) => {
      setOriginalFile(file)
      setResult(null)
      setError(null)
      hasAutoConverted.current = false
      runConversion(file, outputFormat, bitrate, sampleRate, compressionLevel)
    },
    [outputFormat, bitrate, sampleRate, compressionLevel, runConversion]
  )

  /** Handle format change — re-convert if a file is loaded. */
  const handleFormatChange = useCallback(
    (newFormat: AudioFormat) => {
      setOutputFormat(newFormat)
      if (originalFile) {
        runConversion(originalFile, newFormat, bitrate, sampleRate, compressionLevel)
      }
    },
    [originalFile, bitrate, sampleRate, compressionLevel, runConversion]
  )

  /** Handle bitrate change — re-convert if applicable. */
  const handleBitrateChange = useCallback(
    (newBitrate: Bitrate) => {
      setBitrate(newBitrate)
      if (originalFile && isBitrateFormat(outputFormat)) {
        runConversion(originalFile, outputFormat, newBitrate, sampleRate, compressionLevel)
      }
    },
    [originalFile, outputFormat, sampleRate, compressionLevel, runConversion]
  )

  /** Handle sample rate change — re-convert if WAV. */
  const handleSampleRateChange = useCallback(
    (newSampleRate: SampleRate) => {
      setSampleRate(newSampleRate)
      if (originalFile && outputFormat === 'wav') {
        runConversion(originalFile, outputFormat, bitrate, newSampleRate, compressionLevel)
      }
    },
    [originalFile, outputFormat, bitrate, compressionLevel, runConversion]
  )

  /** Handle compression level change — re-convert if FLAC. */
  const handleCompressionChange = useCallback(
    (newLevel: FLACCompression) => {
      setCompressionLevel(newLevel)
      if (originalFile && outputFormat === 'flac') {
        runConversion(originalFile, outputFormat, bitrate, sampleRate, newLevel)
      }
    },
    [originalFile, outputFormat, bitrate, sampleRate, runConversion]
  )

  /** Trigger download of the converted file. */
  const handleDownload = useCallback(() => {
    if (!result || !originalFile) return

    const ext = outputFormat
    const baseName = originalFile.name.replace(/\.[^.]+$/, '')

    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(`${baseName}.${ext}`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result, outputFormat, originalFile])

  /** Reset all state to initial. */
  const handleReset = useCallback(() => {
    setOriginalFile(null)
    setResult(null)
    setError(null)
    setProgress(0)
    setOutputFormat('mp3')
    setBitrate('192')
    setSampleRate('44100')
    setCompressionLevel('5')
    hasAutoConverted.current = false
  }, [])

  // ─── Derived display values ─────────────────────────────────────────────

  const showBitrateControl = isBitrateFormat(outputFormat)
  const showSampleRateControl = outputFormat === 'wav'
  const showCompressionControl = outputFormat === 'flac'

  const inputFormatLabel = originalFile
    ? (originalFile.name.split('.').pop()?.toUpperCase() ?? '—')
    : null

  const outputFormatLabel = outputFormat.toUpperCase()

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left Column: Main content ───────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {error && (
            <ErrorCard
              title="Conversion Failed"
              message={error}
              onRetry={() =>
                originalFile &&
                runConversion(originalFile, outputFormat, bitrate, sampleRate, compressionLevel)
              }
            />
          )}

          {!originalFile ? (
            <UploadDropzone
              acceptedFormats={ACCEPTED_FORMATS}
              onFileSelect={handleFileSelect}
            />
          ) : isProcessing ? (
            <div className="space-y-4">
              <ProcessingStatus message="Converting your audio..." />
              <ProgressBar
                percent={progress}
                label="Conversion Progress"
                detail={
                  progress < 100
                    ? 'Processing with advanced audio technology...'
                    : 'Finalizing output...'
                }
              />
            </div>
          ) : result ? (
            <div className="space-y-6">
              {/* File Info + Size Comparison */}
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-4">Conversion Complete</h3>

                {/* File details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 text-center">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Input Format</div>
                    <div className="font-semibold text-sm">{inputFormatLabel}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Output Format</div>
                    <div className="font-semibold text-sm">{outputFormatLabel}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Duration</div>
                    <div className="font-semibold text-sm">{formatDuration(result.duration)}</div>
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

                {/* Size comparison */}
                <h4 className="text-sm font-medium text-muted-foreground mb-3">File Sizes</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Original</div>
                    <div className="text-2xl font-bold text-foreground">
                      {formatBytes(result.originalSize)}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Converted</div>
                    <div className="text-2xl font-bold text-foreground">
                      {formatBytes(result.convertedSize)}
                    </div>
                    {result.originalSize > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {result.convertedSize < result.originalSize
                          ? `${Math.round(
                              ((result.originalSize - result.convertedSize) / result.originalSize) * 100
                            )}% smaller`
                          : result.convertedSize > result.originalSize
                            ? `${Math.round(
                                ((result.convertedSize - result.originalSize) / result.originalSize) * 100
                              )}% larger`
                            : 'Same size'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 flex-1"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download {outputFormatLabel}
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Convert Another
                </Button>
              </div>
            </div>
          ) : null}

          {/* How To Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Convert Audio</h2>
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
              <h3 className="font-semibold text-lg mb-6">Conversion Options</h3>

              {/* Output Format */}
              <div className="mb-6">
                <label className="text-sm font-medium">Output Format</label>
                <select
                  value={outputFormat}
                  onChange={(e) => handleFormatChange(e.target.value as AudioFormat)}
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

              {/* Bitrate selector (MP3/AAC/OGG/M4A) */}
              {showBitrateControl && (
                <div className="mb-6">
                  <label className="text-sm font-medium flex justify-between">
                    <span>Bitrate</span>
                    <span className="text-primary font-semibold">{bitrate} kbps</span>
                  </label>
                  <select
                    value={bitrate}
                    onChange={(e) => handleBitrateChange(e.target.value as Bitrate)}
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

              {/* Sample rate selector (WAV) */}
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
                    onChange={(e) => handleSampleRateChange(e.target.value as SampleRate)}
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
                    WAV is lossless — sample rate is the primary quality control.
                  </p>
                </div>
              )}

              {/* Compression level selector (FLAC) */}
              {showCompressionControl && (
                <div className="mb-6">
                  <label className="text-sm font-medium flex justify-between">
                    <span>Compression Level</span>
                    <span className="text-primary font-semibold">Level {compressionLevel}</span>
                  </label>
                  <select
                    value={compressionLevel}
                    onChange={(e) => handleCompressionChange(e.target.value as FLACCompression)}
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

              {/* Convert Button */}
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!originalFile || isProcessing}
                onClick={() =>
                  originalFile &&
                  runConversion(originalFile, outputFormat, bitrate, sampleRate, compressionLevel)
                }
              >
                {isProcessing ? 'Converting...' : 'Convert'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
