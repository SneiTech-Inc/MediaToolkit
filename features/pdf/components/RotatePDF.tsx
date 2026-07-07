'use client'

import { useState, useCallback, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Download, RotateCcw, RotateCw, RefreshCw, FileText, Rotate3D, Loader2 } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { Button } from '@/components/ui/button'
import { getPdfPageCount } from '@/features/pdf/utils/pdfMerger'
import { rotatePDFPages } from '@/features/pdf/utils/pdfRotator'
import type { PageRotation } from '@/features/pdf/utils/pdfRotator'
import { formatBytes } from '@/utils/formatBytes'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

// ─── Constants ─────────────────────────────────────────────────────────────

type Angle = 0 | 90 | 180 | 270

const ROTATION_LABELS: Record<Angle, string> = {
  0: '0°',
  90: '90°',
  180: '180°',
  270: '270°',
}

const TOOL_FAQS = [
  { question: 'Can I rotate specific pages only?', answer: 'Yes! Each page has individual rotate left, rotate right, and rotate 180° buttons. Only the pages you click are affected.' },
  { question: 'Can I rotate all pages at once?', answer: 'Yes! Use the "Apply to All" buttons at the top to rotate every page in the document simultaneously.' },
  { question: 'What rotation options are available?', answer: 'Rotate 90° clockwise, 90° counter-clockwise, or 180°. Each click adds to the current rotation, so you can achieve any 90° increment (0°, 90°, 180°, 270°).' },
  { question: 'Is my PDF uploaded to a server?', answer: 'No! All processing happens entirely in your browser using pdf-lib. Your PDF never leaves your device.' },
]

// ─── Thumbnail Generation ──────────────────────────────────────────────────

async function generateThumbnails(file: File, pageCount: number): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const thumbs: string[] = []

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 0.25 })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!

    await page.render({ canvasContext: ctx, viewport, canvas: null }).promise
    thumbs.push(canvas.toDataURL('image/jpeg', 0.7))
  }

  return thumbs
}

// ─── Component ─────────────────────────────────────────────────────────────

