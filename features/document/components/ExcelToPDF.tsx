'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, RotateCcw, FileSpreadsheet } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/utils/formatBytes'
import { convertExcelToPDF } from '@/features/document/utils/excelToPdf'
import type { FAQItem } from '@/types/common'

const ACCEPTED_FORMATS = ['xlsx', 'xls']

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Upload your spreadsheet',
    desc: 'Click the upload area or drag and drop a .xlsx or .xls file. All processing happens in your browser.',
  },
  {
    step: 2,
    title: 'Select sheets',
    desc: 'If your workbook has multiple sheets, select which ones to include. Each sheet becomes a PDF page.',
  },
  {
    step: 3,
    title: 'Download your PDF',
    desc: 'Click Convert to PDF and download. Large sheets (>50 rows) are automatically split across multiple pages.',
  },
]

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What Excel formats are supported?',
    answer:
      'We support .xlsx (Excel 2007+) and .xls (legacy) files. Cell data, bold/italic formatting, and table structures are preserved. Complex charts, pivot tables, and formulas are rendered as static data.',
  },
  {
    question: 'What happens if my sheet is very large?',
    answer:
      'Sheets with more than 50 rows are automatically paginated across multiple PDF pages. Each page includes a footer with the sheet name and page number.',
  },
  {
    question: 'Is my spreadsheet uploaded to a server?',
    answer:
      'No! All processing happens entirely in your browser. Your spreadsheet never leaves your device — 100% private and secure.',
  },
  {
    question: 'What formatting is preserved?',
    answer:
      'Header rows are rendered in bold with a shaded background. Numbers are right-aligned, text is left-aligned. Cell borders provide table structure. Charts, images, and conditional formatting are not rendered in v1.',
  },
  {
    question: 'How are multiple sheets handled?',
    answer:
      'Each sheet in your workbook becomes a separate section in the PDF. Sheet names appear as titles at the top of each page.',
  },
]

/**
 * Excel to PDF conversion tool.
 *
 * Flow: Upload Excel → Preview first sheet → Convert to PDF → Download
 * Uses xlsx for parsing and pdf-lib for PDF generation.
 * All processing is 100% client-side — no data leaves the browser.
 */
export function ExcelToPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set())
  const previewRef = useRef<HTMLDivElement>(null)

  // Parse sheet names on file select
  useEffect(() => {
    if (!file) {
      setSheets([])
      setSelectedSheets(new Set())
      return
    }

    const parseSheets = async () => {
      try {
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        setSheets(wb.SheetNames)
        setSelectedSheets(new Set(wb.SheetNames))
      } catch {
        setSheets([])
      }
    }
    parseSheets()
  }, [file])

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    setPdfBlob(null)
    setError(null)
  }, [])

  const toggleSheet = useCallback((name: string) => {
    setSelectedSheets((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const handleConvert = useCallback(async () => {
    if (!file) return
    setIsProcessing(true)
    setError(null)
    setProgress(0)

    try {
      const pdfBytes = await convertExcelToPDF(file, (pct) => setProgress(pct))
      setPdfBlob(new Blob([pdfBytes], { type: 'application/pdf' }))
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
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const baseName = file?.name.replace(/\.(xlsx?|xls)$/i, '') || 'spreadsheet'
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
    setSheets([])
    setSelectedSheets(new Set())
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

                {/* Sheet selector */}
                {sheets.length > 0 && (
                  <div className="p-4 border-b border-border">
                    <p className="text-sm font-medium mb-2">
                      Sheets ({sheets.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sheets.map((name) => (
                        <button
                          key={name}
                          onClick={() => toggleSheet(name)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            selectedSheets.has(name)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-6 text-center text-muted-foreground">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-3" />
                  <p>
                    {sheets.length > 0
                      ? `${selectedSheets.size} of ${sheets.length} sheet${sheets.length > 1 ? 's' : ''} selected`
                      : 'Spreadsheet ready for conversion'}
                  </p>
                  <p className="text-xs mt-1">
                    Each sheet becomes a PDF page
                  </p>
                </div>
              </div>

              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                onClick={handleConvert}
                disabled={selectedSheets.size === 0}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Convert to PDF
              </Button>
            </div>
          )}

          {isProcessing && (
            <div className="space-y-4">
              <ProcessingStatus message="Creating PDF..." />
              <ProgressBar
                percent={progress}
                label="Converting"
                detail="Rendering spreadsheet pages..."
              />
            </div>
          )}

          {pdfBlob && !isProcessing && (
            <div className="space-y-6">
              <div className="border border-border rounded-xl p-8 text-center bg-green-500/10 border-green-500">
                <div className="text-4xl mb-4">✓</div>
                <h3 className="text-xl font-semibold mb-2">PDF Ready</h3>
                <p className="text-muted-foreground mb-2">
                  {file?.name} has been converted to PDF
                </p>
                <p className="text-xs text-muted-foreground mb-6">
                  {sheets.length > 0
                    ? `${sheets.length} sheet${sheets.length > 1 ? 's' : ''} rendered`
                    : 'Spreadsheet rendered'}
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
              How to Convert Excel to PDF
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
              <h3 className="font-semibold text-lg mb-4">Spreadsheet Info</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Each sheet becomes a PDF page. Large sheets (50+ rows) are
                automatically split across multiple pages. Headers are bold
                with shading, numbers right-aligned.
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
                    <span className="text-muted-foreground">Sheets</span>
                    <span className="font-medium">
                      {sheets.length || '—'}
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
