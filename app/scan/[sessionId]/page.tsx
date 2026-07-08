'use client'

import { useState, useRef, useEffect, useCallback, use } from 'react'
import { Camera, Upload, X, ArrowLeft } from 'lucide-react'

export default function ScannerPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [captures, setCaptures] = useState<string[]>([])
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [flash, setFlash] = useState(false)

  // ── Camera ───────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsCameraReady(true)
      }
    } catch {
      setCameraError('Could not access camera. Please ensure camera permissions are granted and try using a secure (HTTPS) connection.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setIsCameraReady(false)
  }, [])

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  // ── Capture ──────────────────────────────────────────────────────────

  const capture = useCallback(() => {
    if (!videoRef.current) return
    const video = videoRef.current

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)

    setCaptures((prev) => [...prev, canvas.toDataURL('image/jpeg', 0.92)])

    // Flash effect
    setFlash(true)
    setTimeout(() => setFlash(false), 150)
  }, [])

  const removeCapture = (index: number) => {
    setCaptures((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Upload ───────────────────────────────────────────────────────────

  const uploadToDesktop = useCallback(() => {
    if (captures.length === 0) return
    localStorage.setItem(`scan_${sessionId}`, JSON.stringify(captures))
    window.location.href = `/tools/pdf/scan-to-pdf?session=${sessionId}&done=true`
  }, [captures, sessionId])

  // ── Keyboard capture (spacebar) ──────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); capture() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [capture])

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Camera viewport */}
      <div className="relative flex-1">
        {cameraError ? (
          <div className="flex items-center justify-center h-full px-6 text-center">
            <p className="text-white/70 text-sm">{cameraError}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            {/* Flash overlay */}
            {flash && (
              <div className="absolute inset-0 bg-white animate-pulse pointer-events-none" />
            )}
            {/* Back button */}
            <a
              href={`/tools/pdf/scan-to-pdf?session=${sessionId}`}
              className="absolute top-4 left-4 p-2 bg-black/40 rounded-full text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </a>
            {/* Capture count */}
            {captures.length > 0 && (
              <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 rounded-full text-white text-sm font-medium">
                {captures.length} page{captures.length !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom controls */}
      <div className="bg-black/90 px-4 pb-8 pt-4 space-y-3 safe-area-bottom">
        {/* Thumbnail strip */}
        {captures.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {captures.map((dataUrl, i) => (
              <div key={i} className="relative shrink-0 w-14 h-18">
                <img
                  src={dataUrl}
                  alt={`Page ${i + 1}`}
                  className="w-full h-full object-cover rounded-lg border border-white/20"
                />
                <button
                  onClick={() => removeCapture(i)}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 rounded-full p-0.5 shadow"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
                <span className="absolute bottom-0.5 left-1 bg-black/70 text-white text-[10px] px-1 rounded">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Capture + Upload buttons */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={capture}
            disabled={!isCameraReady}
            className="w-16 h-16 rounded-full bg-white hover:bg-gray-200 flex items-center justify-center transition-transform active:scale-95 disabled:opacity-30 shadow-lg"
          >
            <Camera className="w-7 h-7 text-black" />
          </button>

          {captures.length > 0 && (
            <button
              onClick={uploadToDesktop}
              className="flex items-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 rounded-full text-white font-medium text-sm transition-colors shadow-lg"
            >
              <Upload className="w-4 h-4" />
              Upload {captures.length}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
