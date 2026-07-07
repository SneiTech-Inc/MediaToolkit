'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { Download, RotateCcw, FileText, Image, Archive, Loader2, AlertTriangle } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { Button } from '@/components/ui/button'
import { getPdfPageCount } from '@/features/pdf/utils/pdfMerger'
import { parsePageInput } from '@/features/pdf/utils/pdfSplitter'
import { convertPDFToJPG } from '@/features/pdf/utils/pdfToJPG'
import type { PDFToJPGResult } from '@/features/pdf/utils/pdfToJPG'
import { formatBytes } from '@/utils/formatBytes'

// ─── Constants ─────────────────────────────────────────────────────────────

const QUALITY_MIN = 1
const QUALITY_MAX = 100
const QUALITY_DEFAULT = 92

interface ScalePreset {
  label: string
  scale: number
  desc: string
}

const SCALE_PRESETS: ScalePreset[] = [
  { label: 'Low', scale: 1.0, desc: '72 DPI' },
  { label: 'Medium', scale: 2.0, desc: '144 DPI' },
  { label: 'High', scale: 3.0, desc: '216 DPI' },
]

const TOOL_FAQS = [
  { question: 'What quality settings are available?', answer: 'Quality ranges from 1 (smallest file, lowest quality) to 100 (largest file, highest quality). The default of 92 provides excellent quality with reasonable file sizes.' },
  { question: 'Can I convert specific pages only?', answer: 'Yes! Toggle "Specific pages" and enter page numbers like "1,3,5-7" to convert only those pages.' },
  { question: 'What resolution are the output images?', answer: 'Low (72 DPI) matches screen resolution, Medium (144 DPI) is good for most uses, and High (216 DPI) provides print-quality output. Higher resolutions produce larger files.' },
  { question: 'Is my PDF uploaded to a server?', answer: 'No! All rendering happens entirely in your browser using PDF.js. Your PDF never leaves your device.' },
]

// ─── Component ─────────────────────────────────────────────────────────────

