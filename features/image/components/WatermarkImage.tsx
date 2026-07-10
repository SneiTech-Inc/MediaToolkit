'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, RotateCcw, Type, ImageIcon } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { loadImage, applyTextWatermark, applyImageWatermark } from '@/features/image/utils/imageProcessing'
import { formatBytes } from '@/utils/formatBytes'
import type { OutputFormat, ResizeResult } from '@/features/image/types'
import type { WatermarkPosition, TextWatermarkOptions, ImageWatermarkOptions } from '@/features/image/utils/imageProcessing'

const ACCEPTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']
const WM_ACCEPTED = ['png', 'webp', 'jpg', 'jpeg']
const MAX_PREVIEW_WIDTH = 600

const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
]

const POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: 'center', label: 'Center' },
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
]

const TOOL_FAQS = [
  {
    question: 'How does watermarking work?',
    answer: 'SaveVex applies watermarks entirely in your browser using browser-native rendering technology. Your image and watermark are composited locally — no data is ever uploaded to any server. Your files remain 100% private and secure.',
  },
  {
    question: 'What types of watermarks can I add?',
    answer: 'You can add text watermarks (customizable font, size, color, rotation) or image watermarks (upload a logo or icon, typically a transparent PNG). Both types support opacity control and nine positioning options.',
  },
  {
    question: 'Can I use a transparent PNG as a logo watermark?',
    answer: 'Yes! Upload a PNG with transparency for the best results. The watermark will preserve its transparency when overlaid on your image. WebP with transparency is also supported.',
  },
  {
    question: 'Will the watermark reduce image quality?',
    answer: 'Drawing the watermark onto your image is a compositing operation — the underlying image pixels are preserved. The output quality depends on your chosen format (PNG is lossless, JPEG/WebP use compression).',
  },
]

const DEFAULT_TEXT = '© SaveVex'

// ─── Fast preview renderer (downscaled, no file I/O) ─────────────────────────

function calculatePosition(
  canvasW: number, canvasH: number,
  wmW: number, wmH: number,
  position: WatermarkPosition, padding: number
): { x: number; y: number } {
  switch (position) {
    case 'center': return { x: (canvasW - wmW) / 2, y: (canvasH - wmH) / 2 }
    case 'top-left': return { x: padding, y: padding }
    case 'top-right': return { x: canvasW - wmW - padding, y: padding }
    case 'bottom-left': return { x: padding, y: canvasH - wmH - padding }
    case 'bottom-right': return { x: canvasW - wmW - padding, y: canvasH - wmH - padding }
  }
}

/**
 * Render a fast downscaled preview onto a canvas (max 600px wide).
 * Uses cached HTMLImageElements — no file loading, no Blob creation.
 * Returns a data URL for immediate <img> display.
 */
