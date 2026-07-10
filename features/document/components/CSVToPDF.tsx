'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback, useMemo } from 'react'
import { Download, RotateCcw, Table as TableIcon } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { convertCSVToPDF, parseCSV, detectDelimiter, type CSVToPDFOptions } from '@/features/document/utils/csvToPdf'
import type { FAQItem } from '@/types/common'

const DEFAULTS: CSVToPDFOptions = { pageSize: 'A4', orientation: 'landscape', fontSize: 10, tableStyle: 'bordered', firstRowHeader: true, delimiter: 'auto' }

const TOOL_FAQS: FAQItem[] = [
  { question: 'What CSV formats are supported?', answer: 'Comma, semicolon, and tab-delimited files. Quoted fields (including commas within fields) are handled automatically.' },
  { question: 'Can I customize the table appearance?', answer: 'Yes! Choose Bordered (grid lines), Striped (alternating row colors), or Plain. Set font size (8-14pt), page size, and orientation.' },
  { question: 'Is my CSV uploaded to a server?', answer: 'No! All processing happens in your browser. Your data never leaves your device.' },
]

export function CSVToPDF() {
  const [raw, setRaw] = useState('')
  const [options, setOptions] = useState<CSVToPDFOptions>(DEFAULTS)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setOpt = <K extends keyof CSVToPDFOptions>(k: K, v: CSVToPDFOptions[K]) => setOptions((p) => ({ ...p, [k]: v }))

  const rows = useMemo(() => {
    if (!raw) return []
    try {
      const d = options.delimiter === 'auto' ? detectDelimiter(raw) : options.delimiter
      return parseCSV(raw, d)
    } catch { return [] }
  }, [raw, options.delimiter])

  const handleFileSelect = useCallback(async (f: File) => { setRaw(await f.text()); setPdfBlob(null); setError(null) }, [])

  const handleConvert = useCallback(async () => {
    if (!raw.trim()) { setError('No data to convert.'); return }
    setIsProcessing(true); setError(null)
    try {
      const bytes = await convertCSVToPDF(raw, options)
      setPdfBlob(new Blob([bytes], { type: 'application/pdf' }))
    } catch (err) { setError(err instanceof Error ? err.message : 'Conversion failed.') }
    finally { setIsProcessing(false) }
  }, [raw, options])

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return; const u = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a'); a.href = u; a.download = getSaveVexFileName('data.pdf')
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(u), 1000)
  }, [pdfBlob])

  const handleReset = () => { setRaw(''); setPdfBlob(null); setError(null) }

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {error && <ErrorCard title="Error" message={error} onRetry={handleReset} />}

          {!raw && <UploadDropzone acceptedFormats={['csv']} onFileSelect={handleFileSelect} />}

          {raw && !isProcessing && !pdfBlob && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Data Preview — {rows.length} rows × {rows[0]?.length || 0} cols</span>
                <Button variant="outline" size="sm" onClick={handleReset}>Clear</Button>
              </div>
              {rows.length > 0 && (
                <div className="border border-border rounded-xl overflow-auto max-h-80">
                  <table className="w-full text-sm">
                    <tbody>
                      {rows.slice(0, 50).map((row, ri) => (
                        <tr key={ri} className={ri === 0 && options.firstRowHeader ? 'bg-muted/30 font-semibold' : ''}>
                          {row.map((cell, ci) => <td key={ci} className="border border-border px-3 py-1 whitespace-nowrap">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rows.length > 50 && <div className="p-2 text-center text-xs text-muted-foreground">Showing 50 of {rows.length} rows</div>}
                </div>
              )}
              <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={handleConvert}><TableIcon className="w-4 h-4 mr-2" />Convert to PDF</Button>
            </div>
          )}

          {isProcessing && <ProcessingStatus message="Creating PDF..." />}

          {pdfBlob && !isProcessing && (
            <div className="border border-border rounded-xl p-8 text-center bg-green-500/10 border-green-500">
              <div className="text-4xl mb-4">✓</div><h3 className="text-xl font-semibold mb-4">PDF Ready</h3>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={handleDownload}><Download className="w-4 h-4 mr-2" />Download PDF</Button>
                <Button size="lg" variant="outline" onClick={handleReset}><RotateCcw className="w-4 h-4 mr-2" />New File</Button>
              </div>
            </div>
          )}

          <div className="mt-12"><FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" /></div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24 border border-border rounded-xl p-6 bg-muted/30 space-y-5">
            <h3 className="font-semibold text-lg">Options</h3>
            <label className="block"><span className="text-xs font-medium text-muted-foreground">Delimiter</span>
              <select className="w-full mt-1 p-2 rounded-lg border border-border bg-card text-sm" value={options.delimiter} onChange={(e) => setOpt('delimiter', e.target.value)}>
                <option value="auto">Auto-detect</option><option value=",">Comma (,)</option><option value=";">Semicolon (;)</option><option value={'\t'}>Tab</option>
              </select></label>
            <label className="block flex items-center gap-2 text-sm"><input type="checkbox" checked={options.firstRowHeader} onChange={(e) => setOpt('firstRowHeader', e.target.checked)} />First row as header</label>
            <label className="block"><span className="text-xs font-medium text-muted-foreground">Page Size</span>
              <select className="w-full mt-1 p-2 rounded-lg border border-border bg-card text-sm" value={options.pageSize} onChange={(e) => setOpt('pageSize', e.target.value as CSVToPDFOptions['pageSize'])}>
                <option value="A4">A4</option><option value="Letter">Letter</option><option value="Legal">Legal</option>
              </select></label>
            <label className="block"><span className="text-xs font-medium text-muted-foreground">Orientation</span>
              <select className="w-full mt-1 p-2 rounded-lg border border-border bg-card text-sm" value={options.orientation} onChange={(e) => setOpt('orientation', e.target.value as CSVToPDFOptions['orientation'])}>
                <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
              </select></label>
            <label className="block"><span className="text-xs font-medium text-muted-foreground">Font Size: {options.fontSize}pt</span>
              <input type="range" min="8" max="14" value={options.fontSize} onChange={(e) => setOpt('fontSize', Number(e.target.value))} className="w-full mt-1" /></label>
            <label className="block"><span className="text-xs font-medium text-muted-foreground">Table Style</span>
              <select className="w-full mt-1 p-2 rounded-lg border border-border bg-card text-sm" value={options.tableStyle} onChange={(e) => setOpt('tableStyle', e.target.value as CSVToPDFOptions['tableStyle'])}>
                <option value="bordered">Bordered</option><option value="striped">Striped</option><option value="plain">Plain</option>
              </select></label>
          </div>
        </div>
      </div>
    </section>
  )
}
