'use client'

import { useState, useCallback } from 'react'
import { Download, RotateCcw, FileText, Scissors, Copy, AlertCircle } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { getPdfPageCount } from '@/features/pdf/utils/pdfMerger'
import { parsePageInput, parseRangeInput, extractPages, splitByRanges } from '@/features/pdf/utils/pdfSplitter'
import { formatBytes } from '@/utils/formatBytes'

const TOOL_FAQS = [
  { question: 'How do I split a PDF?', answer: 'Upload your PDF, choose Extract Pages (to pull out specific pages into one new PDF) or Split by Range (to create multiple PDFs from different page ranges). Enter your page numbers and click the action button.' },
  { question: 'Can I extract specific pages?', answer: 'Yes! In Extract Pages mode, type page numbers like "1, 3, 5-7" to pull those pages into a new PDF. Pages are kept in the order you specify.' },
  { question: 'Can I split by page ranges?', answer: 'Yes! In Split by Range mode, enter ranges like "1-3, 4-6, 7-10" to create separate PDFs — one per range. Each range becomes its own downloadable file.' },
  { question: 'Is my PDF uploaded to a server?', answer: 'No! All splitting happens entirely in your browser using advanced PDF processing technology. Your PDF never leaves your device.' },
]

type Mode = 'extract' | 'split'

interface SplitResult {
  name: string
  data: Uint8Array
  pages: string
  blob: Blob
}

export function SplitPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [mode, setMode] = useState<Mode>('extract')
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null) // single extract
  const [splitResults, setSplitResults] = useState<SplitResult[]>([]) // range split

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f); setError(null); setResultBlob(null); setSplitResults([]); setInput('')
    try {
      const count = await getPdfPageCount(f)
      setPageCount(count)
    } catch {
      setError('Failed to read PDF. The file may be corrupted or encrypted.')
    }
  }, [])

  const handleExtract = useCallback(async () => {
    if (!file) return
    setIsProcessing(true); setError(null)
    try {
      const indices = parsePageInput(input, pageCount)
      const bytes = await extractPages(file, indices)
      setResultBlob(new Blob([bytes], { type: 'application/pdf' }))
      setSplitResults([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed.')
    } finally { setIsProcessing(false) }
  }, [file, input, pageCount])

  const handleSplit = useCallback(async () => {
    if (!file) return
    setIsProcessing(true); setError(null)
    try {
      const ranges = parseRangeInput(input, pageCount)
      const results = await splitByRanges(file, ranges)
      setSplitResults(results.map((r) => ({ ...r, blob: new Blob([r.data], { type: 'application/pdf' }) })))
      setResultBlob(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Split failed.')
    } finally { setIsProcessing(false) }
  }, [file, input, pageCount])

  const downloadBlob = useCallback((blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [])

  const handleReset = useCallback(() => {
    setFile(null); setPageCount(0); setInput(''); setError(null)
    setResultBlob(null); setSplitResults([]); setMode('extract')
  }, [])

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Split Failed" message={error} onRetry={mode === 'extract' ? handleExtract : handleSplit} />}

          {!file ? (
            <UploadDropzone acceptedFormats={['pdf']} onFileSelect={handleFileSelect} />
          ) : (
            <div className="space-y-6">
              {/* File info */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                <FileText className="w-10 h-10 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{pageCount} pages · {formatBytes(file.size)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}><RotateCcw className="w-4 h-4 mr-1" />New PDF</Button>
              </div>

              {/* Mode tabs */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                {([
                  { value: 'extract' as Mode, label: 'Extract Pages', icon: Copy },
                  { value: 'split' as Mode, label: 'Split by Range', icon: Scissors },
                ]).map((m) => (
                  <button key={m.value} onClick={() => { setMode(m.value); setError(null); setResultBlob(null); setSplitResults([]) }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                      mode === m.value ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'
                    }`}>
                    <m.icon className="w-4 h-4" />{m.label}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div>
                <label className="text-sm font-medium">
                  {mode === 'extract' ? 'Pages to extract' : 'Page ranges'}
                </label>
                <input type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={mode === 'extract' ? 'e.g. 1, 3, 5-7' : 'e.g. 1-3, 4-6, 7-10'}
                  className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm font-mono"
                  disabled={isProcessing} />
                <p className="text-xs text-muted-foreground mt-1">
                  {mode === 'extract' ? 'Use commas between pages. Ranges like 5-7 are supported.' : 'One range per output PDF. Separate ranges with commas.'}
                  {' '}Valid pages: 1–{pageCount}
                </p>
              </div>

              {/* Action */}
              <Button size="lg" className="w-full bg-primary hover:bg-primary/90" onClick={mode === 'extract' ? handleExtract : handleSplit}
                disabled={!input.trim() || isProcessing}>
                {isProcessing ? 'Processing...' : mode === 'extract' ? 'Extract Pages' : 'Split into PDFs'}
              </Button>

              {isProcessing && <ProcessingStatus message={mode === 'extract' ? 'Extracting pages...' : 'Splitting PDF...'} />}

              {/* Results */}
              {resultBlob && (
                <div className="p-4 rounded-xl border border-green-500/50 bg-green-500/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Extracted PDF</p>
                      <p className="text-sm text-muted-foreground">{formatBytes(resultBlob.size)}</p>
                    </div>
                    <Button size="sm" className="bg-primary" onClick={() => downloadBlob(resultBlob, `${file.name.replace('.pdf','')}-extracted.pdf`)}>
                      <Download className="w-4 h-4 mr-1" />Download
                    </Button>
                  </div>
                </div>
              )}

              {splitResults.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">{splitResults.length} PDF{splitResults.length !== 1 ? 's' : ''} created</h3>
                  {splitResults.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                      <div>
                        <p className="font-medium text-sm">{r.pages}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(r.blob.size)}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => downloadBlob(r.blob, r.name)}>
                        <Download className="w-4 h-4 mr-1" />Download
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Split a PDF</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload PDF', desc: 'Click the upload area to select the PDF you want to split.' },
                { step: 2, title: 'Choose mode', desc: 'Extract Pages pulls specific pages into one PDF. Split by Range creates multiple PDFs.' },
                { step: 3, title: 'Enter pages & download', desc: 'Type your page numbers, click the action button, and download your result(s).' },
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
              <h3 className="font-semibold text-lg mb-4">Split Info</h3>
              {file ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="font-medium truncate ml-2">{file.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pages</span><span className="font-medium">{pageCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span className="font-medium">{formatBytes(file.size)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Mode</span><span className="font-medium">{mode === 'extract' ? 'Extract Pages' : 'Split by Range'}</span></div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Upload a PDF to get started. Choose Extract Pages to pull specific pages, or Split by Range to create multiple PDFs.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
