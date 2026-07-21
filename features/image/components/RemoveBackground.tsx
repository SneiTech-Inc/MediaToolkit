'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Download, RotateCcw, Sparkles, Image as ImageIcon, X } from 'lucide-react'
import { UploadDropzone } from '@/components/shared/UploadDropzone'
import { ProcessingStatus } from '@/components/shared/ProcessingStatus'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ErrorCard } from '@/components/shared/ErrorCard'
import { FAQSection } from '@/components/shared/FAQSection'
import { RelatedTools } from '@/components/shared/RelatedTools'
import { Button } from '@/components/ui/button'
import {
  removeImageBackground,
  checkBrowserSupport,
  preloadBackgroundEngine,
} from '@/features/image/utils/backgroundRemover'
import { getSaveVexFileName } from '@/utils/fileNames'
import { formatBytes } from '@/utils/formatBytes'
import { TOOLS } from '@/lib/constants'
import type {
  BackgroundMode,
  BackgroundOutputFormat,
  BackgroundRemovalResult,
} from '@/features/image/utils/backgroundRemover'

// ─── Constants ──────────────────────────────────────────────────────────────

const ACCEPTED_FORMATS = ['jpg', 'jpeg', 'png', 'webp']

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

type ProcessingPhase = 'idle' | 'loading-model' | 'removing-background'

/** All output formats (JPEG conditionally excluded by the UI). */
const ALL_OUTPUT_FORMATS: { value: BackgroundOutputFormat; label: string; description: string }[] = [
  { value: 'image/png', label: 'PNG', description: 'Lossless, supports transparency' },
  { value: 'image/webp', label: 'WebP', description: 'Smaller file, supports transparency' },
  { value: 'image/jpeg', label: 'JPEG', description: 'Smallest file, no transparency' },
]

// ─── FAQ ────────────────────────────────────────────────────────────────────

