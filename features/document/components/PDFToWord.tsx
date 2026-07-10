'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback } from 'react'
import { Download, RotateCcw, FileText } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/utils/formatBytes'
import { convertPDFToWord } from '@/features/document/utils/pdfToWord'
import type { FAQItem } from '@/types/common'

const ACCEPTED_FORMATS = ['pdf']

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Upload your PDF',
    desc: 'Click the upload area or drag and drop a PDF file. All processing happens in your browser.',
  },
  {
    step: 2,
    title: 'Extract content',
    desc: 'We extract text, headings, bold/italic formatting, and list structure from your PDF.',
  },
  {
    step: 3,
    title: 'Download your .docx file',
    desc: 'Save the editable Word document to your device. Open it in Word or any compatible editor.',
  },
]

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What types of PDFs work best?',
    answer:
      'PDFs created from Word documents or other text editors work best — these contain extractable text. Image-only PDFs (scanned documents) will not work with this tool.',
  },
  {
    question: 'What formatting is preserved?',
    answer:
      'Headings, bold, italic, bullet lists, and numbered lists are preserved as best-effort text extraction. Complex layouts like multi-column text, tables, and embedded images are not preserved in v1.',
  },
  {
    question: 'Is my PDF uploaded to a server?',
    answer:
      'No! All processing happens entirely in your browser using advanced document processing technology. Your PDF never leaves your device — 100% private and secure.',
  },
  {
    question: 'Can I convert image-based PDFs?',
    answer:
      'No — this tool extracts text from the PDF, so scanned/image-only PDFs won\'t work. You\'ll see an error message if no extractable text is found.',
  },
  {
    question: 'Will the .docx look exactly like my PDF?',
    answer:
      'This is best-effort text extraction — not pixel-perfect conversion. Fonts, exact positioning, and complex formatting will differ. The result is a clean, editable Word document with the extracted content.',
  },
]

/**
 * PDF to Word conversion tool.
 *
 * Flow: Upload PDF → Extract text + formatting → Download .docx
 * Uses pdfjs-dist for text extraction and docx for .docx generation.
 * All processing is 100% client-side — no data leaves the browser.
 */
export function PDFToWord() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    setDocxBlob(null)
    setError(null)
  }, [])

  const handleConvert = useCallback(async () => {
    if (!file) return
    setIsProcessing(true)
    setError(null)
    setProgress(0)

    try {
      const blob = await convertPDFToWord(file, (pct) => setProgress(pct))
      setDocxBlob(blob)
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
    if (!docxBlob) return
    const url = URL.createObjectURL(docxBlob)
    const baseName = file?.name.replace(/\.pdf$/i, '') || 'document'
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(`${baseName}.docx`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [docxBlob, file])

  const handleReset = useCallback(() => {
    setFile(null)
    setDocxBlob(null)
    setError(null)
    setProgress(0)
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────

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

          {file && !isProcessing && !docxBlob && (
            <div className="space-y-6">
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 flex items-center justify-between border-b border-border">
                  <span className="text-sm font-medium">
                    {file.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </span>
                </div>
                <div className="p-6 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3" />
                  <p>PDF ready for conversion</p>
                  <p className="text-xs mt-1">
                    Click &ldquo;Convert to Word&rdquo; to extract text and formatting
                  </p>
                </div>
              </div>

              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                onClick={handleConvert}
              >
                <FileText className="w-4 h-4 mr-2" />
                Convert to Word
              </Button>
            </div>
          )}

          {isProcessing && (
            <div className="space-y-4">
              <ProcessingStatus message="Extracting text..." />
              <ProgressBar
                percent={progress}
                label="Processing"
                detail="Analyzing PDF content..."
              />
            </div>
          )}

          {docxBlob && !isProcessing && (
            <div className="space-y-6">
              <div className="border border-border rounded-xl p-8 text-center bg-green-500/10 border-green-500">
                <div className="text-4xl mb-4">✓</div>
                <h3 className="text-xl font-semibold mb-2">
                  Word Document Ready
                </h3>
                <p className="text-muted-foreground mb-2">
                  {file?.name} has been converted to .docx
                </p>
                <p className="text-xs text-muted-foreground mb-6">
                  Best-effort text extraction — some formatting may differ from the original PDF
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download .docx
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
              How to Convert PDF to Word
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
              <h3 className="font-semibold text-lg mb-4">Document Info</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Text and basic formatting are extracted from your PDF.
                Complex layouts, tables, and images are not preserved in v1.
                All processing happens locally in your browser.
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
                    <span className="font-medium">.pdf → .docx</span>
                  </div>
                  {docxBlob && (
                    <div className="flex justify-between text-sm pt-2 border-t border-border">
                      <span className="text-muted-foreground">.docx size</span>
                      <span className="font-medium">
                        {formatBytes(docxBlob.size)}
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
