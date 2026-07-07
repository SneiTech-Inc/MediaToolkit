'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Download, RotateCcw, X, GripVertical, FileDown, Loader2 } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { Button } from '@/components/ui/button'
import { convertJPGToPDF } from '@/features/pdf/utils/jpgToPDF'
import type { JPGToPDFOptions } from '@/features/pdf/utils/jpgToPDF'
import { formatBytes } from '@/utils/formatBytes'

// ─── Constants ─────────────────────────────────────────────────────────────

const ACCEPTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']

const PAGE_SIZE_OPTIONS: { value: JPGToPDFOptions['pageSize']; label: string }[] = [
  { value: 'fit', label: 'Fit to Image' },
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
  { value: 'legal', label: 'Legal' },
]

const ORIENTATION_OPTIONS: { value: JPGToPDFOptions['orientation']; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
]

const IMAGE_FIT_OPTIONS: { value: JPGToPDFOptions['imageFit']; label: string }[] = [
  { value: 'contain', label: 'Contain' },
  { value: 'cover', label: 'Cover' },
]

const TOOL_FAQS = [
  { question: 'What image formats are supported?', answer: 'JPG, PNG, WebP, GIF, and BMP. JPG and PNG images are embedded directly. WebP, GIF, and BMP are automatically converted to PNG via Canvas API before embedding.' },
  { question: 'Can I choose the page size?', answer: 'Yes! Select from Fit to Image (each page matches the image dimensions), A4, Letter, or Legal. You can also switch between portrait and landscape orientation.' },
  { question: 'How do I reorder images before converting?', answer: 'Drag the grip handle on any image tile to rearrange the order. Images appear in the PDF in the order shown in the list.' },
  { question: 'Is my data uploaded to a server?', answer: 'No! All processing happens entirely in your browser using pdf-lib. Your images never leave your device.' },
]

// ─── Entry Model ───────────────────────────────────────────────────────────

interface ImageEntry {
  id: string
  file: File
  previewUrl: string
}

let nextId = 0
function makeEntry(file: File): ImageEntry {
  return { id: `img-${++nextId}`, file, previewUrl: URL.createObjectURL(file) }
}

// ─── SortableTile ──────────────────────────────────────────────────────────

