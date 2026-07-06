'use client'

import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UploadDropzoneProps {
  acceptedFormats: string[]
  onFileSelect: (file: File) => void
  disabled?: boolean
}

/**
 * Drag-and-drop (click-to-browse) file upload area.
 * Extracted from the tool page's upload state — identical DOM output.
 */
export function UploadDropzone({ acceptedFormats, onFileSelect, disabled = false }: UploadDropzoneProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  return (
    <div className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary transition-colors">
      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
      <h3 className="text-xl font-semibold mb-2">Drop your file here or click to browse</h3>
      <p className="text-muted-foreground mb-6">
        Supported formats: {acceptedFormats.join(', ').toUpperCase()}
      </p>
      <input
        type="file"
        onChange={handleFileChange}
        accept={acceptedFormats.map(f => `.${f}`).join(',')}
        className="hidden"
        id="file-upload"
        disabled={disabled}
      />
      <label htmlFor="file-upload">
        <Button asChild disabled={disabled}>
          <span>Select File</span>
        </Button>
      </label>
    </div>
  )
}
