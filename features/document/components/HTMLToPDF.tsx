'use client'

import { useState, useCallback, useRef } from 'react'
import { Download, RotateCcw, Globe, FileCode, Upload } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { convertHTMLToPDF, type HTMLToPDFOptions } from '@/features/document/utils/htmlToPdf'
import type { FAQItem } from '@/types/common'

const CORS_PROXY = 'https://api.allorigins.win/raw?url='

const DEFAULTS: HTMLToPDFOptions = { pageSize: 'A4', orientation: 'portrait', viewportWidth: 1024 }

const TOOL_FAQS: FAQItem[] = [
  { question: 'What HTML content can be converted?', answer: 'Any valid HTML, including CSS styles. JavaScript is not executed for security reasons — interactive elements appear as static content.' },
  { question: 'Do you support JavaScript-rendered pages?', answer: 'No — for security and privacy, JavaScript is blocked in the sandboxed iframe used for rendering. Pages that rely on JS for content will show their non-JS fallback.' },
  { question: 'Is my HTML content uploaded to a server?', answer: 'No! For file uploads and pasted code, processing is 100% local. For URL fetching, the content is fetched directly by your browser; no server receives your data.' },
]

export function HTMLToPDF() {
  const [html, setHtml] = useState('')
  const [options, setOptions] = useState<HTMLToPDFOptions>(DEFAULTS)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'url' | 'upload' | 'paste'>('url')
  const [url, setUrl] = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const setOpt = <K extends keyof HTMLToPDFOptions>(k: K, v: HTMLToPDFOptions[K]) => setOptions((p) => ({ ...p, [k]: v }))

  const loadPreview = useCallback((h: string) => {
    setHtml(h); setPdfBlob(null); setError(null)
    if (iframeRef.current) iframeRef.current.srcdoc = h
  }, [])

  const handleURLFetch = useCallback(async () => {
    if (!url) return; setError(null); setIsProcessing(true)
    try {
      let resp = await fetch(url).catch(() => null)
      if (!resp?.ok) resp = await fetch(CORS_PROXY + encodeURIComponent(url))
      if (!resp?.ok) throw new Error('Could not fetch URL. The site may block cross-origin access.')
      const h = await resp.text()
      loadPreview(h)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load URL. Try pasting HTML code instead.') }
    finally { setIsProcessing(false) }
  }, [url, loadPreview])

  const handleFileSelect = useCallback(async (file: File) => { setError(null); loadPreview(await file.text()) }, [loadPreview])

  const handleConvert = useCallback(async () => {
    if (!html.trim()) { setError('No HTML content to convert.'); return }
    setIsProcessing(true); setError(null)
    try {
      const bytes = await convertHTMLToPDF(html, options)
      setPdfBlob(new Blob([bytes], { type: 'application/pdf' }))
    } catch (err) { setError(err instanceof Error ? err.message : 'Conversion failed.') }
    finally { setIsProcessing(false) }
  }, [html, options])

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return; const u = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a'); a.href = u; a.download = 'page.pdf'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(u), 1000)
  }, [pdfBlob])

  const handleReset = () => { setHtml(''); setPdfBlob(null); setError(null); setUrl('') }

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {error && <ErrorCard title="Error" message={error} onRetry={handleReset} />}

          {/* Tabs */}
          {!html && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex border-b border-border">
                {(['url', 'upload', 'paste'] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-3 text-sm font-medium ${tab === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/30'}`}>
                    {t === 'url' ? <Globe className="w-4 h-4 inline mr-1" /> : t === 'upload' ? <Upload className="w-4 h-4 inline mr-1" /> : <FileCode className="w-4 h-4 inline mr-1" />}
                    {t === 'url' ? 'URL' : t === 'upload' ? 'Upload' : 'Paste'}
                  </button>
                ))}
              </div>
              <div className="p-6">
                {tab === 'url' && (
                  <div className="flex gap-3">
                    <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="flex-1 p-3 rounded-xl border border-border bg-card text-sm" onKeyDown={(e) => e.key === 'Enter' && handleURLFetch()} />
                    <Button onClick={handleURLFetch} disabled={isProcessing}>{isProcessing ? 'Loading...' : 'Load URL'}</Button>
                  </div>
                )}
                {tab === 'upload' && <UploadDropzone acceptedFormats={['html', 'htm']} onFileSelect={handleFileSelect} />}
                {tab === 'paste' && (
                  <div className="space-y-3">
                    <textarea placeholder="Paste HTML code here..." className="w-full h-40 p-4 rounded-xl border border-border bg-card text-sm font-mono resize-y" onChange={(e) => setHtml(e.target.value)} />
                    <Button onClick={() => loadPreview(html)} disabled={!html}>Load Preview</Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview iframe */}
          {html && !isProcessing && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-muted/30 px-4 py-2 flex items-center justify-between border-b border-border">
                <span className="text-sm font-medium">Preview</span>
                <Button variant="outline" size="sm" onClick={handleReset}>Change</Button>
              </div>
              <iframe ref={iframeRef} srcDoc={html} sandbox="allow-scripts allow-same-origin" className="w-full bg-white" style={{ height: 500, border: 'none' }} />
            </div>
          )}

          {isProcessing && <ProcessingStatus message="Rendering..." />}

          {pdfBlob && !isProcessing && (
            <div className="border border-border rounded-xl p-8 text-center bg-green-500/10 border-green-500">
              <div className="text-4xl mb-4">✓</div>
              <h3 className="text-xl font-semibold mb-4">PDF Ready</h3>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={handleDownload}><Download className="w-4 h-4 mr-2" />Download PDF</Button>
                <Button size="lg" variant="outline" onClick={handleReset}><RotateCcw className="w-4 h-4 mr-2" />New HTML</Button>
              </div>
            </div>
          )}

          {html && !isProcessing && !pdfBlob && (
            <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={handleConvert}><FileCode className="w-4 h-4 mr-2" />Convert to PDF</Button>
          )}

          <div className="mt-12"><FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" /></div>
        </div>

        {/* Options Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 border border-border rounded-xl p-6 bg-muted/30 space-y-5">
            <h3 className="font-semibold text-lg">Options</h3>
            <label className="block"><span className="text-xs font-medium text-muted-foreground">Page Size</span>
              <select className="w-full mt-1 p-2 rounded-lg border border-border bg-card text-sm" value={options.pageSize} onChange={(e) => setOpt('pageSize', e.target.value as HTMLToPDFOptions['pageSize'])}>
                <option value="A4">A4</option><option value="Letter">Letter</option><option value="Legal">Legal</option>
              </select></label>
            <label className="block"><span className="text-xs font-medium text-muted-foreground">Orientation</span>
              <select className="w-full mt-1 p-2 rounded-lg border border-border bg-card text-sm" value={options.orientation} onChange={(e) => setOpt('orientation', e.target.value as HTMLToPDFOptions['orientation'])}>
                <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
              </select></label>
            <label className="block"><span className="text-xs font-medium text-muted-foreground">Viewport Width: {options.viewportWidth}px</span>
              <input type="range" min="375" max="1920" step="1" value={options.viewportWidth} onChange={(e) => setOpt('viewportWidth', Number(e.target.value))} className="w-full mt-1" /></label>
          </div>
        </div>
      </div>
    </section>
  )
}
