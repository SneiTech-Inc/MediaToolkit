'use client'

import { useState, useCallback, useEffect } from 'react'
import { Download, RotateCcw, FlipHorizontal, FlipVertical } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { flipImage } from '@/features/image/utils/imageProcessing'
import { formatBytes } from '@/utils/formatBytes'
import type { OutputFormat, ResizeResult } from '@/features/image/types'
import type { FlipType } from '@/features/image/utils/imageProcessing'

const ACCEPTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']

const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
]

const TOOL_FAQS = [
  {
    question: 'How does image flipping work?',
    answer: 'SaveVex flips your images entirely in your browser using browser-native rendering technology. The image is mirrored using mathematical transforms — no data is ever uploaded to any server. Your files remain 100% private and secure.',
  },
  {
    question: 'What does flipping an image do?',
    answer: 'Horizontal flip mirrors the image left-to-right (like looking in a mirror). Vertical flip mirrors top-to-bottom (like a reflection in water). Applying both flips at once is equivalent to a 180° rotation.',
  },
  {
    question: 'Can I flip horizontally and vertically at the same time?',
    answer: 'Yes! Enable both toggles and the image will be flipped in both directions — producing a 180° rotation effect. The dimensions stay the same since flipping preserves the original size.',
  },
  {
    question: 'Does flipping reduce image quality?',
    answer: 'No — flipping is a lossless transform. Every pixel is preserved exactly as-is, just in a mirrored position. The output quality depends only on your chosen output format (PNG is lossless, JPEG/WebP use compression).',
  },
]

/**
 * Image Flip tool.
 *
 * Flow: Upload → Toggle flips → Preview → Download
 */
