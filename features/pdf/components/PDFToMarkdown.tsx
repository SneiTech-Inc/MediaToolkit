'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { RotateCcw, FileText, Copy, Download, CheckCircle2, Loader2, FileCode } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { Button } from '@/components/ui/button'
import { getPdfPageCount } from '@/features/pdf/utils/pdfMerger'
import { convertPDFToMarkdown } from '@/features/pdf/utils/pdfToMarkdown'
import type { MarkdownResult } from '@/features/pdf/utils/pdfToMarkdown'
import { formatBytes } from '@/utils/formatBytes'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

// ─── Constants ─────────────────────────────────────────────────────────────

const TOOL_FAQS = [
  { question: 'What is Markdown used for?', answer: 'Markdown is a lightweight formatting language used for README files, blogs, documentation, AI training data, and more. It\'s plain text that can be easily converted to HTML, PDF, or other formats.' },
  { question: 'Does the tool preserve formatting?', answer: 'It preserves headings (#, ##, ###), bullet and numbered lists, paragraph breaks, and text content. Complex layouts like multi-column text and embedded images may not convert perfectly.' },
  { question: 'Can I use the Markdown with AI models?', answer: 'Yes! Markdown is an excellent format for providing context to AI models like ChatGPT, Claude, and Gemini. The clean structure helps them understand document content better than raw PDFs.' },
  { question: 'Is my PDF uploaded to a server?', answer: 'No! All extraction happens entirely in your browser using PDF.js. Your PDF never leaves your device.' },
]

// ─── Component ─────────────────────────────────────────────────────────────

export function PDFToMarkdown() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<MarkdownResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Upload ──────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f); setError(null); setResult(null)
    try {
      const count = await getPdfPageCount(f)
      setPageCount(count)

      // Render first page preview
      const buf = await f.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: 0.4 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width; canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport, canvas: null }).promise
      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.7))
    } catch {
      setError('Failed to read PDF.')
    }
  }, [])

  // ── Convert ─────────────────────────────────────────────────────────

  const handleConvert = useCallback(async () => {
    if (!file) return
    setIsProcessing(true); setError(null); setResult(null); setProgress(0)

    // Simulate progress since extraction is fast
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 10, 85))
    }, 150)

    try {
      const res = await convertPDFToMarkdown(file)
      clearInterval(progressInterval)
      setProgress(100)
      setResult(res)
    } catch (err) {
      clearInterval(progressInterval)
      setError(err instanceof Error ? err.message : 'Conversion failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [file])

  // ── Copy & Download ─────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [result])

  const handleDownloadMd = useCallback(() => {
    if (!result || !file) return
    const blob = new Blob([result.markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = file.name.replace(/\.pdf$/i, '') + '.md'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result, file])

  const handleReset = useCallback(() => {
    setFile(null); setPageCount(0); setPreviewUrl(null)
    setResult(null); setError(null); setProgress(0)
  }, [])

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Conversion Failed" message={error} onRetry={handleConvert} />}

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

              {/* Convert button */}
              {!result && (
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90"
                  onClick={handleConvert} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileCode className="w-4 h-4 mr-2" />}
                  {isProcessing ? 'Extracting...' : 'Convert to Markdown'}
                </Button>
              )}

              {/* Progress */}
              {isProcessing && (
                <div className="space-y-4">
                  <ProcessingStatus message="Extracting text and structure..." />
                  <ProgressBar percent={progress} label="Processing" detail="Analyzing headings, lists, and formatting" />
                </div>
              )}

              {/* Result */}
              {result && (
                <div className="space-y-4">
                  {/* Stats + actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{result.words.toLocaleString()} words</span>
                      <span>{result.characters.toLocaleString()} chars</span>
                      <span>{result.headings} heading{result.headings !== 1 ? 's' : ''}</span>
                      <span>{result.lists} list{result.lists !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopy}>
                        {copied ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDownloadMd}>
                        <Download className="w-4 h-4 mr-1" />Download .md
                      </Button>
                    </div>
                  </div>

                  {/* Split view: preview + markdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* PDF preview (first page) */}
                    {previewUrl && (
                      <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                        <div className="px-3 py-2 border-b border-border bg-card">
                          <span className="text-xs font-medium text-muted-foreground">PDF Preview</span>
                        </div>
                        <div className="p-2 flex items-start justify-center">
                          <img src={previewUrl} alt="First page preview"
                            className="max-w-full rounded shadow-sm" />
                        </div>
                      </div>
                    )}

                    {/* Markdown output */}
                    <div className={`rounded-xl border border-border bg-muted/30 overflow-hidden ${!previewUrl ? 'md:col-span-2' : ''}`}>
                      <div className="px-3 py-2 border-b border-border bg-card">
                        <span className="text-xs font-medium text-muted-foreground">Markdown Output</span>
                      </div>
                      <pre className="p-4 text-xs font-mono whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                        {result.markdown}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Convert PDF to Markdown</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload PDF', desc: 'Click the upload area to select the PDF you want to convert.' },
                { step: 2, title: 'Convert', desc: 'Click Convert to Markdown. The tool extracts text, headings, and lists from all pages.' },
                { step: 3, title: 'Copy or download', desc: 'Copy the Markdown to your clipboard or download as a .md file for use in docs, blogs, or AI prompts.' },
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
              <h3 className="font-semibold text-lg mb-4">Conversion Info</h3>
              {file ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="font-medium truncate ml-2 max-w-[140px]">{file.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pages</span><span className="font-medium">{pageCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span className="font-medium">{formatBytes(file.size)}</span></div>
                  {result && (
                    <>
                      <div className="flex justify-between pt-2 border-t border-border"><span className="text-muted-foreground">Words</span><span className="font-medium">{result.words.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Characters</span><span className="font-medium">{result.characters.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Headings</span><span className="font-medium">{result.headings}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Lists</span><span className="font-medium">{result.lists}</span></div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Upload a PDF to extract clean Markdown. Detects headings, bullet/numbered lists, and preserves paragraph structure.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
