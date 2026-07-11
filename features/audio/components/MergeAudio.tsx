'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { Upload, Download, RotateCcw, GripVertical, X, Music } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { mergeAudioFiles } from '@/features/audio/utils/audioMerger'
import { getSaveVexFileName } from '@/utils/fileNames'
import { formatBytes } from '@/utils/formatBytes'
import type {
  AudioFormat,
  Bitrate,
  SampleRate,
  FLACCompression,
} from '@/features/audio/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileWithId {
  id: string
  file: File
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_FORMATS = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a']
const MAX_FILES = 20

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
    question: 'What audio formats can I merge?',
    answer:
      'You can merge MP3, WAV, AAC, OGG, FLAC, and M4A files — even mixing different formats in the same merge. All files are automatically normalized to the same sample rate and channel layout before combining, so the output plays back smoothly without glitches.',
  },
  {
    question: 'Can I reorder the files before merging?',
    answer:
      'Yes! Drag and drop the files in the list to arrange them in any order. The merge follows the exact order shown — top file plays first, bottom file plays last.',
  },
  {
    question: 'Is my audio uploaded to a server?',
    answer:
      'No. All audio merging happens entirely in your browser. Your files are never uploaded to any server — they remain 100% private and secure on your device.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Upload your audio files',
    desc: 'Select 2 to 20 audio files (MP3, WAV, AAC, OGG, FLAC, or M4A). They can be different formats.',
  },
  {
    step: 2,
    title: 'Arrange the order',
    desc: 'Drag and drop the files to set the order they should play in the merged track.',
  },
  {
    step: 3,
    title: 'Choose format & merge',
    desc: 'Select your output format and quality settings, then click Merge to create a single combined audio file.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format duration in seconds to a human-readable string (e.g. "3:42"). */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Get the duration of an audio file using a native <audio> element. */
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
      resolve(isFinite(dur) ? dur : 0)
    }

    audio.onerror = () => {
      cleanup()
      resolve(0)
    }

    audio.src = url
  })
}

/** Determine whether the given format uses a bitrate-based quality control. */
function isBitrateFormat(format: AudioFormat): boolean {
  return format === 'mp3' || format === 'aac' || format === 'ogg' || format === 'm4a'
}

