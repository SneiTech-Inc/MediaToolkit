'use client'

import { useState, useCallback, useEffect } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { convertImage } from '@/features/image/utils/imageProcessing'
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
    question: 'How does image conversion work?',
    answer: 'SaveVex converts your images entirely in your browser using browser-native rendering technology. Your image is drawn and exported in the target format. No image data is ever uploaded to any server — your files remain 100% private and secure.',
  },
  {
    question: 'What formats can I convert between?',
    answer: 'You can upload JPEG, PNG, WebP, GIF, or BMP images and convert them to JPEG, PNG, or WebP. GIF animations are converted as a single frame.',
  },
  {
    question: 'Does converting affect image quality?',
    answer: 'JPEG and WebP use lossy compression — lower quality produces smaller files but may introduce artifacts. PNG is lossless, so quality is always preserved but file sizes may be larger. We recommend quality 80–92 for a good balance.',
  },
  {
    question: 'Why is my transparent background white after converting to JPEG?',
    answer: 'JPEG does not support transparency. Any transparent areas are filled with a white background when converting to JPEG. Use PNG or WebP if you need to preserve transparency.',
  },
]

/**
 * Image Converter tool.
 *
 * Flow: Upload → Select target format → Convert → Preview → Download
 */
export function ImageConverter() {
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg')
  const [quality, setQuality] = useState(85)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ResizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showOriginalPreview, setShowOriginalPreview] = useState(true)

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
      if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileSelect = useCallback((file: File) => {
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)

    setError(null)
    setResult(null)

    const previewUrl = URL.createObjectURL(file)
    setOriginalFile(file)
    setOriginalPreviewUrl(previewUrl)

    // Auto-convert on upload
    convertAndSet(file, outputFormat, quality)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalPreviewUrl, result])

  const convertAndSet = useCallback(async (file: File, format: OutputFormat, q: number) => {
    setError(null)
    setIsProcessing(true)
    try {
      const convertResult = await convertImage(file, format, q / 100)
      setResult(convertResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleFormatChange = useCallback((newFormat: OutputFormat) => {
    setOutputFormat(newFormat)
    if (originalFile) {
      convertAndSet(originalFile, newFormat, quality)
    }
  }, [originalFile, quality, convertAndSet])

  const handleQualityChange = useCallback((newQuality: number) => {
    setQuality(newQuality)
    if (originalFile && outputFormat !== 'image/png') {
      convertAndSet(originalFile, outputFormat, newQuality)
    }
  }, [originalFile, outputFormat, convertAndSet])

  const handleDownload = useCallback(() => {
    if (!result || !originalFile) return

    const ext = outputFormat === 'image/jpeg' ? 'jpg' : outputFormat === 'image/webp' ? 'webp' : 'png'
    const baseName = originalFile.name.replace(/\.[^.]+$/, '')
    const fileName = `${baseName}-converted.${ext}`

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
    setResult(null)
    setError(null)
    setOutputFormat('image/jpeg')
    setQuality(85)
    setShowOriginalPreview(true)
  }, [originalPreviewUrl, result])

  const isPngOutput = outputFormat === 'image/png'

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {error && (
            <ErrorCard
              title="Conversion Failed"
              message={error}
              onRetry={() => originalFile && convertAndSet(originalFile, outputFormat, quality)}
            />
          )}

          {!originalFile ? (
            <UploadDropzone
              acceptedFormats={ACCEPTED_FORMATS}
              onFileSelect={handleFileSelect}
            />
          ) : isProcessing ? (
            <ProcessingStatus message="Converting your image..." />
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
                    Original
                    {originalFile && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({originalFile.type.split('/')[1]?.toUpperCase()})
                      </span>
                    )}
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
                    Converted
                    {result && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({outputFormat.split('/')[1]?.toUpperCase()})
                      </span>
                    )}
                  </button>
                </div>
                <div className="p-6 flex items-center justify-center bg-muted/10 min-h-[300px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={showOriginalPreview || !result ? (originalPreviewUrl || '') : result.previewUrl}
                    alt={showOriginalPreview ? 'Original preview' : 'Converted preview'}
                    className="max-w-full max-h-[400px] object-contain rounded-lg"
                  />
                </div>
              </div>

              {/* Size comparison */}
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-4">File Sizes</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Original</div>
                    <div className="text-2xl font-bold text-foreground">
                      {originalFile ? formatBytes(originalFile.size) : '—'}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Converted</div>
                    <div className="text-2xl font-bold text-foreground">
                      {result ? formatBytes(result.blob.size) : '—'}
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
                  Download Converted Image
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Convert Another
                </Button>
              </div>
            </div>
          )}

          {/* How To Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Convert an Image</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload your image', desc: 'Click the upload area or drag and drop a JPEG, PNG, WebP, GIF, or BMP file.' },
                { step: 2, title: 'Choose output format', desc: 'Select JPEG, PNG, or WebP. Adjust quality for JPEG/WebP output.' },
                { step: 3, title: 'Download', desc: 'Preview the converted result and download your image in the new format.' },
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
              <h3 className="font-semibold text-lg mb-6">Conversion Options</h3>

              {/* Output Format */}
              <div className="mb-6">
                <label className="text-sm font-medium">Convert To</label>
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

              {/* Quality Slider — hidden for PNG */}
              {!isPngOutput && (
                <div className="mb-6">
                  <label className="text-sm font-medium flex justify-between">
                    <span>Quality</span>
                    <span className="text-primary font-semibold">{quality}%</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={quality}
                    onChange={(e) => handleQualityChange(Number(e.target.value))}
                    className="w-full mt-2 accent-primary"
                    disabled={!originalFile || isProcessing}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Smaller file</span>
                    <span>Better quality</span>
                  </div>
                </div>
              )}

              {isPngOutput && (
                <div className="mb-6 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  PNG uses lossless compression — quality setting does not apply.
                </div>
              )}

              {/* Convert Button */}
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!originalFile || isProcessing}
                onClick={() => originalFile && convertAndSet(originalFile, outputFormat, quality)}
              >
                {isProcessing ? 'Converting...' : 'Convert'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
