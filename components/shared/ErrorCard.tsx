import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ErrorCardProps {
  title?: string
  message?: string
  onRetry?: () => void
}

/**
 * Standardized error display with optional retry action.
 * Used by ErrorBoundary and individual tool error states.
 */
export function ErrorCard({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
}: ErrorCardProps) {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-muted-foreground mb-6">{message}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            Try Again
          </Button>
        )}
      </div>
    </div>
  )
}
