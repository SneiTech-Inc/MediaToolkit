'use client'

import { useState, useCallback } from 'react'
import { Download, RotateCcw, FileText, Wrench, Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { getPdfPageCount } from '@/features/pdf/utils/pdfMerger'
import { repairPDF } from '@/features/pdf/utils/pdfRepairer'
import type { RepairReport } from '@/features/pdf/utils/pdfRepairer'
import { formatBytes } from '@/utils/formatBytes'

// ─── Constants ─────────────────────────────────────────────────────────────

const TOOL_FAQS = [
  { question: 'What types of PDF issues can be repaired?', answer: 'This tool can fix broken cross-reference tables, invalid object streams, minor structural corruption, and optimize poorly-saved PDFs. It rebuilds the PDF structure using pdf-lib\'s error-recovery parser.' },
  { question: 'Can all PDFs be repaired?', answer: 'No. Severely corrupted PDFs where the header, trailer, or critical objects are missing may not be repairable. Encrypted PDFs must be unlocked first using the Unlock PDF tool.' },
  { question: 'Is my PDF uploaded to a server?', answer: 'No! All repair processing happens entirely in your browser. Your PDF never leaves your device.' },
]

// ─── Component ─────────────────────────────────────────────────────────────

export function RepairPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [report, setReport] = useState<RepairReport | null>(null)
  const [repairedData, setRepairedData] = useState<Uint8Array | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Upload ──────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f); setError(null); setReport(null); setRepairedData(null)
    try {
      const count = await getPdfPageCount(f)
      setPageCount(count)
    } catch {
      // PDF might be too damaged to count pages — that's fine, we'll try to repair anyway
      setPageCount(0)
    }
  }, [])

  // ── Repair ──────────────────────────────────────────────────────────

  const handleRepair = useCallback(async () => {
    if (!file) return
    setIsProcessing(true); setError(null); setReport(null); setRepairedData(null)
    try {
      const result = await repairPDF(file)
      setReport(result.report)
      if (result.data.length > 0) setRepairedData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repair failed.')
    } finally { setIsProcessing(false) }
  }, [file])

  const handleDownload = useCallback(() => {
    if (!repairedData || !file) return
    const blob = new Blob([repairedData], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = file.name.replace('.pdf', '-repaired.pdf')
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [repairedData, file])

  const handleReset = useCallback(() => {
    setFile(null); setPageCount(0); setReport(null); setRepairedData(null); setError(null)
  }, [])

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Repair Failed" message={error} onRetry={handleRepair} />}

          {!file ? (
            <UploadDropzone acceptedFormats={['pdf']} onFileSelect={handleFileSelect} />
          ) : (
            <div className="space-y-6">
              {/* File info */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                <FileText className="w-10 h-10 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(file.size)}
                    {pageCount > 0 && <span> · {pageCount} page{pageCount !== 1 ? 's' : ''}</span>}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}><RotateCcw className="w-4 h-4 mr-1" />New</Button>
              </div>

              {/* Repair button */}
              {!report && (
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90"
                  onClick={handleRepair} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wrench className="w-4 h-4 mr-2" />}
                  {isProcessing ? 'Repairing...' : 'Repair PDF'}
                </Button>
              )}

              {isProcessing && <ProcessingStatus message="Analyzing and repairing PDF..." />}

              {/* Report */}
              {report && (
                <div className="space-y-4">
                  {/* Status banner */}
                  <div className={`p-4 rounded-xl border ${
                    report.success ? 'border-green-500/50 bg-green-500/5' : 'border-destructive/50 bg-destructive/5'
                  }`}>
                    <div className="flex items-center gap-2">
                      {report.success ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive" />
                      )}
                      <span className={`font-semibold ${report.success ? 'text-green-600' : 'text-destructive'}`}>
                        {report.success ? 'PDF Repaired Successfully' : 'Repair Partially Failed'}
                      </span>
                    </div>
                  </div>

                  {/* Issues Found */}
                  {report.issuesFound.length > 0 && (
                    <details className="rounded-xl border border-border bg-card overflow-hidden" open>
                      <summary className="px-4 py-3 cursor-pointer hover:bg-muted/50 font-medium text-sm">
                        <AlertTriangle className="w-4 h-4 inline mr-2 text-amber-500" />
                        Issues Found ({report.issuesFound.length})
                      </summary>
                      <ul className="px-4 pb-3 space-y-1">
                        {report.issuesFound.map((issue, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-amber-500 mt-1">•</span> {issue}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Fixed */}
                  {report.issuesFixed.length > 0 && (
                    <details className="rounded-xl border border-green-500/30 bg-green-500/5 overflow-hidden" open>
                      <summary className="px-4 py-3 cursor-pointer hover:bg-muted/50 font-medium text-sm text-green-600">
                        <CheckCircle2 className="w-4 h-4 inline mr-2" />
                        Fixed ({report.issuesFixed.length})
                      </summary>
                      <ul className="px-4 pb-3 space-y-1">
                        {report.issuesFixed.map((fix, i) => (
                          <li key={i} className="text-sm text-green-600 flex items-start gap-2">
                            <span>✓</span> {fix}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Unresolved */}
                  {report.issuesUnresolved.length > 0 && (
                    <details className="rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden" open>
                      <summary className="px-4 py-3 cursor-pointer hover:bg-muted/50 font-medium text-sm text-destructive">
                        <XCircle className="w-4 h-4 inline mr-2" />
                        Could Not Fix ({report.issuesUnresolved.length})
                      </summary>
                      <ul className="px-4 pb-3 space-y-1">
                        {report.issuesUnresolved.map((issue, i) => (
                          <li key={i} className="text-sm text-destructive flex items-start gap-2">
                            <span>✗</span> {issue}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Download */}
                  {report.success && repairedData && (
                    <Button size="lg" className="w-full bg-primary hover:bg-primary/90" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download Repaired PDF ({formatBytes(repairedData.length)})
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Repair a PDF</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload damaged PDF', desc: 'Click the upload area to select the PDF that needs repair. Even if it appears broken, we\'ll try to recover it.' },
                { step: 2, title: 'Run repair', desc: 'Click Repair PDF to analyze and fix structural issues. The tool attempts multiple recovery strategies.' },
                { step: 3, title: 'Review & download', desc: 'Check the repair report to see what was fixed, then download your repaired PDF.' },
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
              <h3 className="font-semibold text-lg mb-4">Repair Info</h3>
              {file ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="font-medium truncate ml-2 max-w-[140px]">{file.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span className="font-medium">{formatBytes(file.size)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pages</span><span className="font-medium">{pageCount || 'Unknown'}</span></div>
                  {report && (
                    <>
                      <div className="flex justify-between pt-2 border-t border-border">
                        <span className="text-muted-foreground">Status</span>
                        <span className={report.success ? 'text-green-600 font-medium' : 'text-destructive font-medium'}>
                          {report.success ? 'Repaired' : 'Failed'}
                        </span>
                      </div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Issues found</span><span className="font-medium">{report.issuesFound.length}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Issues fixed</span><span className="font-medium text-green-600">{report.issuesFixed.length}</span></div>
                      {report.issuesUnresolved.length > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Unresolved</span><span className="font-medium text-destructive">{report.issuesUnresolved.length}</span></div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Upload a damaged or corrupt PDF to attempt repair. The tool uses multiple recovery strategies to rebuild the PDF structure.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
