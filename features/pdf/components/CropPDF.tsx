'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Download, RotateCcw, FileText, Crop, Loader2, Scan, AlertTriangle } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { getPdfPageCount } from '@/features/pdf/utils/pdfMerger'
import { parsePageInput } from '@/features/pdf/utils/pdfSplitter'
import { cropPDF, detectWhiteMargins } from '@/features/pdf/utils/pdfCropper'
import type { CropMargins } from '@/features/pdf/utils/pdfCropper'
import { formatBytes } from '@/utils/formatBytes'
import { getSaveVexFileName } from '@/utils/fileNames'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

// ─── Constants ─────────────────────────────────────────────────────────────

interface Preset {
  label: string
  getMargins?: (pageWidth: number, pageHeight: number) => CropMargins
}

const PRESETS: Preset[] = [
  { label: 'Custom' },
  { label: 'A4', getMargins: (w, h) => ({ top: Math.max(0, h - 842), bottom: 0, left: Math.max(0, w - 595), right: 0 }) },
  { label: 'Letter', getMargins: (w, h) => ({ top: Math.max(0, h - 792), bottom: 0, left: Math.max(0, w - 612), right: 0 }) },
  { label: 'Legal', getMargins: (w, h) => ({ top: Math.max(0, h - 1008), bottom: 0, left: Math.max(0, w - 612), right: 0 }) },
  { label: 'Auto-Detect' },
]

const TOOL_FAQS = [
  { question: 'What does cropping a PDF do?', answer: 'Cropping trims the visible area of PDF pages by setting a crop box. Content outside the crop box is hidden but not deleted — it can be restored with the original file.' },
  { question: 'Can I crop specific pages only?', answer: 'Yes! Toggle "Specific pages" and enter page numbers like "1,3,5-7" to crop only those pages.' },
  { question: 'Does cropping affect PDF quality?', answer: 'No. Cropping changes the visible area, not the resolution. All content remains at its original quality.' },
  { question: 'Is my PDF uploaded to a server?', answer: 'No! All processing happens entirely in your browser. Your PDF never leaves your device.' },
]

// ─── Component ─────────────────────────────────────────────────────────────