export function PDFToJPG() {
  // File state
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)

  // Options
  const [quality, setQuality] = useState(QUALITY_DEFAULT)
  const [useAllPages, setUseAllPages] = useState(true)
  const [pageInput, setPageInput] = useState('')
  const [pageInputError, setPageInputError] = useState<string | null>(null)
  const [scaleIndex, setScaleIndex] = useState(1) // default Medium (144 DPI)

  // Processing
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<PDFToJPGResult[]>([])
  const [error, setError] = useState<string | null>(null)

  // ZIP download state
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)

  // ── Resolve selected pages ────────────────────────────────────────────

  const selectedPages = useMemo((): number[] => {
    if (useAllPages) {
      return Array.from({ length: pageCount }, (_, i) => i + 1)
    }
    if (!pageInput.trim()) return []

    try {
      const zeroBased = parsePageInput(pageInput, pageCount)
      return zeroBased.map((i) => i + 1) // convert to 1-indexed
    } catch {
      return []
    }
  }, [useAllPages, pageInput, pageCount])

  // ── Validate page input ───────────────────────────────────────────────

  const validatedPages = useMemo((): number[] | null => {
    if (useAllPages) return Array.from({ length: pageCount }, (_, i) => i + 1)
    if (!pageInput.trim()) return null

    try {
      const zeroBased = parsePageInput(pageInput, pageCount)
      return zeroBased.map((i) => i + 1)
    } catch (err) {
      return null
    }
  }, [useAllPages, pageInput, pageCount])

  // ── Cleanup preview URLs on unmount ────────────────────────────────────

  useEffect(() => {
    return () => {
      results.forEach((r) => URL.revokeObjectURL(r.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f)
    setError(null)
    setResults([])
    setPageInput('')
    setPageInputError(null)
    setUseAllPages(true)
    try {
      const count = await getPdfPageCount(f)
      setPageCount(count)
    } catch {
      setError('Failed to read PDF. The file may be corrupted or encrypted.')
    }
  }, [])

  const handlePageInputChange = useCallback((value: string) => {
    setPageInput(value)
    if (!value.trim()) {
      setPageInputError(null)
      return
    }
    try {
      parsePageInput(value, pageCount)
      setPageInputError(null)
    } catch (err) {
      setPageInputError(err instanceof Error ? err.message : 'Invalid page input.')
    }
  }, [pageCount])

  const handleConvert = useCallback(async () => {
    if (!file || !validatedPages || validatedPages.length === 0) return

    // Revoke previous preview URLs
    results.forEach((r) => URL.revokeObjectURL(r.previewUrl))

    setIsProcessing(true)
    setError(null)
    setResults([])
    setProgress({ current: 0, total: validatedPages.length })

    try {
      const scale = SCALE_PRESETS[scaleIndex].scale
      const converted = await convertPDFToJPG(file, {
        quality,
        pages: validatedPages,
        scale,
        onProgress: (current, total) => setProgress({ current, total }),
      })
      setResults(converted)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.')
    } finally {
      setIsProcessing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, validatedPages, quality, scaleIndex])

  const handleDownloadSingle = useCallback((result: PDFToJPGResult) => {
    const url = result.previewUrl
    const a = document.createElement('a')
    a.href = url
    a.download = `page-${result.pageNumber}.jpg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  const handleDownloadAllZip = useCallback(async () => {
    if (results.length === 0) return
    setIsDownloadingZip(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      for (const result of results) {
        const buf = await result.blob.arrayBuffer()
        zip.file(`page-${result.pageNumber}.jpg`, buf)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = file!.name.replace('.pdf', '-pages.zip')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ZIP archive.')
    } finally {
      setIsDownloadingZip(false)
    }
  }, [results, file])

  const handleReset = useCallback(() => {
    results.forEach((r) => URL.revokeObjectURL(r.previewUrl))
    setFile(null)
    setPageCount(0)
    setQuality(QUALITY_DEFAULT)
    setUseAllPages(true)
    setPageInput('')
    setPageInputError(null)
    setScaleIndex(1)
    setResults([])
    setError(null)
    setProgress({ current: 0, total: 0 })
  }, [results])

  // ── Render ─────────────────────────────────────────────────────────────

  const totalOutputSize = results.reduce((sum, r) => sum + r.blob.size, 0)

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Main Column ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Conversion Failed" message={error} onRetry={handleConvert} />}

          {/* Upload */}
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
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-1" />New
                </Button>
              </div>

              {/* Quality slider */}
              <div className="p-4 rounded-xl border border-border bg-card">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Image Quality</label>
                  <span className="text-sm font-semibold text-primary">{quality}%</span>
                </div>
                <input
                  type="range"
                  min={QUALITY_MIN}
                  max={QUALITY_MAX}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full accent-primary"
                  disabled={isProcessing}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Smaller file</span>
                  <span>Higher quality</span>
                </div>
              </div>

              {/* Page selection */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pages"
                      checked={useAllPages}
                      onChange={() => { setUseAllPages(true); setPageInputError(null) }}
                      className="accent-primary"
                      disabled={isProcessing}
                    />
                    <span className="text-sm font-medium">All pages</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pages"
                      checked={!useAllPages}
                      onChange={() => setUseAllPages(false)}
                      className="accent-primary"
                      disabled={isProcessing}
                    />
                    <span className="text-sm font-medium">Specific pages</span>
                  </label>
                </div>

                {!useAllPages && (
                  <div>
                    <input
                      type="text"
                      value={pageInput}
                      onChange={(e) => handlePageInputChange(e.target.value)}
                      placeholder="e.g. 1, 3, 5-7"
                      disabled={isProcessing}
                      className={`w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono ${
                        pageInputError
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-border focus:ring-primary'
                      }`}
                    />
                    {pageInputError ? (
                      <p className="text-xs text-red-500 mt-1">{pageInputError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        Use commas between pages. Ranges like 5-7 are supported. Valid: 1–{pageCount}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Resolution presets */}
              <div className="grid grid-cols-3 gap-3">
                {SCALE_PRESETS.map((preset, idx) => (
                  <button
                    key={preset.label}
                    onClick={() => setScaleIndex(idx)}
                    disabled={isProcessing}
                    className={`p-4 rounded-xl border text-center transition-all ${
                      scaleIndex === idx
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-card hover:bg-muted'
                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="font-semibold text-sm">{preset.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{preset.desc}</div>
                  </button>
                ))}
              </div>

              {/* Convert button */}
              <Button
                size="lg"
                className="w-full bg-primary hover:bg-primary/90"
                onClick={handleConvert}
                disabled={isProcessing || validatedPages === null || validatedPages?.length === 0}
              >
                <Image className="w-4 h-4 mr-2" />
                {isProcessing
                  ? 'Converting...'
                  : `Convert ${validatedPages?.length ?? 0} Page${validatedPages?.length !== 1 ? 's' : ''} to JPG`}
              </Button>

              {/* Progress */}
              {isProcessing && (
                <div className="space-y-4">
                  <ProcessingStatus message="Rendering PDF pages..." />
                  <ProgressBar
                    percent={progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
                    label="Converting"
                    detail={`Page ${progress.current} of ${progress.total}`}
                  />
                </div>
              )}

              {/* Results grid */}
              {results.length > 0 && !isProcessing && (
                <div className="space-y-4">
                  {/* Download All */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      size="lg"
                      className="flex-1 bg-primary hover:bg-primary/90"
                      onClick={handleDownloadAllZip}
                      disabled={isDownloadingZip}
                    >
                      {isDownloadingZip ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Archive className="w-4 h-4 mr-2" />
                      )}
                      {isDownloadingZip ? 'Creating ZIP...' : `Download All as ZIP (${formatBytes(totalOutputSize)})`}
                    </Button>
                  </div>

                  {/* Preview grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {results.map((result) => (
                      <div
                        key={result.pageNumber}
                        className="rounded-xl border border-border bg-card overflow-hidden"
                      >
                        {/* Preview image */}
                        <div className="aspect-[8.5/11] bg-muted/30 flex items-center justify-center overflow-hidden border-b border-border">
                          <img
                            src={result.previewUrl}
                            alt={`Page ${result.pageNumber}`}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        </div>

                        {/* Info & download */}
                        <div className="p-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Page {result.pageNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {result.width}×{result.height} · {formatBytes(result.blob.size)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadSingle(result)}
                          >
                            <Download className="w-4 h-4 mr-1" />Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation warning */}
              {!isProcessing && file && !useAllPages && pageInput.trim() && validatedPages === null && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Enter valid page numbers to enable conversion. Use commas between pages or ranges like &ldquo;1,3,5-7&rdquo;.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* How to Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Convert PDF to JPG</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload PDF', desc: 'Click the upload area to select the PDF you want to convert.' },
                { step: 2, title: 'Choose settings', desc: 'Adjust quality, select pages, and pick your desired resolution.' },
                { step: 3, title: 'Convert & download', desc: 'Click Convert, preview the results, then download individual pages or all as a ZIP.' },
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
                  {results.length > 0 && (
                    <>
                      <div className="flex justify-between pt-2 border-t border-border">
                        <span className="text-muted-foreground">Pages converted</span>
                        <span className="font-medium">{results.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Output size</span>
                        <span className="font-medium text-green-600">{formatBytes(totalOutputSize)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quality</span>
                        <span className="font-medium">{quality}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Resolution</span>
                        <span className="font-medium">{SCALE_PRESETS[scaleIndex].desc}</span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Upload a PDF to convert its pages to JPEG images. Each page is rendered at your selected resolution and quality. All processing is done locally in your browser.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
