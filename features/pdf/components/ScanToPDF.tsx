'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import QRCode from 'qrcode'
import { Download, RotateCcw, FileDown, Smartphone, Loader2, Trash2, X } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { convertJPGToPDF } from '@/features/pdf/utils/jpgToPDF'
import { formatBytes } from '@/utils/formatBytes'

// ─── Constants ─────────────────────────────────────────────────────────────

const POLL_INTERVAL = 2000

const TOOL_FAQS = [
  { question: 'How does the QR code scanner work?', answer: 'Scan the QR code with your phone camera to open a mobile scanner page. Capture document pages on your phone, then tap Upload to send them to your desktop browser via local storage.' },
  { question: 'Is my data uploaded to a server?', answer: 'No! Images are stored temporarily in your browser\'s localStorage and processed entirely on your device. They never leave your computer.' },
  { question: 'What if I don\'t want to use my phone?', answer: 'You can also upload existing JPG, PNG or WebP images directly using the upload area below the QR code.' },
  { question: 'Is my PDF uploaded to a server?', answer: 'No! All PDF conversion happens entirely in your browser using advanced PDF processing technology. Your documents never leave your device.' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────

function dataURLToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ScanToPDF() {
  const [sessionId] = useState(() => crypto.randomUUID())
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [captures, setCaptures] = useState<string[]>([])
  const [isPolling, setIsPolling] = useState(true)
  const [isConverting, setIsConverting] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const scannerUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/scan/${sessionId}`
  }, [sessionId])

  // ── Generate QR code ────────────────────────────────────────────────

  useEffect(() => {
    QRCode.toDataURL(scannerUrl, { width: 300, margin: 2, color: { dark: '#1e3a5f', light: '#ffffff' } })
      .then((url: string) => setQrDataUrl(url))
      .catch(() => setError('Failed to generate QR code.'))
  }, [scannerUrl])

  // ── Poll for mobile uploads ─────────────────────────────────────────

  useEffect(() => {
    if (!isPolling) return

    const check = () => {
      const key = `scan_${sessionId}`
      const stored = localStorage.getItem(key)
      if (stored) {
        try {
          const images: string[] = JSON.parse(stored)
          if (images.length > 0) {
            setCaptures((prev) => [...prev, ...images])
            localStorage.removeItem(key)
          }
        } catch { /* ignore corrupt storage */ }
      }
    }

    // Check immediately
    check()

    // Also check URL params (from mobile redirect)
    const params = new URLSearchParams(window.location.search)
    if (params.get('session') === sessionId && params.get('done') === 'true') {
      check()
      // Clean URL
      window.history.replaceState({}, '', `/tools/pdf/scan-to-pdf`)
    }

    const interval = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [sessionId, isPolling])

  // ── Direct upload fallback ──────────────────────────────────────────

  const handleFileSelect = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => setCaptures((prev) => [...prev, reader.result as string])
    reader.readAsDataURL(file)
  }, [])

  // ── Remove capture ──────────────────────────────────────────────────

  const removeCapture = (index: number) => {
    setCaptures((prev) => prev.filter((_, i) => i !== index))
    setPdfBlob(null)
  }

  // ── Convert to PDF ──────────────────────────────────────────────────

  const handleConvert = useCallback(async () => {
    if (captures.length === 0) return
    setIsConverting(true); setError(null)

    try {
      const files = captures.map((dataUrl, i) => {
        const blob = dataURLToBlob(dataUrl)
        return new File([blob], `page-${i + 1}.jpg`, { type: 'image/jpeg' })
      })

      const pdfBytes = await convertJPGToPDF(files, {
        pageSize: 'fit',
        orientation: 'auto',
        margin: 5,
        imageFit: 'contain',
      })

      setPdfBlob(new Blob([pdfBytes], { type: 'application/pdf' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.')
    } finally {
      setIsConverting(false)
    }
  }, [captures])

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url; a.download = 'scanned-document.pdf'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [pdfBlob])

  const handleReset = useCallback(() => {
    setCaptures([]); setPdfBlob(null); setError(null); setIsPolling(true)
  }, [])

  // ── Render ───────────────────────────────────────────────────────────

  const totalSize = captures.reduce((sum, d) => sum + new Blob([dataURLToBlob(d)]).size, 0)

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Error" message={error} onRetry={handleConvert} />}

          {/* QR code + scanner info */}
          {captures.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* QR code */}
              <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Smartphone className="w-5 h-5" />
                  <h3 className="font-semibold">Scan with Phone</h3>
                </div>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="mx-auto w-56 h-56 rounded-lg" />
                ) : (
                  <div className="w-56 h-56 mx-auto bg-muted rounded-lg animate-pulse" />
                )}
                <p className="text-xs text-muted-foreground">
                  Point your phone camera at the QR code to open the scanner.
                </p>
              </div>

              {/* Instructions */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <h3 className="font-semibold">How it works</h3>
                <ol className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-2"><span className="font-bold text-primary">1.</span> Scan the QR code with your phone</li>
                  <li className="flex gap-2"><span className="font-bold text-primary">2.</span> Capture document pages using your phone camera</li>
                  <li className="flex gap-2"><span className="font-bold text-primary">3.</span> Tap Upload — images appear here instantly</li>
                  <li className="flex gap-2"><span className="font-bold text-primary">4.</span> Convert to PDF and download</li>
                </ol>
              </div>
            </div>
          )}

          {/* Direct upload fallback */}
          <div className={captures.length > 0 ? '' : 'mt-0'}>
            <UploadDropzone acceptedFormats={['jpg', 'jpeg', 'png', 'webp']} onFileSelect={handleFileSelect} />
          </div>

          {/* Captured pages */}
          {captures.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{captures.length} page{captures.length !== 1 ? 's' : ''} · {formatBytes(totalSize)}</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4 mr-1" />Reset
                  </Button>
                </div>
              </div>

              {/* Thumbnail grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {captures.map((dataUrl, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden border border-border bg-muted">
                    <img src={dataUrl} alt={`Page ${i + 1}`}
                      className="w-full aspect-[3/4] object-cover" />
                    <button
                      onClick={() => removeCapture(i)}
                      className="absolute top-1 right-1 bg-red-500/90 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>

              {/* Convert/Download */}
              {!pdfBlob ? (
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90"
                  onClick={handleConvert} disabled={isConverting || captures.length === 0}>
                  {isConverting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                  {isConverting ? 'Converting...' : `Convert to PDF (${captures.length} page${captures.length !== 1 ? 's' : ''})`}
                </Button>
              ) : (
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />Download PDF ({formatBytes(pdfBlob.size)})
                </Button>
              )}

              {isConverting && <ProcessingStatus message="Converting images to PDF..." />}
            </div>
          )}

          <div className="mt-12"><FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" /></div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-4">Scan Info</h3>
              {captures.length > 0 ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Pages</span><span className="font-medium">{captures.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total size</span><span className="font-medium">{formatBytes(totalSize)}</span></div>
                  {pdfBlob && (
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="text-muted-foreground">PDF size</span>
                      <span className="font-medium text-green-600">{formatBytes(pdfBlob.size)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">Scan the QR code or upload images directly.</p>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code" className="w-full rounded-lg" />
                  ) : (
                    <div className="w-full aspect-square bg-muted rounded-lg animate-pulse" />
                  )}
                  <p className="text-xs text-muted-foreground text-center">Scan to open mobile scanner</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
