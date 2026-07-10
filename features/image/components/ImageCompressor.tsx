'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback, useRef, useEffect } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { useImageCompression } from '@/features/image/hooks/useImageCompression'
import { isFormatSupported } from '@/features/image/utils/imageProcessing'
import { formatBytes } from '@/utils/formatBytes'
import type { OutputFormat, ImageCompressionResult } from '@/features/image/types'

const ACCEPTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp']

const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
]

const TOOL_FAQS = [
  {
    question: 'How does SaveVex compress my images?',
    answer: 'SaveVex compresses your images entirely in your browser using browser-native rendering. No image data is ever uploaded to any server — everything stays on your device. This means your images are 100% private and secure.',
  },
  {
    question: 'Which format should I choose?',
    answer: 'JPEG is best for photographs — small file size with good quality. PNG is best for graphics with text or transparency — it uses lossless compression. WebP offers the best of both worlds with smaller files than JPEG and transparency support like PNG.',
  },
  {
    question: 'Will I lose image quality?',
    answer: 'JPEG and WebP use lossy compression — lowering the quality slider reduces file size but may introduce visible artifacts. PNG uses lossless compression, so quality is preserved but file size reduction is smaller. We recommend quality 70–85 for a good balance.',
  },
  {
    question: 'Is there a file size limit?',
    answer: 'File sizes are limited by your browser\'s available memory. Most modern browsers handle images up to 50 MB without issues. Very large images (>50 MP) may take longer to process.',
  },
  {
    question: 'What happens with animated GIFs?',
    answer: 'The browser\'s image engine only captures the first frame of animated GIFs. If you upload an animated GIF, the output will be a still image showing only the first frame.',
  },
]

/**
 * Image Compressor tool — the reference implementation for all SaveVex tools.
 *
 * Flow: Upload → Preview + Configure → Compress → Compare → Download
 * All processing happens client-side via Canvas API.
 */
