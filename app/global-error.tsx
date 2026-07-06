'use client'

import { ErrorCard } from '@/components/shared/ErrorCard'
import { Button } from '@/components/ui/button'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Root-level error boundary. Catches errors in the root layout.
 * Renders its own <html> and <body> since the layout may be broken.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body className="antialiased bg-background text-foreground">
        <main className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <h1 className="text-3xl font-bold mb-4">SaveVex</h1>
            <ErrorCard
              title="Application Error"
              message={error.message || 'A critical error occurred.'}
            />
            <Button onClick={reset} className="mt-6">
              Reload Application
            </Button>
          </div>
        </main>
      </body>
    </html>
  )
}
