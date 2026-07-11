'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Download,
  Share2,
  Copy,
  Check,
  Upload,
  X,
  QrCode,
  AlertTriangle,
} from 'lucide-react'
import { FAQSection } from '@/components/shared/FAQSection'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { Button } from '@/components/ui/button'
import { getSaveVexFileName } from '@/utils/fileNames'
import { formatBytes } from '@/utils/formatBytes'
import {
  generateQrToCanvas,
  generateQrSvgString,
  overlayLogo,
  drawWatermark,
  generateQrPdf,
  generateEntryId,
} from '@/features/utility/utils/qrGenerator'
import {
  QR_SIZE_MAP,
  RECENT_QR_STORAGE_KEY,
  MAX_RECENT_QR_CODES,
  GENERATION_DEBOUNCE_MS,
  type QRErrorCorrectionLevel,
  type QRCodeSize,
  type QRGenerationStatus,
  type RecentQRCode,
} from '@/features/utility/types/qr'
import type { FAQItem } from '@/types/common'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What can I encode in a QR code?',
    answer:
      'You can encode URLs, text, contact information (vCard), WiFi credentials, email addresses, and more. Simply paste your content into the text field. The QR code will be generated entirely in your browser.',
  },
  {
    question: 'Can I add my own logo?',
    answer:
      'Yes! Upload your logo image (PNG with transparency is recommended) and it will be centered in the QR code. The logo is placed inside a white circle to ensure scanability. We recommend using High (H) error correction when adding a logo.',
  },
  {
    question: 'What formats can I download?',
    answer:
      'Download your QR code as PNG (high quality, includes logo and watermark), SVG (vector, plain QR without logo), or PDF (print-ready, includes logo and watermark).',
  },
  {
    question: 'Is my data uploaded to a server?',
    answer:
      'No! All QR codes are generated entirely in your browser using advanced QR code generation technology. Your data never leaves your device — 100% private and secure.',
  },
  {
    question: 'What does the "Powered by SaveVex" text mean?',
    answer:
      'This is a small branding watermark we include to support SaveVex\'s free tools. It\'s placed below the QR code and doesn\'t affect scannability.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Enter your content',
    desc: 'Type or paste a URL, text, or any data you want to encode into a QR code.',
  },
  {
    step: 2,
    title: 'Customize your QR code',
    desc: 'Choose colors, error correction level, size, and optionally upload a logo for branding.',
  },
  {
    step: 3,
    title: 'Download or share',
    desc: 'Download your QR code as PNG, SVG, or PDF — or share it directly using the Web Share API.',
  },
]

const ERROR_CORRECTION_OPTIONS: { level: QRErrorCorrectionLevel; label: string; recovery: string }[] = [
  { level: 'L', label: 'Low', recovery: '7%' },
  { level: 'M', label: 'Medium', recovery: '15%' },
  { level: 'Q', label: 'Quartile', recovery: '25%' },
  { level: 'H', label: 'High', recovery: '30%' },
]

const SIZE_OPTIONS: { size: QRCodeSize; label: string; px: string }[] = [
  { size: 'small', label: 'Small', px: '200px' },
  { size: 'medium', label: 'Medium', px: '400px' },
  { size: 'large', label: 'Large', px: '600px' },
]

const MAX_LOGO_SIZE = 1 * 1024 * 1024 // 1 MB

// ─── Component ─────────────────────────────────────────────────────────────────

