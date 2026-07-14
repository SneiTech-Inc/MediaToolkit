'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  Download, RotateCcw, Film, GripVertical, X,
  Plus, Scissors,
} from 'lucide-react'
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
import { mergeVideos, canUseConcatDemuxer } from '@/features/video/utils/videoMerger'
import { getBasicMetadata, getAdvancedMetadata, preloadFFmpeg } from '@/features/video/utils/videoMetadata'
import { formatDuration } from '@/features/video/utils/videoTimeline'
import { FORMAT_CONFIG, RESOLUTION_HEIGHT } from '@/features/video/types'
import { getSaveVexFileName } from '@/utils/fileNames'
import { formatBytes } from '@/utils/formatBytes'
import type {
  VideoOutputFormat,
  VideoPreset,
  VideoResolution,
  VideoFrameRate,
  VideoMetadata,
  ExtendedVideoMetadata,
  MergeFileInfo,
} from '@/features/video/types'
import { DEFAULT_CRF, MIN_CRF, MAX_CRF } from '@/features/video/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_FORMATS = ['mp4', 'webm', 'mov', 'mkv', 'avi']
const MAX_FILE_COUNT = 20
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500 MB

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
    question: 'What video formats are supported for merging?',
    answer:
      'You can merge MP4, WebM, MOV, AVI, and MKV files. Output formats include MP4, MOV, AVI, and MKV — all using industry-standard compression for wide compatibility.',
  },
  {
    question: 'How many videos can I merge?',
    answer:
      'You can merge up to 20 videos, with each file up to 500 MB. This limit protects your browser\'s memory during processing.',
  },
  {
    question: 'Why is merging sometimes instant?',
    answer:
      'When all videos share the same format, type, resolution, and frame rate, we use fast processing — which combines the files together without re-processing. This is nearly instant. Standard processing only happens when files are incompatible or when you change the output format, resolution, or frame rate.',
  },
  {
    question: 'Is my video uploaded to a server?',
    answer:
      'No! All processing happens entirely in your browser using advanced video processing technology. Your videos never leave your device — they remain 100% private and secure.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Add your videos',
    desc: 'Click or drag and drop up to 20 video files (max 500 MB each). Drag to reorder them in the list.',
  },
  {
    step: 2,
    title: 'Choose your settings',
    desc: 'Select output format and quality options. Fast Merge is enabled by default for near-instant results when files are compatible.',
  },
  {
    step: 3,
    title: 'Download your merged video',
    desc: 'Click Merge Videos, wait for the progress bar, then preview and download your combined video file.',
  },
]

// ─── Analytics ────────────────────────────────────────────────────────────────

function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    ;(window as any).gtag('event', name, props)
  }
}

// ─── Size Estimation ──────────────────────────────────────────────────────────

function estimateOutputSize(
  totalInputSize: number,
  crf: number,
  resolution: VideoResolution,
  frameRate: VideoFrameRate,
): { min: number; max: number } | null {
  const crfRatio = 0.3 + ((crf - 18) / (32 - 18)) * 0.5
  let adjusted = totalInputSize * crfRatio

  if (resolution !== 'original' && frameRate !== 'original') {
    adjusted = adjusted * 0.7
  }

  return {
    min: Math.round(adjusted * 0.7),
    max: Math.round(adjusted * 1.3),
  }
}

// ─── Sortable File Item ───────────────────────────────────────────────────────

interface SortableFileItemProps {
  info: MergeFileInfo
  index: number
  onRemove: (index: number) => void
}

