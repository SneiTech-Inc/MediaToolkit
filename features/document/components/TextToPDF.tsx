'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback, useMemo } from 'react'
import { Download, RotateCcw, FileText, Type, Settings2 } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { convertTextToPDF, computeTextStats, type TextToPDFOptions } from '@/features/document/utils/textToPdf'
import type { FAQItem } from '@/types/common'

const DEFAULTS: TextToPDFOptions = {
  pageSize: 'A4',
  orientation: 'portrait',
  fontSize: 12,
  lineHeight: 1.5,
  marginTop: 72,
  marginBottom: 72,
  marginLeft: 72,
  marginRight: 72,
}

const TOOL_FAQS: FAQItem[] = [
  { question: 'What text formats are supported?', answer: 'Plain text (.txt) files and pasted text. Only Latin characters (English, French, Spanish, etc.) are supported in this version.' },
  { question: 'Can I customize the PDF layout?', answer: 'Yes! Choose page size (A4/Letter/Legal), orientation, font size (10-20pt), line height, and margins.' },
  { question: 'Is my text uploaded to a server?', answer: 'No! All processing happens in your browser. Your text never leaves your device.' },
]

export function TextToPDF() {
  const [text, setText] = useState('')
  const [options, setOptions] = useState<TextToPDFOptions>(DEFAULTS)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stats = useMemo(() => computeTextStats(text, options), [text, options])

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null); setPdfBlob(null)
    const t = await file.text()
    setText(t)
  }, [])

  const handleConvert = useCallback(async () => {
    if (!text.trim()) { setError('Please enter some text.'); return }
    setIsProcessing(true); setError(null)
    try {
      const bytes = await convertTextToPDF(text, options)
      setPdfBlob(new Blob([bytes], { type: 'application/pdf' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.')
    } finally { setIsProcessing(false) }
  }, [text, options])

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url; a.download = getSaveVexFileName('text.pdf')
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [pdfBlob])

  const handleReset = useCallback(() => { setText(''); setPdfBlob(null); setError(null) }, [])

  const setOpt = useCallback(<K extends keyof TextToPDFOptions>(k: K, v: TextToPDFOptions[K]) => {
    setOptions((prev) => ({ ...prev, [k]: v }))
  }, [])

  const showUpload = !text

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Conversion Failed" message={error} onRetry={handleReset} />}

          {showUpload && (
            <div className="space-y-4">
              <UploadDropzone acceptedFormats={['txt']} onFileSelect={handleFileSelect} />
              <div className="text-center text-sm text-muted-foreground">— or —</div>
              <textarea
                placeholder="Paste your text here..."
                className="w-full h-40 p-4 rounded-xl border border-border bg-card resize-y text-sm"
                onChange={(e) => { setText(e.target.value); setPdfBlob(null); setError(null) }}
              />
            </div>
          )}

          {!showUpload && !pdfBlob && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Text Preview ({stats.chars} chars)</span>
                <Button variant="outline" size="sm" onClick={handleReset}>Clear</Button>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-48 p-4 rounded-xl border border-border bg-card resize-y text-sm font-mono"
              />
              <div className="grid grid-cols-4 gap-3 text-center text-sm">
                <div className="bg-muted/30 rounded-lg p-3"><div className="font-bold text-lg">{stats.words}</div><div className="text-xs text-muted-foreground">Words</div></div>
                <div className="bg-muted/30 rounded-lg p-3"><div className="font-bold text-lg">{stats.chars}</div><div className="text-xs text-muted-foreground">Chars</div></div>
                <div className="bg-muted/30 rounded-lg p-3"><div className="font-bold text-lg">{stats.lines}</div><div className="text-xs text-muted-foreground">Lines</div></div>
                <div className="bg-muted/30 rounded-lg p-3"><div className="font-bold text-lg">~{stats.estimatedPages}</div><div className="text-xs text-muted-foreground">Pages</div></div>
              </div>
              <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={handleConvert}>
                <FileText className="w-4 h-4 mr-2" />Convert to PDF
              </Button>
            </div>
          )}

          {isProcessing && <ProcessingStatus message="Creating PDF..." />}

          {pdfBlob && !isProcessing && (
            <div className="border border-border rounded-xl p-8 text-center bg-green-500/10 border-green-500">
              <div className="text-4xl mb-4">✓</div>
              <h3 className="text-xl font-semibold mb-4">PDF Ready</h3>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={handleDownload}><Download className="w-4 h-4 mr-2" />Download PDF</Button>
                <Button size="lg" variant="outline" onClick={handleReset}><RotateCcw className="w-4 h-4 mr-2" />New Text</Button>
              </div>
            </div>
          )}

          <div className="mt-12"><FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" /></div>
        </div>

        {/* Options Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 border border-border rounded-xl p-6 bg-muted/30 space-y-5">
            <h3 className="font-semibold text-lg flex items-center gap-2"><Settings2 className="w-4 h-4" />Options</h3>

            <label className="block"><span className="text-xs font-medium text-muted-foreground">Page Size</span>
              <select className="w-full mt-1 p-2 rounded-lg border border-border bg-card text-sm" value={options.pageSize} onChange={(e) => setOpt('pageSize', e.target.value as TextToPDFOptions['pageSize'])}>
                <option value="A4">A4</option><option value="Letter">Letter</option><option value="Legal">Legal</option>
              </select></label>

            <label className="block"><span className="text-xs font-medium text-muted-foreground">Orientation</span>
              <select className="w-full mt-1 p-2 rounded-lg border border-border bg-card text-sm" value={options.orientation} onChange={(e) => setOpt('orientation', e.target.value as TextToPDFOptions['orientation'])}>
                <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
              </select></label>

            <label className="block"><span className="text-xs font-medium text-muted-foreground">Font Size: {options.fontSize}pt</span>
              <input type="range" min="10" max="20" value={options.fontSize} onChange={(e) => setOpt('fontSize', Number(e.target.value))} className="w-full mt-1" /></label>

            <label className="block"><span className="text-xs font-medium text-muted-foreground">Line Height: {options.lineHeight.toFixed(1)}</span>
              <input type="range" min="1.0" max="2.0" step="0.1" value={options.lineHeight} onChange={(e) => setOpt('lineHeight', Number(e.target.value))} className="w-full mt-1" /></label>

            {(['marginTop', 'marginBottom', 'marginLeft', 'marginRight'] as const).map((m) => (
              <label key={m} className="block"><span className="text-xs font-medium text-muted-foreground">{m.replace('margin', '')}: {options[m]}pt</span>
                <input type="range" min="18" max="144" value={options[m]} onChange={(e) => setOpt(m, Number(e.target.value))} className="w-full mt-1" /></label>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