export function CropPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [pageWidth, setPageWidth] = useState(0)
  const [pageHeight, setPageHeight] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [margins, setMargins] = useState<CropMargins>({ top: 0, bottom: 0, left: 0, right: 0 })
  const [presetIndex, setPresetIndex] = useState(0)
  const [useAllPages, setUseAllPages] = useState(true)
  const [pageInput, setPageInput] = useState('')
  const [pageInputError, setPageInputError] = useState<string | null>(null)

  const [isProcessing, setIsProcessing] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [resultData, setResultData] = useState<Uint8Array | null>(null)
  const [error, setError] = useState<string | null>(null)

  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  // ── Upload ──────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f); setError(null); setResultData(null)
    try {
      const count = await getPdfPageCount(f)
      setPageCount(count)

      // Render first page for preview
      const buf = await f.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: 0.5 })

      setPageWidth(viewport.width)
      setPageHeight(viewport.height)

      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport, canvas: null }).promise
      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.85))
    } catch {
      setError('Failed to read PDF.')
    }
  }, [])

  // ── Draw crop overlay on preview canvas ─────────────────────────────

  useEffect(() => {
    if (!previewUrl || !previewCanvasRef.current || !pageWidth) return

    const canvas = previewCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)

      // Draw crop overlay
      const { top, bottom, left, right } = margins

      // Dimmed areas outside crop
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      if (top > 0) ctx.fillRect(0, 0, canvas.width, top)
      if (bottom > 0) ctx.fillRect(0, canvas.height - bottom, canvas.width, bottom)
      if (left > 0) ctx.fillRect(0, top, left, canvas.height - top - bottom)
      if (right > 0) ctx.fillRect(canvas.width - right, top, right, canvas.height - top - bottom)

      // Dashed crop border
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(left, top, canvas.width - left - right, canvas.height - top - bottom)
      ctx.setLineDash([])
    }
    img.src = previewUrl
  }, [previewUrl, margins, pageWidth])

  // ── Preset handling ─────────────────────────────────────────────────

  const handlePreset = useCallback(async (index: number) => {
    setPresetIndex(index)
    setResultData(null)

    if (index === 4 && file) {
      // Auto-detect
      setIsDetecting(true)
      try {
        const detected = await detectWhiteMargins(file)
        setMargins(detected)
      } catch {
        setError('Auto-detection failed. Please set margins manually.')
      } finally {
        setIsDetecting(false)
      }
    } else if (index > 0 && index < 4 && PRESETS[index].getMargins) {
      // A4/Letter/Legal preset
      const size = PRESETS[index].getMargins!(pageWidth, pageHeight)
      setMargins(size)
    }
  }, [file, pageWidth, pageHeight])

  const setMargin = (key: keyof CropMargins, value: number) => {
    setMargins((prev) => ({ ...prev, [key]: Math.max(0, value) }))
    setPresetIndex(0)  // switch to Custom
    setResultData(null)
  }

  // ── Page validation ─────────────────────────────────────────────────

  const validatedPages = useMemo((): number[] | null => {
    if (useAllPages) return Array.from({ length: pageCount }, (_, i) => i)
    if (!pageInput.trim()) return null
    try { return parsePageInput(pageInput, pageCount) }
    catch { return null }
  }, [useAllPages, pageInput, pageCount])

  const handlePageInputChange = useCallback((value: string) => {
    setPageInput(value)
    if (!value.trim()) { setPageInputError(null); return }
    try { parsePageInput(value, pageCount); setPageInputError(null) }
    catch (err) { setPageInputError(err instanceof Error ? err.message : 'Invalid input.') }
  }, [pageCount])

  // ── Apply crop ──────────────────────────────────────────────────────

  const handleCrop = useCallback(async () => {
    if (!file || !validatedPages) return
    setIsProcessing(true); setError(null)
    try {
      const data = await cropPDF(file, { margins, pages: validatedPages })
      setResultData(data)

      const blob = new Blob([data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = getSaveVexFileName(file.name)
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crop failed.')
    } finally { setIsProcessing(false) }
  }, [file, margins, validatedPages])

  const handleReset = useCallback(() => {
    setFile(null); setPageCount(0); setPageWidth(0); setPageHeight(0)
    setPreviewUrl(null); setMargins({ top: 0, bottom: 0, left: 0, right: 0 })
    setPresetIndex(0); setUseAllPages(true); setPageInput('')
    setPageInputError(null); setResultData(null); setError(null)
  }, [])

  // ── Render ───────────────────────────────────────────────────────────

  const hasCrop = margins.top > 0 || margins.bottom > 0 || margins.left > 0 || margins.right > 0

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Crop Failed" message={error} onRetry={handleCrop} />}

          {!file ? (
            <UploadDropzone acceptedFormats={['pdf']} onFileSelect={handleFileSelect} />
          ) : (
            <div className="space-y-6">
              {/* File info */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                <FileText className="w-10 h-10 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{pageCount} page{pageCount !== 1 ? 's' : ''} · {formatBytes(file.size)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}><RotateCcw className="w-4 h-4 mr-1" />New</Button>
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                <canvas ref={previewCanvasRef} className="max-w-full" />
                <div className="px-4 py-2 border-t border-border bg-card text-center">
                  <span className="text-xs text-muted-foreground">
                    {hasCrop ? 'Preview with crop overlay' : 'Original page — adjust margins to crop'}
                  </span>
                </div>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset, idx) => (
                  <Button key={preset.label} variant={presetIndex === idx ? 'default' : 'outline'} size="sm"
                    onClick={() => handlePreset(idx)}
                    disabled={isProcessing || isDetecting}
                    className={presetIndex === idx ? 'bg-primary hover:bg-primary/90' : ''}>
                    {idx === 4 ? <><Scan className="w-4 h-4 mr-1" />{preset.label}</> : preset.label}
                  </Button>
                ))}
              </div>

              {isDetecting && <ProcessingStatus message="Detecting white margins..." />}

              {/* Margin inputs */}
              <div className="grid grid-cols-2 gap-4">
                {([
                  { key: 'top' as const, label: 'Top' },
                  { key: 'bottom' as const, label: 'Bottom' },
                  { key: 'left' as const, label: 'Left' },
                  { key: 'right' as const, label: 'Right' },
                ]).map(({ key, label }) => (
                  <div key={key} className="p-3 rounded-xl border border-border bg-card">
                    <label className="text-sm font-medium block mb-1">{label}</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min={0} max={pageHeight || 500} value={margins[key]}
                        onChange={(e) => setMargin(key, Number(e.target.value))}
                        className="flex-1 accent-primary" disabled={isProcessing} />
                      <span className="text-sm font-mono w-10 text-right">{margins[key]}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Page selection */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <label className="text-sm font-medium">Pages</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="pages" checked={useAllPages}
                      onChange={() => { setUseAllPages(true); setPageInputError(null) }}
                      className="accent-primary" disabled={isProcessing} />
                    <span className="text-sm">All pages</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="pages" checked={!useAllPages}
                      onChange={() => setUseAllPages(false)}
                      className="accent-primary" disabled={isProcessing} />
                    <span className="text-sm">Specific pages</span>
                  </label>
                </div>
                {!useAllPages && (
                  <div>
                    <input type="text" value={pageInput}
                      onChange={(e) => handlePageInputChange(e.target.value)}
                      placeholder="e.g. 1, 3, 5-7" disabled={isProcessing}
                      className={`w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono ${pageInputError ? 'border-red-500' : 'border-border'}`} />
                    {pageInputError ? <p className="text-xs text-red-500 mt-1">{pageInputError}</p>
                      : <p className="text-xs text-muted-foreground mt-1">Valid: 1–{pageCount}</p>}
                  </div>
                )}
              </div>

              {/* Validation warning */}
              {!isProcessing && !useAllPages && pageInput.trim() && validatedPages === null && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">Enter valid page numbers to apply cropping.</p>
                </div>
              )}

              {/* Apply */}
              <Button size="lg" className="w-full bg-primary hover:bg-primary/90"
                onClick={handleCrop}
                disabled={isProcessing || !hasCrop || (!useAllPages && validatedPages === null)}>
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Crop className="w-4 h-4 mr-2" />}
                {isProcessing ? 'Cropping...' : resultData ? 'Download Cropped PDF Again' : 'Apply Crop & Download'}
              </Button>

              {isProcessing && <ProcessingStatus message="Applying crop..." />}
            </div>
          )}

          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Crop a PDF</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload PDF', desc: 'Click the upload area to select the PDF you want to crop.' },
                { step: 2, title: 'Adjust margins', desc: 'Use sliders or choose a preset (A4, Letter, Legal) or Auto-Detect to find white margins.' },
                { step: 3, title: 'Apply & download', desc: 'Preview the crop area, then click Apply to crop and download your PDF.' },
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
              <h3 className="font-semibold text-lg mb-4">Crop Info</h3>
              {file ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="font-medium truncate ml-2 max-w-[140px]">{file.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pages</span><span className="font-medium">{pageCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span className="font-medium">{formatBytes(file.size)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Top</span><span className="font-medium">{margins.top}pt</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Bottom</span><span className="font-medium">{margins.bottom}pt</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Left</span><span className="font-medium">{margins.left}pt</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Right</span><span className="font-medium">{margins.right}pt</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Affected</span><span className="font-medium">{useAllPages ? `All (${pageCount})` : (validatedPages?.length ?? '—')}</span></div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Upload a PDF to crop its pages. Adjust margins manually or use Auto-Detect to find and remove white borders automatically.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
