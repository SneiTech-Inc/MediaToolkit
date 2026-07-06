'use client'

import { useState, useCallback, useMemo } from 'react'
import { Download, RotateCcw, X, GripVertical, FileText } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { Button } from '@/components/ui/button'
import { convertImagesToPDF } from '@/features/image/utils/imageToPDF'

const ACCEPTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp']

const TOOL_FAQS = [
  { question: 'How many images can I convert to PDF?', answer: 'There is no hard limit — you can add as many images as you like. Each image becomes one page in the PDF. Keep in mind that very large PDFs may use significant browser memory.' },
  { question: 'Can I reorder images before converting?', answer: 'Yes! Drag the grip handle (⠿) on each thumbnail to rearrange the page order. The final PDF will use your custom order.' },
  { question: 'What image formats are supported?', answer: 'JPEG, PNG, WebP, GIF, SVG, and BMP. Non-JPEG/PNG formats are automatically converted before embedding in the PDF.' },
  { question: 'Is my data uploaded to a server?', answer: 'No! All processing happens entirely in your browser using pdf-lib and Canvas API. Your images never leave your device.' },
]

interface ImageEntry {
  id: string
  file: File
  previewUrl: string
}

let nextId = 0
function makeEntry(file: File): ImageEntry {
  return { id: `img-${++nextId}`, file, previewUrl: URL.createObjectURL(file) }
}

/** Draggable thumbnail tile */
function SortableTile({ entry, onRemove }: { entry: ImageEntry; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="relative group rounded-xl border border-border bg-card overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={entry.previewUrl} alt={entry.file.name} className="w-full h-32 object-cover" />
      <div className="p-2 flex items-center gap-2">
        <button {...attributes} {...listeners} className="shrink-0 p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing" aria-label="Drag to reorder">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-xs truncate flex-1">{entry.file.name}</span>
        <button onClick={() => onRemove(entry.id)} className="shrink-0 p-1 hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove image">
          <X className="w-4 h-4 text-destructive" />
        </button>
      </div>
    </div>
  )
}

/**
 * Image to PDF tool.
 * First multi-file tool — upload multiple images, reorder, convert to a single PDF.
 */
export function ImageToPDF() {
  const [entries, setEntries] = useState<ImageEntry[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const entryIds = useMemo(() => entries.map((e) => e.id), [entries])

  const handleFiles = useCallback((files: FileList | File[]) => {
    const newEntries = Array.from(files).map(makeEntry)
    setEntries((prev) => [...prev, ...newEntries])
    setPdfBlob(null)
    setError(null)
  }, [])

  const handleFileSelect = useCallback((file: File) => handleFiles([file]), [handleFiles])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleRemove = useCallback((id: string) => {
    setEntries((prev) => {
      const entry = prev.find((e) => e.id === id)
      if (entry) URL.revokeObjectURL(entry.previewUrl)
      return prev.filter((e) => e.id !== id)
    })
    setPdfBlob(null)
  }, [])

  const handleDragEnd = useCallback((event: { active: { id: string }; over: { id: string } | null }) => {
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
    setIsConverting(true)
    setError(null)
    try {
      const files = entries.map((e) => e.file)
      const pdfBytes = await convertImagesToPDF(files, (current, total) => setProgress({ current, total }))
      setPdfBlob(new Blob([pdfBytes], { type: 'application/pdf' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF conversion failed.')
    } finally {
      setIsConverting(false)
    }
  }, [entries])

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url; a.download = 'images.pdf'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [pdfBlob])

  const handleReset = useCallback(() => {
    entries.forEach((e) => URL.revokeObjectURL(e.previewUrl))
    setEntries([]); setPdfBlob(null); setError(null); setProgress({ current: 0, total: 0 })
  }, [entries])

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Conversion Failed" message={error} onRetry={handleConvert} />}

          {/* Upload */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <UploadDropzone acceptedFormats={ACCEPTED_FORMATS} onFileSelect={handleFileSelect} />
          </div>

          {/* Thumbnail Grid */}
          {entries.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{entries.length} image{entries.length !== 1 ? 's' : ''}</h3>
                <span className="text-xs text-muted-foreground">Drag handles to reorder</span>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={entryIds} strategy={verticalListSortingStrategy}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {entries.map((entry) => (
                      <SortableTile key={entry.id} entry={entry} onRemove={handleRemove} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Converting progress */}
          {isConverting && (
            <ProcessingStatus message="Creating PDF...">
              <ProgressBar percent={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
                label="Embedding images" detail={`Page ${progress.current} of ${progress.total}`} />
            </ProcessingStatus>
          )}

          {/* Actions */}
          {entries.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              {!pdfBlob ? (
                <Button size="lg" className="bg-primary hover:bg-primary/90 flex-1" onClick={handleConvert} disabled={isConverting}>
                  <FileText className="w-4 h-4 mr-2" />
                  {isConverting ? 'Converting...' : `Convert ${entries.length} image${entries.length !== 1 ? 's' : ''} to PDF`}
                </Button>
              ) : (
                <Button size="lg" className="bg-primary hover:bg-primary/90 flex-1" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />Download PDF
                </Button>
              )}
              <Button size="lg" variant="outline" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />Reset
              </Button>
            </div>
          )}

          {/* How To Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Convert Images to PDF</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload images', desc: 'Click the upload area or drag and drop multiple JPEG, PNG, WebP, GIF, SVG, or BMP files.' },
                { step: 2, title: 'Reorder pages', desc: 'Drag the grip handle on each thumbnail to arrange images in your desired page order.' },
                { step: 3, title: 'Convert & download', desc: 'Click Convert to PDF and download your single PDF document with all images as separate pages.' },
              ].map((item) => (
                <li key={item.step} className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">{item.step}</span>
                  <div><h4 className="font-semibold">{item.title}</h4><p className="text-muted-foreground text-sm">{item.desc}</p></div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-12">
            <FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" />
          </div>
        </div>

        {/* Right Column — Info */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-4">PDF Settings</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Each image is placed on its own page at its original dimensions.
                All processing happens locally in your browser.
              </p>

              {entries.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Images</span>
                    <span className="font-medium">{entries.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Output</span>
                    <span className="font-medium">PDF</span>
                  </div>
                  {pdfBlob && (
                    <div className="flex justify-between text-sm pt-2 border-t border-border">
                      <span className="text-muted-foreground">PDF size</span>
                      <span className="font-medium">{(pdfBlob.size / 1024).toFixed(0)} KB</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
