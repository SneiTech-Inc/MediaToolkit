'use client'

import { Download, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ResultCardProps {
  fileName?: string
  onDownload: () => void
  onReset: () => void
}

/**
 * Success state shown after file processing completes.
 * Extracted from the tool page's complete state.
 */
export function ResultCard({ fileName, onDownload, onReset }: ResultCardProps) {
  return (
    <div className="border rounded-xl p-12 text-center bg-green-500/10 border-green-500">
      <div className="text-4xl mb-4">✓</div>
      <h3 className="text-xl font-semibold mb-2">Processing Complete!</h3>
      <p className="text-muted-foreground mb-6">
        {fileName ? `${fileName} is ready to download` : 'Your file is ready to download'}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button size="lg" className="bg-primary hover:bg-primary/90" onClick={onDownload}>
          <Download className="w-4 h-4 mr-2" />
          Download File
        </Button>
        <Button size="lg" variant="outline" onClick={onReset}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Process Another
        </Button>
      </div>
    </div>
  )
}
