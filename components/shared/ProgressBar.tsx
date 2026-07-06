interface ProgressBarProps {
  /** Progress value 0–100. */
  percent: number
  /** Optional label shown above the bar. */
  label?: string
  /** Optional detail text shown below the bar. */
  detail?: string
}

/**
 * Animated progress bar with percentage display.
 * Used by any tool that needs to report processing progress.
 */
export function ProgressBar({ percent, label, detail }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <div className="w-full">
      {(label || detail === undefined) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-sm font-medium text-foreground">{label}</span>}
          <span className="text-sm font-semibold text-primary">{Math.round(clamped)}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {detail && <p className="text-xs text-muted-foreground mt-1">{detail}</p>}
    </div>
  )
}