export function ImageCompressor() {
  const { compress, result, isProcessing, error, progress, reset } = useImageCompression()

  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null)
  const [quality, setQuality] = useState(80)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg')
  const [showOriginalPreview, setShowOriginalPreview] = useState(true)

  // Debounce timer for auto-recompression on quality/format change
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup all object URLs on unmount
  useEffect(() => {
    return () => {
      if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileSelect = useCallback((file: File) => {
    // Clean up previous original preview
    if (originalPreviewUrl) {
      URL.revokeObjectURL(originalPreviewUrl)
    }

    const previewUrl = URL.createObjectURL(file)
    setOriginalFile(file)
    setOriginalPreviewUrl(previewUrl)

    // Auto-compress on upload
    compress(file, {
      quality: quality / 100,
      format: outputFormat,
    })
  }, [compress, quality, outputFormat, originalPreviewUrl])

  const handleQualityChange = useCallback((newQuality: number) => {
    setQuality(newQuality)

    // Debounced re-compression
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (originalFile) {
        compress(originalFile, {
          quality: newQuality / 100,
          format: outputFormat,
        })
      }
    }, 300)
  }, [originalFile, compress, outputFormat])

  const handleFormatChange = useCallback((newFormat: OutputFormat) => {
    setOutputFormat(newFormat)
    if (originalFile) {
      compress(originalFile, {
        quality: quality / 100,
        format: newFormat,
      })
    }
  }, [originalFile, compress, quality])

  const handleDownload = useCallback(() => {
    if (!result) return

    const ext = outputFormat === 'image/jpeg' ? 'jpg' : outputFormat === 'image/webp' ? 'webp' : 'png'
    const originalName = originalFile?.name || 'image'
    const baseName = originalName.replace(/\.[^.]+$/, '')

    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(`${baseName}.${ext}`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Revoke after a short delay to allow the download to start
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result, outputFormat, originalFile])

  const handleReset = useCallback(() => {
    if (originalPreviewUrl) {
      URL.revokeObjectURL(originalPreviewUrl)
    }
    setOriginalFile(null)
    setOriginalPreviewUrl(null)
    setQuality(80)
    setOutputFormat('image/jpeg')
    reset()
  }, [originalPreviewUrl, reset])

  const webpSupported = isFormatSupported('image/webp')

  return (
    <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column — Upload + Preview */}
          <div className="lg:col-span-2 space-y-8">
            {/* Error state */}
            {error && (
              <ErrorCard
                title="Compression Failed"
                message={error}
                onRetry={() => originalFile && handleFileSelect(originalFile)}
              />
            )}

            {/* Upload or Processing or Result */}
            {!originalFile ? (
              <UploadDropzone
                acceptedFormats={ACCEPTED_FORMATS}
                onFileSelect={handleFileSelect}
              />
            ) : isProcessing ? (
              <div className="space-y-6">
                <ProcessingStatus message="Compressing your image..." />
                <ProgressBar
                  percent={progress}
                  label="Compressing"
                  detail={progress < 100 ? 'Rendering with browser-native engine...' : 'Finalizing...'}
                />
              </div>
            ) : result ? (
              <div className="space-y-6">
                {/* Result card with preview comparison */}
                <div className="border border-border rounded-xl overflow-hidden">
                  {/* Toggle tabs */}
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
                    </button>
                    <button
                      onClick={() => setShowOriginalPreview(false)}
                      className={`flex-1 py-3 text-sm font-medium transition-colors ${
                        !showOriginalPreview
                          ? 'bg-background text-foreground border-b-2 border-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Compressed
                    </button>
                  </div>

                  {/* Preview image */}
                  <div className="p-6 flex items-center justify-center bg-muted/10 min-h-[300px]">
                    {showOriginalPreview ? (
                      originalPreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={originalPreviewUrl}
                          alt="Original image preview"
                          className="max-w-full max-h-[400px] object-contain rounded-lg"
                        />
                      ) : null
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.previewUrl}
                        alt="Compressed image preview"
                        className="max-w-full max-h-[400px] object-contain rounded-lg"
                      />
                    )}
                  </div>
                </div>

                {/* Size comparison */}
                <SizeComparison result={result} />

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 flex-1" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    Download Compressed Image
                  </Button>
                  <Button size="lg" variant="outline" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Compress Another
                  </Button>
                </div>
              </div>
            ) : null}

            {/* How To Use */}
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-6">How to Compress an Image</h2>
              <ol className="space-y-4">
                {[
                  { step: 1, title: 'Upload your image', desc: 'Click the upload area or drag and drop a JPEG, PNG, WebP, GIF, SVG, or BMP file.' },
                  { step: 2, title: 'Adjust quality & format', desc: 'Use the slider to balance quality vs. file size. Choose JPEG, PNG, or WebP as the output format.' },
                  { step: 3, title: 'Preview & download', desc: 'Compare original and compressed versions side by side, then download your optimized image.' },
                ].map((item) => (
                  <li key={item.step} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
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
              <FAQSection
                faqs={TOOL_FAQS}
                title="Frequently Asked Questions"
                description=""
              />
            </div>
          </div>

          {/* Right Column — Options Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="border border-border rounded-xl p-6 bg-muted/30">
                <h3 className="font-semibold text-lg mb-6">Compression Options</h3>

                {/* Output Format */}
                <div className="mb-6">
                  <label className="text-sm font-medium">Output Format</label>
                  <select
                    value={outputFormat}
                    onChange={(e) => handleFormatChange(e.target.value as OutputFormat)}
                    className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    disabled={isProcessing}
                  >
                    {OUTPUT_FORMATS.map((fmt) => (
                      <option
                        key={fmt.value}
                        value={fmt.value}
                        disabled={fmt.value === 'image/webp' && !webpSupported}
                      >
                        {fmt.label}{fmt.value === 'image/webp' && !webpSupported ? ' (not supported)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quality Slider */}
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
                    disabled={isProcessing || !originalFile}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Smaller file</span>
                    <span>Better quality</span>
                  </div>
                  {outputFormat === 'image/png' && (
                    <p className="text-xs text-muted-foreground mt-2">
                      PNG uses lossless compression — the quality slider has no effect.
                    </p>
                  )}
                </div>

                {/* Compress button for re-compression */}
                <Button
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={!originalFile || isProcessing}
                  onClick={() => originalFile && compress(originalFile, {
                    quality: quality / 100,
                    format: outputFormat,
                  })}
                >
                  {isProcessing ? 'Compressing...' : 'Apply Compression'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
  )
}

/** Size comparison bar showing original vs compressed with percent saved. */
function SizeComparison({ result }: { result: ImageCompressionResult }) {
  const { originalSize, compressedSize, percentSaved, width, height } = result

  return (
    <div className="border border-border rounded-xl p-6 bg-card">
      <h3 className="font-semibold text-lg mb-4">Compression Results</h3>

      {/* Visual bar */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium">Original</span>
          <span className="text-sm text-muted-foreground">{formatBytes(originalSize)}</span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-muted-foreground/30 rounded-full" style={{ width: '100%' }} />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-sm font-medium">Compressed</span>
          <span className="text-sm text-muted-foreground">{formatBytes(compressedSize)}</span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden mt-1">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(2, 100 - percentSaved)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {percentSaved > 0 ? `${percentSaved}%` : '—'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Size Reduction</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="text-2xl font-bold text-foreground">
            {formatBytes(compressedSize).split(' ')[0]}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {formatBytes(compressedSize).split(' ')[1]}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="text-2xl font-bold text-foreground">
            {width}×{height}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Dimensions</div>
        </div>
      </div>
    </div>
  )
}
