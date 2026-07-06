import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'

interface ToolOptionsProps {
  outputFormats: readonly string[]
  defaultQuality?: number
  disabled?: boolean
  onProcess?: () => void
}

/**
 * Options sidebar for individual tool pages.
 * Extracted from the tool page's right sidebar panel.
 */
export function ToolOptions({
  outputFormats,
  defaultQuality = 80,
  disabled = false,
  onProcess,
}: ToolOptionsProps) {
  return (
    <div className="border border-border rounded-xl p-6 bg-muted/30">
      <h3 className="font-semibold text-lg mb-6">Options</h3>

      {/* Output Format */}
      <div className="mb-6">
        <label className="text-sm font-medium">Output Format</label>
        <select className="w-full mt-2 px-3 py-2 border border-border rounded-lg bg-background">
          {outputFormats.map(format => (
            <option key={format} value={format}>
              {format.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Quality Slider */}
      <div className="mb-6">
        <label className="text-sm font-medium flex justify-between">
          <span>Quality</span>
          <span className="text-primary">{defaultQuality}%</span>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          defaultValue={defaultQuality}
          className="w-full mt-2"
        />
      </div>

      <Button
        className="w-full bg-primary hover:bg-primary/90"
        disabled={disabled}
        onClick={onProcess}
      >
        <Upload className="w-4 h-4 mr-2" />
        Process File
      </Button>
    </div>
  )
}
