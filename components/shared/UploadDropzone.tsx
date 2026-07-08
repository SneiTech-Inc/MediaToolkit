'use client'

import { useRef, useState, useId, useCallback } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UploadDropzoneProps {
  acceptedFormats: string[]
  onFileSelect: (file: File) => void
  disabled?: boolean
}

/**
 * Drag-and-drop (click-to-browse) file upload area.
 *
 * Features:
 * - Click anywhere on the dropzone to open the file picker
 * - Drag and drop a file onto the zone
 * - Visual feedback during drag-over
 * - Hidden file input uses off-screen positioning (not display:none) for
 *   cross-browser compatibility with label-triggered file pickers
 */
export function UploadDropzone({ acceptedFormats, onFileSelect, disabled = false }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const uniqueId = useId()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
    // Reset the input so the same file can be re-selected after reset
    e.target.value = ''
  }

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }, [disabled])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (disabled) return

    const file = e.dataTransfer.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }, [disabled, onFileSelect])

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer ${
        isDragOver
          ? 'border-primary bg-primary/5 scale-[1.01]'
          : disabled
            ? 'border-muted cursor-not-allowed opacity-60'
            : 'border-border hover:border-primary hover:bg-muted/20'
      }`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload file"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <Upload className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
      <h3 className="text-xl font-semibold mb-2">
        {isDragOver ? 'Drop your file here' : 'Drop your file here or click to browse'}
      </h3>
      <p className="text-muted-foreground mb-6">
        Supported formats: {acceptedFormats.join(', ').toUpperCase()}
      </p>

      {/* Hidden file input — positioned off-screen, not display:none.
          display:none prevents label-triggered clicks from opening the
          file picker in some browsers (Safari, mobile). */}
      <input
        ref={inputRef}
        type="file"
        onChange={handleFileChange}
        accept={acceptedFormats.map(f => `.${f}`).join(',')}
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        id={uniqueId}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
      />

      <label htmlFor={uniqueId} onClick={(e) => e.stopPropagation()}>
        <Button disabled={disabled}>Select File</Button>
      </label>
    </div>
  )
}
