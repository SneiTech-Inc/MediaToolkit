'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback } from 'react'
import { Download, RotateCcw, FileSpreadsheet } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/utils/formatBytes'
import { convertPDFToExcel } from '@/features/document/utils/pdfToExcel'
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
    title: 'Extract tables',
    desc: 'We detect table structures by analyzing text positions — rows, columns, and cell data.',
  },
  {
    step: 3,
    title: 'Download your Excel file',
    desc: 'Save the .xlsx file to your device. Multi-page tables are merged; different tables get separate sheets.',
  },
]

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What types of PDFs work best?',
    answer:
      'PDFs with clearly structured tables (consistent rows and columns) work best. Scanned/image-only PDFs will not work — they contain no extractable text.',
  },
  {
    question: 'How are multi-page tables handled?',
    answer:
      'If all pages share the same column structure, data is merged into a single "Data" sheet. If pages have different structures, each page gets its own sheet ("Page 1", "Page 2", etc.).',
  },
  {
    question: 'Is my PDF uploaded to a server?',
    answer:
      'No! All processing happens entirely in your browser. Your PDF never leaves your device — 100% private and secure.',
  },
  {
    question: 'What if my PDF has no tables?',
    answer:
      'If no clear table structure is detected, all extracted text is placed in a single-column sheet named "Text". You can still access the text content.',
  },
  {
    question: 'Will numbers be detected correctly?',
    answer:
      'Yes — numeric values (including those with commas like "1,204.50") are automatically converted to Excel number format for calculations.',
  },
]

/**
 * PDF to Excel conversion tool.
 *
 * Flow: Upload PDF → Extract tables → Download .xlsx
 * Uses pdfjs-dist for text position analysis and xlsx for Excel generation.
 * All processing is 100% client-side — no data leaves the browser.
 */
export function PDFToExcel() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [xlsxBlob, setXlsxBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    setXlsxBlob(null)
    setError(null)
  }, [])

  const handleConvert = useCallback(async () => {
    if (!file) return
    setIsProcessing(true)
    setError(null)
    setProgress(0)

    try {
      const blob = await convertPDFToExcel(file, (pct) => setProgress(pct))
      setXlsxBlob(blob)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'PDF conversion failed.',
      )
    } finally {
      setIsProcessing(false)
      setProgress(0)
    }
  }, [file])

  const handleDownload = useCallback(() => {
    if (!xlsxBlob) return
    const url = URL.createObjectURL(xlsxBlob)
    const baseName = file?.name.replace(/\.pdf$/i, '') || 'document'
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(`${baseName}.xlsx`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [xlsxBlob, file])

  const handleReset = useCallback(() => {
    setFile(null)
    setXlsxBlob(null)
    setError(null)
    setProgress(0)
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

          {file && !isProcessing && !xlsxBlob && (
            <div className="space-y-6">
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 flex items-center justify-between border-b border-border">
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </span>
                </div>
                <div className="p-6 text-center text-muted-foreground">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-3" />
                  <p>PDF ready for table extraction</p>
                  <p className="text-xs mt-1">
                    Click &ldquo;Convert to Excel&rdquo; to extract tables
                  </p>
                </div>
              </div>

              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                onClick={handleConvert}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Convert to Excel
              </Button>
            </div>
          )}

          {isProcessing && (
            <div className="space-y-4">
              <ProcessingStatus message="Extracting tables..." />
              <ProgressBar
                percent={progress}
                label="Processing"
                detail="Analyzing table structure..."
              />
            </div>
          )}

          {xlsxBlob && !isProcessing && (
            <div className="space-y-6">
              <div className="border border-border rounded-xl p-8 text-center bg-green-500/10 border-green-500">
                <div className="text-4xl mb-4">✓</div>
                <h3 className="text-xl font-semibold mb-2">
                  Excel File Ready
                </h3>
                <p className="text-muted-foreground mb-2">
                  {file?.name} has been converted to .xlsx
                </p>
                <p className="text-xs text-muted-foreground mb-6">
                  Tables extracted with best-effort position analysis
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download .xlsx
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
              How to Convert PDF to Excel
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
                Tables are extracted using text position analysis.
                Multi-page tables are merged; different structures get separate sheets.
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
                    <span className="font-medium">.pdf → .xlsx</span>
                  </div>
                  {xlsxBlob && (
                    <div className="flex justify-between text-sm pt-2 border-t border-border">
                      <span className="text-muted-foreground">.xlsx size</span>
                      <span className="font-medium">
                        {formatBytes(xlsxBlob.size)}
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
