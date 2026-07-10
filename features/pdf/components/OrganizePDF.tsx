'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Download, RotateCcw, RotateCw, GripVertical, Trash2, Undo2, FileText, Loader2 } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { getPdfPageCount } from '@/features/pdf/utils/pdfMerger'
import { reorganizePDF } from '@/features/pdf/utils/pdfOrganizer'
import type { PageItem } from '@/features/pdf/utils/pdfOrganizer'
import { formatBytes } from '@/utils/formatBytes'
import { getSaveVexFileName } from '@/utils/fileNames'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

// ─── Types ─────────────────────────────────────────────────────────────────

type Angle = 0 | 90 | 180 | 270

interface PageState {
  id: string
  originalIndex: number  // fixed position in source PDF
  rotation: Angle
  deleted: boolean
  thumbnail: string      // data URL
}

// ─── Constants ─────────────────────────────────────────────────────────────

const ROTATION_LABELS: Record<Angle, string> = { 0: '0°', 90: '90°', 180: '180°', 270: '270°' }

const TOOL_FAQS = [
  { question: 'Can I reorder pages in my PDF?', answer: 'Yes! Drag the grip handle on any page tile to rearrange the order. Pages appear in the final PDF in the order you arrange them.' },
  { question: 'Can I delete multiple pages at once?', answer: 'Yes — delete individual pages with the trash button. Deleted pages can be restored via the Undo button until you reset or upload a new file.' },
  { question: 'Can I rotate pages while organizing?', answer: 'Yes! Each page has a rotate button that rotates in 90° increments. Use "Rotate All" to rotate every non-deleted page at once.' },
  { question: 'What happens to page numbers after reorganization?', answer: 'Pages are renumbered based on their new order. Original page numbers are discarded — the final PDF reflects exactly what you see.' },
  { question: 'Is my PDF uploaded to a server?', answer: 'No! All processing happens entirely in your browser using advanced PDF processing technology. Your PDF never leaves your device.' },
]

// ─── Sortable Tile ─────────────────────────────────────────────────────────