export function ImageFlip() {
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ResizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Cleanup
  useEffect(() => {
    return () => {
      if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
      if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getFlipType = useCallback((): FlipType | null => {
    if (flipH && flipV) return 'both'
    if (flipH) return 'horizontal'
    if (flipV) return 'vertical'
    return null
  }, [flipH, flipV])

  const doFlip = useCallback(async (file: File, type: FlipType, fmt: OutputFormat) => {
    setIsProcessing(true)
    setError(null)
    try {
      const flipResult = await flipImage(file, type, fmt)
      setResult(flipResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Flip failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleFileSelect = useCallback((file: File) => {
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)

    setError(null)
    setResult(null)
    setFlipH(false)
    setFlipV(false)

    const previewUrl = URL.createObjectURL(file)
    setOriginalFile(file)
    setOriginalPreviewUrl(previewUrl)
  }, [originalPreviewUrl, result])

  // Auto-process when flip state changes
  const toggleFlipH = useCallback(() => {
    setFlipH((prev) => {
      const next = !prev
      if (originalFile) {
        const newType: FlipType | null =
          next && flipV ? 'both' : next ? 'horizontal' : flipV ? 'vertical' : null
        if (newType) {
          doFlip(originalFile, newType, outputFormat)
        } else {
          if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
          setResult(null)
        }
      }
      return next
    })
  }, [originalFile, flipV, outputFormat, doFlip, result])

  const toggleFlipV = useCallback(() => {
    setFlipV((prev) => {
      const next = !prev
      if (originalFile) {
        const newType: FlipType | null =
          flipH && next ? 'both' : flipH ? 'horizontal' : next ? 'vertical' : null
        if (newType) {
          doFlip(originalFile, newType, outputFormat)
        } else {
          if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
          setResult(null)
        }
      }
      return next
    })
  }, [originalFile, flipH, outputFormat, doFlip, result])

  const handleFormatChange = useCallback((fmt: OutputFormat) => {
    setOutputFormat(fmt)
    const type = getFlipType()
    if (originalFile && type) {
      doFlip(originalFile, type, fmt)
    }
  }, [originalFile, getFlipType, doFlip])

  const handleDownload = useCallback(() => {
    if (!result || !originalFile) return

    const ext = outputFormat === 'image/jpeg' ? 'jpg' : outputFormat === 'image/webp' ? 'webp' : 'png'
    const baseName = originalFile.name.replace(/\.[^.]+$/, '')
    const flipLabel = flipH && flipV ? 'flipped-both' : flipH ? 'flipped-h' : 'flipped-v'
    const fileName = `${baseName}-${flipLabel}.${ext}`

    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result, outputFormat, originalFile, flipH, flipV])

  const handleReset = useCallback(() => {
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
    setOriginalFile(null)
    setOriginalPreviewUrl(null)
    setFlipH(false)
    setFlipV(false)
    setResult(null)
    setError(null)
    setOutputFormat('image/jpeg')
  }, [originalPreviewUrl, result])

  const flipLabel = flipH && flipV ? 'Horizontal + Vertical' : flipH ? 'Horizontal' : flipV ? 'Vertical' : 'None'

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {error && (
            <ErrorCard
              title="Flip Failed"
              message={error}
              onRetry={() => {
                const type = getFlipType()
                if (originalFile && type) doFlip(originalFile, type, outputFormat)
              }}
            />
          )}

          {!originalFile ? (
            <UploadDropzone
              acceptedFormats={ACCEPTED_FORMATS}
              onFileSelect={handleFileSelect}
            />
          ) : (
            <div className="space-y-6">
              {/* Preview */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {result ? 'Flipped Preview' : 'Original Image'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {flipLabel}
                  </span>
                </div>
                <div className="p-6 flex items-center justify-center bg-muted/10 min-h-[300px]">
                  {isProcessing ? (
                    <ProcessingStatus message="Flipping..." />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={result?.previewUrl || originalPreviewUrl || ''}
                      alt={result ? 'Flipped preview' : 'Original preview'}
                      className="max-w-full max-h-[400px] object-contain rounded-lg"
                    />
                  )}
                </div>
              </div>

              {/* Info */}
              {result && originalFile && (
                <div className="border border-border rounded-xl p-6 bg-card">
                  <h3 className="font-semibold text-lg mb-4">Flip Details</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Flip</div>
                      <div className="text-xl font-bold">{flipLabel}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Dimensions</div>
                      <div className="text-xl font-bold">{result.width}×{result.height}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Size</div>
                      <div className="text-xl font-bold">{formatBytes(result.blob.size)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 flex-1"
                  onClick={handleDownload}
                  disabled={!result}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Flipped Image
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>
          )}

          {/* How To Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Flip an Image</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload your image', desc: 'Click the upload area or drag and drop a JPEG, PNG, WebP, GIF, or BMP file.' },
                { step: 2, title: 'Choose flip direction', desc: 'Toggle Horizontal (left-right mirror) or Vertical (top-bottom mirror). Enable both for a 180° effect.' },
                { step: 3, title: 'Download', desc: 'Preview the result and download your flipped image in JPEG, PNG, or WebP format.' },
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

        {/* Right Column — Controls */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <div className="border border-border rounded-xl p-6 bg-muted/30">
              <h3 className="font-semibold text-lg mb-6">Flip Controls</h3>

              {/* Horizontal Toggle */}
              <div className="mb-4">
                <button
                  onClick={toggleFlipH}
                  disabled={!originalFile}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                    flipH
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-border hover:bg-muted'
                  } disabled:opacity-50`}
                >
                  <FlipHorizontal className="w-5 h-5" />
                  Flip Horizontal {flipH && '✓'}
                </button>
              </div>

              {/* Vertical Toggle */}
              <div className="mb-6">
                <button
                  onClick={toggleFlipV}
                  disabled={!originalFile}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                    flipV
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-border hover:bg-muted'
                  } disabled:opacity-50`}
                >
                  <FlipVertical className="w-5 h-5" />
                  Flip Vertical {flipV && '✓'}
                </button>
              </div>

              {/* Output Format */}
              <div className="mb-6">
                <label className="text-sm font-medium">Output Format</label>
                <select
                  value={outputFormat}
                  onChange={(e) => handleFormatChange(e.target.value as OutputFormat)}
                  className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  disabled={!originalFile || isProcessing}
                >
                  {OUTPUT_FORMATS.map((fmt) => (
                    <option key={fmt.value} value={fmt.value}>{fmt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