const TOOL_FAQS = [
  {
    question: 'Is my image uploaded to a server?',
    answer:
      'No! All processing happens 100% in your browser using an AI model that runs locally on your device. Your images never leave your computer. No data is ever uploaded to any server — your files remain 100% private and secure.',
  },
  {
    question: 'What image formats are supported?',
    answer:
      'You can upload JPG, PNG, and WebP images up to 20 MB. Output is available in PNG (lossless with transparency), WebP (smaller file with transparency), and JPEG (smallest, but no transparency — only available when replacing the background with a solid color or another image).',
  },
  {
    question: 'How accurate is the background removal?',
    answer:
      'The AI model works best on photos with clear subjects — portraits, products on simple backgrounds, and objects with well-defined edges. Complex backgrounds, fine details like hair, and low-contrast edges may show some imperfections. Results are generally good for most common use cases but may not match professional desktop software in edge cases.',
  },
  {
    question: "Why can't I select JPEG when using transparent background?",
    answer:
      'JPEG format does not support transparency (alpha channel). If you need transparency, choose PNG or WebP instead. JPEG is available when you replace the background with a solid color or another image.',
  },
  {
    question: 'Is there a file size or resolution limit?',
    answer:
      'The maximum file size is 20 MB. For very large images (over 4096 pixels on the longest side), SaveVex will automatically downscale them for AI processing to ensure fast performance while preserving the original resolution in your final output.',
  },
  {
    question: 'Does it work on mobile devices?',
    answer:
      'Yes! The tool runs entirely in your browser and works on modern mobile browsers including Safari on iOS and Chrome on Android. Processing speed depends on your device — newer devices with more RAM will be faster.',
  },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function RemoveBackground() {
  // ── File state ────────────────────────────────────────────────────────
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null)
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null)

  // ── Processing state ──────────────────────────────────────────────────
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>('idle')
  const [modelProgress, setModelProgress] = useState(0)
  const [inferenceProgress, setInferenceProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // ── Options ───────────────────────────────────────────────────────────
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('transparent')
  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [backgroundImageFile, setBackgroundImageFile] = useState<File | null>(null)
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(null)
  const [outputFormat, setOutputFormat] = useState<BackgroundOutputFormat>('image/png')
  const [outputQuality, setOutputQuality] = useState(92)

  // ── Result ────────────────────────────────────────────────────────────
  const [result, setResult] = useState<BackgroundRemovalResult | null>(null)

  // ── Preview ───────────────────────────────────────────────────────────
  const [showOriginal, setShowOriginal] = useState(true)

  // ── Browser support ───────────────────────────────────────────────────
  const [browserUnsupported, setBrowserUnsupported] = useState<string | null>(null)

  // ── Refs ──────────────────────────────────────────────────────────────
  const isProcessingRef = useRef(false)
  const processingPhaseRef = useRef<ProcessingPhase>('idle')

  // ── Mount: check browser support + fire-and-forget preload ─────────────
  useEffect(() => {
    const support = checkBrowserSupport()
    if (!support.supported) {
      setBrowserUnsupported(support.reason ?? 'Your browser is not supported.')
      return
    }

    // Fire-and-forget model preload — mirrors preloadFFmpeg() pattern
    preloadBackgroundEngine()
  }, [])

  // ── Unmount: cleanup all object URLs ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
      if (backgroundPreviewUrl) URL.revokeObjectURL(backgroundPreviewUrl)
      if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── File select handler ───────────────────────────────────────────────
  const handleFileSelect = useCallback(
    (file: File) => {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError(
          `File size (${formatBytes(file.size)}) exceeds the ${formatBytes(MAX_FILE_SIZE)} limit. Please use a smaller image or compress it first.`,
        )
        return
      }

      // Cancel any in-progress operation
      isProcessingRef.current = false

      // Clean up previous previews
      if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
      if (result?.previewUrl) {
        URL.revokeObjectURL(result.previewUrl)
      }

      const url = URL.createObjectURL(file)

      // Get dimensions from the loaded image
      const img = new window.Image()
      img.onload = () => {
        setOriginalDimensions({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.src = url

      setOriginalFile(file)
      setOriginalPreviewUrl(url)
      setResult(null)
      setError(null)
      setModelProgress(0)
      setInferenceProgress(0)
      setProcessingPhase('idle')
      setShowOriginal(true)
    },
    [originalPreviewUrl, result],
  )

  // ── Background image select handler ───────────────────────────────────
  const handleBgImageSelect = useCallback(
    (file: File) => {
      if (backgroundPreviewUrl) URL.revokeObjectURL(backgroundPreviewUrl)
      setBackgroundImageFile(file)
      setBackgroundPreviewUrl(URL.createObjectURL(file))
    },
    [backgroundPreviewUrl],
  )

  /** Remove the uploaded background image. */
  const handleClearBgImage = useCallback(() => {
    if (backgroundPreviewUrl) URL.revokeObjectURL(backgroundPreviewUrl)
    setBackgroundImageFile(null)
    setBackgroundPreviewUrl(null)
  }, [backgroundPreviewUrl])

  // ── Process handler ───────────────────────────────────────────────────
  const handleRemoveBackground = useCallback(async () => {
    if (!originalFile) return

    setIsProcessing(true)
    isProcessingRef.current = true
    setError(null)
    setModelProgress(0)
    setInferenceProgress(0)
    setProcessingPhase('loading-model')
    processingPhaseRef.current = 'loading-model'

    try {
      const bgResult = await removeImageBackground(originalFile, {
        backgroundMode,
        backgroundColor: backgroundMode === 'solid-color' ? backgroundColor : undefined,
        backgroundImage: backgroundMode === 'image' && backgroundImageFile ? backgroundImageFile : undefined,
        outputFormat:
          backgroundMode === 'transparent' && outputFormat === 'image/jpeg'
            ? 'image/png' // defensive fallback — UI prevents this
            : outputFormat,
        outputQuality: outputQuality / 100,
        onModelProgress: (pct) => {
          setModelProgress(pct)
        },
        onInferenceProgress: (pct) => {
          // Use ref to avoid stale closure — the state variable may not
          // reflect the latest phase inside this callback.
          if (pct > 0 && processingPhaseRef.current === 'loading-model') {
            processingPhaseRef.current = 'removing-background'
            setProcessingPhase('removing-background')
          }
          setInferenceProgress(pct)
        },
      })

      // Clear the previous result's preview URL
      if (result?.previewUrl) {
        URL.revokeObjectURL(result.previewUrl)
      }

      setResult(bgResult)
      setShowOriginal(false)
      setProcessingPhase('idle')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled — silent, reset to idle
        setProcessingPhase('idle')
        return
      }
      const msg = err instanceof Error ? err.message : 'Background removal failed. Please try again.'
      setError(msg)
      setProcessingPhase('idle')
    } finally {
      setIsProcessing(false)
      isProcessingRef.current = false
    }
  }, [
    originalFile,
    backgroundMode,
    backgroundColor,
    backgroundImageFile,
    outputFormat,
    outputQuality,
    result,
  ])

  // ── Download handler ──────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!result) return

    const ext =
      outputFormat === 'image/jpeg' ? 'jpg' : outputFormat === 'image/webp' ? 'webp' : 'png'
    const baseName = (originalFile?.name ?? 'image').replace(/\.[^.]+$/, '')

    const url = URL.createObjectURL(result.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(`${baseName}-no-bg.${ext}`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result, outputFormat, originalFile])

  // ── Reset handler ─────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl)
    if (backgroundPreviewUrl) URL.revokeObjectURL(backgroundPreviewUrl)
    if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl)

    setOriginalFile(null)
    setOriginalPreviewUrl(null)
    setOriginalDimensions(null)
    setBackgroundImageFile(null)
    setBackgroundPreviewUrl(null)
    setResult(null)
    setError(null)
    setModelProgress(0)
    setInferenceProgress(0)
    setProcessingPhase('idle')
    setShowOriginal(true)
  }, [originalPreviewUrl, backgroundPreviewUrl, result])

  // ── Derived data ──────────────────────────────────────────────────────

  /** Output formats filtered by background mode. */
  const availableFormats = ALL_OUTPUT_FORMATS.filter(
    (f) => backgroundMode !== 'transparent' || f.value !== 'image/jpeg',
  )

  /** Related tools for the sidebar (shown before processing completes). */
  const relatedTools = TOOLS.filter(
    (t) => t.category === 'image' && t.slug !== 'remove-background',
  ).slice(0, 4)

  /** Is the action button enabled? */
  const isActionDisabled =
    !originalFile ||
    isProcessing ||
    (backgroundMode === 'image' && !backgroundImageFile)

  // ── Render: Browser unsupported ───────────────────────────────────────
  if (browserUnsupported) {
    return (
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <ErrorCard title="Browser Not Supported" message={browserUnsupported} />
          <div className="mt-12">
            <FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" />
          </div>
        </div>
      </section>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ═══════════════════ LEFT COLUMN ═══════════════════ */}
        <div className="lg:col-span-2 space-y-8">
          {/* Error */}
          {error && (
            <ErrorCard
              title="Background Removal Failed"
              message={error}
              onRetry={handleRemoveBackground}
            />
          )}

          {/* No file → Upload */}
          {!originalFile && (
            <UploadDropzone
              acceptedFormats={ACCEPTED_FORMATS}
              onFileSelect={handleFileSelect}
            />
          )}

          {/* Processing */}
          {originalFile && isProcessing && (
            <div className="space-y-6">
              <ProcessingStatus
                message={
                  processingPhase === 'loading-model'
                    ? 'Loading AI model...'
                    : 'Removing background...'
                }
              />
              {processingPhase === 'loading-model' && (
                <ProgressBar
                  percent={modelProgress}
                  label="Downloading AI model"
                  detail="Loading the background removal neural network into your browser..."
                />
              )}
              {processingPhase === 'removing-background' && (
                <ProgressBar
                  percent={inferenceProgress}
                  label="Removing background"
                  detail="Running AI inference locally on your device..."
                />
              )}
            </div>
          )}

          {/* Result */}
          {!isProcessing && result && (
            <div className="space-y-6">
              {/* Preview with Original / Processed tabs */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="flex border-b border-border bg-muted/30">
                  <button
                    onClick={() => setShowOriginal(true)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      showOriginal
                        ? 'bg-background text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Original
                    {originalDimensions &&
                      ` (${originalDimensions.width} × ${originalDimensions.height})`}
                  </button>
                  <button
                    onClick={() => setShowOriginal(false)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      !showOriginal
                        ? 'bg-background text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Processed ({result.width} × {result.height})
                  </button>
                </div>
                <div
                  className="p-6 flex items-center justify-center min-h-[300px]"
                  style={
                    !showOriginal && backgroundMode === 'transparent'
                      ? {
                          backgroundImage:
                            'linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 75%, #e5e5e5 75%, #e5e5e5), linear-gradient(45deg, #e5e5e5 25%, transparent 25%, transparent 75%, #e5e5e5 75%, #e5e5e5)',
                          backgroundSize: '20px 20px',
                          backgroundPosition: '0 0, 10px 10px',
                        }
                      : { backgroundColor: 'var(--color-muted)' }
                  }
                >
                  {showOriginal && originalPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={originalPreviewUrl}
                      alt="Original"
                      className="max-w-full max-h-[500px] object-contain rounded-lg"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={result.previewUrl}
                      alt="Background removed"
                      className="max-w-full max-h-[500px] object-contain rounded-lg"
                    />
                  )}
                </div>
              </div>

              {/* Result stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-muted/30 text-center border border-border">
                  <div className="text-lg font-semibold">
                    {result.width} × {result.height}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Dimensions</div>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 text-center border border-border">
                  <div className="text-lg font-semibold">{formatBytes(result.blob.size)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Output Size</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 flex-1"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Image
                </Button>
                <Button size="lg" variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Process Another
                </Button>
              </div>
            </div>
          )}

          {/* How To Use (always visible when file is selected) */}
          {originalFile && (
            <div>
              <h2 className="text-2xl font-bold mb-6">How to Remove Image Background</h2>
              <ol className="space-y-4">
                {[
                  {
                    step: 1,
                    title: 'Upload your image',
                    desc: 'Click the upload area to select your image (JPG, PNG, or WebP, up to 20 MB).',
                  },
                  {
                    step: 2,
                    title: 'Choose background options',
                    desc: 'Select transparent, solid color, or upload a replacement background image from the right panel.',
                  },
                  {
                    step: 3,
                    title: 'Download your image',
                    desc: 'Click Remove Background to run AI locally, then download your image with the background removed.',
                  },
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
          )}

          {/* FAQ */}
          <div className="mt-12">
            <FAQSection
              faqs={TOOL_FAQS}
              title="Frequently Asked Questions"
              description=""
            />
          </div>
        </div>

        {/* ═══════════════════ RIGHT COLUMN ═══════════════════ */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            {/* File Info Card */}
            {originalFile && (
              <div className="border border-border rounded-xl p-4 space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                  File Info
                </h4>
                <p className="text-xs text-muted-foreground truncate" title={originalFile.name}>
                  {originalFile.name}
                </p>
                <p className="text-xs text-muted-foreground">{formatBytes(originalFile.size)}</p>
                {originalDimensions && (
                  <p className="text-xs text-muted-foreground">
                    {originalDimensions.width} × {originalDimensions.height} px
                  </p>
                )}
              </div>
            )}

            {/* Background Mode */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-sm">Background</h4>
              <select
                value={backgroundMode}
                onChange={(e) => {
                  const mode = e.target.value as BackgroundMode
                  setBackgroundMode(mode)
                  // Auto-switch format when switching to transparent while JPEG selected
                  if (mode === 'transparent' && outputFormat === 'image/jpeg') {
                    setOutputFormat('image/png')
                  }
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                disabled={isProcessing}
              >
                <option value="transparent">Transparent</option>
                <option value="solid-color">Solid Color</option>
                <option value="image">Upload Image</option>
              </select>

              {/* Solid Color Picker */}
              {backgroundMode === 'solid-color' && (
                <div className="flex items-center gap-3 pt-1">
                  <div className="relative">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                      disabled={isProcessing}
                    />
                  </div>
                  <code className="text-xs text-muted-foreground">{backgroundColor}</code>
                </div>
              )}

              {/* Background Image Upload */}
              {backgroundMode === 'image' && (
                <div className="space-y-2 pt-1">
                  {backgroundPreviewUrl ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={backgroundPreviewUrl}
                        alt="Background"
                        className="w-full h-24 object-cover rounded-lg border border-border"
                      />
                      <button
                        onClick={handleClearBgImage}
                        disabled={isProcessing}
                        className="absolute top-2 right-2 w-6 h-6 bg-background/90 border border-border rounded-full flex items-center justify-center hover:bg-background transition-colors"
                        aria-label="Remove background image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <p className="text-xs text-muted-foreground mt-1">
                        Image will be scaled to cover your photo. Different aspect ratios
                        will be centered and cropped — not stretched.
                      </p>
                    </div>
                  ) : (
                    <UploadDropzone
                      acceptedFormats={ACCEPTED_FORMATS}
                      onFileSelect={handleBgImageSelect}
                      disabled={isProcessing}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Output Format */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-sm">Output Format</h4>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as BackgroundOutputFormat)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                disabled={isProcessing}
              >
                {availableFormats.map((fmt) => (
                  <option key={fmt.value} value={fmt.value}>
                    {fmt.label} — {fmt.description}
                  </option>
                ))}
              </select>
              {backgroundMode === 'transparent' && (
                <p className="text-xs text-muted-foreground">
                  JPEG is not available with transparent background — it does not support
                  alpha channel. Choose PNG or WebP instead.
                </p>
              )}
            </div>

            {/* Quality Slider (JPEG/WebP only) */}
            {outputFormat !== 'image/png' && (
              <div className="border border-border rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-sm flex justify-between">
                  <span>Quality</span>
                  <span className="text-primary font-semibold">{outputQuality}%</span>
                </h4>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={outputQuality}
                  onChange={(e) => setOutputQuality(Number(e.target.value))}
                  className="w-full accent-primary"
                  disabled={isProcessing || !originalFile}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Smaller file</span>
                  <span>Better quality</span>
                </div>
              </div>
            )}

            {/* Action Button */}
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              size="lg"
              disabled={isActionDisabled}
              onClick={handleRemoveBackground}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isProcessing
                ? processingPhase === 'loading-model'
                  ? 'Loading Model...'
                  : 'Removing...'
                : 'Remove Background'}
            </Button>

            {/* Re-process hint when result exists but user changes options */}
            {originalFile && result && !isProcessing && (
              <p className="text-xs text-muted-foreground text-center">
                Changed options? Click the button above to re-process.
              </p>
            )}

            {/* Related Tools */}
            {!result && (
              <RelatedTools tools={relatedTools} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