function SortableTile({
  page, index, total, onRotate, onDelete, onUndo,
}: {
  page: PageState; index: number; total: number;
  onRotate: (id: string) => void; onDelete: (id: string) => void; onUndo: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : page.deleted ? 0.3 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
        page.deleted
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-border bg-card'
      }`}
    >
      {/* Drag handle */}
      <button {...attributes} {...listeners}
        className="shrink-0 p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
        disabled={page.deleted}>
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Thumbnail + rotation */}
      <div className="relative shrink-0 w-16 h-20 rounded bg-muted overflow-hidden">
        <img src={page.thumbnail} alt={`Page ${index + 1}`}
          className="w-full h-full object-cover transition-transform duration-200"
          style={{ transform: `rotate(${page.rotation}deg) scale(${page.rotation === 90 || page.rotation === 270 ? 0.7 : 1})` }} />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {page.deleted ? (
            <span className="text-sm font-medium text-red-600 dark:text-red-400 line-through">
              Page {page.originalIndex + 1}
            </span>
          ) : (
            <span className="text-sm font-medium">
              Page {index + 1} <span className="text-xs text-muted-foreground">(was page {page.originalIndex + 1})</span>
            </span>
          )}
          {page.rotation !== 0 && !page.deleted && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {ROTATION_LABELS[page.rotation]}
            </span>
          )}
          {page.deleted && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-600">
              Deleted
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {page.deleted ? (
          <Button variant="outline" size="sm" onClick={() => onUndo(page.id)} title="Undo delete">
            <Undo2 className="w-4 h-4" />
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => onRotate(page.id)} title="Rotate 90° clockwise">
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDelete(page.id)} title="Delete page">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────

export function OrganizePDF() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [pages, setPages] = useState<PageState[]>([])
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const originalPagesRef = useRef<PageState[]>([]) // snapshot for reset

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const activeIds = useMemo(() => pages.map((p) => p.id), [pages])

  // ─── Derived stats ──────────────────────────────────────────────────

  const deletedCount = pages.filter((p) => p.deleted).length
  const rotatedCount = pages.filter((p) => !p.deleted && p.rotation !== 0).length
  const activePages = pages.filter((p) => !p.deleted)

  // ─── Upload + thumbnail generation ──────────────────────────────────

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f)
    setError(null)
    setIsGeneratingThumbs(true)

    try {
      const count = await getPdfPageCount(f)
      setPageCount(count)

      const buf = await f.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise
      const thumbs: PageState[] = []

      for (let i = 1; i <= count; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 0.3 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport, canvas: null }).promise

        thumbs.push({
          id: crypto.randomUUID(),
          originalIndex: i - 1,
          rotation: 0,
          deleted: false,
          thumbnail: canvas.toDataURL('image/jpeg', 0.7),
        })
      }

      setPages(thumbs)
      originalPagesRef.current = JSON.parse(JSON.stringify(thumbs)) // deep clone for reset
    } catch {
      setError('Failed to read PDF.')
    } finally {
      setIsGeneratingThumbs(false)
    }
  }, [])

  // ─── Actions ────────────────────────────────────────────────────────

  const rotatePage = useCallback((id: string) => {
    setPages((prev) => prev.map((p) =>
      p.id === id ? { ...p, rotation: ((p.rotation + 90) % 360) as Angle } : p
    ))
  }, [])

  const deletePage = useCallback((id: string) => {
    setPages((prev) => prev.map((p) =>
      p.id === id ? { ...p, deleted: true } : p
    ))
  }, [])

  const undoDelete = useCallback((id: string) => {
    setPages((prev) => prev.map((p) =>
      p.id === id ? { ...p, deleted: false } : p
    ))
  }, [])

  const undoAllDeletes = useCallback(() => {
    setPages((prev) => prev.map((p) => ({ ...p, deleted: false })))
  }, [])

  const rotateAll = useCallback(() => {
    setPages((prev) => prev.map((p) =>
      p.deleted ? p : { ...p, rotation: ((p.rotation + 90) % 360) as Angle }
    ))
  }, [])

  const resetAll = useCallback(() => {
    setPages(JSON.parse(JSON.stringify(originalPagesRef.current)))
  }, [])

  const handleDragEnd = useCallback((event: import('@dnd-kit/core').DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setPages((prev) => {
        const oldIndex = prev.findIndex((p) => p.id === active.id)
        const newIndex = prev.findIndex((p) => p.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }, [])

  // ─── Download ───────────────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    if (!file || activePages.length === 0) return
    setIsProcessing(true)
    setError(null)

    try {
      const pageItems: PageItem[] = activePages.map((p) => ({
        originalIndex: p.originalIndex,
        rotation: p.rotation,
      }))

      const pdfBytes = await reorganizePDF(file, pageItems)
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = getSaveVexFileName(file.name)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Organization failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [file, activePages])

  const handleReset = useCallback(() => {
    setFile(null)
    setPageCount(0)
    setPages([])
    setError(null)
    originalPagesRef.current = []
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Main Column ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Failed" message={error} onRetry={handleDownload} />}

          {!file ? (
            <UploadDropzone acceptedFormats={['pdf']} onFileSelect={handleFileSelect} />
          ) : (
            <div className="space-y-6">
              {/* File info + stats */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                <FileText className="w-10 h-10 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {pageCount} page{pageCount !== 1 ? 's' : ''} · {formatBytes(file.size)}
                    {deletedCount > 0 && <span className="text-red-500 ml-2">· {deletedCount} deleted</span>}
                    {rotatedCount > 0 && <span className="text-primary ml-2">· {rotatedCount} rotated</span>}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}><RotateCcw className="w-4 h-4 mr-1" />New</Button>
              </div>

              {/* Bulk controls */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={rotateAll}
                  disabled={isGeneratingThumbs || isProcessing}>
                  <RotateCw className="w-4 h-4 mr-1" />Rotate All 90°
                </Button>
                {deletedCount > 0 && (
                  <Button variant="outline" size="sm" onClick={undoAllDeletes}
                    disabled={isProcessing}>
                    <Undo2 className="w-4 h-4 mr-1" />Undo All Deletes ({deletedCount})
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={resetAll}
                  disabled={isProcessing}>
                  <RotateCcw className="w-4 h-4 mr-1" />Reset to Original
                </Button>
              </div>

              {/* Thumbnail generation progress */}
              {isGeneratingThumbs && (
                <ProcessingStatus message="Generating page previews..." />
              )}

              {/* Sortable page list */}
              {pages.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={activeIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {pages.map((page, i) => (
                        <SortableTile
                          key={page.id}
                          page={page}
                          index={i}
                          total={pages.length}
                          onRotate={rotatePage}
                          onDelete={deletePage}
                          onUndo={undoDelete}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {/* Download button */}
              {pages.length > 0 && (
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90"
                  onClick={handleDownload}
                  disabled={isProcessing || activePages.length === 0}>
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {isProcessing
                    ? 'Organizing...'
                    : activePages.length === 0
                      ? 'No pages remaining'
                      : `Download Organized PDF (${activePages.length} page${activePages.length !== 1 ? 's' : ''})`}
                </Button>
              )}

              {isProcessing && <ProcessingStatus message="Reorganizing PDF..." />}
            </div>
          )}

          {/* How to Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Organize PDF Pages</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload PDF', desc: 'Click the upload area to select the PDF you want to reorganize.' },
                { step: 2, title: 'Rearrange pages', desc: 'Drag pages using the grip handle to reorder. Delete unwanted pages with the trash icon, or rotate pages 90° clockwise.' },
                { step: 3, title: 'Download', desc: 'Click Download to save your organized PDF with pages in their new order, with deletions and rotations applied.' },
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

        {/* ── Sidebar ────────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-4">Organization Info</h3>
              {file ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="font-medium truncate ml-2 max-w-[140px]">{file.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Original pages</span><span className="font-medium">{pageCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Final pages</span><span className="font-medium">{activePages.length}</span></div>
                  {deletedCount > 0 && <div className="flex justify-between"><span className="text-muted-foreground text-red-500">Deleted</span><span className="font-medium text-red-500">{deletedCount}</span></div>}
                  {rotatedCount > 0 && <div className="flex justify-between"><span className="text-muted-foreground text-primary">Rotated</span><span className="font-medium text-primary">{rotatedCount}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span className="font-medium">{formatBytes(file.size)}</span></div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Upload a PDF to reorder, delete, and rotate its pages. Drag to rearrange, use the buttons to rotate or remove pages.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