/** Generate a short unique ID. */
function uid(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SortableFileItemProps {
  item: FileWithId
  duration: number
  onRemove: (id: string) => void
}

/** A single sortable row in the file list. */
function SortableFileItem({ item, duration, onRemove }: SortableFileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const ext = item.file.name.split('.').pop()?.toUpperCase() ?? '—'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border border-border rounded-lg bg-background"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* File icon */}
      <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Music className="w-4 h-4 text-primary" />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(item.file.size)} — {formatDuration(duration)}
        </p>
      </div>

      {/* Format badge */}
      <span className="shrink-0 text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
        {ext}
      </span>

      {/* Remove button */}
      <button
        onClick={() => onRemove(item.id)}
        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
        aria-label={`Remove ${item.file.name}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * Merge Audio tool.
 *
 * Flow: Upload 2–20 files → Reorder → Select format & quality → Merge → Download
 * Uses ffmpeg.wasm (shared singleton) for all audio merging.
 */
export function MergeAudio() {
  const [files, setFiles] = useState<FileWithId[]>([])
  const [fileDurations, setFileDurations] = useState<Record<string, number>>({})
  const [outputFormat, setOutputFormat] = useState<AudioFormat>('mp3')
  const [bitrate, setBitrate] = useState<Bitrate>('192')
  const [sampleRate, setSampleRate] = useState<SampleRate>('44100')
  const [compressionLevel, setCompressionLevel] = useState<FLACCompression>('5')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{
    blob: Blob
    totalInputSize: number
    outputSize: number
    fileCount: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const durationsLoading = useRef(false)

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  /** Load durations for newly added files (whose durations aren't yet known). */
  const loadDurations = useCallback(async (newFiles: FileWithId[]) => {
    const unknown = newFiles.filter((f) => !(f.id in fileDurations))
    if (unknown.length === 0) return

    // Prevent concurrent duration loads
    if (durationsLoading.current) return
    durationsLoading.current = true

    const entries: Record<string, number> = {}
    for (const f of unknown) {
      entries[f.id] = await getAudioDuration(f.file)
    }

    setFileDurations((prev) => ({ ...prev, ...entries }))
    durationsLoading.current = false
  }, [fileDurations])

  /** Add new files to the list (validates format, caps at MAX_FILES). */
  const addFiles = useCallback(
    (newFiles: File[]) => {
      setError(null)
      setResult(null)

      const validFiles: FileWithId[] = []
      for (const file of newFiles) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
        if (!ACCEPTED_FORMATS.includes(ext)) continue
        validFiles.push({ id: uid(), file })
      }

      if (validFiles.length === 0) return

      setFiles((prev) => {
        const combined = [...prev, ...validFiles].slice(0, MAX_FILES)
        // Load durations asynchronously
        loadDurations(combined)
        return combined
      })
    },
    [loadDurations]
  )

  /** Handle file input change. */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(Array.from(e.target.files))
      }
      e.target.value = ''
    },
    [addFiles]
  )

  /** Drag and drop handlers. */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(Array.from(e.dataTransfer.files))
      }
    },
    [addFiles]
  )

  /** Remove a file from the list. */
  const handleRemove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    setFileDurations((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setResult(null)
    setError(null)
  }, [])

  /** Handle drag-and-drop reorder. */
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setFiles((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id)
      const newIndex = prev.findIndex((f) => f.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }, [])

  /** Execute the merge. */
  const runMerge = useCallback(async () => {
    if (files.length < 2) return

    setError(null)
    setIsProcessing(true)
    setProgress(0)
    setResult(null)

    try {
      const mergeResult = await mergeAudioFiles(
        files.map((f) => f.file),
        {
          format: outputFormat,
          bitrate,
          sampleRate,
          compressionLevel,
        },
        (p) => setProgress(p)
      )

      setResult({
        blob: mergeResult.blob,
        totalInputSize: mergeResult.totalInputSize,
        outputSize: mergeResult.outputSize,
        fileCount: mergeResult.fileCount,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }, [files, outputFormat, bitrate, sampleRate, compressionLevel])

  /** Trigger download. */
  const handleDownload = useCallback(() => {
    if (!result) return

    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(`merged.${outputFormat}`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result, outputFormat])

  /** Reset everything. */
  const handleReset = useCallback(() => {
    setFiles([])
    setFileDurations({})
    setResult(null)
    setError(null)
    setProgress(0)
    setOutputFormat('mp3')
    setBitrate('192')
    setSampleRate('44100')
    setCompressionLevel('5')
  }, [])

  // ─── Derived display values ─────────────────────────────────────────────

  const showBitrateControl = isBitrateFormat(outputFormat)
  const showSampleRateControl = outputFormat === 'wav' || outputFormat === 'flac'
  const showCompressionControl = outputFormat === 'flac'
  const totalInputSize = files.reduce((sum, f) => sum + f.file.size, 0)
  const canMerge = files.length >= 2 && !isProcessing

  // Stable array of IDs for SortableContext
  const fileIds = useMemo(() => files.map((f) => f.id), [files])

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left Column: Main content ───────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {error && (
            <ErrorCard
              title="Merge Failed"
              message={error}
              onRetry={runMerge}
            />
          )}

          {result ? (
            /* ── Result state ────────────────────────────────────────── */
            <div className="space-y-6">
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-4">Merge Complete</h3>

                <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Files Merged</div>
                    <div className="font-semibold text-sm">{result.fileCount} files</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Output Format</div>
                    <div className="font-semibold text-sm">{outputFormat.toUpperCase()}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Total Duration</div>
                    <div className="font-semibold text-sm">
                      {formatDuration(
                        Object.values(fileDurations).reduce((sum, d) => sum + d, 0)
                      )}
                    </div>
                  </div>
                </div>

                {/* Size comparison */}
                <h4 className="text-sm font-medium text-muted-foreground mb-3">File Sizes</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Total Input</div>
                    <div className="text-2xl font-bold text-foreground">
                      {formatBytes(result.totalInputSize)}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Merged Output</div>
                    <div className="text-2xl font-bold text-foreground">
                      {formatBytes(result.outputSize)}
                    </div>
                    {result.totalInputSize > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {result.outputSize < result.totalInputSize
                          ? `${Math.round(
                              ((result.totalInputSize - result.outputSize) / result.totalInputSize) * 100
                            )}% smaller`
                          : result.outputSize > result.totalInputSize
                            ? `${Math.round(
                                ((result.outputSize - result.totalInputSize) / result.totalInputSize) * 100
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
                  Download Merged {outputFormat.toUpperCase()}
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Start Over
                </Button>
              </div>
            </div>
          ) : isProcessing ? (
            /* ── Processing state ─────────────────────────────────────── */
            <div className="space-y-4">
              <ProcessingStatus message={`Merging ${files.length} audio files...`} />
              <ProgressBar
                percent={progress}
                label="Merge Progress"
                detail={
                  progress < 100
                    ? 'Combining files with advanced audio technology...'
                    : 'Finalizing output...'
                }
              />
            </div>
          ) : (
            /* ── Upload + File list state ─────────────────────────────── */
            <div className="space-y-6">
              {/* Upload dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer ${
                  isDragOver
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-border hover:border-primary hover:bg-muted/20'
                }`}
                role="button"
                tabIndex={0}
                aria-label="Upload audio files"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    inputRef.current?.click()
                  }
                }}
              >
                <Upload className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                <h3 className="text-xl font-semibold mb-2">
                  {isDragOver
                    ? 'Drop your files here'
                    : files.length > 0
                      ? 'Add more files'
                      : 'Drop your audio files here or click to browse'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  Supported formats: {ACCEPTED_FORMATS.join(', ').toUpperCase()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Select 2–{MAX_FILES} files • Max 20 files
                </p>

                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  onChange={handleInputChange}
                  accept={ACCEPTED_FORMATS.map((f) => `.${f}`).join(',')}
                  className="absolute w-0 h-0 opacity-0 pointer-events-none"
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>

              {/* File list with drag reorder */}
              {files.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">
                      Files to Merge ({files.length}/{MAX_FILES})
                    </h3>
                    {files.length > 0 && (
                      <button
                        onClick={handleReset}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {files.length < 2 && (
                    <p className="text-sm text-muted-foreground">
                      Add at least {2 - files.length} more file{2 - files.length === 1 ? '' : 's'} to enable merging.
                    </p>
                  )}

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={fileIds}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {files.map((item, index) => (
                          <SortableFileItem
                            key={item.id}
                            item={item}
                            duration={fileDurations[item.id] ?? 0}
                            onRemove={handleRemove}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>

                  {/* Total size */}
                  <div className="text-sm text-muted-foreground text-right">
                    Total size: {formatBytes(totalInputSize)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* How To Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Merge Audio Files</h2>
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
              <h3 className="font-semibold text-lg mb-6">Merge Options</h3>

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

              {/* Bitrate selector (MP3/AAC/OGG/M4A) */}
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

              {/* Sample rate selector (WAV/FLAC) */}
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

              {/* Compression level selector (FLAC only) */}
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

              {/* Merge Button */}
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!canMerge}
                onClick={runMerge}
              >
                {isProcessing
                  ? 'Merging...'
                  : files.length < 2
                    ? `Add ${2 - files.length} More File${2 - files.length === 1 ? '' : 's'}`
                    : `Merge ${files.length} Files`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
