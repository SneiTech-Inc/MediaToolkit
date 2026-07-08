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
import { convertPDFToPPT } from '@/features/document/utils/pdfToPPT'
import type { FAQItem } from '@/types/common'

const ACCEPTED_FORMATS = ['pdf']

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What content is preserved in the PowerPoint?',
    answer:
      'Text, headings, bold, italic, bullet lists, and numbered lists are extracted. Each PDF page becomes one slide. Complex layouts, tables, images, and exact fonts are not preserved in v1.',
  },
  {
    question: 'Can I edit the converted presentation?',
    answer:
      'Yes! The .pptx file is fully editable in PowerPoint or any compatible editor. You can change text, formatting, layouts, and add your own content.',
  },
  {
    question: 'Is my PDF uploaded to a server?',
    answer:
      'No! All processing happens entirely in your browser. Your PDF never leaves your device — 100% private and secure.',
  },
  {
    question: 'What about image-only PDFs?',
    answer:
      'Scanned/image-only PDFs won\'t work — they contain no extractable text. You\'ll see an error message if no text is found.',
  },
]

/**
 * PDF to PowerPoint conversion tool.
 * Extracts text, headings, and lists from PDFs into editable .pptx slides.
 */
export function PDFToPPT() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [pptxBlob, setPptxBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback((f: File) => {
    setFile(f)
    setPptxBlob(null)
    setError(null)
  }, [])

  const handleConvert = useCallback(async () => {
    if (!file) return
    setIsProcessing(true)
    setError(null)
    setProgress(0)
    try {
      const blob = await convertPDFToPPT(file, (p) => setProgress(p))
      setPptxBlob(blob)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.')
    } finally {
      setIsProcessing(false)
      setProgress(0)
    }
  }, [file])

  const handleDownload = useCallback(() => {
    if (!pptxBlob) return
    const url = URL.createObjectURL(pptxBlob)
    const base = file?.name.replace(/\.pdf$/i, '') || 'presentation'
    const a = document.createElement('a')
    a.href = url; a.download = `${base}.pptx`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [pptxBlob, file])

  const handleReset = useCallback(() => {
    setFile(null); setPptxBlob(null); setError(null); setProgress(0)
  }, [])

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Conversion Failed" message={error} onRetry={handleReset} />}
          {!file && <UploadDropzone acceptedFormats={ACCEPTED_FORMATS} onFileSelect={handleFileSelect} />}

          {file && !isProcessing && !pptxBlob && (
            <div className="space-y-6">
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 flex items-center justify-between border-b border-border">
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                </div>
                <div className="p-6 text-center text-muted-foreground">
                  <Presentation className="w-12 h-12 mx-auto mb-3" />
                  <p>Ready to extract text into PowerPoint slides</p>
                  <p className="text-xs mt-1">Each PDF page becomes one slide</p>
                </div>
              </div>
              <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={handleConvert}>
                <Presentation className="w-4 h-4 mr-2" />Convert to PowerPoint
              </Button>
            </div>
          )}

          {isProcessing && (
            <div className="space-y-4">
              <ProcessingStatus message="Extracting content..." />
              <ProgressBar percent={progress} label="Processing" detail="Building slides..." />
            </div>
          )}

          {pptxBlob && !isProcessing && (
            <div className="border border-border rounded-xl p-8 text-center bg-green-500/10 border-green-500">
              <div className="text-4xl mb-4">✓</div>
              <h3 className="text-xl font-semibold mb-2">PowerPoint Ready</h3>
              <p className="text-muted-foreground mb-6">{file?.name} converted to .pptx</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />Download .pptx
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />Convert Another
                </Button>
              </div>
            </div>
          )}

          <div className="mt-12"><FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" /></div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24 border border-border rounded-xl p-6 bg-muted/30">
            <h3 className="font-semibold text-lg mb-4">Document Info</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Text, headings, and lists are extracted into editable slides.
              Complex layouts and images are not preserved in v1.
            </p>
            {file && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">File</span><span className="font-medium truncate ml-2 max-w-[140px]">{file.name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Size</span><span className="font-medium">{formatBytes(file.size)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Format</span><span className="font-medium">.pdf → .pptx</span></div>
                {pptxBlob && <div className="flex justify-between text-sm pt-2 border-t border-border"><span className="text-muted-foreground">.pptx size</span><span className="font-medium">{formatBytes(pptxBlob.size)}</span></div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