function SortableFileItem({ info, index, onRemove }: SortableFileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `file-${index}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const meta = info.metadata
  const adv = info.advanced
  const ext = info.file.name.split('.').pop()?.toUpperCase() ?? '?'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card hover:border-primary/50 transition-colors"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* File info */}
      <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
        <Film className="w-4 h-4 text-red-600 dark:text-red-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{info.file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(info.file.size)}
          {meta.duration > 0 && <> · {formatDuration(meta.duration)}</>}
          {meta.width > 0 && <> · {meta.width}×{meta.height}</>}
          {adv && <> · {adv.codec}</>}
          {' · '}{ext}
        </p>
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(index)}
        className="shrink-0 p-1 text-muted-foreground hover:text-destructive rounded hover:bg-muted transition-colors"
        aria-label={`Remove ${info.file.name}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MergeVideo() {
  // ── File state ──────────────────────────────────────────────────────────
  const [fileInfos, setFileInfos] = useState<MergeFileInfo[]>([])

  // ── Options ─────────────────────────────────────────────────────────────
  const [outputFormat, setOutputFormat] = useState<VideoOutputFormat>('mp4')
  const [fastMerge, setFastMerge] = useState(true)
  const [preset, setPreset] = useState<VideoPreset>('medium')
  const [crf, setCrf] = useState<number>(DEFAULT_CRF)
  const [resolution, setResolution] = useState<VideoResolution>('original')
  const [frameRate, setFrameRate] = useState<VideoFrameRate>('original')

  // ── Processing state ────────────────────────────────────────────────────
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [estimatedRemaining, setEstimatedRemaining] = useState(0)
  const [result, setResult] = useState<{
    blob: Blob
    totalInputSize: number
    outputSize: number
    usedStreamCopy: boolean
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCancelled, setIsCancelled] = useState(false)

  // ── UI state ────────────────────────────────────────────────────────────
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  // ── dnd-kit sensors ─────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // ── Derived ─────────────────────────────────────────────────────────────
  const totalInputSize = fileInfos.reduce((sum, f) => sum + f.file.size, 0)
  const canMerge = fileInfos.length >= 2 && !isProcessing
  const isStreamCopyPossible = canUseConcatDemuxer(fileInfos)
  const effectiveFastMerge = fastMerge && isStreamCopyPossible
  const needsReencode = !effectiveFastMerge
  // Stable IDs array for SortableContext
  const fileIds = useMemo(() => fileInfos.map((_, i) => `file-${i}`), [fileInfos])

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────────

  /** Handle files being added (via dropzone or file input). */
  const handleFilesAdded = useCallback(async (newFiles: FileList | File[]) => {
    const files = Array.from(newFiles)
    setError(null)

    // Validate count
    if (fileInfos.length + files.length > MAX_FILE_COUNT) {
      setError(`Maximum ${MAX_FILE_COUNT} files allowed. You already have ${fileInfos.length}.`)
      return
    }

    // Validate size and format
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" exceeds the maximum file size of 500 MB.`)
        return
      }
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !ACCEPTED_FORMATS.includes(ext)) {
        setError(`"${file.name}" is not a supported format. Supported: ${ACCEPTED_FORMATS.map(f => f.toUpperCase()).join(', ')}.`)
        return
      }
    }

    // Extract basic metadata for all new files (Phase 1 — immediate HTML5)
    const newInfos: MergeFileInfo[] = []
    for (const file of files) {
      const metadata = await getBasicMetadata(file)
      newInfos.push({
        file,
        metadata: metadata ?? { duration: 0, width: 0, height: 0 },
      })
    }

    setFileInfos((prev) => [...prev, ...newInfos])
    trackEvent('video_uploaded', { count: files.length, tool: 'merge' })

    // Preload ffmpeg in background
    preloadFFmpeg()
  }, [fileInfos.length])

  /** Remove a file by index. */
  const handleRemove = useCallback((index: number) => {
    setFileInfos((prev) => prev.filter((_, i) => i !== index))
    setResult(null)
    setError(null)
  }, [])

  /** Handle drag-and-drop reorder. */
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setFileInfos((prev) => {
      const oldIndex = prev.findIndex((_, i) => `file-${i}` === active.id)
      const newIndex = prev.findIndex((_, i) => `file-${i}` === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }, [])

  /** Dropzone handlers. */
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files)
    }
  }, [handleFilesAdded])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(e.target.files)
    }
    e.target.value = ''
  }, [handleFilesAdded])

  // ── Load advanced metadata in background when fileInfos change ──────────
  useEffect(() => {
    if (fileInfos.length === 0) return

    let cancelled = false

    const loadAdvanced = async () => {
      try {
        const { getFFmpeg: getFFmpegInstance } = await import('@/features/audio/utils/ffmpegClient')
        const ffmpeg = await getFFmpegInstance()

        for (let i = 0; i < fileInfos.length; i++) {
          if (cancelled) return
          // Only probe files that don't have advanced metadata yet
          if (fileInfos[i].advanced) continue

          try {
            const advanced = await getAdvancedMetadata(ffmpeg, fileInfos[i].file, fileInfos[i].metadata)
            if (!cancelled) {
              setFileInfos((prev) => {
                const next = [...prev]
                if (next[i]) {
                  next[i] = { ...next[i], advanced }
                }
                return next
              })
            }
          } catch {
            // Individual probe failures are non-fatal
          }
        }
      } catch {
        // Silently ignore
      }
    }

    loadAdvanced()

    return () => { cancelled = true }
  }, [fileInfos.length])

  // ── Merge ───────────────────────────────────────────────────────────────
  const handleMerge = useCallback(async () => {
    if (fileInfos.length < 2) return

    setError(null)
    setIsCancelled(false)
    setIsProcessing(true)
    setProgress(0)
    setElapsedSeconds(0)
    setEstimatedRemaining(0)
    setResult(null)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    trackEvent('merge_started', {
      file_count: fileInfos.length,
      fast_merge: effectiveFastMerge,
      format: outputFormat,
    })

    try {
      const mergeResult = await mergeVideos(
        fileInfos,
        {
          outputFormat,
          preset,
          crf,
          resolution,
          frameRate,
          fastMerge: effectiveFastMerge,
        },
        (pct, elapsed, remaining) => {
          setProgress(pct)
          setElapsedSeconds(elapsed)
          setEstimatedRemaining(remaining)
        },
        abortController.signal,
      )

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      previewUrlRef.current = URL.createObjectURL(mergeResult.blob)

      setResult({
        blob: mergeResult.blob,
        totalInputSize: mergeResult.totalInputSize,
        outputSize: mergeResult.blob.size,
        usedStreamCopy: mergeResult.usedStreamCopy,
      })

      trackEvent('merge_completed', {
        file_count: fileInfos.length,
        fast_merge: mergeResult.usedStreamCopy,
        total_mb: Math.round(mergeResult.totalInputSize / (1024 * 1024)),
        output_mb: Math.round(mergeResult.blob.size / (1024 * 1024)),
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        trackEvent('merge_cancelled', { file_count: fileInfos.length })
        setIsCancelled(true)
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Merge failed. Please try again with different video files.'
        )
        trackEvent('merge_failed', { error: err instanceof Error ? err.message : 'unknown' })
      }
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
    }
  }, [fileInfos, outputFormat, effectiveFastMerge, preset, crf, resolution, frameRate])

  // ── Cancel ──────────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  // ── Download ────────────────────────────────────────────────────────────
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

    trackEvent('download_clicked', { format: outputFormat })
  }, [result, outputFormat])

  // ── Reset ───────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    abortControllerRef.current?.abort()
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setFileInfos([])
    setOutputFormat('mp4')
    setFastMerge(true)
    setPreset('medium')
    setCrf(DEFAULT_CRF)
    setResolution('original')
    setFrameRate('original')
    setResult(null)
    setError(null)
    setIsCancelled(false)
    setIsProcessing(false)
    setProgress(0)
  }, [])

  // ── Size estimate (re-encode path only) ─────────────────────────────────
  const sizeEstimate = totalInputSize > 0 && needsReencode
    ? estimateOutputSize(totalInputSize, crf, resolution, frameRate)
    : null

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left Column ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {/* Cancelled */}
          {isCancelled && !error && !result && (
            <div className="border border-border rounded-xl p-8 text-center bg-card">
              <Scissors className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Merge Cancelled</h3>
              <p className="text-muted-foreground mb-4">
                Processing was cancelled. Temporary files have been cleaned up.
              </p>
              <Button variant="outline" onClick={() => setIsCancelled(false)}>
                Try Again
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <ErrorCard
              title="Merge Failed"
              message={error}
              onRetry={fileInfos.length >= 2 ? handleMerge : handleReset}
            />
          )}

          {/* IDLE / FILE_LIST: upload or file management */}
          {!isProcessing && !result && !error && !isCancelled && (
            <>
              {fileInfos.length === 0 ? (
                /* Empty state: dropzone */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer ${
                    isDragOver
                      ? 'border-primary bg-primary/5 scale-[1.01]'
                      : 'border-border hover:border-primary hover:bg-muted/20'
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload video files"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      inputRef.current?.click()
                    }
                  }}
                >
                  <Plus className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">
                    {isDragOver ? 'Drop your files here' : 'Drop video files here or click to browse'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Supported formats: {ACCEPTED_FORMATS.join(', ').toUpperCase()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Up to {MAX_FILE_COUNT} files · Max {Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB each
                  </p>

                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    onChange={handleFileInputChange}
                    accept={ACCEPTED_FORMATS.map(f => `.${f}`).join(',')}
                    className="absolute w-0 h-0 opacity-0 pointer-events-none"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
              ) : (
                /* File list with dnd-kit reordering */
                <div className="border border-border rounded-xl p-6 bg-card space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">
                      {fileInfos.length} file{fileInfos.length !== 1 ? 's' : ''} selected
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => inputRef.current?.click()}
                      disabled={fileInfos.length >= MAX_FILE_COUNT}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Files
                    </Button>
                    <input
                      ref={inputRef}
                      type="file"
                      multiple
                      onChange={handleFileInputChange}
                      accept={ACCEPTED_FORMATS.map(f => `.${f}`).join(',')}
                      className="absolute w-0 h-0 opacity-0 pointer-events-none"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                  </div>

                  {fileInfos.length < 2 && (
                    <p className="text-sm text-muted-foreground">
                      Add at least {2 - fileInfos.length} more file{2 - fileInfos.length === 1 ? '' : 's'} to enable merging.
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
                        {fileInfos.map((info, index) => (
                          <SortableFileItem
                            key={fileIds[index]}
                            info={info}
                            index={index}
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
            </>
          )}

          {/* PROCESSING */}
          {isProcessing && (
            <div className="space-y-4">
              <ProcessingStatus message={`Merging ${fileInfos.length} videos...`} />
              <ProgressBar
                percent={progress}
                label="Merge Progress"
                detail={
                  progress < 5
                    ? 'Initializing...'
                    : progress < 95
                      ? effectiveFastMerge
                        ? 'Copying video streams...'
                        : 'Processing merged video...'
                      : 'Finalizing output...'
                }
              />
              {elapsedSeconds > 0 && (
                <div className="text-sm text-muted-foreground text-center">
                  Elapsed: {formatDuration(elapsedSeconds)}
                  {estimatedRemaining > 0 && <> · Remaining: ~{formatDuration(estimatedRemaining)}</>}
                </div>
              )}
              <div className="flex justify-center">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* RESULT */}
          {result && (
            <div className="space-y-6">
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-4">Merge Complete</h3>

                {/* Video preview */}
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
                    <div className="text-xs text-muted-foreground mb-1">Files</div>
                    <div className="font-semibold text-sm">{fileInfos.length}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Format</div>
                    <div className="font-semibold text-sm uppercase">{outputFormat}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Method</div>
                    <div className="font-semibold text-sm">
                      {result.usedStreamCopy ? 'Fast Merge' : 'Standard'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Resolution</div>
                    <div className="font-semibold text-sm">
                      {resolution === 'original' ? 'Original' : resolution}
                    </div>
                  </div>
                </div>

                {/* File size comparison */}
                <h4 className="text-sm font-medium text-muted-foreground mb-3">File Sizes</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Total Input</div>
                    <div className="text-2xl font-bold">{formatBytes(result.totalInputSize)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Merged</div>
                    <div className="text-2xl font-bold">{formatBytes(result.outputSize)}</div>
                    {result.totalInputSize > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {result.outputSize < result.totalInputSize
                          ? `${Math.round(((result.totalInputSize - result.outputSize) / result.totalInputSize) * 100)}% smaller`
                          : result.outputSize > result.totalInputSize
                            ? `${Math.round(((result.outputSize - result.totalInputSize) / result.totalInputSize) * 100)}% larger`
                            : 'Same size'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Download / Reset */}
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
                  Merge More Videos
                </Button>
              </div>
            </div>
          )}

          {/* How To */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Merge Videos</h2>
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

        {/* ── Right Column: Options Panel ────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            {/* FILE_LOADED: options */}
            {fileInfos.length > 0 && !isProcessing && !result && (
              <div className="border border-border rounded-xl p-6 bg-muted/30 space-y-6">
                <h3 className="font-semibold text-lg">Merge Settings</h3>

                {/* Output Format */}
                <div>
                  <label className="text-sm font-medium flex justify-between">
                    <span>Output Format</span>
                    <span className="text-primary font-semibold uppercase">{outputFormat}</span>
                  </label>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value as VideoOutputFormat)}
                    className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  >
                    {OUTPUT_FORMAT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fast Merge toggle */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fastMerge}
                      onChange={(e) => setFastMerge(e.target.checked)}
                      className="w-4 h-4 accent-primary"
                      disabled={!isStreamCopyPossible}
                    />
                    <div>
                      <span className="text-sm font-medium">Fast Merge (instant processing)</span>
                      {!isStreamCopyPossible && fileInfos.length >= 2 && (
                        <p className="text-xs text-muted-foreground">
                          Unavailable — files have different types, resolutions, or formats.
                        </p>
                      )}
                    </div>
                  </label>
                  {effectiveFastMerge && (
                    <div className="mt-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                      <p className="text-xs text-green-800 dark:text-green-200">
                        ⚡ Fast Merge: files are compatible — near-instant, no quality loss.
                      </p>
                    </div>
                  )}
                </div>

                {/* Re-encode options (only when NOT fast merge) */}
                {needsReencode && (
                  <>
                    <div className="border-t border-border pt-4">
                      <p className="text-xs text-muted-foreground mb-4">
                        Files need standard processing. Configure quality options below.
                      </p>

                      {/* Preset */}
                      <div className="mb-4">
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
                      <div className="mb-4">
                        <label className="text-sm font-medium flex justify-between">
                          <span>Quality</span>
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

                      {/* Resolution */}
                      <div className="mb-4">
                        <label className="text-sm font-medium flex justify-between">
                          <span>Resolution</span>
                          <span className="text-primary font-semibold">
                            {resolution === 'original' ? 'Original' : resolution}
                          </span>
                        </label>
                        <select
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value as VideoResolution)}
                          className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                        >
                          {RESOLUTION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Frame Rate */}
                      <div className="mb-4">
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

                      {/* Estimated size */}
                      {sizeEstimate && (
                        <div className="p-3 rounded-lg bg-background border border-border">
                          <div className="text-xs text-muted-foreground mb-1">
                            Estimated Output Size
                          </div>
                          <div className="text-lg font-bold">
                            {formatBytes(sizeEstimate.min)} – {formatBytes(sizeEstimate.max)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Approximate — actual size varies by content.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Merge button */}
                <Button
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={!canMerge}
                  onClick={handleMerge}
                >
                  <Scissors className="w-4 h-4 mr-2" />
                  {fileInfos.length < 2
                    ? `Add ${2 - fileInfos.length} more file${2 - fileInfos.length === 1 ? '' : 's'}`
                    : `Merge ${fileInfos.length} Videos`}
                </Button>
              </div>
            )}

            {/* PROCESSING */}
            {isProcessing && (
              <div className="border border-border rounded-xl p-6 bg-muted/30">
                <h3 className="font-semibold text-lg mb-6">Merge Settings</h3>
                <div className="space-y-3 opacity-50 pointer-events-none">
                  <div>
                    <label className="text-sm font-medium">Output Format</label>
                    <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm uppercase">
                      {outputFormat}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Method</label>
                    <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                      {effectiveFastMerge ? 'Fast Merge' : 'Standard Processing'}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Files</label>
                    <div className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-sm">
                      {fileInfos.length} videos
                    </div>
                  </div>
                </div>
                <Button className="w-full mt-4" disabled>
                  Processing...
                </Button>
              </div>
            )}

            {/* RESULT */}
            {result && (
              <div className="border border-border rounded-xl p-6 bg-muted/30">
                <h3 className="font-semibold text-lg mb-6">Done!</h3>
                <div className="space-y-3">
                  <Button
                    className="w-full bg-primary hover:bg-primary/90"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Merged {outputFormat.toUpperCase()}
                  </Button>
                  <Button className="w-full" variant="outline" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Merge More Videos
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
