'use client'

import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Root-level error boundary. Catches errors in the root layout.
 * Renders its own <html> and <body> since the layout may be broken.
 * Branded with logo, gradient accent, and clear recovery action.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body className="antialiased bg-background text-foreground">
        {/* Gradient accent top bar */}
        <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />

        <main className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="text-center max-w-md mx-auto">
            {/* Logo */}
            <div className="mb-8">
              <Image
                src="/savevex-logo.png"
                alt="SaveVex"
                width={1320}
                height={329}
                className="h-12 w-auto mx-auto"
                priority
              />
            </div>

            {/* Error icon */}
            <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-6" />

            {/* Heading */}
            <h1 className="text-3xl font-bold mb-4">
              Application Error
            </h1>

            {/* Message */}
            <p className="text-muted-foreground mb-2">
              {error.message || 'A critical error occurred. Please try reloading the application.'}
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground/60 mb-8">
                Error ID: {error.digest}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-4 mt-6 flex-wrap">
              <Button onClick={reset} variant="outline">
                <RotateCcw className="w-4 h-4" />
                Try Again
              </Button>
              <Button onClick={reset}>
                <RotateCcw className="w-4 h-4" />
                Reload Application
              </Button>
            </div>
          </div>

          {/* Footer */}
          <p className="text-sm text-muted-foreground/60 mt-16">
            &copy; {new Date().getFullYear()} SaveVex. All rights reserved.
          </p>
        </main>
      </body>
    </html>
  )
}