function SortableTile({ entry, onRemove }: { entry: ImageEntry; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
      <button {...attributes} {...listeners} className="shrink-0 p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing" aria-label="Drag to reorder">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Thumbnail */}
      <img
        src={entry.previewUrl}
        alt={entry.file.name}
        className="w-12 h-12 rounded-lg object-cover shrink-0 bg-muted"
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{entry.file.name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(entry.file.size)}</p>
      </div>

      <button
        onClick={() => onRemove(entry.id)}
        className="shrink-0 p-1 hover:bg-destructive/10 rounded opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Remove image"
      >
        <X className="w-4 h-4 text-destructive" />
      </button>
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────

export function JPGToPDF() {
  const [entries, setEntries] = useState<ImageEntry[]>([])
  const [pageSize, setPageSize] = useState<JPGToPDFOptions['pageSize']>('fit')
  const [orientation, setOrientation] = useState<JPGToPDFOptions['orientation']>('auto')
  const [margin, setMargin] = useState(10)
  const [imageFit, setImageFit] = useState<JPGToPDFOptions['imageFit']>('contain')

  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const entryIds = useMemo(() => entries.map((e) => e.id), [entries])

  // ── Cleanup preview URLs on unmount ──────────────────────────────────

  useEffect(() => {
    return () => {
      entries.forEach((e) => URL.revokeObjectURL(e.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────

  const addFiles = useCallback((files: FileList | File[]) => {
    const valid = Array.from(files).filter((f) => ACCEPTED_MIME.includes(f.type) || f.name.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i))
    if (valid.length === 0) return
    setEntries((prev) => [...prev, ...valid.map(makeEntry)])
    setPdfBlob(null)
    setError(null)
  }, [])

  const handleFileSelect = useCallback((file: File) => addFiles([file]), [addFiles])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files)
  }, [addFiles])

  const handleRemove = useCallback((id: string) => {
    setEntries((prev) => {
      const entry = prev.find((e) => e.id === id)
      if (entry) URL.revokeObjectURL(entry.previewUrl)
      return prev.filter((e) => e.id !== id)
    })
    setPdfBlob(null)
  }, [])

  const handleDragEnd = useCallback((event: import('@dnd-kit/core').DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setEntries((prev) => {
        const oldIndex = prev.findIndex((e) => e.id === active.id)
        const newIndex = prev.findIndex((e) => e.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }, [])

  const handleConvert = useCallback(async () => {
    if (entries.length === 0) return
    setIsProcessing(true)
    setError(null)
    setPdfBlob(null)
    setProgress({ current: 0, total: entries.length })

    try {
      const files = entries.map((e) => e.file)
      const pdfBytes = await convertJPGToPDF(
        files,
        { pageSize, orientation, margin, imageFit },
        (current, total) => setProgress({ current, total }),
      )
      setPdfBlob(new Blob([pdfBytes], { type: 'application/pdf' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [entries, pageSize, orientation, margin, imageFit])

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'images.pdf'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [pdfBlob])

  const handleReset = useCallback(() => {
    entries.forEach((e) => URL.revokeObjectURL(e.previewUrl))
    setEntries([])
    setPdfBlob(null)
    setError(null)
    setProgress({ current: 0, total: 0 })
    setPageSize('fit')
    setOrientation('auto')
    setMargin(10)
    setImageFit('contain')
  }, [entries])

  // ── Render ───────────────────────────────────────────────────────────

  const totalImageSize = entries.reduce((sum, e) => sum + e.file.size, 0)

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Main Column ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Conversion Failed" message={error} onRetry={handleConvert} />}

          {/* Upload area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={entries.length === 0 ? '' : 'space-y-6'}
          >
            {entries.length === 0 ? (
              <UploadDropzone acceptedFormats={ACCEPTED_FORMATS} onFileSelect={handleFileSelect} />
            ) : (
              <UploadDropzone acceptedFormats={ACCEPTED_FORMATS} onFileSelect={handleFileSelect} />
            )}
          </div>

          {/* Reorderable image list */}
          {entries.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{entries.length} image{entries.length !== 1 ? 's' : ''}</h3>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-1" />Reset
                </Button>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={entryIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {entries.map((entry) => (
                      <SortableTile key={entry.id} entry={entry} onRemove={handleRemove} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Options */}
          {entries.length > 0 && (
            <div className="space-y-4">
              {/* Page size */}
              <div className="p-4 rounded-xl border border-border bg-card">
                <label className="text-sm font-medium block mb-3">Page Size</label>
                <div className="grid grid-cols-4 gap-2">
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setPageSize(opt.value); setPdfBlob(null) }}
                      disabled={isProcessing}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        pageSize === opt.value
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border bg-background hover:bg-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientation */}
              <div className="p-4 rounded-xl border border-border bg-card">
                <label className="text-sm font-medium block mb-3">Orientation</label>
                <div className="grid grid-cols-3 gap-2">
                  {ORIENTATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setOrientation(opt.value); setPdfBlob(null) }}
                      disabled={isProcessing}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        orientation === opt.value
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border bg-background hover:bg-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Margin */}
              <div className="p-4 rounded-xl border border-border bg-card">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Margin</label>
                  <span className="text-sm font-semibold text-primary">{margin}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={margin}
                  onChange={(e) => { setMargin(Number(e.target.value)); setPdfBlob(null) }}
                  className="w-full accent-primary"
                  disabled={isProcessing}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>No margin</span>
                  <span>50px</span>
                </div>
              </div>

              {/* Image fit */}
              <div className="p-4 rounded-xl border border-border bg-card">
                <label className="text-sm font-medium block mb-3">Image Fit</label>
                <div className="grid grid-cols-2 gap-2">
                  {IMAGE_FIT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setImageFit(opt.value); setPdfBlob(null) }}
                      disabled={isProcessing}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                        imageFit === opt.value
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border bg-background hover:bg-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {imageFit === 'contain'
                    ? 'Image fits entirely within the page. White space may appear on sides.'
                    : 'Image fills the entire page. Edges may be cropped.'}
                </p>
              </div>

              {/* Convert button */}
              {!pdfBlob ? (
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={handleConvert}
                  disabled={isProcessing || entries.length === 0}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4 mr-2" />
                  )}
                  {isProcessing ? 'Converting...' : `Convert ${entries.length} Image${entries.length !== 1 ? 's' : ''} to PDF`}
                </Button>
              ) : (
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />Download PDF ({formatBytes(pdfBlob.size)})
                </Button>
              )}

              {/* Progress */}
              {isProcessing && (
                <div className="space-y-4">
                  <ProcessingStatus message="Creating PDF..." />
                  <ProgressBar
                    percent={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
                    label="Converting"
                    detail={`Image ${progress.current} of ${progress.total}`}
                  />
                </div>
              )}
            </div>
          )}

          {/* How to Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Convert Images to PDF</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload images', desc: 'Click the upload area or drag and drop your images. JPG, PNG, WebP, GIF, and BMP are supported.' },
                { step: 2, title: 'Arrange & configure', desc: 'Drag to reorder images, then choose page size, orientation, margins, and image fit.' },
                { step: 3, title: 'Convert & download', desc: 'Click Convert to PDF and download your document.' },
              ].map((item) => (
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

        {/* ── Sidebar ────────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-4">Conversion Info</h3>
              {entries.length > 0 ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Images</span>
                    <span className="font-medium">{entries.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total size</span>
                    <span className="font-medium">{formatBytes(totalImageSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Page size</span>
                    <span className="font-medium">{PAGE_SIZE_OPTIONS.find((o) => o.value === pageSize)?.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Orientation</span>
                    <span className="font-medium">{orientation.charAt(0).toUpperCase() + orientation.slice(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Margin</span>
                    <span className="font-medium">{margin}px</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Image fit</span>
                    <span className="font-medium">{imageFit.charAt(0).toUpperCase() + imageFit.slice(1)}</span>
                  </div>
                  {pdfBlob && (
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="text-muted-foreground">PDF size</span>
                      <span className="font-medium text-green-600">{formatBytes(pdfBlob.size)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Upload images to convert them into a single PDF document. Drag to reorder, then choose your page layout settings.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
