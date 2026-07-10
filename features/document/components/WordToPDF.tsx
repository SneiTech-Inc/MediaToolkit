'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback, useRef, useEffect } from 'react'
import { Download, RotateCcw, FileText } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/utils/formatBytes'
import { convertWordToPDF, renderDocxPreview } from '@/features/document/utils/wordToPdf'
import type { FAQItem } from '@/types/common'

const ACCEPTED_FORMATS = ['docx']

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Upload your Word document',
    desc: 'Click the upload area or drag and drop a .docx file. All processing happens in your browser.',
  },
  {
    step: 2,
    title: 'Preview the content',
    desc: 'Review your document with pixel-perfect rendering — images, tables, fonts, and layout are all preserved exactly.',
  },
  {
    step: 3,
    title: 'Convert to PDF',
    desc: 'Click Convert to PDF and your document will be captured and assembled as a downloadable PDF.',
  },
  {
    step: 4,
    title: 'Download your file',
    desc: 'Save the PDF to your device. Your original document stays private — nothing is uploaded to any server.',
  },
]

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What Word formats are supported?',
    answer:
      'We support .docx files (Word 2007 and later). Legacy .doc format is not supported. Images, tables, fonts, and layout are all preserved in the output.',
  },
  {
    question: 'Does formatting stay intact?',
    answer:
      'Yes! The document is rendered using a native OOXML renderer, so images, tables, borders, shading, fonts, and all formatting appear exactly as in Word. The preview shows your document with pixel-perfect accuracy.',
  },
  {
    question: 'Is my document uploaded to a server?',
    answer:
      'No! All processing happens entirely in your browser. Your documents never leave your device — 100% private and secure.',
  },
  {
    question: 'Are there file size limits?',
    answer:
      "File size is limited by your browser's available memory. Most modern browsers can handle documents up to 50 MB without issues. Very large documents with many images may take longer to process.",
  },
  {
    question: 'Will images and tables be preserved?',
    answer:
      'Yes! Unlike text-based converters, we render the document visually using your browser\'s layout engine. Images, tables, borders, shading, and fonts are all captured exactly as they appear.',
  },
]

/**
 * Word to PDF conversion tool.
 *
 * Flow: Upload .docx → Preview rendered document → Convert to PDF → Download
 * Uses docx-preview for OOXML rendering, html2canvas for capture, and pdf-lib for PDF assembly.
 * All processing is 100% client-side — no data leaves the browser.
 */
export function WordToPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRendering, setIsRendering] = useState(false)
  const [progress, setProgress] = useState(0)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [renderKey, setRenderKey] = useState(0)

  const previewRef = useRef<HTMLDivElement>(null)

  // Remove the first useEffect (the renderKey one) and the renderKey state entirely — not needed.

  useEffect(() => {
    if (!file || !previewRef.current) return

    const TIMEOUT_MS = 30_000
    let cancelled = false
    const container = previewRef.current

    container.replaceChildren() // clear old content, but keep the node itself mounted
    setPreviewReady(false)
    setIsRendering(true)
    setError(null)

    const render = async () => {
      try {
        const result = await Promise.race([
          renderDocxPreview(file, container).then(() => 'ok' as const),
          new Promise<'timeout'>((resolve) =>
            setTimeout(() => resolve('timeout'), TIMEOUT_MS),
          ),
        ])

        if (cancelled) return

        if (result === 'timeout') {
          setError('Preview timed out. The document may be too large or complex. You can still convert to PDF.')
          return
        }

        setPreviewReady(true)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to render document.')
      } finally {
        if (!cancelled) setIsRendering(false)
      }
    }

    render()

    return () => {
      cancelled = true
      container.replaceChildren() // clear content only — never detach the node
    }
  }, [file])

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    setPdfBlob(null)
    setPreviewReady(false)
  }, [])

  const handleConvert = useCallback(async () => {
    if (!file) return
    setIsProcessing(true)
    setError(null)
    setProgress(0)

    try {
      const pdfBytes = await convertWordToPDF(file, (pct) => setProgress(pct))
      setPdfBlob(new Blob([pdfBytes], { type: 'application/pdf' }))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'PDF conversion failed.'
      setError(message)
    } finally {
      setIsProcessing(false)
      setProgress(0)
    }
  }, [file])

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const baseName = file?.name.replace(/\.docx?$/i, '') || 'document'
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(`${baseName}.pdf`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [pdfBlob, file])

  const handleReset = useCallback(() => {
    setFile(null)
    setPdfBlob(null)
    setError(null)
    setProgress(0)
    setPreviewReady(false)
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────

  const showUpload = !file

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Main Content (lg:col-span-2) ─────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {/* Error */}
          {error && (
            <ErrorCard
              title="Conversion Failed"
              message={error}
              onRetry={handleReset}
            />
          )}

          {/* Upload */}
          {showUpload && (
            <UploadDropzone
              acceptedFormats={ACCEPTED_FORMATS}
              onFileSelect={handleFileSelect}
            />
          )}

          {/* Preview — always shown while a file is selected */}
          {file && (
            <div className="space-y-6">
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 flex items-center justify-between border-b border-border">
                  <span className="text-sm font-medium">
                    Preview — {file.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </span>
                </div>

                <div className="relative">
                  {isRendering && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                      <ProcessingStatus message="Rendering document..." />
                    </div>
                  )}
                  <div
                    ref={previewRef}
                    className="p-6 max-h-[500px] overflow-y-auto bg-white"
                    style={{ minHeight: '200px', height: 'auto' }}
                  />
                </div>
              </div>

              {/* Convert button (after preview is ready, before PDF) */}
              {previewReady && !pdfBlob && (
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                  onClick={handleConvert}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Convert to PDF
                </Button>
              )}

              {/* Skip Preview — shown when preview fails or takes too long */}
              {(error || isRendering) && file && !pdfBlob && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleConvert}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Skip Preview — Convert to PDF
                </Button>
              )}
            </div>
          )}

          {/* Converting progress */}
          {isProcessing && (
            <div className="space-y-4">
              <ProcessingStatus message="Creating PDF..." />
              <ProgressBar
                percent={progress}
                label="Converting"
                detail="Capturing document pages..."
              />
            </div>
          )}

          {/* Result */}
          {pdfBlob && !isProcessing && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 flex-1"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Convert Another
                </Button>
              </div>
            </div>
          )}

          {/* How To Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">
              How to Convert Word to PDF
            </h2>
            <ol className="space-y-4">
              {HOW_TO_STEPS.map((item) => (
                <li key={item.step} className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                    {item.step}
                  </span>
                  <div>
                    <h4 className="font-semibold">{item.title}</h4>
                    <p className="text-muted-foreground text-sm">
                      {item.desc}
                    </p>
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

        {/* ── Sidebar (lg:col-span-1) ──────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-4">Document Info</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your Word document is rendered with pixel-perfect accuracy —
                images, tables, and all formatting preserved. Processing
                happens entirely in your browser.
              </p>

              {file && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">File</span>
                    <span className="font-medium truncate ml-2 max-w-[140px]">
                      {file.name}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Size</span>
                    <span className="font-medium">
                      {formatBytes(file.size)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Format</span>
                    <span className="font-medium">.docx → .pdf</span>
                  </div>
                  {pdfBlob && (
                    <div className="flex justify-between text-sm pt-2 border-t border-border">
                      <span className="text-muted-foreground">PDF size</span>
                      <span className="font-medium">
                        {formatBytes(pdfBlob.size)}
                      </span>
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
