'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Download, RotateCcw, X, GripVertical, FileText, Merge, Loader2 } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { Button } from '@/components/ui/button'
import { mergePDFs, getPdfPageCount } from '@/features/pdf/utils/pdfMerger'
import { formatBytes } from '@/utils/formatBytes'
import { getSaveVexMergedFileName } from '@/utils/fileNames'

const TOOL_FAQS = [
  { question: 'How many PDFs can I merge?', answer: 'There is no hard limit — you can merge as many PDFs as you need. All processing happens locally in your browser so performance depends on your device.' },
  { question: 'Can I reorder PDFs before merging?', answer: 'Yes! Drag the grip handle on each tile to rearrange the order. The final merged PDF will use your custom page order.' },
  { question: 'Is my data uploaded to a server?', answer: 'No! All merging happens entirely in your browser using advanced PDF processing technology. Your PDFs never leave your device — 100% private and secure.' },
  { question: 'Are there file size limits?', answer: 'File size is limited by your browser\'s available memory. For best performance, keep individual PDFs under 50 MB and total files under 200 MB.' },
]

interface PdfEntry {
  id: string
  file: File
  pageCount: number | null
}

let nextId = 0
function makeEntry(file: File): PdfEntry {
  return { id: `pdf-${++nextId}`, file, pageCount: null }
}

function SortableTile({ entry, onRemove }: { entry: PdfEntry; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
      <button {...attributes} {...listeners} className="shrink-0 p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing" aria-label="Drag to reorder">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      <FileText className="w-8 h-8 text-primary shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{entry.file.name}</p>
        <p className="text-xs text-muted-foreground">
          {entry.pageCount !== null ? `${entry.pageCount} page${entry.pageCount !== 1 ? 's' : ''}` : 'Loading...'}
          {' · '}{formatBytes(entry.file.size)}
        </p>
      </div>
      <button onClick={() => onRemove(entry.id)} className="shrink-0 p-1 hover:bg-destructive/10 rounded opacity-60 hover:opacity-100 transition-opacity" aria-label="Remove PDF">
        <X className="w-4 h-4 text-destructive" />
      </button>
    </div>
  )
}

export function MergePDF() {
  const [entries, setEntries] = useState<PdfEntry[]>([])
  const [isMerging, setIsMerging] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const entryIds = useMemo(() => entries.map((e) => e.id), [entries])

  // Load page counts after adding files
  useEffect(() => {
    entries.forEach((entry) => {
      if (entry.pageCount === null) {
        getPdfPageCount(entry.file).then((count) => {
          setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, pageCount: count } : e))
        }).catch(() => {
          setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, pageCount: 0 } : e))
        })
      }
    })
  }, [entries.length])

  const handleFiles = useCallback((files: FileList | File[]) => {
    setEntries((prev) => [...prev, ...Array.from(files).map(makeEntry)])
    setPdfBlob(null)
    setError(null)
  }, [])

  const handleFileSelect = useCallback((file: File) => handleFiles([file]), [handleFiles])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleRemove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
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

  const handleMerge = useCallback(async () => {
    if (entries.length < 2) return
    setIsMerging(true)
    setError(null)
    try {
      const files = entries.map((e) => e.file)
      const pdfBytes = await mergePDFs(files, (current, total) => setProgress({ current, total }))
      setPdfBlob(new Blob([pdfBytes], { type: 'application/pdf' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF merge failed.')
    } finally {
      setIsMerging(false)
    }
  }, [entries])

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url; a.download = getSaveVexMergedFileName('pdf')
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [pdfBlob])

  const handleReset = useCallback(() => {
    setEntries([]); setPdfBlob(null); setError(null); setProgress({ current: 0, total: 0 })
  }, [])

  const totalPages = entries.reduce((sum, e) => sum + (e.pageCount || 0), 0)

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Merge Failed" message={error} onRetry={handleMerge} />}

          <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
            <UploadDropzone acceptedFormats={['pdf']} onFileSelect={handleFileSelect} />
          </div>

          {entries.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{entries.length} PDF{entries.length !== 1 ? 's' : ''}</h3>
                <span className="text-xs text-muted-foreground">{totalPages} total page{totalPages !== 1 ? 's' : ''}</span>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={entryIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {entries.map((entry) => (
                      <SortableTile key={entry.id} entry={entry} onRemove={handleRemove} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {isMerging && (
            <div className="space-y-4">
              <ProcessingStatus message="Merging PDFs..." />
              <ProgressBar percent={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
                label="Processing" detail={`PDF ${progress.current} of ${progress.total}`} />
            </div>
          )}

          {entries.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              {!pdfBlob ? (
                <Button size="lg" className="bg-primary hover:bg-primary/90 flex-1" onClick={handleMerge} disabled={entries.length < 2 || isMerging}>
                  {isMerging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Merge className="w-4 h-4 mr-2" />}
                  {isMerging ? 'Merging...' : `Merge ${entries.length} PDFs`}
                </Button>
              ) : (
                <Button size="lg" className="bg-primary hover:bg-primary/90 flex-1" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />Download Merged PDF
                </Button>
              )}
              <Button size="lg" variant="outline" onClick={handleReset}><RotateCcw className="w-4 h-4 mr-2" />Reset</Button>
            </div>
          )}

          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Merge PDFs</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload PDFs', desc: 'Click the upload area or drag and drop multiple PDF files.' },
                { step: 2, title: 'Reorder pages', desc: 'Drag the grip handle to arrange PDFs in your desired order. Each PDF\'s pages stay together.' },
                { step: 3, title: 'Merge & download', desc: 'Click Merge PDFs and download your single combined document.' },
              ].map((item) => (
                <li key={item.step} className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">{item.step}</span>
                  <div><h4 className="font-semibold">{item.title}</h4><p className="text-muted-foreground text-sm">{item.desc}</p></div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-12"><FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" /></div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-4">Merge Info</h3>
              <p className="text-sm text-muted-foreground mb-4">All PDFs are combined in order. Pages from each file stay together.</p>
              {entries.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Files</span><span className="font-medium">{entries.length}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total pages</span><span className="font-medium">{totalPages}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total size</span><span className="font-medium">{formatBytes(entries.reduce((s, e) => s + e.file.size, 0))}</span></div>
                  {pdfBlob && <div className="flex justify-between text-sm pt-2 border-t border-border"><span className="text-muted-foreground">Merged size</span><span className="font-medium">{formatBytes(pdfBlob.size)}</span></div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
