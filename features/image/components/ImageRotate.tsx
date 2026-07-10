'use client'

import { useState, useCallback, useEffect } from 'react'
import { Download, RotateCcw, RotateCw, RotateCcw as RotateLeft, ArrowUpDown } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { rotateImage } from '@/features/image/utils/imageProcessing'
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
    question: 'How does image rotation work?',
    answer: 'SaveVex rotates your images entirely in your browser using browser-native rendering technology. The image is redrawn at your chosen angle using mathematical transforms — no data is ever uploaded to any server. Your files remain 100% private and secure.',
  },
  {
    question: 'What angles can I rotate to?',
    answer: 'You can rotate by 90° left, 90° right, or 180° with the preset buttons, or use the slider to set any custom angle from 0° to 360°. The angle is additive — clicking 90° Right twice rotates 180°.',
  },
  {
    question: 'Does rotation affect image quality?',
    answer: 'Rotations of 90°, 180°, and 270° are lossless — every pixel is preserved in its new position. Custom angles (like 45°) require interpolation which may slightly soften the image. Use PNG output for the best quality on custom angles.',
  },
  {
    question: 'Why does the canvas size change when I rotate?',
    answer: 'When you rotate by a non-90° angle, the image\'s bounding box expands to fit the entire rotated image without clipping. This means the output dimensions will be larger than the original for angles like 45°.',
  },
]

/**
 * Image Rotate tool.
 *
 * Flow: Upload → Rotate (presets or slider) → Preview → Download
 */
export function ImageRotate() {
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null)
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 })
  const [angle, setAngle] = useState(0)
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

  const doRotate = useCallback(async (file: File, angleDeg: number, fmt: OutputFormat) => {
    setIsProcessing(true)
    setError(null)
    try {
      const rotateResult = await rotateImage(file, angleDeg, fmt)
      setResult(rotateResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rotation failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleFileSelect = useCallback((file: File) => {
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)

    setError(null)
    setResult(null)
    setAngle(0)

    const previewUrl = URL.createObjectURL(file)
    setOriginalFile(file)
    setOriginalPreviewUrl(previewUrl)

    // Load dimensions
    const img = new Image()
    img.onload = () => {
      setOriginalSize({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.src = previewUrl
  }, [originalPreviewUrl, result])

  // Re-rotate whenever angle, format, or file changes
  useEffect(() => {
    if (originalFile && angle !== 0) {
      doRotate(originalFile, angle, outputFormat)
    } else if (angle === 0) {
      // Reset result when back to 0°
      if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
      setResult(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angle, outputFormat])

  const handlePreset = useCallback((delta: number) => {
    setAngle((prev) => {
      let next = prev + delta
      // Normalize to 0–360
      next = ((next % 360) + 360) % 360
      return next
    })
  }, [])

  const handleSliderChange = useCallback((newAngle: number) => {
    setAngle(newAngle)
    if (originalFile) {
      doRotate(originalFile, newAngle, outputFormat)
    }
  }, [originalFile, outputFormat, doRotate])

  const handleFormatChange = useCallback((fmt: OutputFormat) => {
    setOutputFormat(fmt)
    if (originalFile && angle !== 0) {
      doRotate(originalFile, angle, fmt)
    }
  }, [originalFile, angle, doRotate])

  const handleDownload = useCallback(() => {
    if (!result || !originalFile) return

    const ext = outputFormat === 'image/jpeg' ? 'jpg' : outputFormat === 'image/webp' ? 'webp' : 'png'
    const baseName = originalFile.name.replace(/\.[^.]+$/, '')
    const fileName = `${baseName}-rotated-${angle}.${ext}`

    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result, outputFormat, originalFile, angle])

  const handleReset = useCallback(() => {
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
    setOriginalFile(null)
    setOriginalPreviewUrl(null)
    setOriginalSize({ width: 0, height: 0 })
    setAngle(0)
    setResult(null)
    setError(null)
    setOutputFormat('image/jpeg')
  }, [originalPreviewUrl, result])

  const isProcessingRef = isProcessing

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {error && (
            <ErrorCard
              title="Rotation Failed"
              message={error}
              onRetry={() => originalFile && doRotate(originalFile, angle, outputFormat)}
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
                    {result ? 'Rotated Preview' : 'Original Image'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {result
                      ? `${result.width}×${result.height}`
                      : `${originalSize.width}×${originalSize.height}`}
                    {' · '}{angle}°
                  </span>
                </div>
                <div className="p-6 flex items-center justify-center bg-muted/10 min-h-[300px]">
                  {isProcessingRef ? (
                    <ProcessingStatus message="Rotating..." />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={result?.previewUrl || originalPreviewUrl || ''}
                      alt={result ? 'Rotated preview' : 'Original preview'}
                      className="max-w-full max-h-[400px] object-contain rounded-lg"
                    />
                  )}
                </div>
              </div>

              {/* Info */}
              {result && (
                <div className="border border-border rounded-xl p-6 bg-card">
                  <h3 className="font-semibold text-lg mb-4">Rotation Details</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Angle</div>
                      <div className="text-xl font-bold">{angle}°</div>
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
                  Download Rotated Image
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
            <h2 className="text-2xl font-bold mb-6">How to Rotate an Image</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload your image', desc: 'Click the upload area or drag and drop a JPEG, PNG, WebP, GIF, or BMP file.' },
                { step: 2, title: 'Choose rotation', desc: 'Use the preset buttons for common angles, or the slider for fine control. The preview updates instantly.' },
                { step: 3, title: 'Download', desc: 'Choose your output format and download the rotated image.' },
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
              <h3 className="font-semibold text-lg mb-6">Rotation Controls</h3>

              {/* Preset Buttons */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <button
                  onClick={() => handlePreset(-90)}
                  disabled={!originalFile}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  <RotateLeft className="w-5 h-5" />
                  <span className="text-xs font-medium">90° Left</span>
                </button>
                <button
                  onClick={() => handlePreset(90)}
                  disabled={!originalFile}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  <RotateCw className="w-5 h-5" />
                  <span className="text-xs font-medium">90° Right</span>
                </button>
                <button
                  onClick={() => handlePreset(180)}
                  disabled={!originalFile}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  <ArrowUpDown className="w-5 h-5" />
                  <span className="text-xs font-medium">180°</span>
                </button>
              </div>

              {/* Custom Angle Slider */}
              <div className="mb-6">
                <label className="text-sm font-medium flex justify-between">
                  <span>Custom Angle</span>
                  <span className="text-primary font-semibold">{angle}°</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={angle}
                  onChange={(e) => handleSliderChange(Number(e.target.value))}
                  className="w-full mt-2 accent-primary"
                  disabled={!originalFile}
                />
              </div>

              {/* Reset to 0° */}
              <div className="mb-6">
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!originalFile || angle === 0}
                  onClick={() => handleSliderChange(0)}
                >
                  Reset to 0°
                </Button>
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