export function RotatePDF() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [rotations, setRotations] = useState<Angle[]>([])
  const [thumbnails, setThumbnails] = useState<string[]>([])
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Handle file upload ──────────────────────────────────────────────

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f)
    setError(null)
    setPdfBlob(null)

    try {
      const count = await getPdfPageCount(f)
      setPageCount(count)
      setRotations(Array.from({ length: count }, () => 0 as Angle))
      setIsGeneratingThumbs(true)

      const thumbs = await generateThumbnails(f, count)
      setThumbnails(thumbs)
    } catch {
      setError('Failed to read PDF. The file may be corrupted or encrypted.')
    } finally {
      setIsGeneratingThumbs(false)
    }
  }, [])

  // ── Rotation helpers ────────────────────────────────────────────────

  const addRotation = (delta: number): Angle => {
    return (((delta % 360) + 360) % 360) as Angle
  }

  const rotatePage = useCallback((index: number, delta: 90 | -90 | 180) => {
    setRotations((prev) => {
      const next = [...prev]
      next[index] = addRotation(next[index] + delta)
      return next
    })
    setPdfBlob(null)
  }, [])

  const rotateAll = useCallback((delta: 90 | -90 | 180) => {
    setRotations((prev) => prev.map((r) => addRotation(r + delta)))
    setPdfBlob(null)
  }, [])

  const resetAll = useCallback(() => {
    setRotations(Array.from({ length: pageCount }, () => 0 as Angle))
    setPdfBlob(null)
  }, [pageCount])

  // ── Download ────────────────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    if (!file) return
    setIsProcessing(true)
    setError(null)

    try {
      const instructions: PageRotation[] = rotations
        .map((rotation, i) => ({ pageIndex: i, rotation }))
        .filter((r) => r.rotation !== 0)

      const pdfBytes = await rotatePDFPages(file, instructions)
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      setPdfBlob(blob)

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name.replace('.pdf', '-rotated.pdf')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rotation failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [file, rotations])

  const handleReset = useCallback(() => {
    setFile(null)
    setPageCount(0)
    setRotations([])
    setThumbnails([])
    setPdfBlob(null)
    setError(null)
  }, [])

  // ── Derived ─────────────────────────────────────────────────────────

  const rotatedCount = rotations.filter((r) => r !== 0).length

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Main Column ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Rotation Failed" message={error} onRetry={handleDownload} />}

          {!file ? (
            <UploadDropzone acceptedFormats={['pdf']} onFileSelect={handleFileSelect} />
          ) : (
            <div className="space-y-6">
              {/* File info */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                <FileText className="w-10 h-10 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {pageCount} page{pageCount !== 1 ? 's' : ''} · {formatBytes(file.size)}
                    {rotatedCount > 0 && (
                      <span className="text-primary ml-2">
                        · {rotatedCount} rotated
                      </span>
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-1" />New
                </Button>
              </div>

              {/* Bulk controls */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rotateAll(-90)}
                  disabled={isGeneratingThumbs || isProcessing}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />Rotate All Left
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rotateAll(90)}
                  disabled={isGeneratingThumbs || isProcessing}
                >
                  <RotateCw className="w-4 h-4 mr-1" />Rotate All Right
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rotateAll(180)}
                  disabled={isGeneratingThumbs || isProcessing}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />Rotate All 180°
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetAll}
                  disabled={isGeneratingThumbs || isProcessing || rotatedCount === 0}
                >
                  <Rotate3D className="w-4 h-4 mr-1" />Reset All
                </Button>
              </div>

              {/* Thumbnail generation progress */}
              {isGeneratingThumbs && (
                <ProcessingStatus message="Generating page previews..." />
              )}

              {/* Thumbnail grid */}
              {thumbnails.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {thumbnails.map((thumb, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-card overflow-hidden"
                    >
                      {/* Preview image with CSS rotation */}
                      <div className="aspect-[8.5/11] bg-muted/30 flex items-center justify-center overflow-hidden border-b border-border p-4">
                        <img
                          src={thumb}
                          alt={`Page ${i + 1}`}
                          className="max-w-full max-h-full object-contain transition-transform duration-200"
                          style={{ transform: `rotate(${rotations[i]}deg)` }}
                        />
                      </div>

                      {/* Controls */}
                      <div className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Page {i + 1}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            rotations[i] !== 0
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {ROTATION_LABELS[rotations[i]]}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => rotatePage(i, -90)}
                            disabled={isProcessing}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => rotatePage(i, 90)}
                            disabled={isProcessing}
                          >
                            <RotateCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => rotatePage(i, 180)}
                            disabled={isProcessing}
                          >
                            180°
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Download button */}
              <Button
                size="lg"
                className="w-full bg-primary hover:bg-primary/90"
                onClick={handleDownload}
                disabled={isGeneratingThumbs || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {isProcessing
                  ? 'Rotating...'
                  : rotatedCount > 0
                    ? `Download Rotated PDF (${rotatedCount} page${rotatedCount !== 1 ? 's' : ''} modified)`
                    : 'Download PDF'}
              </Button>

              {isProcessing && <ProcessingStatus message="Applying rotations..." />}
            </div>
          )}

          {/* How to Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Rotate PDF Pages</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload PDF', desc: 'Click the upload area to select the PDF you want to rotate.' },
                { step: 2, title: 'Rotate pages', desc: 'Use the buttons below each preview to rotate individual pages 90° left, right, or 180°. Use "Apply to All" for bulk rotation.' },
                { step: 3, title: 'Download', desc: 'Click Download to save your rotated PDF. Only pages with non-zero rotation are modified.' },
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
              <h3 className="font-semibold text-lg mb-4">Rotation Info</h3>
              {file ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">File</span>
                    <span className="font-medium truncate ml-2 max-w-[140px]">{file.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pages</span>
                    <span className="font-medium">{pageCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size</span>
                    <span className="font-medium">{formatBytes(file.size)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-muted-foreground">Pages rotated</span>
                    <span className={`font-medium ${rotatedCount > 0 ? 'text-primary' : ''}`}>
                      {rotatedCount}
                    </span>
                  </div>
                  {pdfBlob && (
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="text-muted-foreground">Output size</span>
                      <span className="font-medium text-green-600">{formatBytes(pdfBlob.size)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Upload a PDF to rotate its pages. Use the preview grid to rotate individual pages or apply bulk rotation to all pages at once.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
