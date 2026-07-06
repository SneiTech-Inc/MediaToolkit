'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Download, RotateCcw, Lock, Unlock } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { loadImage, resizeImage } from '@/features/image/utils/imageProcessing'
import { formatBytes } from '@/utils/formatBytes'
import type { OutputFormat, ResizeResult } from '@/features/image/types'

const ACCEPTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']

const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
]

const TOOL_FAQS = [
  {
    question: 'How does SaveVex resize my images?',
    answer: 'SaveVex resizes your images entirely in your browser using the native Canvas API. No image data is ever uploaded to any server — everything stays on your device. Your images are 100% private and secure.',
  },
  {
    question: 'What happens if I change only one dimension?',
    answer: 'When the aspect ratio lock is enabled, changing either width or height automatically updates the other to maintain the original proportions of your image, preventing stretching or squashing.',
  },
  {
    question: 'Can I resize to specific pixel dimensions?',
    answer: 'Yes! Enter your desired width and height in pixels. The tool supports any positive integer dimensions. For best quality when upscaling, choose PNG format.',
  },
  {
    question: 'Which format should I choose for the output?',
    answer: 'JPEG is best for photographs with smaller file sizes. PNG is best for images needing transparency or sharp text/graphics. WebP balances quality and compression for web use.',
  },
  {
    question: 'Is there a limit on dimensions?',
    answer: 'The maximum dimensions depend on your browser\'s Canvas capabilities. Most modern browsers support canvases up to at least 8192×8192 pixels. Very large upscales may use significant memory.',
  },
]

/**
 * Image Resizer tool.
 *
 * Flow: Upload → Set dimensions → Resize → Preview → Download
 */
