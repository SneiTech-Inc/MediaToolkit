interface ProcessingStatusProps {
  message?: string
}

/**
 * Spinning loader shown while a file is being processed.
 * Extracted from the tool page's processing state.
 */
export function ProcessingStatus({ message = 'Processing your file...' }: ProcessingStatusProps) {
  return (
    <div className="border rounded-xl p-12 text-center bg-muted/30">
      <div className="inline-block">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <h3 className="text-xl font-semibold mt-4">{message}</h3>
      <p className="text-muted-foreground mt-2">This may take a few moments</p>
    </div>
  )
}
