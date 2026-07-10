'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { loadImage, blurImage } from '@/features/image/utils/imageProcessing'
import { formatBytes } from '@/utils/formatBytes'
import type { OutputFormat, ResizeResult } from '@/features/image/types'

const ACCEPTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']
const MAX_PREVIEW_WIDTH = 600

const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
]

const TOOL_FAQS = [
  {
    question: 'How does image blur work?',
    answer: 'SaveVex blurs your images entirely in your browser using browser-native rendering technology. The blur effect is applied mathematically — no data is ever uploaded to any server. Your files remain 100% private and secure.',
  },
  {
    question: 'What is image blur used for?',
    answer: 'Blur is commonly used to obscure sensitive information (license plates, faces, personal data), create background effects for text overlays, or add artistic depth-of-field effects to photos.',
  },
  {
    question: 'Can I control how much blur is applied?',
    answer: 'Yes! Use the slider to set the blur radius from 0px (no blur) to 20px (extreme blur). The preview updates in real-time as you drag.',
  },
  {
    question: 'Does blurring reduce image quality?',
    answer: 'Blur intentionally reduces detail — that\'s the point! The underlying image dimensions remain the same. For best output quality when saving, use PNG format.',
  },
]

/**
 * Fast downscaled blur preview using cached image + Canvas filter API.
 * No file I/O, no Blob — returns a data URL for immediate <img> display.
 */
function renderPreview(mainImage: HTMLImageElement, radius: number): string {
  const origW = mainImage.naturalWidth
  const origH = mainImage.naturalHeight
  const scale = Math.min(1, MAX_PREVIEW_WIDTH / origW)
  const cw = Math.round(origW * scale)
  const ch = Math.round(origH * scale)

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!

  if (radius > 0) {
    // Scale blur radius proportionally to preview size
    ctx.filter = `blur(${radius * scale}px)`
  }
  ctx.drawImage(mainImage, 0, 0, cw, ch)
  return canvas.toDataURL()
}

/**
 * Blur Image tool.
 *
 * Flow: Upload → Adjust blur slider → Preview (live) → Download (full-res)
 */
export function ImageBlur() {
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null)
  const [radius, setRadius] = useState(5)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ResizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const mainImageRef = useRef<HTMLImageElement | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
      if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Fast rAF-throttled preview ──────────────────────────────────────────

  const schedulePreview = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (!mainImageRef.current) return
      setPreviewUrl(renderPreview(mainImageRef.current, radius))
    })
  }, [radius])

  useEffect(() => { schedulePreview() }, [schedulePreview])

  // ── Upload: cache image in ref ──────────────────────────────────────────

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
      setError('Failed to load image.')
    }
  }, [originalPreviewUrl, result, schedulePreview])

  // ── Download: full-res render ───────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    if (!originalFile) return
    setIsProcessing(true)
    setError(null)
    try {
      const res = await blurImage(originalFile, radius, outputFormat)
      setResult(res)
      const ext = outputFormat === 'image/jpeg' ? 'jpg' : outputFormat === 'image/webp' ? 'webp' : 'png'
      const baseName = originalFile.name.replace(/\.[^.]+$/, '')
      const url = URL.createObjectURL(res.blob)
      const a = document.createElement('a')
      a.href = url; a.download = getSaveVexFileName(`${baseName}.${ext}`)
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Blur failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [originalFile, radius, outputFormat])

  const handleReset = useCallback(() => {
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    mainImageRef.current = null
    setOriginalFile(null); setOriginalPreviewUrl(null); setPreviewUrl(null)
    setResult(null); setError(null); setRadius(5); setOutputFormat('image/jpeg')
  }, [originalPreviewUrl, result])

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Blur Failed" message={error} onRetry={handleDownload} />}

          {!originalFile ? (
            <UploadDropzone acceptedFormats={ACCEPTED_FORMATS} onFileSelect={handleFileSelect} />
          ) : (
            <div className="space-y-6">
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                  <span className="text-sm font-medium">Preview</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    Blur: {radius}px · {originalFile.name}
                  </span>
                </div>
                <div className="p-6 flex items-center justify-center bg-muted/10 min-h-[300px]">
                  {isProcessing ? (
                    <ProcessingStatus message="Generating full-resolution output..." />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={previewUrl || originalPreviewUrl || ''} alt="Preview"
                      className="max-w-full max-h-[400px] object-contain rounded-lg" />
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" className="bg-primary hover:bg-primary/90 flex-1" onClick={handleDownload}
                  disabled={!originalFile || isProcessing}>
                  <Download className="w-4 h-4 mr-2" />Download Blurred Image
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />Reset
                </Button>
              </div>
            </div>
          )}

          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Blur an Image</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload your image', desc: 'Click the upload area or drag and drop a JPEG, PNG, WebP, GIF, or BMP file.' },
                { step: 2, title: 'Adjust blur intensity', desc: 'Drag the slider to set the blur radius (0–20px). Preview updates live as you drag.' },
                { step: 3, title: 'Download', desc: 'Click Download to generate the full-resolution blurred image.' },
              ].map((item) => (
                <li key={item.step} className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">{item.step}</span>
                  <div><h4 className="font-semibold">{item.title}</h4><p className="text-muted-foreground text-sm">{item.desc}</p></div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-12">
            <FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" />
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-6">Blur Intensity</h3>

              <div className="mb-4">
                <label className="text-sm font-medium flex justify-between">
                  <span>Radius</span><span className="text-primary font-semibold">{radius}px</span>
                </label>
                <input type="range" min="0" max="20" step="0.5" value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full mt-2 accent-primary" disabled={!originalFile} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>No blur</span><span>Extreme blur</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium">Output Format</label>
                <select value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
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
