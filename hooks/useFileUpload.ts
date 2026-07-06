'use client'

import { useState, useCallback, useRef } from 'react'
import type { ProcessingState, FileWithPreview } from '@/types/file'

interface UseFileUploadOptions {
  acceptedFormats: string[]
  maxSizeBytes?: number
  onError?: (error: string) => void
}

/**
 * Generic file upload hook with drag-and-drop support, validation, and blob URL management.
 * Returns state and handlers for building upload UIs.
 */
export function useFileUpload({ acceptedFormats, maxSizeBytes, onError }: UseFileUploadOptions) {
  const [file, setFile] = useState<FileWithPreview | null>(null)
  const [state, setState] = useState<ProcessingState>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback(
    (f: File): boolean => {
      const ext = f.name.split('.').pop()?.toLowerCase()
      if (ext && acceptedFormats.length > 0 && !acceptedFormats.includes(ext)) {
        onError?.(`Unsupported format: .${ext}. Accepted: ${acceptedFormats.join(', ')}`)
        return false
      }
      if (maxSizeBytes && f.size > maxSizeBytes) {
        onError?.(`File too large: ${(f.size / 1024 / 1024).toFixed(1)} MB. Max: ${(maxSizeBytes / 1024 / 1024).toFixed(1)} MB`)
        return false
      }
      return true
    },
    [acceptedFormats, maxSizeBytes, onError]
  )

  const handleFile = useCallback(
    (f: File) => {
      if (!validateFile(f)) return

      const previewUrl = URL.createObjectURL(f)
      setFile({
        file: f,
        previewUrl,
        name: f.name,
        size: f.size,
        type: f.type,
      })
      setState('uploading')
    },
    [validateFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const f = e.dataTransfer.files?.[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const openFileDialog = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const removeFile = useCallback(() => {
    if (file?.previewUrl) {
      URL.revokeObjectURL(file.previewUrl)
    }
    setFile(null)
    setState('idle')
  }, [file])

  const setProcessing = useCallback(() => setState('processing'), [])
  const setComplete = useCallback(() => setState('complete'), [])
  const setError = useCallback((message: string) => {
    onError?.(message)
    setState('error')
  }, [onError])

  return {
    file,
    state,
    inputRef,
    handleDrop,
    handleDragOver,
    handleInputChange,
    openFileDialog,
    removeFile,
    setProcessing,
    setComplete,
    setError,
  }
}
