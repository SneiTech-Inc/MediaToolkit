'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { loadImage, addBorder } from '@/features/image/utils/imageProcessing'
import { formatBytes } from '@/utils/formatBytes'
import type { OutputFormat, ResizeResult } from '@/features/image/types'
import type { BorderOptions } from '@/features/image/utils/imageProcessing'

const ACCEPTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']
const MAX_PREVIEW_WIDTH = 600

const STYLES: { value: BorderOptions['style']; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
]

const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
]

const TOOL_FAQS = [
  { question: 'How does adding a border work?', answer: 'SaveVex adds borders entirely in your browser using browser-native rendering technology. The image is drawn centered on a larger canvas filled with your chosen border color. No data is ever uploaded to any server.' },
  { question: 'What border styles are available?', answer: 'Solid (continuous line), Dashed (long dashes), and Dotted (small dots). You can also round the corners using the radius slider for a softer, frame-like look.' },
  { question: 'Can I make rounded corners with the border?', answer: 'Yes! Use the Corner Radius slider to curve the border corners. The image itself will also be clipped to match, giving a polished rounded look.' },
  { question: 'Does adding a border reduce image quality?', answer: 'The inner image is drawn at its original resolution — no quality is lost. The final dimensions increase by (border width × 2), so very thick borders create larger output files.' },
]

function renderPreview(mainImage: HTMLImageElement, opts: BorderOptions): string {
  const origW = mainImage.naturalWidth
  const origH = mainImage.naturalHeight
  const scale = Math.min(1, MAX_PREVIEW_WIDTH / (origW + opts.width * 2))
  const bw = Math.round(opts.width * scale)
  const cw = Math.round(origW * scale) + bw * 2
  const ch = Math.round(origH * scale) + bw * 2
  const r = Math.min(Math.round(opts.radius * scale), cw / 2, ch / 2)

  const canvas = document.createElement('canvas')
  canvas.width = cw; canvas.height = ch
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = opts.color
  if (r > 0) {
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(0, 0, cw, ch, r)
    else { ctx.rect(0, 0, cw, ch) }
    ctx.fill()
  } else {
    ctx.fillRect(0, 0, cw, ch)
  }

  // Dash for preview
  if (opts.style === 'dashed') ctx.setLineDash([bw * 0.8, bw * 0.6])
  else if (opts.style === 'dotted') ctx.setLineDash([bw * 0.3, bw * 0.6])

  const iw = Math.round(origW * scale)
  const ih = Math.round(origH * scale)
  if (r > 0) {
    ctx.save()
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(bw, bw, iw, ih, Math.max(0, r - bw))
    else ctx.rect(bw, bw, iw, ih)
    ctx.clip()
  }
  ctx.drawImage(mainImage, bw, bw, iw, ih)
  if (r > 0) ctx.restore()

  return canvas.toDataURL()
}

export function AddBorder() {
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null)
  const [width, setWidth] = useState(20)
  const [color, setColor] = useState('#000000')
  const [style, setStyle] = useState<BorderOptions['style']>('solid')
  const [radius, setRadius] = useState(0)
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

  const schedulePreview = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      if (!mainImageRef.current) return
      setPreviewUrl(renderPreview(mainImageRef.current, { width, color, style, radius }))
    })
  }, [width, color, style, radius])

  useEffect(() => { schedulePreview() }, [schedulePreview])

  const handleFileSelect = useCallback(async (file: File) => {
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
    setError(null); setResult(null)
    setOriginalFile(file)
    setOriginalPreviewUrl(URL.createObjectURL(file))
    try { mainImageRef.current = await loadImage(file); schedulePreview() }
    catch { setError('Failed to load image.') }
  }, [originalPreviewUrl, result, schedulePreview])

  const handleDownload = useCallback(async () => {
    if (!originalFile) return
    setIsProcessing(true); setError(null)
    try {
      const res = await addBorder(originalFile, { width, color, style, radius }, outputFormat)
      setResult(res)
      const ext = outputFormat === 'image/jpeg' ? 'jpg' : outputFormat === 'image/webp' ? 'webp' : 'png'
      const baseName = originalFile.name.replace(/\.[^.]+$/, '')
      const url = URL.createObjectURL(res.blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${baseName}-bordered.${ext}`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) { setError(err instanceof Error ? err.message : 'Border failed.') }
    finally { setIsProcessing(false) }
  }, [originalFile, width, color, style, radius, outputFormat])

  const handleReset = useCallback(() => {
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    mainImageRef.current = null
    setOriginalFile(null); setOriginalPreviewUrl(null); setPreviewUrl(null)
    setResult(null); setError(null)
    setWidth(20); setColor('#000000'); setStyle('solid'); setRadius(0); setOutputFormat('image/jpeg')
  }, [originalPreviewUrl, result])

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {error && <ErrorCard title="Border Failed" message={error} onRetry={handleDownload} />}
          {!originalFile ? (
            <UploadDropzone acceptedFormats={ACCEPTED_FORMATS} onFileSelect={handleFileSelect} />
          ) : (
            <div className="space-y-6">
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                  <span className="text-sm font-medium">Preview</span>
                  <span className="ml-2 text-xs text-muted-foreground">{originalFile.name}</span>
                </div>
                <div className="p-6 flex items-center justify-center bg-muted/10 min-h-[300px]">
                  {isProcessing ? <ProcessingStatus message="Generating full-resolution output..." /> : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={previewUrl || originalPreviewUrl || ''} alt="Preview" className="max-w-full max-h-[400px] object-contain rounded-lg" />
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" className="bg-primary hover:bg-primary/90 flex-1" onClick={handleDownload} disabled={!originalFile || isProcessing}>
                  <Download className="w-4 h-4 mr-2" />Download Bordered Image
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}><RotateCcw className="w-4 h-4 mr-2" />Reset</Button>
              </div>
            </div>
          )}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Add a Border</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload your image', desc: 'Click the upload area or drag and drop a JPEG, PNG, WebP, GIF, or BMP file.' },
                { step: 2, title: 'Customize the border', desc: 'Adjust width, color, style (solid/dashed/dotted), and corner radius. Preview updates live.' },
                { step: 3, title: 'Download', desc: 'Click Download to save the bordered image in your chosen format.' },
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
              <h3 className="font-semibold text-lg mb-4">Border Options</h3>
              <div className="mb-4">
                <label className="text-sm font-medium flex justify-between"><span>Width</span><span className="text-primary">{width}px</span></label>
                <input type="range" min="1" max="100" value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-full mt-2 accent-primary" disabled={!originalFile} />
              </div>
              <div className="mb-4">
                <label className="text-sm font-medium">Color</label>
                <div className="flex items-center gap-2 mt-2">
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded border border-border cursor-pointer" disabled={!originalFile} />
                  <span className="text-xs text-muted-foreground">{color}</span>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-sm font-medium">Style</label>
                <select value={style} onChange={(e) => setStyle(e.target.value as BorderOptions['style'])} className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm" disabled={!originalFile}>
                  {STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="text-sm font-medium flex justify-between"><span>Corner Radius</span><span className="text-primary">{radius}px</span></label>
                <input type="range" min="0" max="50" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full mt-2 accent-primary" disabled={!originalFile} />
              </div>
              <div>
                <label className="text-sm font-medium">Output Format</label>
                <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as OutputFormat)} className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm" disabled={!originalFile || isProcessing}>
                  {OUTPUT_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
