'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback, useRef, useEffect } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop, convertToPixelCrop } from 'react-image-crop'
import type { Crop, PixelCrop, PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Download, RotateCcw } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { loadImage, cropImage } from '@/features/image/utils/imageProcessing'
import { formatBytes } from '@/utils/formatBytes'
import type { OutputFormat, ResizeResult } from '@/features/image/types'

const ACCEPTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']

const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
]

const ASPECT_RATIOS: { label: string; value: number | undefined }[] = [
  { label: 'Free', value: undefined },
  { label: '1:1 (Square)', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:2', value: 3 / 2 },
]

const TOOL_FAQS = [
  {
    question: 'How does image cropping work?',
    answer: 'SaveVex crops your images entirely in your browser using browser-native rendering technology. You select the area you want to keep, and the rest is trimmed away. No image data is ever uploaded to any server — your files remain 100% private and secure.',
  },
  {
    question: 'Can I crop to a specific aspect ratio?',
    answer: 'Yes! Use the aspect ratio dropdown to lock your selection to common ratios like 1:1 (square), 4:3, 16:9 (widescreen), or 3:2 (photo). Choose "Free" to crop without constraints.',
  },
  {
    question: 'Can I undo my crop selection?',
    answer: 'You can drag the crop handles to resize or move the selection at any time before applying. After applying, use the "Crop Another" button to start over with a fresh selection.',
  },
]

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number | undefined
): PercentCrop {
  return centerCrop(
    makeAspectCrop(
      { unit: '%', width: aspect ? 75 : 90 },
      aspect || (mediaWidth / mediaHeight),
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

/**
 * Image Crop tool.
 *
 * Flow: Upload → Select crop region → Apply → Preview → Download
 */
export function ImageCrop() {
  const imgRef = useRef<HTMLImageElement>(null)

  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [displayedSize, setDisplayedSize] = useState({ width: 0, height: 0 })
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
  const [aspect, setAspect] = useState<number | undefined>(undefined)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('image/jpeg')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ResizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Cleanup
  useEffect(() => {
    return () => {
      if (imageSrc) URL.revokeObjectURL(imageSrc)
      if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileSelect = useCallback(async (file: File) => {
    // Cleanup previous
    if (imageSrc) URL.revokeObjectURL(imageSrc)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)

    setError(null)
    setResult(null)
    setCrop(undefined)
    setCompletedCrop(null)

    const src = URL.createObjectURL(file)
    setImageSrc(src)
    setOriginalFile(file)

    try {
      const img = await loadImage(file)
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
    } catch {
      setError('Failed to load image. The file may be corrupted or too large.')
    }
  }, [imageSrc, result])

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const naturalW = img.naturalWidth
    const naturalH = img.naturalHeight
    const displayedW = img.offsetWidth
    const displayedH = img.offsetHeight

    setImageSize({ width: naturalW, height: naturalH })
    setDisplayedSize({ width: displayedW, height: displayedH })

    // Set initial centered crop (in natural pixel coordinates)
    const initialCrop = centerAspectCrop(naturalW, naturalH, aspect)
    setCrop(initialCrop)
    setCompletedCrop(convertToPixelCrop(initialCrop, naturalW, naturalH))
  }, [aspect])

  const handleAspectChange = useCallback((newAspect: number | undefined) => {
    setAspect(newAspect)
    if (imageSize.width > 0) {
      const newCrop = centerAspectCrop(imageSize.width, imageSize.height, newAspect)
      setCrop(newCrop)
      setCompletedCrop(convertToPixelCrop(newCrop, imageSize.width, imageSize.height))
    }
  }, [imageSize])

  const handleApplyCrop = useCallback(async () => {
    if (!originalFile || !completedCrop || completedCrop.width <= 0 || completedCrop.height <= 0) return

    // Scale from displayed-pixel coordinates to natural-pixel coordinates.
    // react-image-crop returns pixels in the rendered element's coordinate space,
    // but the canvas needs the original image's coordinate space.
    const scaleX = displayedSize.width > 0 ? imageSize.width / displayedSize.width : 1
    const scaleY = displayedSize.height > 0 ? imageSize.height / displayedSize.height : 1

    const scaledCrop = {
      x: Math.round(completedCrop.x * scaleX),
      y: Math.round(completedCrop.y * scaleY),
      width: Math.round(completedCrop.width * scaleX),
      height: Math.round(completedCrop.height * scaleY),
    }

    setIsProcessing(true)
    setError(null)
    try {
      const cropResult = await cropImage(originalFile, scaledCrop, outputFormat)
      setResult(cropResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crop failed.')
    } finally {
      setIsProcessing(false)
    }
  }, [originalFile, completedCrop, outputFormat, imageSize, displayedSize])

  const handleDownload = useCallback(() => {
    if (!result || !originalFile) return

    const ext = outputFormat === 'image/jpeg' ? 'jpg' : outputFormat === 'image/webp' ? 'webp' : 'png'
    const baseName = originalFile.name.replace(/\.[^.]+$/, '')

    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(`${baseName}.${ext}`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result, outputFormat, originalFile])

  const handleReset = useCallback(() => {
    if (imageSrc) URL.revokeObjectURL(imageSrc)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
    setOriginalFile(null)
    setImageSrc(null)
    setImageSize({ width: 0, height: 0 })
    setDisplayedSize({ width: 0, height: 0 })
    setCrop(undefined)
    setCompletedCrop(null)
    setResult(null)
    setError(null)
    setAspect(undefined)
    setOutputFormat('image/jpeg')
  }, [imageSrc, result])

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {error && (
            <ErrorCard
              title="Crop Failed"
              message={error}
              onRetry={handleApplyCrop}
            />
          )}

          {!originalFile ? (
            <UploadDropzone
              acceptedFormats={ACCEPTED_FORMATS}
              onFileSelect={handleFileSelect}
            />
          ) : isProcessing ? (
            <ProcessingStatus message="Cropping your image..." />
          ) : result ? (
            <div className="space-y-6">
              {/* Result preview */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                  <span className="text-sm font-medium">Cropped Result</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {result.width}×{result.height}
                  </span>
                </div>
                <div className="p-6 flex items-center justify-center bg-muted/10 min-h-[300px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.previewUrl}
                    alt="Cropped result"
                    className="max-w-full max-h-[400px] object-contain rounded-lg"
                  />
                </div>
              </div>

              {/* Size info */}
              <div className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-semibold text-lg mb-4">Crop Details</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Dimensions</div>
                    <div className="text-xl font-bold">{result.width}×{result.height}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">File Size</div>
                    <div className="text-xl font-bold">{formatBytes(result.blob.size)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">Format</div>
                    <div className="text-xl font-bold">{outputFormat.split('/')[1]?.toUpperCase()}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" className="bg-primary hover:bg-primary/90 flex-1" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Cropped Image
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Crop Another
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Interactive Crop Area */}
              <div className="border border-border rounded-xl overflow-hidden bg-muted/10">
                <div className="border-b border-border bg-muted/30 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Select Crop Area
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {imageSize.width}×{imageSize.height} px
                  </span>
                </div>
                {imageSrc && (
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={aspect}
                    minWidth={10}
                    minHeight={10}
                    className="max-w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={imgRef}
                      src={imageSrc}
                      alt="Crop preview"
                      onLoad={onImageLoad}
                      className="max-w-full max-h-[500px] object-contain"
                    />
                  </ReactCrop>
                )}
              </div>

              {/* Apply Crop Button */}
              <Button
                size="lg"
                className="w-full bg-primary hover:bg-primary/90"
                onClick={handleApplyCrop}
                disabled={!completedCrop || completedCrop.width <= 0}
              >
                Apply Crop
              </Button>
            </div>
          )}

          {/* How To Use */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">How to Crop an Image</h2>
            <ol className="space-y-4">
              {[
                { step: 1, title: 'Upload your image', desc: 'Click the upload area or drag and drop a JPEG, PNG, WebP, GIF, or BMP file.' },
                { step: 2, title: 'Select crop area', desc: 'Drag the handles on the overlay to select the region you want to keep. Use the aspect ratio presets for standard sizes.' },
                { step: 3, title: 'Apply & download', desc: 'Click Apply Crop, preview the result, and download your cropped image.' },
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
              <h3 className="font-semibold text-lg mb-6">Crop Options</h3>

              {/* Aspect Ratio */}
              <div className="mb-6">
                <label className="text-sm font-medium">Aspect Ratio</label>
                <select
                  value={aspect ?? ''}
                  onChange={(e) => handleAspectChange(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  disabled={!originalFile}
                >
                  {ASPECT_RATIOS.map((r) => (
                    <option key={r.label} value={r.value ?? ''}>{r.label}</option>
                  ))}
                </select>
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

              {/* Apply Button */}
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!originalFile || !completedCrop || isProcessing}
                onClick={handleApplyCrop}
              >
                {isProcessing ? 'Cropping...' : 'Apply Crop'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
