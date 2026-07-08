'use client'

import { useState, useCallback } from 'react'
import { Download, RotateCcw, Presentation } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/utils/formatBytes'
import { convertPPTToPDF } from '@/features/document/utils/pptToPdf'
import type { FAQItem } from '@/types/common'

const ACCEPTED_FORMATS = ['pptx']

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Upload your presentation',
    desc: 'Click the upload area or drag and drop a .pptx file. All processing happens in your browser.',
  },
  {
    step: 2,
    title: 'Review slide count',
    desc: 'See how many slides are in your presentation. Each slide becomes one PDF page.',
  },
  {
    step: 3,
    title: 'Download your PDF',
    desc: 'Click Convert to PDF and download. Text, images, and shapes are preserved in the output.',
  },
]

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What PowerPoint formats are supported?',
    answer:
      'We support .pptx files (PowerPoint 2007 and later). Legacy .ppt format is not supported. Each slide is rendered as a PDF page.',
  },
  {
    question: 'What formatting is preserved?',
    answer:
      'Text, images, shapes, and basic layout are preserved. Animations, slide transitions, embedded videos, and 3D objects are not rendered in the PDF.',
  },
  {
    question: 'Is my presentation uploaded to a server?',
    answer:
      'No! All processing happens entirely in your browser. Your presentation never leaves your device — 100% private and secure.',
  },
  {
    question: 'What about large presentations?',
    answer:
      'Presentations with many slides may take longer to process. A progress indicator shows which slide is being rendered. Very large files (50MB+) may exceed browser memory limits.',
  },
]

/**
 * PPT to PDF conversion tool.
 *
 * Flow: Upload .pptx → Count slides → Render each slide → Assemble PDF → Download
 * Uses pptxjs for HTML rendering, html2canvas-pro for capture, and pdf-lib for PDF assembly.
 * All processing is 100% client-side — no data leaves the browser.
 */
export function PPTToPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [slideCount, setSlideCount] = useState(0)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    setPdfBlob(null)
    setError(null)

    // Count slides
    try {
      const { PPTXViewer } = await import('pptxviewjs')
      const viewer = new PPTXViewer()
      await viewer.loadFile(selectedFile)
      setSlideCount(viewer.getSlideCount())
      viewer.destroy()
    } catch {
      setSlideCount(0)
    }
  }, [])

  const handleConvert = useCallback(async () => {
    if (!file) return
    setIsProcessing(true)
    setError(null)
    setProgress({ current: 0, total: slideCount })

    try {
      const pdfBytes = await convertPPTToPDF(file, (current, total) =>
        setProgress({ current, total }),
      )
      setPdfBlob(new Blob([pdfBytes], { type: 'application/pdf' }))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'PDF conversion failed.',
      )
    } finally {
      setIsProcessing(false)
    }
  }, [file, slideCount])

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const baseName = file?.name.replace(/\.pptx?$/i, '') || 'presentation'
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [pdfBlob, file])

  const handleReset = useCallback(() => {
    setFile(null)
    setPdfBlob(null)
    setError(null)
    setProgress({ current: 0, total: 0 })
    setSlideCount(0)
  }, [])

  const showUpload = !file

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {error && (
            <ErrorCard
              title="Conversion Failed"
              message={error}
              onRetry={handleReset}
            />
          )}

          {showUpload && (
            <UploadDropzone
              acceptedFormats={ACCEPTED_FORMATS}
              onFileSelect={handleFileSelect}
            />
          )}

          {file && !isProcessing && !pdfBlob && (
            <div className="space-y-6">
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 flex items-center justify-between border-b border-border">
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </span>
                </div>
                <div className="p-6 text-center text-muted-foreground">
                  <Presentation className="w-12 h-12 mx-auto mb-3" />
                  <p className="text-lg font-medium text-foreground">
                    {slideCount > 0
                      ? `${slideCount} slide${slideCount > 1 ? 's' : ''} detected`
                      : 'Counting slides...'}
                  </p>
                  <p className="text-xs mt-1">
                    Each slide becomes one PDF page
                  </p>
                </div>
              </div>

              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                onClick={handleConvert}
                disabled={slideCount === 0}
              >
                <Presentation className="w-4 h-4 mr-2" />
                Convert to PDF
              </Button>
            </div>
          )}

          {isProcessing && (
            <div className="space-y-4">
              <ProcessingStatus message="Rendering slides..." />
              <ProgressBar
                percent={
                  progress.total > 0
                    ? (progress.current / progress.total) * 100
                    : 0
                }
                label="Converting"
                detail={
                  progress.total > 0
                    ? `Slide ${progress.current} of ${progress.total}`
                    : 'Preparing...'
                }
              />
            </div>
          )}

          {pdfBlob && !isProcessing && (
            <div className="space-y-6">
              <div className="border border-border rounded-xl p-8 text-center bg-green-500/10 border-green-500">
                <div className="text-4xl mb-4">✓</div>
                <h3 className="text-xl font-semibold mb-2">PDF Ready</h3>
                <p className="text-muted-foreground mb-2">
                  {file?.name} — {slideCount} slide{slideCount > 1 ? 's' : ''}{' '}
                  converted
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90"
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
            </div>
          )}

          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">
              How to Convert PPT to PDF
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

          <div className="mt-12">
            <FAQSection
              faqs={TOOL_FAQS}
              title="Frequently Asked Questions"
              description=""
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-4">
                Presentation Info
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Each slide is rendered as a full PDF page. Text, images, and
                shapes are preserved. Animations and transitions are not
                included. All processing happens locally in your browser.
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
                    <span className="text-muted-foreground">Slides</span>
                    <span className="font-medium">
                      {slideCount || '—'}
                    </span>
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
