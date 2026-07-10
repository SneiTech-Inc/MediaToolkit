'use client'

import { useState, useCallback } from 'react'
import { Download, RotateCcw, FileText, ScanText, Loader2, ChevronDown } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { Button } from '@/components/ui/button'
import { getPdfPageCount } from '@/features/pdf/utils/pdfMerger'
import { ocrPDF, OCR_LANGUAGES } from '@/features/pdf/utils/ocrProcessor'
import type { OCRLanguage, OCRProgress, OCRResult } from '@/features/pdf/utils/ocrProcessor'
import { formatBytes } from '@/utils/formatBytes'

// ─── Constants ─────────────────────────────────────────────────────────────

const TOOL_FAQS = [
  { question: 'What languages are supported?', answer: 'English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Chinese (Simplified), and Chinese (Traditional). Select your language from the dropdown before processing.' },
  { question: 'How accurate is the OCR?', answer: 'Our OCR engine provides good accuracy for clear, printed text at reasonable resolutions. Handwriting, stylized fonts, and low-resolution scans may have reduced accuracy.' },
  { question: 'Can I OCR PDFs with handwriting?', answer: 'Our OCR technology is optimized for printed text. Handwriting recognition is limited and may produce inaccurate results.' },
  { question: 'Is my PDF uploaded to a server?', answer: 'No! All OCR processing happens entirely in your browser. Your PDF never leaves your device.' },
]

// ─── Component ─────────────────────────────────────────────────────────────

export function OCRPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [language, setLanguage] = useState<OCRLanguage>('eng')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<OCRProgress | null>(null)
  const [result, setResult] = useState<OCRResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showLangDropdown, setShowLangDropdown] = useState(false)

  // ── Upload ──────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f); setError(null); setResult(null)
    try {
      const count = await getPdfPageCount(f)
      setPageCount(count)
    } catch {
      setError('Failed to read PDF.')
    }
  }, [])

  // ── OCR ─────────────────────────────────────────────────────────────

  const handleOCR = useCallback(async () => {
    if (!file) return
    setIsProcessing(true); setError(null); setResult(null)

    try {
      const res = await ocrPDF(file, {
        language,
        onProgress: (p) => setProgress({ ...p }),
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR processing failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [file, language])

  const handleDownload = useCallback(() => {
    if (!result || !file) return
    const blob = new Blob([result.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = file.name.replace('.pdf', '-ocr.pdf')
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result, file])

  const handleReset = useCallback(() => {
    setFile(null); setPageCount(0); setLanguage('eng')
    setResult(null); setError(null); setProgress(null)
  }, [])

  // ── Render ───────────────────────────────────────────────────────────

  const selectedLang = OCR_LANGUAGES.find((l) => l.value === language)
  const totalWords = result?.pages.reduce((s, p) => s + p.wordCount, 0) ?? 0

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="OCR Failed" message={error} onRetry={handleOCR} />}

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

              {/* Language selector */}
              <div className="relative">
                <label className="text-sm font-medium block mb-2">Language</label>
                <button
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <span className="text-sm">{selectedLang?.label ?? 'English'}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>

                {showLangDropdown && (
                  <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
                    {OCR_LANGUAGES.map((lang) => (
                      <button
                        key={lang.value}
                        onClick={() => { setLanguage(lang.value); setShowLangDropdown(false) }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors ${
                          language === lang.value ? 'bg-primary/5 text-primary font-medium' : ''
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* OCR Button */}
              {!result ? (
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90"
                  onClick={handleOCR} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ScanText className="w-4 h-4 mr-2" />}
                  {isProcessing ? 'Processing OCR...' : 'OCR PDF'}
                </Button>
              ) : (
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Searchable PDF ({formatBytes(result.data.length)})
                </Button>
              )}

              {/* Progress */}
              {isProcessing && progress && (
                <div className="space-y-4">
                  <ProcessingStatus message={progress.detail || 'Running OCR...'} />
                  <ProgressBar percent={progress.percent} label="OCR Progress"
                    detail={`Page ${progress.page} of ${progress.totalPages}`} />
                </div>
              )}

              {/* Text preview */}
              {result && result.pages.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Extracted Text</h3>
                    <span className="text-xs text-muted-foreground">
                      {result.pages.length} page{result.pages.length !== 1 ? 's' : ''} · {totalWords} words
                    </span>
                  </div>

                  {result.pages.map((p) => (
                    <details key={p.pageNumber} className="rounded-xl border border-border bg-card overflow-hidden">
                      <summary className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <span className="text-sm font-medium">Page {p.pageNumber}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {p.wordCount} words · {p.text.length} chars
                        </span>
                      </summary>
                      <div className="px-4 py-3 border-t border-border bg-muted/20">
                        <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground max-h-48 overflow-y-auto">
                          {p.text || '(no text detected)'}
                        </pre>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to OCR a PDF</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload scanned PDF', desc: 'Click the upload area to select a scanned or image-based PDF.' },
                { step: 2, title: 'Choose language', desc: 'Select the language of the text in your document for best accuracy.' },
                { step: 3, title: 'Process & download', desc: 'Click OCR PDF to extract text. Download your searchable PDF with invisible text layer.' },
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
              <h3 className="font-semibold text-lg mb-4">OCR Info</h3>
              {file ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="font-medium truncate ml-2 max-w-[140px]">{file.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pages</span><span className="font-medium">{pageCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span className="font-medium">{formatBytes(file.size)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Language</span><span className="font-medium">{selectedLang?.label}</span></div>
                  {result && (
                    <>
                      <div className="flex justify-between pt-2 border-t border-border"><span className="text-muted-foreground">Pages processed</span><span className="font-medium">{result.pages.length}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Words extracted</span><span className="font-medium text-green-600">{totalWords}</span></div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Upload a scanned PDF to make it searchable. Our OCR engine will extract text and embed it as an invisible searchable layer.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
