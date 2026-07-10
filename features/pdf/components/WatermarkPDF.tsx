'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Download, RotateCcw, FileText, Shield, Type, ImageIcon, AlertTriangle, Loader2 } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { getPdfPageCount } from '@/features/pdf/utils/pdfMerger'
import { parsePageInput } from '@/features/pdf/utils/pdfSplitter'
import { addTextWatermark, addImageWatermark } from '@/features/pdf/utils/pdfWatermark'
import type { WatermarkPosition } from '@/features/pdf/utils/pdfWatermark'
import { formatBytes } from '@/utils/formatBytes'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

// ─── Constants ─────────────────────────────────────────────────────────────

const POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'center', label: 'Center' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
]

const TOOL_FAQS = [
  { question: 'What types of watermarks can I add?', answer: 'Text watermarks (custom text with configurable font size, color, and rotation) or image watermarks (upload a logo or icon — PNG with transparency is recommended for best results).' },
  { question: 'Can I use a transparent PNG as a logo watermark?', answer: 'Yes! PNG images with transparency work best for logo watermarks. Non-PNG formats are automatically converted via Canvas before embedding.' },
  { question: 'Can I apply watermarks to specific pages only?', answer: 'Yes! Toggle "Specific pages" and enter page numbers like "1,3,5-7" to watermark only those pages.' },
  { question: 'Is my PDF uploaded to a server?', answer: 'No! All processing happens entirely in your browser using advanced PDF processing technology. Your PDF and watermark never leave your device.' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { r: 0.5, g: 0.5, b: 0.5 }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export function WatermarkPDF() {
  // PDF state
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [previewBase, setPreviewBase] = useState<string | null>(null) // page 1 rendered as data URL

  // Watermark type
  const [wmType, setWmType] = useState<'text' | 'image'>('text')

  // Text options
  const [text, setText] = useState('© SaveVex')
  const [fontSize, setFontSize] = useState(48)
  const [textColor, setTextColor] = useState('#808080')
  const [textRotation, setTextRotation] = useState(0)

  // Image options
  const [wmFile, setWmFile] = useState<File | null>(null)
  const [wmImg, setWmImg] = useState<HTMLImageElement | null>(null)
  const [wmScale, setWmScale] = useState(50)

  // Common options
  const [position, setPosition] = useState<WatermarkPosition>('center')
  const [opacity, setOpacity] = useState(30)
  const [useAllPages, setUseAllPages] = useState(true)
  const [pageInput, setPageInput] = useState('')
  const [pageInputError, setPageInputError] = useState<string | null>(null)

  // Processing
  const [isProcessing, setIsProcessing] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Preview canvas
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  // ── Load PDF and generate base preview ──────────────────────────────

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f)
    setError(null)
    setPdfBlob(null)

    try {
      const count = await getPdfPageCount(f)
      setPageCount(count)

      // Render first page for preview base
      const buf = await f.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: 0.5 })

      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!

      await page.render({ canvasContext: ctx, viewport, canvas: null }).promise
      setPreviewBase(canvas.toDataURL('image/jpeg', 0.85))
    } catch {
      setError('Failed to read PDF.')
    }
  }, [])

  // ── Load watermark image ────────────────────────────────────────────

  const handleWmFileSelect = useCallback((f: File) => {
    setWmFile(f)
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => setWmImg(img)
    img.onerror = () => setError('Failed to load watermark image.')
    img.src = url
  }, [])

  // ── Render preview overlay ──────────────────────────────────────────

  useEffect(() => {
    if (!previewBase || !previewCanvasRef.current) return

    const canvas = previewCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw base page image
    const baseImg = new Image()
    baseImg.onload = () => {
      canvas.width = baseImg.naturalWidth
      canvas.height = baseImg.naturalHeight
      ctx.drawImage(baseImg, 0, 0)

      ctx.save()
      ctx.globalAlpha = opacity / 100

      if (wmType === 'text') {
        // Text watermark overlay
        const fs = fontSize * 0.5 // scale to preview (0.5 scale factor)
        ctx.font = `${fs}px system-ui, sans-serif`
        ctx.fillStyle = textColor

        const tw = text.length * fs * 0.55
        const th = fs
        const pos = calculatePreviewPos(position, canvas.width, canvas.height, tw, th)

        // Apply rotation
        ctx.translate(pos.x + tw / 2, pos.y + th / 2)
        ctx.rotate((textRotation * Math.PI) / 180)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, 0, 0)

      } else if (wmType === 'image' && wmImg) {
        // Image watermark overlay
        const scale = wmScale / 100
        const iw = wmImg.naturalWidth * scale * 0.5 // account for preview scale
        const ih = wmImg.naturalHeight * scale * 0.5
        const pos = calculatePreviewPos(position, canvas.width, canvas.height, iw, ih)

        ctx.drawImage(wmImg, pos.x, pos.y, iw, ih)
      }

      ctx.restore()
    }
    baseImg.src = previewBase
  }, [previewBase, wmType, text, fontSize, textColor, textRotation, wmImg, wmScale, position, opacity])

  // ── Page validation ─────────────────────────────────────────────────

  const validatedPages = useMemo((): number[] | null => {
    if (useAllPages) return Array.from({ length: pageCount }, (_, i) => i)
    if (!pageInput.trim()) return null
    try {
      return parsePageInput(pageInput, pageCount)
    } catch {
      return null
    }
  }, [useAllPages, pageInput, pageCount])

  const handlePageInputChange = useCallback((value: string) => {
    setPageInput(value)
    if (!value.trim()) { setPageInputError(null); return }
    try {
      parsePageInput(value, pageCount)
      setPageInputError(null)
    } catch (err) {
      setPageInputError(err instanceof Error ? err.message : 'Invalid input.')
    }
  }, [pageCount])

  // ── Apply watermark ─────────────────────────────────────────────────

  const handleApply = useCallback(async () => {
    if (!file) return
    if (wmType === 'image' && !wmFile) return

    setIsProcessing(true)
    setError(null)

    try {
      let pdfBytes: Uint8Array
      const pages = validatedPages && validatedPages.length > 0 ? validatedPages : undefined

      if (wmType === 'text') {
        pdfBytes = await addTextWatermark(file, {
          text,
          fontSize,
          color: hexToRgb(textColor),
          opacity,
          rotation: textRotation,
          position,
        }, pages)
      } else {
        pdfBytes = await addImageWatermark(file, {
          imageFile: wmFile!,
          scale: wmScale,
          opacity,
          position,
        }, pages)
      }

      setPdfBlob(new Blob([pdfBytes], { type: 'application/pdf' }))

      // Auto-download
      const url = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = file.name.replace('.pdf', '-watermarked.pdf')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Watermark failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [file, wmType, wmFile, text, fontSize, textColor, opacity, textRotation, position, wmScale, validatedPages])

  const handleReset = useCallback(() => {
    if (wmFile && wmImg && wmImg.src.startsWith('blob:')) URL.revokeObjectURL(wmImg.src)
    setFile(null)
    setPageCount(0)
    setPreviewBase(null)
    setWmType('text')
    setText('© SaveVex')
    setFontSize(48)
    setTextColor('#808080')
    setTextRotation(0)
    setWmFile(null)
    setWmImg(null)
    setWmScale(50)
    setPosition('center')
    setOpacity(30)
    setUseAllPages(true)
    setPageInput('')
    setPageInputError(null)
    setPdfBlob(null)
    setError(null)
  }, [wmFile, wmImg])

  // ── Render ───────────────────────────────────────────────────────────

  const canApply = file && (wmType === 'text' || (wmType === 'image' && wmFile))

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Main Column ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Watermark Failed" message={error} onRetry={handleApply} />}

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
                <div className="flex items-center justify-center p-4">
                  <canvas ref={previewCanvasRef} className="max-w-full shadow-lg rounded" />
                </div>
                <div className="px-4 py-2 border-t border-border bg-card text-center">
                  <span className="text-xs text-muted-foreground">Page 1 preview with watermark</span>
                </div>
              </div>

              {/* Watermark type tabs */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setWmType('text')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-medium transition-all ${
                    wmType === 'text'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted'
                  }`}
                >
                  <Type className="w-4 h-4" />Text Watermark
                </button>
                <button
                  onClick={() => setWmType('image')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-medium transition-all ${
                    wmType === 'image'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />Image Watermark
                </button>
              </div>

              {/* Text Watermark settings */}
              {wmType === 'text' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-border bg-card">
                    <label className="text-sm font-medium block mb-2">Text</label>
                    <input
                      type="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      disabled={isProcessing}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-border bg-card">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium">Font Size</label>
                        <span className="text-sm font-semibold text-primary">{fontSize}px</span>
                      </div>
                      <input type="range" min={12} max={120} value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="w-full accent-primary" disabled={isProcessing} />
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-card">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium">Color</label>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded border border-border" style={{ backgroundColor: textColor }} />
                          <input type="color" value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            className="w-6 h-6 cursor-pointer border-0 bg-transparent"
                            disabled={isProcessing} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium">Rotation</label>
                      <span className="text-sm font-semibold text-primary">{textRotation}°</span>
                    </div>
                    <input type="range" min={0} max={360} step={15} value={textRotation}
                      onChange={(e) => setTextRotation(Number(e.target.value))}
                      className="w-full accent-primary" disabled={isProcessing} />
                  </div>
                </div>
              )}

              {/* Image Watermark settings */}
              {wmType === 'image' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-border bg-card">
                    <label className="text-sm font-medium block mb-2">Watermark Image</label>
                    {!wmFile ? (
                      <UploadDropzone acceptedFormats={['png', 'jpg', 'jpeg', 'webp']} onFileSelect={handleWmFileSelect} />
                    ) : (
                      <div className="flex items-center gap-3">
                        {wmImg && (
                          <img src={wmImg.src} alt="Watermark"
                            className="w-12 h-12 rounded-lg object-contain bg-muted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{wmFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {wmImg ? `${wmImg.naturalWidth}×${wmImg.naturalHeight}` : ''} · {formatBytes(wmFile.size)}
                          </p>
                        </div>
                        <Button variant="outline" size="sm"
                          onClick={() => { if (wmImg && wmImg.src.startsWith('blob:')) URL.revokeObjectURL(wmImg.src); setWmFile(null); setWmImg(null) }}>
                          Change
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-card">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium">Scale</label>
                      <span className="text-sm font-semibold text-primary">{wmScale}%</span>
                    </div>
                    <input type="range" min={10} max={100} step={5} value={wmScale}
                      onChange={(e) => setWmScale(Number(e.target.value))}
                      className="w-full accent-primary" disabled={isProcessing} />
                  </div>
                </div>
              )}

              {/* Common settings */}
              <div className="space-y-4">
                {/* Position */}
                <div className="p-4 rounded-xl border border-border bg-card">
                  <label className="text-sm font-medium block mb-3">Position</label>
                  <div className="grid grid-cols-5 gap-2">
                    {POSITIONS.map((p) => (
                      <button key={p.value}
                        onClick={() => setPosition(p.value)}
                        disabled={isProcessing}
                        className={`px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                          position === p.value
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border bg-background hover:bg-muted'
                        }`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity */}
                <div className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium">Opacity</label>
                    <span className="text-sm font-semibold text-primary">{opacity}%</span>
                  </div>
                  <input type="range" min={0} max={100} value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="w-full accent-primary" disabled={isProcessing} />
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
                        placeholder="e.g. 1, 3, 5-7"
                        disabled={isProcessing}
                        className={`w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono ${
                          pageInputError ? 'border-red-500' : 'border-border'
                        }`} />
                      {pageInputError ? (
                        <p className="text-xs text-red-500 mt-1">{pageInputError}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">Valid: 1–{pageCount}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Validation warning */}
              {!isProcessing && !useAllPages && pageInput.trim() && validatedPages === null && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Enter valid page numbers to apply the watermark.
                  </p>
                </div>
              )}

              {/* Apply button */}
              <Button size="lg" className="w-full bg-primary hover:bg-primary/90"
                onClick={handleApply}
                disabled={!canApply || isProcessing || (!useAllPages && validatedPages === null)}>
                {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                {isProcessing ? 'Applying Watermark...' : pdfBlob ? 'Download Watermarked PDF Again' : 'Apply Watermark & Download'}
              </Button>

              {isProcessing && <ProcessingStatus message="Adding watermark to PDF..." />}
            </div>
          )}

          {/* How to Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Add a Watermark</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload PDF', desc: 'Click the upload area to select the PDF you want to watermark.' },
                { step: 2, title: 'Choose watermark type', desc: 'Select Text (custom text with font, color, rotation) or Image (upload a logo/icon — PNG with transparency works best).' },
                { step: 3, title: 'Adjust settings', desc: 'Set position, opacity, and which pages to watermark. Preview updates live.' },
                { step: 4, title: 'Apply & download', desc: 'Click Apply to add the watermark and download your protected PDF.' },
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
              <h3 className="font-semibold text-lg mb-4">Watermark Info</h3>
              {file ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="font-medium truncate ml-2 max-w-[140px]">{file.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pages</span><span className="font-medium">{pageCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span className="font-medium">{formatBytes(file.size)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium">{wmType === 'text' ? 'Text' : 'Image'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Position</span><span className="font-medium">{POSITIONS.find((p) => p.value === position)?.label}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Opacity</span><span className="font-medium">{opacity}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pages</span><span className="font-medium">{useAllPages ? `All (${pageCount})` : (validatedPages?.length ?? '—')}</span></div>
                  {pdfBlob && <div className="flex justify-between pt-2 border-t border-border"><span className="text-muted-foreground">Output</span><span className="font-medium text-green-600">{formatBytes(pdfBlob.size)}</span></div>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Upload a PDF to add a text or image watermark. Choose position, opacity, and target pages.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Preview Position Helper (scaled) ──────────────────────────────────────

function calculatePreviewPos(
  position: WatermarkPosition,
  canvasW: number,
  canvasH: number,
  wmW: number,
  wmH: number,
  pad = 20,
): { x: number; y: number } {
  switch (position) {
    case 'center': return { x: (canvasW - wmW) / 2, y: (canvasH - wmH) / 2 }
    case 'top-left': return { x: pad, y: pad }
    case 'top-right': return { x: canvasW - wmW - pad, y: pad }
    case 'bottom-left': return { x: pad, y: canvasH - wmH - pad }
    case 'bottom-right': return { x: canvasW - wmW - pad, y: canvasH - wmH - pad }
  }
}