export function ImageResizer() {
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null)
  const [originalWidth, setOriginalWidth] = useState(0)
  const [originalHeight, setOriginalHeight] = useState(0)

  // Dimension inputs
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [lockAspectRatio, setLockAspectRatio] = useState(true)

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ResizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg')
  const [showOriginalPreview, setShowOriginalPreview] = useState(true)

  const inputRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })

  // Cleanup
  useEffect(() => {
    return () => {
      if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
      if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileSelect = useCallback(async (file: File) => {
    // Clean up previous
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)

    setError(null)
    setResult(null)

    const previewUrl = URL.createObjectURL(file)
    setOriginalFile(file)
    setOriginalPreviewUrl(previewUrl)

    try {
      const image = await loadImage(file)
      const w = image.naturalWidth
      const h = image.naturalHeight
      setOriginalWidth(w)
      setOriginalHeight(h)
      setWidth(w)
      setHeight(h)
      inputRef.current = { width: w, height: h }
    } catch {
      setError('Failed to load image. The file may be corrupted or too large.')
    }
  }, [originalPreviewUrl, result])

  const handleWidthChange = useCallback((newWidth: number) => {
    setWidth(newWidth)
    if (lockAspectRatio && originalHeight > 0) {
      const ratio = originalHeight / originalWidth
      setHeight(Math.round(newWidth * ratio))
    }
  }, [lockAspectRatio, originalWidth, originalHeight])

  const handleHeightChange = useCallback((newHeight: number) => {
    setHeight(newHeight)
    if (lockAspectRatio && originalWidth > 0) {
      const ratio = originalWidth / originalHeight
      setWidth(Math.round(newHeight * ratio))
    }
  }, [lockAspectRatio, originalWidth, originalHeight])

  const handleResize = useCallback(async () => {
    if (!originalFile || width <= 0 || height <= 0) return

    setError(null)
    setIsProcessing(true)

    try {
      const resizeResult = await resizeImage(originalFile, width, height, outputFormat)
      setResult(resizeResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resize failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [originalFile, width, height, outputFormat])

  const handleDownload = useCallback(() => {
    if (!result) return

    const ext = outputFormat === 'image/jpeg' ? 'jpg' : outputFormat === 'image/webp' ? 'webp' : 'png'
    const baseName = originalFile?.name?.replace(/\.[^.]+$/, '') || 'image'
    const fileName = `${baseName}-resized.${ext}`

    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result, outputFormat, originalFile])

  const handleReset = useCallback(() => {
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
    setOriginalFile(null)
    setOriginalPreviewUrl(null)
    setOriginalWidth(0)
    setOriginalHeight(0)
    setWidth(0)
    setHeight(0)
    setResult(null)
    setError(null)
    setOutputFormat('image/jpeg')
    setShowOriginalPreview(true)
  }, [originalPreviewUrl, result])

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {error && (
            <ErrorCard
              title="Resize Failed"
              message={error}
              onRetry={handleResize}
            />
          )}

          {!originalFile ? (
            <UploadDropzone
              acceptedFormats={ACCEPTED_FORMATS}
              onFileSelect={handleFileSelect}
            />
          ) : isProcessing ? (
            <ProcessingStatus message="Resizing your image..." />
          ) : (
            <div className="space-y-6">
              {/* Preview Tabs */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="flex border-b border-border bg-muted/30">
                  <button
                    onClick={() => setShowOriginalPreview(true)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      showOriginalPreview
                        ? 'bg-background text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Original ({originalWidth}×{originalHeight})
                  </button>
                  <button
                    onClick={() => setShowOriginalPreview(false)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      !showOriginalPreview
                        ? 'bg-background text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    disabled={!result}
                  >
                    Resized {result ? `(${result.width}×${result.height})` : ''}
                  </button>
                </div>
                <div className="p-6 flex items-center justify-center bg-muted/10 min-h-[300px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={showOriginalPreview || !result ? (originalPreviewUrl || '') : result.previewUrl}
                    alt={showOriginalPreview ? 'Original preview' : 'Resized preview'}
                    className="max-w-full max-h-[400px] object-contain rounded-lg"
                  />
                </div>
              </div>

              {/* Dimension comparison */}
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-4">Dimensions</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Original</div>
                    <div className="text-2xl font-bold text-foreground">
                      {originalWidth}×{originalHeight}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {originalFile ? formatBytes(originalFile.size) : ''}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Resized</div>
                    <div className="text-2xl font-bold text-foreground">
                      {result ? `${result.width}×${result.height}` : '—'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {result ? formatBytes(result.blob.size) : ''}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 flex-1"
                  onClick={handleDownload}
                  disabled={!result}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Resized Image
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Resize Another
                </Button>
              </div>
            </div>
          )}

          {/* How To Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Resize an Image</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload your image', desc: 'Click the upload area or drag and drop a JPEG, PNG, WebP, GIF, or BMP file.' },
                { step: 2, title: 'Set dimensions', desc: 'Enter your desired width and height. Lock aspect ratio to prevent distortion.' },
                { step: 3, title: 'Resize & download', desc: 'Click Apply Resize, preview the result, and download your resized image.' },
              ].map((item) => (
                <li key={item.step} className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                    {item.step}
                  </span>
                  <div>
                    <h4 className="font-semibold">{item.title}</h4>
                    <p className="text-muted-foreground text-sm">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* FAQ */}
          <div className="mt-12">
            <FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" />
          </div>
        </div>

        {/* Right Column — Options */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-6">Resize Options</h3>

              {/* Width */}
              <div className="mb-4">
                <label className="text-sm font-medium">Width (px)</label>
                <input
                  type="number"
                  min="1"
                  max="8192"
                  value={width || ''}
                  onChange={(e) => handleWidthChange(Number(e.target.value))}
                  className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  disabled={!originalFile}
                  placeholder="Width"
                />
              </div>

              {/* Height */}
              <div className="mb-4">
                <label className="text-sm font-medium">Height (px)</label>
                <input
                  type="number"
                  min="1"
                  max="8192"
                  value={height || ''}
                  onChange={(e) => handleHeightChange(Number(e.target.value))}
                  className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  disabled={!originalFile}
                  placeholder="Height"
                />
              </div>

              {/* Aspect Ratio Lock */}
              <div className="mb-6">
                <button
                  onClick={() => setLockAspectRatio(!lockAspectRatio)}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    lockAspectRatio
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  }`}
                >
                  {lockAspectRatio ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {lockAspectRatio ? 'Aspect Ratio Locked' : 'Aspect Ratio Unlocked'}
                </button>
              </div>

              {/* Output Format */}
              <div className="mb-6">
                <label className="text-sm font-medium">Output Format</label>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                  className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  disabled={!originalFile || isProcessing}
                >
                  {OUTPUT_FORMATS.map((fmt) => (
                    <option key={fmt.value} value={fmt.value}>{fmt.label}</option>
                  ))}
                </select>
              </div>

              {/* Resize Button */}
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!originalFile || isProcessing || width <= 0 || height <= 0}
                onClick={handleResize}
              >
                {isProcessing ? 'Resizing...' : 'Apply Resize'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
