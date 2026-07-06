export type ProcessingState = 'idle' | 'uploading' | 'processing' | 'complete' | 'error'

export interface FileWithPreview {
  file: File
  previewUrl: string
  name: string
  size: number
  type: string
}

export interface UploadHandlers {
  onFileSelect: (file: File) => void
  onFileRemove: () => void
  onError: (error: string) => void
}

export interface FileValidationResult {
  valid: boolean
  error?: string
}
