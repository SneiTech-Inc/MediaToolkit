'use client'

import { useState, useCallback } from 'react'
import { Download, RotateCcw, FileText, FileDown, CheckCircle2, Info, AlertTriangle } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { getPdfPageCount } from '@/features/pdf/utils/pdfMerger'
import { compressPDF } from '@/features/pdf/utils/pdfCompressor'
import type { CompressionLevel, CompressionResult } from '@/features/pdf/utils/pdfCompressor'
import { formatBytes } from '@/utils/formatBytes'
import { getSaveVexFileName } from '@/utils/fileNames'

const LEVELS: { value: CompressionLevel; label: string; desc: string }[] = [
  { value: 'low', label: 'Low', desc: 'Mild JPEG recompression, best quality' },
  { value: 'medium', label: 'Medium', desc: 'Moderate recompression + downscale (recommended)' },
  { value: 'high', label: 'High', desc: 'Aggressive recompression + max downscale' },
]

const TOOL_FAQS = [
  { question: 'How does PDF compression work?', answer: 'SaveVex finds images embedded in your PDF and recompresses them at lower JPEG quality using your browser. It also applies structural optimization via object streams. All processing happens locally in your browser.' },
  { question: 'What compression levels are available?', answer: 'Low (85% JPEG quality, original size), Medium (50% quality, max 2000px — recommended), and High (25% quality, max 1440px). Medium balances size and quality for most use cases, while High prioritizes maximum reduction.' },
  { question: 'Will compression affect quality?', answer: 'Yes — images are re-encoded as JPEG at reduced quality. Low preserves most detail, Medium visibly reduces quality but keeps images readable, and High may show noticeable JPEG artifacts. Text and vector graphics are never modified.' },
  { question: 'Why didn\'t my file shrink much?', answer: 'Text-heavy PDFs have few or no images to compress. Scanned documents and image-heavy files will see the biggest reductions — often 60–80% at High compression.' },
  { question: 'Is my PDF uploaded to a server?', answer: 'No! All compression happens entirely in your browser. Your PDF never leaves your device.' },
]

export function CompressPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [level, setLevel] = useState<CompressionLevel>('medium')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CompressionResult | null>(null)

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f); setError(null); setResult(null)
    try { setPageCount(await getPdfPageCount(f)) }
    catch { setError('Failed to read PDF.') }
  }, [])

  const handleCompress = useCallback(async () => {
    if (!file) return
    setIsProcessing(true); setError(null)
    try {
      const res = await compressPDF(file, level)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compression failed.')
    } finally { setIsProcessing(false) }
  }, [file, level])

  const handleDownload = useCallback(() => {
    if (!result || !file) return
    const blob = new Blob([result.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = getSaveVexFileName(file.name)
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result, file])

  const handleReset = useCallback(() => {
    setFile(null); setPageCount(0); setResult(null); setError(null); setLevel('medium')
  }, [])

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Compression Failed" message={error} onRetry={handleCompress} />}

          {/* Warning: no images found */}
          {result && result.imagesFound === 0 && result.percentSaved < 2 && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">No embedded images found in this PDF.</p>
                <p className="text-sm text-blue-600/80 dark:text-blue-400/80">The file is already optimized for size.</p>
              </div>
            </div>
          )}

          {/* Warning: minimal compression on text-heavy PDF */}
          {result && result.imagesFound > 0 && result.percentSaved < 2 && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Limited compression achieved.</p>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/80">This PDF appears to contain mostly text. Compression may be limited. For best results, use on image-heavy files like scanned documents.</p>
              </div>
            </div>
          )}

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
                <Button variant="outline" size="sm" onClick={handleReset}><RotateCcw className="w-4 h-4 mr-1" />New</Button>
              </div>

              {/* Compression levels */}
              <div className="grid grid-cols-3 gap-3">
                {LEVELS.map((l) => (
                  <button key={l.value}
                    onClick={() => { setLevel(l.value); setResult(null) }}
                    className={`p-4 rounded-xl border text-center transition-all ${
                      level === l.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-card hover:bg-muted'
                    }`}>
                    <div className="font-semibold text-sm">{l.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{l.desc}</div>
                  </button>
                ))}
              </div>

              <Button size="lg" className="w-full bg-primary hover:bg-primary/90" onClick={handleCompress} disabled={isProcessing}>
                <FileDown className="w-4 h-4 mr-2" />{isProcessing ? 'Compressing...' : 'Compress PDF'}
              </Button>

              {isProcessing && <ProcessingStatus message="Compressing PDF..." />}

              {/* Result */}
              {result && (
                <div className="space-y-4">
                  <div className="p-6 rounded-xl border border-green-500/50 bg-green-500/5">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span className="font-semibold">Compression Complete</span>
                    </div>

                    {/* Comparison bar */}
                    <div className="space-y-3 mb-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1"><span>Original</span><span>{formatBytes(file.size)}</span></div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-muted-foreground/30 rounded-full" style={{ width: '100%' }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1"><span>Compressed</span><span>{formatBytes(result.compressedSize)}</span></div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(2, 100 - result.percentSaved)}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-3 rounded-lg bg-background">
                        <div className="text-2xl font-bold text-green-600">{result.percentSaved > 0 ? `${result.percentSaved}%` : '—'}</div>
                        <div className="text-xs text-muted-foreground mt-1">Reduction</div>
                      </div>
                      <div className="p-3 rounded-lg bg-background">
                        <div className="text-2xl font-bold">{formatBytes(result.compressedSize).split(' ')[0]}</div>
                        <div className="text-xs text-muted-foreground mt-1">{formatBytes(result.compressedSize).split(' ')[1]}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-background">
                        <div className="text-xl font-bold">{level.charAt(0).toUpperCase() + level.slice(1)}</div>
                        <div className="text-xs text-muted-foreground mt-1">Level</div>
                      </div>
                      <div className="p-3 rounded-lg bg-background">
                        <div className="text-xl font-bold">{result.imagesCompressed}{result.imagesFound > 0 && `/${result.imagesFound}`}</div>
                        <div className="text-xs text-muted-foreground mt-1">Images</div>
                      </div>
                    </div>
                  </div>

                  <Button size="lg" className="w-full bg-primary hover:bg-primary/90" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />Download Compressed PDF
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Compress a PDF</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload PDF', desc: 'Click the upload area to select the PDF you want to compress.' },
                { step: 2, title: 'Choose level', desc: 'Low (minimal), Medium (balanced), or High (maximum compression).' },
                { step: 3, title: 'Compress & download', desc: 'Click Compress and download your optimized PDF.' },
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
              <h3 className="font-semibold text-lg mb-4">Compression Info</h3>
              {file ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="font-medium truncate ml-2 max-w-[160px]">{file.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pages</span><span className="font-medium">{pageCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Original</span><span className="font-medium">{formatBytes(file.size)}</span></div>
                  {result && (
                    <>
                      <div className="flex justify-between pt-2 border-t border-border"><span className="text-muted-foreground">Compressed</span><span className="font-medium text-green-600">{formatBytes(result.compressedSize)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Images found</span><span className="font-medium">{result.imagesFound}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Compressed</span><span className="font-medium">{result.imagesCompressed}</span></div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Upload a PDF to compress. Images will be re-encoded as JPEG at lower quality. The file structure is also optimized for additional savings.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