export function QRCodeGenerator() {
  // ── State ──────────────────────────────────────────────────────────────────

  const [inputText, setInputText] = useState('')
  const [qrName, setQrName] = useState('')
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState<QRErrorCorrectionLevel>('H')
  const [size, setSize] = useState<QRCodeSize>('medium')
  const [foregroundColor, setForegroundColor] = useState('#000000')
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<QRGenerationStatus>('idle')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrSvgString, setQrSvgString] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [recentQRCodes, setRecentQRCodes] = useState<RecentQRCode[]>([])
  const [isPdfGenerating, setIsPdfGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  // ── Refs ───────────────────────────────────────────────────────────────────

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoPreviewRef = useRef<string | null>(null)

  // ── Effects ────────────────────────────────────────────────────────────────

  // Load recent QR codes from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_QR_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setRecentQRCodes(parsed.slice(0, MAX_RECENT_QR_CODES))
      }
    } catch {
      // Corrupt data — silently reset
    }
  }, [])

  // Cleanup logo preview URLs
  useEffect(() => {
    return () => {
      if (logoPreviewRef.current) {
        URL.revokeObjectURL(logoPreviewRef.current)
        logoPreviewRef.current = null
      }
    }
  }, [])

  // Auto-generate QR on option changes (debounced)
  useEffect(() => {
    const trimmed = inputText.trim()
    if (!trimmed) {
      setStatus('idle')
      setQrDataUrl(null)
      setQrSvgString(null)
      setValidationError(null)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      generateQR()
    }, GENERATION_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText, errorCorrectionLevel, size, foregroundColor, backgroundColor, logoFile])

  // ── Validation ─────────────────────────────────────────────────────────────

  const validateInput = useCallback((value: string): string | null => {
    const trimmed = value.trim()
    if (!trimmed) return null // handled separately in generateQR

    // Check for URL-like text and validate URL structure
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        new URL(trimmed)
        return null // valid URL
      } catch {
        return 'The URL appears to be invalid, but the QR code will still be generated.'
      }
    }

    return null
  }, [])

  // ── Core Generation ────────────────────────────────────────────────────────

  const generateQR = useCallback(async () => {
    const text = inputText.trim()
    if (!text) {
      setValidationError('Please enter text or a URL to generate a QR code.')
      setStatus('idle')
      return
    }

    // Run validation (warning only, doesn't block generation)
    setValidationError(validateInput(text))

    setStatus('generating')
    setErrorMessage(null)

    const pixelWidth = QR_SIZE_MAP[size]
    // Canvas height includes QR area + watermark padding (48 px)
    const canvasHeight = pixelWidth + 48

    try {
      // 1. Render QR code directly to canvas
      const canvas = canvasRef.current
      if (!canvas) {
        throw new Error('Canvas element not found')
      }

      canvas.width = pixelWidth
      canvas.height = canvasHeight

      // Fill canvas background with the user's chosen background color
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = backgroundColor
        ctx.fillRect(0, 0, pixelWidth, pixelWidth)
      }

      await generateQrToCanvas(canvas, text, {
        width: pixelWidth,
        margin: 2,
        darkColor: foregroundColor,
        lightColor: backgroundColor,
        errorCorrectionLevel,
      })

      // 2. Overlay logo if provided
      if (logoFile) {
        await overlayLogo(canvas, logoFile)
      }

      // 3. Draw "Powered by SaveVex" watermark
      drawWatermark(canvas)

      // 4. Extract final data URL from canvas
      const finalDataUrl = canvas.toDataURL('image/png', 0.95)
      setQrDataUrl(finalDataUrl)

      // 5. Generate SVG string (no logo/watermark)
      const svg = await generateQrSvgString(text, {
        width: pixelWidth,
        margin: 2,
        darkColor: foregroundColor,
        lightColor: backgroundColor,
        errorCorrectionLevel,
      })
      setQrSvgString(svg)

      setStatus('complete')
    } catch (err) {
      setStatus('error')
      const message = err instanceof Error ? err.message : 'Failed to generate QR code.'
      // Provide user-friendly guidance for common errors
      if (message.includes('too long') || message.includes('capacity')) {
        setErrorMessage(
          'The text is too long for the selected error correction level. Try a lower error correction level (L or M) for longer text, or reduce the amount of data.',
        )
      } else {
        setErrorMessage(message)
      }
    }
  }, [inputText, qrName, errorCorrectionLevel, size, foregroundColor, backgroundColor, logoFile, validateInput])

  // ── Input Handlers ─────────────────────────────────────────────────────────

  const handleInputChange = useCallback(
    (value: string) => {
      setInputText(value)
      if (!value.trim()) {
        setValidationError(null)
      }
    },
    [],
  )

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      // Validate size
      if (file.size > MAX_LOGO_SIZE) {
        setValidationError('Logo image must be under 1 MB.')
        return
      }

      // Revoke previous preview URL
      if (logoPreviewRef.current) {
        URL.revokeObjectURL(logoPreviewRef.current)
      }

      const previewUrl = URL.createObjectURL(file)
      logoPreviewRef.current = previewUrl
      setLogoFile(file)
      setLogoPreviewUrl(previewUrl)
      setValidationError(null)
    },
    [],
  )

  const handleRemoveLogo = useCallback(() => {
    if (logoPreviewRef.current) {
      URL.revokeObjectURL(logoPreviewRef.current)
      logoPreviewRef.current = null
    }
    setLogoFile(null)
    setLogoPreviewUrl(null)
  }, [])

  const handleRetry = useCallback(() => {
    generateQR()
  }, [generateQR])

  // ── Save to Recent ──────────────────────────────────────────────────────────

  const saveCurrentQRToRecent = useCallback(() => {
    if (!qrDataUrl || !inputText.trim()) return

    const entry: RecentQRCode = {
      id: generateEntryId(),
      inputText: inputText.trim(),
      qrName: qrName.trim() || 'Unnamed',
      qrDataUrl: qrDataUrl,
      createdAt: new Date().toISOString(),
    }

    setRecentQRCodes(prev => {
      // Deduplicate by input text
      const filtered = prev.filter(r => r.inputText !== entry.inputText)
      const updated = [entry, ...filtered].slice(0, MAX_RECENT_QR_CODES)
      try {
        localStorage.setItem(RECENT_QR_STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // localStorage quota exceeded — silently ignore
      }
      return updated
    })
  }, [qrDataUrl, inputText, qrName])

  // ── Download Handlers ──────────────────────────────────────────────────────

  const handleDownloadPNG = useCallback(() => {
    if (!qrDataUrl) return
    saveCurrentQRToRecent()
    const filename = qrName.trim()
      ? getSaveVexFileName(`${qrName.trim().replace(/[^a-zA-Z0-9\-_\s]/g, '')}.png`)
      : getSaveVexFileName('qr-code.png')
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [qrDataUrl, qrName, saveCurrentQRToRecent])

  const handleDownloadSVG = useCallback(() => {
    if (!qrSvgString) return
    saveCurrentQRToRecent()
    const filename = qrName.trim()
      ? getSaveVexFileName(`${qrName.trim().replace(/[^a-zA-Z0-9\-_\s]/g, '')}.svg`)
      : getSaveVexFileName('qr-code.svg')
    const blob = new Blob([qrSvgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [qrSvgString, qrName, saveCurrentQRToRecent])

  const handleDownloadPDF = useCallback(async () => {
    if (!qrDataUrl) return
    saveCurrentQRToRecent()
    setIsPdfGenerating(true)
    try {
      const pdfBytes = await generateQrPdf(qrDataUrl)
      const filename = qrName.trim()
        ? getSaveVexFileName(`${qrName.trim().replace(/[^a-zA-Z0-9\-_\s]/g, '')}.pdf`)
        : getSaveVexFileName('qr-code.pdf')
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setErrorMessage('PDF generation failed. Please try downloading as PNG instead.')
    } finally {
      setIsPdfGenerating(false)
    }
  }, [qrDataUrl, qrName, saveCurrentQRToRecent])

  const handleShare = useCallback(async () => {
    if (!qrDataUrl) return
    try {
      const response = await fetch(qrDataUrl)
      const blob = await response.blob()
      const filename = qrName.trim()
        ? getSaveVexFileName(`${qrName.trim().replace(/[^a-zA-Z0-9\-_\s]/g, '')}.png`)
        : getSaveVexFileName('qr-code.png')
      const file = new File([blob], filename, { type: 'image/png' })
      await navigator.share({
        files: [file],
        title: qrName || 'QR Code',
        text: inputText,
      })
      saveCurrentQRToRecent()
    } catch (err) {
      // AbortError = user cancelled, silently ignore
      if (err instanceof Error && err.name !== 'AbortError') {
        setErrorMessage('Sharing failed. Please try downloading instead.')
      }
    }
  }, [qrDataUrl, qrName, inputText, saveCurrentQRToRecent])

  const handleCopyImage = useCallback(async () => {
    if (!qrDataUrl) return
    try {
      const response = await fetch(qrDataUrl)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: open in new tab for user to copy manually
      window.open(qrDataUrl, '_blank')
    }
  }, [qrDataUrl])

  const handleRecentClick = useCallback((item: RecentQRCode) => {
    setInputText(item.inputText)
    setQrName(item.qrName === '(unnamed)' ? '' : item.qrName)
  }, [])

  // ── Derived Values ─────────────────────────────────────────────────────────

  const showShareButton = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const showLogoWarning = logoFile !== null && (errorCorrectionLevel === 'L' || errorCorrectionLevel === 'M')

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ════════════════════════════════════════════════════════════════
            LEFT COLUMN — Main content
           ════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-8">
          {/* ── Input Section ─────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Content</h3>
            </div>

            <div>
              <label htmlFor="qr-input-text" className="text-sm font-medium">
                Text or URL <span className="text-destructive">*</span>
              </label>
              <textarea
                id="qr-input-text"
                className="w-full mt-1 px-4 py-3 rounded-lg border border-border bg-background min-h-[100px] resize-y text-sm"
                placeholder="https://example.com or any text you want to encode..."
                value={inputText}
                onChange={e => handleInputChange(e.target.value)}
              />
              {validationError && (
                <p
                  className={`text-xs mt-1.5 flex items-center gap-1.5 ${
                    validationError.startsWith('Please enter')
                      ? 'text-destructive'
                      : 'text-amber-500'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  {validationError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="qr-input-name" className="text-sm font-medium">
                QR Name <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="qr-input-name"
                type="text"
                className="w-full mt-1 px-4 py-2.5 rounded-lg border border-border bg-background text-sm"
                placeholder="e.g. My Website QR"
                value={qrName}
                onChange={e => setQrName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used for the download filename. Leave blank for &quot;qr-code&quot;.
              </p>
            </div>
          </div>

          {/* ── Preview Section ───────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Preview</h3>

            {status === 'idle' && (
              <div className="py-16 text-center text-muted-foreground">
                <QrCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-sm">Enter text above to generate a QR code</p>
              </div>
            )}

            {status === 'generating' && (
              <ProcessingStatus message="Generating QR code..." />
            )}

            {status === 'complete' && qrDataUrl && (
              <div className="flex flex-col items-center">
                <img
                  src={qrDataUrl}
                  alt={qrName || 'Generated QR Code'}
                  className="max-w-full rounded-lg"
                  style={{ maxHeight: QR_SIZE_MAP[size] + 48 }}
                />
                <p className="text-xs text-muted-foreground mt-3">
                  Preview includes &quot;Powered by SaveVex&quot; watermark
                </p>
              </div>
            )}

            {status === 'error' && (
              <ErrorCard
                title="Generation failed"
                message={errorMessage ?? 'An unexpected error occurred.'}
                onRetry={handleRetry}
              />
            )}

            {/* Hidden canvas used for logo + watermark compositing */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* ── Action Buttons ─────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleDownloadPNG}
              disabled={status !== 'complete'}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download PNG
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadSVG}
              disabled={status !== 'complete'}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download SVG
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={status !== 'complete' || isPdfGenerating}
            >
              <Download className="w-4 h-4 mr-1.5" />
              {isPdfGenerating ? 'Generating PDF...' : 'Download PDF'}
            </Button>
            {showShareButton && (
              <Button
                variant="secondary"
                onClick={handleShare}
                disabled={status !== 'complete'}
              >
                <Share2 className="w-4 h-4 mr-1.5" />
                Share
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={handleCopyImage}
              disabled={status !== 'complete'}
            >
              {copied ? (
                <Check className="w-4 h-4 mr-1.5 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 mr-1.5" />
              )}
              {copied ? 'Copied!' : 'Copy Image'}
            </Button>
          </div>

          {/* ── How To Use ─────────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-bold mb-6">How to Use QR Code Generator</h2>
            <ol className="space-y-4">
              {HOW_TO_STEPS.map(({ step, title, desc }) => (
                <li key={step} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                    {step}
                  </span>
                  <div>
                    <h4 className="font-semibold">{title}</h4>
                    <p className="text-muted-foreground text-sm">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* ── Recent QR Codes ────────────────────────────────────────── */}
          {recentQRCodes.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold mb-4">
                Recent QR Codes
                <span className="text-xs text-muted-foreground ml-2 font-normal">
                  (stored locally)
                </span>
              </h3>
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
                {recentQRCodes.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                    onClick={() => handleRecentClick(item)}
                    title={`Restore: ${item.inputText}`}
                  >
                    <img
                      src={item.qrDataUrl}
                      alt=""
                      className="w-12 h-12 rounded-lg border border-border flex-shrink-0 object-contain bg-white"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.qrName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.inputText}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── FAQ ─────────────────────────────────────────────────────── */}
          <div>
            <FAQSection
              faqs={TOOL_FAQS}
              title="Frequently Asked Questions"
              description=""
            />
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT COLUMN — Sidebar options
           ════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            {/* ── Colors ───────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="font-semibold">Colors</h3>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="qr-fg-color" className="text-sm font-medium">
                  Foreground
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    {foregroundColor}
                  </span>
                  <input
                    id="qr-fg-color"
                    type="color"
                    value={foregroundColor}
                    onChange={e => setForegroundColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-border cursor-pointer p-0.5"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="qr-bg-color" className="text-sm font-medium">
                  Background
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    {backgroundColor}
                  </span>
                  <input
                    id="qr-bg-color"
                    type="color"
                    value={backgroundColor}
                    onChange={e => setBackgroundColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-border cursor-pointer p-0.5"
                  />
                </div>
              </div>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  setForegroundColor('#000000')
                  setBackgroundColor('#FFFFFF')
                }}
              >
                Reset to defaults
              </button>
            </div>

            {/* ── Error Correction Level ────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Error Correction</h3>
              <div className="grid grid-cols-2 gap-2">
                {ERROR_CORRECTION_OPTIONS.map(({ level, label, recovery }) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setErrorCorrectionLevel(level)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      errorCorrectionLevel === level
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:border-primary/50'
                    }`}
                  >
                    <span className="block text-xs opacity-70">{label}</span>
                    <span>{recovery}</span>
                  </button>
                ))}
              </div>
              {showLogoWarning && (
                <p className="text-xs text-amber-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  With a logo, H or Q error correction is recommended for better scanability.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Higher correction recovers more damaged data but stores less total content.
              </p>
            </div>

            {/* ── Size ──────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Size</h3>
              <div className="flex gap-2">
                {SIZE_OPTIONS.map(({ size: s, label, px }) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      size === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:border-primary/50'
                    }`}
                  >
                    <span className="block text-xs opacity-70">{label}</span>
                    <span>{px}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Logo Upload ───────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">
                Logo <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </h3>

              {logoFile && logoPreviewUrl ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <img
                    src={logoPreviewUrl}
                    alt="Logo preview"
                    className="w-12 h-12 object-contain rounded-lg border border-border bg-white"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{logoFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(logoFile.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-destructive hover:text-destructive/80 transition-colors p-1"
                    title="Remove logo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to upload logo</span>
                  <span className="text-xs text-muted-foreground">
                    PNG, JPG, SVG &mdash; max 1 MB
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleLogoUpload}
                  />
                </label>
              )}

              <p className="text-xs text-muted-foreground">
                The logo is centered inside a white circle. PNG with transparency works best.
              </p>
            </div>

            {/* ── Tips ──────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>Test the QR code before printing to ensure it scans correctly with your device.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>Higher error correction (<strong>H</strong> or <strong>Q</strong>) is essential when adding a logo.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>Use high-contrast colors — the foreground should be much darker than the background.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>All processing happens in your browser. Nothing is uploaded to a server.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
