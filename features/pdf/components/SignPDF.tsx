'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { RotateCcw, FileText, Pen, Type, Upload, Download, Clock, X } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { getPdfPageCount } from '@/features/pdf/utils/pdfMerger'
import { formatBytes } from '@/utils/formatBytes'

// ─── Constants ─────────────────────────────────────────────────────────────

type SignatureMode = 'draw' | 'type' | 'upload'
type Placement = 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right'

const PLACEMENTS: { value: Placement; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'center', label: 'Center' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
]

const TOOL_FAQS = [
  { question: 'When will digital signatures be available?', answer: 'We\'re actively building secure digital signature functionality using Web Crypto API and certificate-based signatures. Sign up for the waitlist to be notified when it launches.' },
  { question: 'Will signatures be legally binding?', answer: 'Phase 1 signatures will be visual only. Phase 2 will introduce certificate-based digital signatures that meet eIDAS and ESIGN Act standards for legal validity.' },
  { question: 'Is my PDF uploaded to a server?', answer: 'No! All processing will happen entirely in your browser. Your PDF never leaves your device.' },
]

// ─── Signature Canvas ──────────────────────────────────────────────────────

function SignatureCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = '#1e3a5f'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true)
    const canvas = canvasRef.current!
    const { x, y } = getPos(e, canvas)
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    const canvas = canvasRef.current!
    const { x, y } = getPos(e, canvas)
    const ctx = canvas.getContext('2d')!
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => setIsDrawing(false)

  const clearCanvas = () => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={500}
        height={160}
        className="w-full border-2 border-dashed border-border rounded-xl cursor-crosshair touch-none bg-white dark:bg-muted"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">Draw your signature above</span>
        {hasSignature && (
          <Button variant="outline" size="sm" onClick={clearCanvas}>
            <X className="w-3 h-3 mr-1" />Clear
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Coming Soon Modal ─────────────────────────────────────────────────────

function ComingSoonModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-center space-y-4">
          <div className="text-5xl">🔐</div>
          <h2 className="text-xl font-bold">Digital Signatures Coming Soon</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;re building secure digital signature functionality using Web Crypto API and certificate-based signatures. Sign up to be notified when it launches!
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-2 text-left text-sm text-muted-foreground">
              <span className="text-green-500 mt-0.5">•</span> Certificate-based digital signatures
            </div>
            <div className="flex items-start gap-2 text-left text-sm text-muted-foreground">
              <span className="text-green-500 mt-0.5">•</span> Hand-drawn signature support
            </div>
            <div className="flex items-start gap-2 text-left text-sm text-muted-foreground">
              <span className="text-green-500 mt-0.5">•</span> Signature verification
            </div>
            <div className="flex items-start gap-2 text-left text-sm text-muted-foreground">
              <span className="text-green-500 mt-0.5">•</span> Trusted timestamping
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <input
              type="email"
              placeholder="Enter your email for updates"
              className="w-full px-4 py-2.5 border border-border rounded-xl bg-background text-sm"
            />
            <Button className="w-full bg-primary hover:bg-primary/90">
              Notify Me
            </Button>
          </div>

          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────

export function SignPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [mode, setMode] = useState<SignatureMode>('draw')
  const [typedText, setTypedText] = useState('')
  const [fontStyle, setFontStyle] = useState<'cursive' | 'serif' | 'sans'>('cursive')
  const [wmFile, setWmFile] = useState<File | null>(null)
  const [placement, setPlacement] = useState<Placement>('bottom-right')
  const [useAllPages, setUseAllPages] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f); setError(null)
    try { setPageCount(await getPdfPageCount(f)) }
    catch { setError('Failed to read PDF.') }
  }, [])

  const handleReset = useCallback(() => {
    setFile(null); setPageCount(0); setMode('draw')
    setTypedText(''); setFontStyle('cursive'); setWmFile(null)
    setPlacement('bottom-right'); setUseAllPages(true); setError(null)
  }, [])

  const fontClass = fontStyle === 'cursive' ? 'font-[cursive]' : fontStyle === 'serif' ? 'font-serif' : 'font-sans'

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Coming Soon Banner */}
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Coming Soon</p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                Digital signatures are in development. The UI is ready — actual signing will be available in Phase 2.
              </p>
            </div>
          </div>

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

              {/* Signature method tabs */}
              <div className="grid grid-cols-3 gap-2">
                {([
                  { mode: 'draw' as const, icon: Pen, label: 'Draw' },
                  { mode: 'type' as const, icon: Type, label: 'Type' },
                  { mode: 'upload' as const, icon: Upload, label: 'Upload' },
                ]).map(({ mode: m, icon: Icon, label }) => (
                  <button key={m}
                    onClick={() => setMode(m)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-medium transition-all ${
                      mode === m ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:bg-muted'
                    }`}>
                    <Icon className="w-4 h-4" />{label}
                  </button>
                ))}
              </div>

              {/* Draw mode */}
              {mode === 'draw' && (
                <div className="p-4 rounded-xl border border-border bg-card">
                  <label className="text-sm font-medium block mb-3">Draw Your Signature</label>
                  <SignatureCanvas />
                </div>
              )}

              {/* Type mode */}
              {mode === 'type' && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <label className="text-sm font-medium block">Type Your Signature</label>
                  <input
                    type="text"
                    value={typedText}
                    onChange={(e) => setTypedText(e.target.value)}
                    placeholder="Type your name..."
                    className="w-full px-4 py-3 border border-border rounded-xl bg-background text-lg"
                  />
                  <div className="flex gap-2">
                    {(['cursive', 'serif', 'sans'] as const).map((s) => (
                      <button key={s}
                        onClick={() => setFontStyle(s)}
                        className={`px-4 py-2 rounded-lg border text-sm capitalize transition-all ${
                          fontStyle === s ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-background hover:bg-muted'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                  {typedText && (
                    <div className={`p-4 border border-border rounded-xl bg-white dark:bg-muted min-h-[60px] text-3xl text-center ${fontClass}`}>
                      {typedText}
                    </div>
                  )}
                </div>
              )}

              {/* Upload mode */}
              {mode === 'upload' && (
                <div className="p-4 rounded-xl border border-border bg-card">
                  <label className="text-sm font-medium block mb-3">Upload Signature Image</label>
                  {!wmFile ? (
                    <UploadDropzone acceptedFormats={['png', 'jpg', 'jpeg']} onFileSelect={(f) => setWmFile(f)} />
                  ) : (
                    <div className="flex items-center gap-3">
                      <img src={URL.createObjectURL(wmFile)} alt="Signature" className="w-16 h-16 rounded-lg object-contain bg-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{wmFile.name}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(wmFile.size)}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setWmFile(null)}>Change</Button>
                    </div>
                  )}
                </div>
              )}

              {/* Placement */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <label className="text-sm font-medium block">Placement</label>
                <div className="grid grid-cols-5 gap-2">
                  {PLACEMENTS.map((p) => (
                    <button key={p.value}
                      onClick={() => setPlacement(p.value)}
                      className={`px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                        placement === p.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-background hover:bg-muted'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Page selection */}
              <div className="p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="pages" checked={useAllPages}
                      onChange={() => setUseAllPages(true)} className="accent-primary" />
                    <span className="text-sm">All pages</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="pages" checked={!useAllPages}
                      onChange={() => setUseAllPages(false)} className="accent-primary" />
                    <span className="text-sm">Specific page</span>
                  </label>
                </div>
              </div>

              {/* Apply button → modal */}
              <Button size="lg" className="w-full bg-primary hover:bg-primary/90"
                onClick={() => setShowModal(true)}>
                <Pen className="w-4 h-4 mr-2" />Apply Signature
              </Button>
            </div>
          )}

          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Sign a PDF</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload PDF', desc: 'Click the upload area to select the PDF you want to sign.' },
                { step: 2, title: 'Create signature', desc: 'Draw with your mouse, type your name and choose a font, or upload a signature image.' },
                { step: 3, title: 'Position & apply', desc: 'Choose where the signature appears on the page, then apply it.' },
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
              <h3 className="font-semibold text-lg mb-4">Signature Info</h3>
              {file ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="font-medium truncate ml-2 max-w-[140px]">{file.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pages</span><span className="font-medium">{pageCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="font-medium capitalize">{mode}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Placement</span><span className="font-medium">{PLACEMENTS.find((p) => p.value === placement)?.label}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pages</span><span className="font-medium">{useAllPages ? 'All' : 'Specific'}</span></div>
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-muted-foreground text-amber-500">Status</span>
                    <span className="font-medium text-amber-500">Coming Soon</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Upload a PDF to preview the signing interface. Actual digital signature functionality is coming in Phase 2.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ComingSoonModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </section>
  )
}
