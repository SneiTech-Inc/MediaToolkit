'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback, useMemo } from 'react'
import { Download, RotateCcw, FileText } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { convertMarkdownToPDF, type MarkdownToPDFOptions } from '@/features/document/utils/markdownToPdf'
import type { FAQItem } from '@/types/common'

const DEFAULTS: MarkdownToPDFOptions = { pageSize: 'A4', orientation: 'portrait', theme: 'light', fontSize: 'medium' }

const TOOL_FAQS: FAQItem[] = [
  { question: 'What Markdown syntax is supported?', answer: 'GitHub-flavored Markdown: headings, bold, italic, links, images, tables, task lists, code blocks, blockquotes, and inline HTML.' },
  { question: 'Can I customize the PDF appearance?', answer: 'Yes! Choose page size, orientation, theme (Light/Dark/Sepia), and font size. Code blocks and tables are styled automatically.' },
  { question: 'Is my Markdown uploaded to a server?', answer: 'No! All processing happens in your browser. Your content never leaves your device.' },
]

export function MarkdownToPDF() {
  const [md, setMd] = useState('')
  const [options, setOptions] = useState<MarkdownToPDFOptions>(DEFAULTS)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setOpt = <K extends keyof MarkdownToPDFOptions>(k: K, v: MarkdownToPDFOptions[K]) => setOptions((p) => ({ ...p, [k]: v }))

  const renderedHTML = useMemo(() => {
    if (!md.trim()) return ''
    try {
      // Quick parse for preview — marked is loaded dynamically for actual conversion
      return md
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^\- (.+)$/gm, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(?!<[hli])(.+)$/gm, '<p>$1</p>')
    } catch { return md }
  }, [md])

  const stats = useMemo(() => ({
    chars: md.length,
    words: md.trim() ? md.trim().split(/\s+/).length : 0,
    headings: (md.match(/^#{1,6}\s/gm) || []).length,
  }), [md])

  const handleFileSelect = useCallback(async (f: File) => { setMd(await f.text()); setError(null); setPdfBlob(null) }, [])

  const handleConvert = useCallback(async () => {
    if (!md.trim()) { setError('No Markdown content.'); return }
    setIsProcessing(true); setError(null)
    try {
      const bytes = await convertMarkdownToPDF(md, options)
      setPdfBlob(new Blob([bytes], { type: 'application/pdf' }))
    } catch (err) { setError(err instanceof Error ? err.message : 'Conversion failed.') }
    finally { setIsProcessing(false) }
  }, [md, options])

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return; const u = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a'); a.href = u; a.download = getSaveVexFileName('document.pdf')
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(u), 1000)
  }, [pdfBlob])

  const handleReset = () => { setMd(''); setPdfBlob(null); setError(null) }

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {error && <ErrorCard title="Error" message={error} onRetry={handleReset} />}

          {!md && (
            <div className="space-y-4">
              <UploadDropzone acceptedFormats={['md', 'markdown']} onFileSelect={handleFileSelect} />
              <div className="text-center text-sm text-muted-foreground">— or —</div>
              <textarea placeholder="Paste your Markdown here..." className="w-full h-40 p-4 rounded-xl border border-border bg-card text-sm font-mono resize-y" onChange={(e) => setMd(e.target.value)} />
            </div>
          )}

          {md && !isProcessing && !pdfBlob && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Editor</span>
                <Button variant="outline" size="sm" onClick={handleReset}>Clear</Button>
              </div>
              <textarea value={md} onChange={(e) => setMd(e.target.value)} className="w-full h-48 p-4 rounded-xl border border-border bg-card text-sm font-mono resize-y" />
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="bg-muted/30 rounded-lg p-3"><div className="font-bold text-lg">{stats.words}</div><div className="text-xs text-muted-foreground">Words</div></div>
                <div className="bg-muted/30 rounded-lg p-3"><div className="font-bold text-lg">{stats.chars}</div><div className="text-xs text-muted-foreground">Chars</div></div>
                <div className="bg-muted/30 rounded-lg p-3"><div className="font-bold text-lg">{stats.headings}</div><div className="text-xs text-muted-foreground">Headings</div></div>
              </div>
              {renderedHTML && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 border-b border-border text-sm font-medium">Preview</div>
                  <div className={`p-6 prose max-w-none text-sm ${options.theme === 'dark' ? 'bg-[#1a1a2e]' : options.theme === 'sepia' ? 'bg-[#f4ecd8]' : 'bg-white'}`} dangerouslySetInnerHTML={{ __html: renderedHTML }} />
                </div>
              )}
              <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={handleConvert}><FileText className="w-4 h-4 mr-2" />Convert to PDF</Button>
            </div>
          )}

          {isProcessing && <ProcessingStatus message="Creating PDF..." />}

          {pdfBlob && !isProcessing && (
            <div className="border border-border rounded-xl p-8 text-center bg-green-500/10 border-green-500">
              <div className="text-4xl mb-4">✓</div><h3 className="text-xl font-semibold mb-4">PDF Ready</h3>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={handleDownload}><Download className="w-4 h-4 mr-2" />Download PDF</Button>
                <Button size="lg" variant="outline" onClick={handleReset}><RotateCcw className="w-4 h-4 mr-2" />New Document</Button>
              </div>
            </div>
          )}

          <div className="mt-12"><FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" /></div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24 border border-border rounded-xl p-6 bg-muted/30 space-y-5">
            <h3 className="font-semibold text-lg">Options</h3>
            <label className="block"><span className="text-xs font-medium text-muted-foreground">Page Size</span>
              <select className="w-full mt-1 p-2 rounded-lg border border-border bg-card text-sm" value={options.pageSize} onChange={(e) => setOpt('pageSize', e.target.value as MarkdownToPDFOptions['pageSize'])}>
                <option value="A4">A4</option><option value="Letter">Letter</option><option value="Legal">Legal</option>
              </select></label>
            <label className="block"><span className="text-xs font-medium text-muted-foreground">Orientation</span>
              <select className="w-full mt-1 p-2 rounded-lg border border-border bg-card text-sm" value={options.orientation} onChange={(e) => setOpt('orientation', e.target.value as MarkdownToPDFOptions['orientation'])}>
                <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
              </select></label>
            <label className="block"><span className="text-xs font-medium text-muted-foreground">Theme</span>
              <select className="w-full mt-1 p-2 rounded-lg border border-border bg-card text-sm" value={options.theme} onChange={(e) => setOpt('theme', e.target.value as MarkdownToPDFOptions['theme'])}>
                <option value="light">Light</option><option value="dark">Dark</option><option value="sepia">Sepia</option>
              </select></label>
            <label className="block"><span className="text-xs font-medium text-muted-foreground">Font Size</span>
              <select className="w-full mt-1 p-2 rounded-lg border border-border bg-card text-sm" value={options.fontSize} onChange={(e) => setOpt('fontSize', e.target.value as MarkdownToPDFOptions['fontSize'])}>
                <option value="small">Small (14pt)</option><option value="medium">Medium (16pt)</option><option value="large">Large (20pt)</option>
              </select></label>
          </div>
        </div>
      </div>
    </section>
  )
}
