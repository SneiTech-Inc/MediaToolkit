'use client'

import { useState, useCallback } from 'react'
import { Download, RotateCcw, FileText, Unlock, Eye, EyeOff, CheckCircle2, Info, Loader2 } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { getPdfPageCount } from '@/features/pdf/utils/pdfMerger'
import { unlockPDF } from '@/features/pdf/utils/pdfUnlocker'
import { formatBytes } from '@/utils/formatBytes'

// ─── Constants ─────────────────────────────────────────────────────────────

const TOOL_FAQS = [
  { question: 'Can I unlock any password-protected PDF?', answer: 'SaveVex can reliably unlock PDFs that were encrypted using the Protect PDF tool (.svpx format). Standard encrypted PDFs may have limited support in this version — re-protect them with Protect PDF first for best results.' },
  { question: 'What happens if I enter the wrong password?', answer: 'An error message is displayed. Passwords are case-sensitive. Double-check your spelling and try again.' },
  { question: 'Is my PDF uploaded to a server?', answer: 'No! All decryption happens entirely in your browser using the Web Crypto API. Your PDF and password never leave your device.' },
  { question: 'Will the unlocked PDF have the same quality?', answer: 'Yes! Decryption restores the original PDF exactly — no quality loss, no changes to content or formatting.' },
]

// ─── Component ─────────────────────────────────────────────────────────────

export function UnlockPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [isEncrypted, setIsEncrypted] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [unlockedData, setUnlockedData] = useState<Uint8Array | null>(null)
  const [isNotEncrypted, setIsNotEncrypted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Upload ──────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f)
    setError(null)
    setUnlockedData(null)
    setIsNotEncrypted(false)

    // Check if it's a .svpx file (our format)
    if (f.name.endsWith('.svpx')) {
      setIsEncrypted(true)
      setPageCount(0)
      return
    }

    // Check if it's an encrypted standard PDF
    try {
      const buf = await f.arrayBuffer()
      const { PDFDocument } = await import('pdf-lib')
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true })
      setIsEncrypted(pdf.isEncrypted)
      if (pdf.isEncrypted) {
        setPageCount(pdf.getPageCount())
      } else {
        setPageCount(pdf.getPageCount())
        setIsNotEncrypted(true)
      }
    } catch {
      // Check magic bytes for .svpx
      try {
        const buf = await f.arrayBuffer()
        const magic = new TextDecoder().decode(new Uint8Array(buf).slice(0, 4))
        if (magic === 'SVPX') {
          setIsEncrypted(true)
          setPageCount(0)
          return
        }
      } catch { /* fall through */ }

      setError('Failed to read file.')
    }
  }, [])

  // ── Unlock ──────────────────────────────────────────────────────────

  const handleUnlock = useCallback(async () => {
    if (!file || !password) return
    setIsProcessing(true)
    setError(null)

    try {
      const result = await unlockPDF(file, password)
      setUnlockedData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decryption failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [file, password])

  const handleDownload = useCallback(() => {
    if (!unlockedData || !file) return
    const blob = new Blob([unlockedData], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const name = file.name.replace('.svpx', '').replace('.pdf', '-unlocked.pdf')
    a.download = name.endsWith('.pdf') ? name : name + '.pdf'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [unlockedData, file])

  const handleReset = useCallback(() => {
    setFile(null)
    setPageCount(0)
    setIsEncrypted(false)
    setPassword('')
    setShowPassword(false)
    setUnlockedData(null)
    setIsNotEncrypted(false)
    setError(null)
  }, [])

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Main Column ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Unlock Failed" message={error} onRetry={handleUnlock} />}

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
                    {isEncrypted && <span className="text-amber-500 ml-1">· Encrypted</span>}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-1" />New
                </Button>
              </div>

              {/* Not encrypted notice */}
              {isNotEncrypted && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
                  <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400">This PDF is not password protected.</p>
                    <p className="text-sm text-blue-600/80 dark:text-blue-400/80">
                      No password is needed to open this file. You can use it as-is or protect it with the{' '}
                      <a href="/tools/pdf/protect-pdf" className="underline">Protect PDF</a> tool.
                    </p>
                  </div>
                </div>
              )}

              {/* Password input */}
              {isEncrypted && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <label className="text-sm font-medium">Password</label>
                  <div className="relative max-w-md">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setUnlockedData(null) }}
                      placeholder="Enter the PDF password"
                      className="w-full px-3 py-2 pr-10 border border-border rounded-lg bg-background text-sm"
                      disabled={isProcessing}
                      onKeyDown={(e) => { if (e.key === 'Enter' && password) handleUnlock() }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Action */}
              {isEncrypted && (
                <>
                  {!unlockedData ? (
                    <Button
                      size="lg"
                      className="w-full bg-primary hover:bg-primary/90"
                      onClick={handleUnlock}
                      disabled={isProcessing || !password}
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Unlock className="w-4 h-4 mr-2" />
                      )}
                      {isProcessing ? 'Decrypting...' : 'Unlock PDF'}
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-6 rounded-xl border border-green-500/50 bg-green-500/5">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <span className="font-semibold">PDF Unlocked Successfully</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          The PDF has been decrypted. Download the unlocked version below.
                        </p>
                      </div>
                      <Button size="lg" className="w-full bg-primary hover:bg-primary/90" onClick={handleDownload}>
                        <Download className="w-4 h-4 mr-2" />
                        Download Unlocked PDF ({formatBytes(unlockedData.length)})
                      </Button>
                    </div>
                  )}
                </>
              )}

              {isProcessing && <ProcessingStatus message="Decrypting PDF..." />}
            </div>
          )}

          {/* How to Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Unlock a PDF</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload protected PDF', desc: 'Click the upload area to select a password-protected PDF or .svpx file.' },
                { step: 2, title: 'Enter password', desc: 'Type the password that was used to protect the PDF.' },
                { step: 3, title: 'Download unlocked PDF', desc: 'Click Unlock to decrypt, then download the password-free PDF.' },
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

        {/* ── Sidebar ────────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-4">Unlock Info</h3>
              {file ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">File</span><span className="font-medium truncate ml-2 max-w-[140px]">{file.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Size</span><span className="font-medium">{formatBytes(file.size)}</span></div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={`font-medium ${isEncrypted ? 'text-amber-500' : 'text-green-600'}`}>
                      {isEncrypted ? 'Encrypted' : isNotEncrypted ? 'Not encrypted' : '—'}
                    </span>
                  </div>
                  {unlockedData && (
                    <div className="flex justify-between pt-2 border-t border-border">
                      <span className="text-muted-foreground">Unlocked</span>
                      <span className="font-medium text-green-600">{formatBytes(unlockedData.length)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Upload a password-protected PDF or .svpx file to remove its password protection. Best results with files encrypted by the Protect PDF tool.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