function renderPreview(
  mainImage: HTMLImageElement,
  wmType: 'text' | 'image',
  wmImage: HTMLImageElement | null,
  textOpts: { text: string; fontSize: number; color: string; rotation: number },
  wmScale: number,
  position: WatermarkPosition,
  opacity: number,
  padding: number
): string {
  const origW = mainImage.naturalWidth
  const origH = mainImage.naturalHeight

  // Downscale
  const scale = Math.min(1, MAX_PREVIEW_WIDTH / origW)
  const cw = Math.round(origW * scale)
  const ch = Math.round(origH * scale)

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!

  // Draw main image at preview scale
  ctx.drawImage(mainImage, 0, 0, cw, ch)

  const alpha = opacity / 100

  if (wmType === 'text') {
    // Scale font size to preview dimensions
    const scaledFontSize = Math.max(8, Math.round(textOpts.fontSize * scale))
    ctx.font = `${scaledFontSize}px system-ui, sans-serif`
    ctx.fillStyle = textOpts.color
    ctx.globalAlpha = alpha
    ctx.textBaseline = 'middle'

    const metrics = ctx.measureText(textOpts.text)
    const tw = metrics.width
    const th = scaledFontSize
    const pos = calculatePosition(cw, ch, tw, th, position, Math.round(padding * scale))

    ctx.save()
    ctx.translate(pos.x + tw / 2, pos.y + th / 2)
    ctx.rotate((textOpts.rotation * Math.PI) / 180)
    ctx.textAlign = 'center'
    ctx.fillText(textOpts.text, 0, 0)
    ctx.restore()
  } else if (wmType === 'image' && wmImage) {
    const wmOrigW = wmImage.naturalWidth
    const wmOrigH = wmImage.naturalHeight
    let wmW = Math.round(wmOrigW * (wmScale / 100) * scale)
    let wmH = Math.round(wmOrigH * (wmScale / 100) * scale)

    // Cap at 50% of preview canvas
    const maxW = cw * 0.5
    const maxH = ch * 0.5
    const shrink = Math.min(1, maxW / wmW, maxH / wmH)
    wmW = Math.round(wmW * shrink)
    wmH = Math.round(wmH * shrink)

    const pos = calculatePosition(cw, ch, wmW, wmH, position, Math.round(padding * scale))

    ctx.globalAlpha = alpha
    ctx.drawImage(wmImage, pos.x, pos.y, wmW, wmH)
  }

  ctx.globalAlpha = 1
  return canvas.toDataURL()
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WatermarkImage() {
  // Main image
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ResizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null) // fast downscaled preview

  // Cached images (loaded once, reused for every preview frame)
  const mainImageRef = useRef<HTMLImageElement | null>(null)
  const wmImageRef = useRef<HTMLImageElement | null>(null)
  const rafRef = useRef<number | null>(null)

  // Type toggle
  const [wmType, setWmType] = useState<'text' | 'image'>('text')

  // Text options
  const [text, setText] = useState(DEFAULT_TEXT)
  const [fontSize, setFontSize] = useState(48)
  const [color, setColor] = useState('#ffffff')
  const [textRotation, setTextRotation] = useState(0)

  // Image watermark options
  const [wmFile, setWmFile] = useState<File | null>(null)
  const [wmScale, setWmScale] = useState(30)

  // Common options
  const [position, setPosition] = useState<WatermarkPosition>('center')
  const [opacity, setOpacity] = useState(50)
  const [padding, setPadding] = useState(20)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg')

  // Cleanup all object URLs on unmount
  useEffect(() => {
    return () => {
      if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
      if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Fast preview (rAF-throttled, downscaled) ────────────────────────────

  const schedulePreview = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (!mainImageRef.current) return

      const dataUrl = renderPreview(
        mainImageRef.current,
        wmType,
        wmImageRef.current,
        { text: text || DEFAULT_TEXT, fontSize, color, rotation: textRotation },
        wmScale, position, opacity, padding
      )
      setPreviewUrl(dataUrl)
    })
  }, [wmType, text, fontSize, color, textRotation, wmScale, position, opacity, padding])

  // Schedule preview on any option change
  useEffect(() => { schedulePreview() }, [schedulePreview])

  // ── Image loading (cache in refs) ────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: File) => {
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)

    setError(null)
    setResult(null)
    setOriginalFile(file)
    setOriginalPreviewUrl(URL.createObjectURL(file))

    try {
      mainImageRef.current = await loadImage(file)
      schedulePreview()
    } catch {
      setError('Failed to load image. The file may be corrupted or too large.')
    }
  }, [originalPreviewUrl, result, schedulePreview])

  const handleWmFileSelect = useCallback(async (file: File) => {
    setWmFile(file)
    try {
      wmImageRef.current = await loadImage(file)
      schedulePreview()
    } catch {
      setError('Failed to load watermark image.')
    }
  }, [schedulePreview])

  // ── Full-res download ───────────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    if (!originalFile) return

    setIsProcessing(true)
    setError(null)
    try {
      let res: ResizeResult
      if (wmType === 'text') {
        const opts: TextWatermarkOptions = {
          text: text || DEFAULT_TEXT, fontSize, color,
          rotation: textRotation, position, opacity: opacity / 100, padding,
        }
        res = await applyTextWatermark(originalFile, opts, outputFormat)
      } else {
        if (!wmFile) return
        const opts: ImageWatermarkOptions = {
          watermarkFile: wmFile,
          scale: wmScale / 100, position, opacity: opacity / 100, padding,
        }
        res = await applyImageWatermark(originalFile, opts, outputFormat)
      }
      setResult(res)

      // Trigger browser download
      const ext = outputFormat === 'image/jpeg' ? 'jpg' : outputFormat === 'image/webp' ? 'webp' : 'png'
      const baseName = originalFile.name.replace(/\.[^.]+$/, '')
      const url = URL.createObjectURL(res.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${baseName}-watermarked.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Watermark failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [originalFile, wmType, text, fontSize, color, textRotation, position, opacity, padding, wmFile, wmScale, outputFormat])

  // ── Reset ───────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    mainImageRef.current = null
    wmImageRef.current = null

    setOriginalFile(null)
    setOriginalPreviewUrl(null)
    setPreviewUrl(null)
    setResult(null)
    setError(null)
    setText(DEFAULT_TEXT)
    setFontSize(48)
    setColor('#ffffff')
    setTextRotation(0)
    setWmFile(null)
    setWmScale(30)
    setPosition('center')
    setOpacity(50)
    setPadding(20)
    setOutputFormat('image/jpeg')
    setWmType('text')
  }, [originalPreviewUrl, result])

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Watermark Failed" message={error} onRetry={handleDownload} />}

          {!originalFile ? (
            <UploadDropzone acceptedFormats={ACCEPTED_FORMATS} onFileSelect={handleFileSelect} />
          ) : (
            <div className="space-y-6">
              {/* Preview — uses fast downscaled data URL, not full-res blob */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                  <span className="text-sm font-medium">Preview</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {originalFile.name} — {formatBytes(originalFile.size)}
                  </span>
                </div>
                <div className="p-6 flex items-center justify-center bg-muted/10 min-h-[300px]">
                  {isProcessing ? (
                    <ProcessingStatus message="Generating full-resolution output..." />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={previewUrl || originalPreviewUrl || ''}
                      alt="Preview"
                      className="max-w-full max-h-[400px] object-contain rounded-lg"
                    />
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" className="bg-primary hover:bg-primary/90 flex-1" onClick={handleDownload} disabled={!originalFile || isProcessing}>
                  <Download className="w-4 h-4 mr-2" />Download Watermarked Image
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />Reset
                </Button>
              </div>
            </div>
          )}

          {/* How To Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Add a Watermark</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload your image', desc: 'Click the upload area to select the image you want to watermark.' },
                { step: 2, title: 'Choose watermark type', desc: 'Select text watermark (customizable text, font, color) or image watermark (upload a logo/icon).' },
                { step: 3, title: 'Adjust & download', desc: 'Set position, opacity, and other options. Preview updates live. Click Download when ready.' },
              ].map((item) => (
                <li key={item.step} className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">{item.step}</span>
                  <div><h4 className="font-semibold">{item.title}</h4><p className="text-muted-foreground text-sm">{item.desc}</p></div>
                </li>
              ))}
            </ol>
          </div>

          {/* FAQ */}
          <div className="mt-12">
            <FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" />
          </div>
        </div>

        {/* Right Column — Controls */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            {/* Watermark Type Tabs */}
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-4">Watermark Type</h3>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setWmType('text')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                    wmType === 'text' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'
                  }`}
                >
                  <Type className="w-4 h-4" /> Text
                </button>
                <button
                  onClick={() => setWmType('image')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                    wmType === 'image' ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" /> Image
                </button>
              </div>
            </div>

            {/* Type-specific options */}
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-4">
                {wmType === 'text' ? 'Text Watermark' : 'Image Watermark'}
              </h3>

              {wmType === 'text' ? (
                <>
                  <div className="mb-4">
                    <label className="text-sm font-medium">Text</label>
                    <input type="text" value={text} onChange={(e) => setText(e.target.value)}
                      className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                      disabled={!originalFile} placeholder="© SaveVex" />
                  </div>
                  <div className="mb-4">
                    <label className="text-sm font-medium flex justify-between">
                      <span>Font Size</span><span className="text-primary">{fontSize}px</span>
                    </label>
                    <input type="range" min="12" max="120" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full mt-2 accent-primary" disabled={!originalFile} />
                  </div>
                  <div className="mb-4">
                    <label className="text-sm font-medium">Color</label>
                    <div className="flex items-center gap-2 mt-2">
                      <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                        className="w-10 h-10 rounded border border-border cursor-pointer" disabled={!originalFile} />
                      <span className="text-xs text-muted-foreground">{color}</span>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="text-sm font-medium flex justify-between">
                      <span>Rotation</span><span className="text-primary">{textRotation}°</span>
                    </label>
                    <input type="range" min="0" max="360" value={textRotation} onChange={(e) => setTextRotation(Number(e.target.value))}
                      className="w-full mt-2 accent-primary" disabled={!originalFile} />
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="text-sm font-medium">Watermark Logo</label>
                    {!wmFile ? (
                      <div className="mt-2">
                        <UploadDropzone acceptedFormats={WM_ACCEPTED} onFileSelect={handleWmFileSelect} disabled={!originalFile} />
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                        <span className="text-sm truncate flex-1">{wmFile.name}</span>
                        <button onClick={() => { wmImageRef.current = null; setWmFile(null); schedulePreview() }}
                          className="text-xs text-destructive hover:underline ml-2">Remove</button>
                      </div>
                    )}
                  </div>
                  <div className="mb-4">
                    <label className="text-sm font-medium flex justify-between">
                      <span>Size</span><span className="text-primary">{wmScale}%</span>
                    </label>
                    <input type="range" min="5" max="100" value={wmScale} onChange={(e) => setWmScale(Number(e.target.value))}
                      className="w-full mt-2 accent-primary" disabled={!originalFile || !wmFile} />
                  </div>
                </>
              )}
            </div>

            {/* Common Options */}
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-4">Common Settings</h3>

              <div className="mb-4">
                <label className="text-sm font-medium">Position</label>
                <select value={position} onChange={(e) => setPosition(e.target.value as WatermarkPosition)}
                  className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm" disabled={!originalFile}>
                  {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium flex justify-between">
                  <span>Opacity</span><span className="text-primary">{opacity}%</span>
                </label>
                <input type="range" min="5" max="100" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full mt-2 accent-primary" disabled={!originalFile} />
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium flex justify-between">
                  <span>Edge Padding</span><span className="text-primary">{padding}px</span>
                </label>
                <input type="range" min="0" max="100" value={padding} onChange={(e) => setPadding(Number(e.target.value))}
                  className="w-full mt-2 accent-primary" disabled={!originalFile} />
              </div>

              <div>
                <label className="text-sm font-medium">Output Format</label>
                <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                  className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  disabled={!originalFile || isProcessing}>
                  {OUTPUT_FORMATS.map((fmt) => <option key={fmt.value} value={fmt.value}>{fmt.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
