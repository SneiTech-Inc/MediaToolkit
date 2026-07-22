'use client'

import { PageLayout } from '@/components/shared/PageLayout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Route-level error boundary. Catches errors in page components and shows
 * a branded error state with both retry and navigation options.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <PageLayout>
      {/* Gradient hero banner */}
      <section className="bg-gradient-to-b from-primary/10 to-accent/5 py-24 px-4 border-b border-border">
        <div className="max-w-6xl mx-auto text-center">
          {/* Error icon */}
          <div className="mb-6">
            <AlertTriangle className="w-20 h-20 text-destructive mx-auto" />
          </div>

          {/* Heading */}
          <h1 className="text-4xl md:text-5xl font-bold">
            Something Went Wrong
          </h1>

          {/* Error message */}
          <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
            {error.message || 'An unexpected error occurred while loading this page.'}
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
            <Button onClick={reset} variant="outline" size="lg">
              <RotateCcw className="w-4 h-4" />
              Try Again
            </Button>
            <Button asChild size="lg">
              <Link href="/">
                <Home className="w-4 h-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Helpful links section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8">Need help?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/blog"
              className="rounded-xl border border-border p-6 hover:border-primary hover:shadow-lg transition-all duration-300 text-left"
            >
              <h3 className="font-semibold mb-1">Blog</h3>
              <p className="text-sm text-muted-foreground">
                Tips, tutorials, and guides for file processing.
              </p>
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border border-border p-6 hover:border-primary hover:shadow-lg transition-all duration-300 text-left"
            >
              <h3 className="font-semibold mb-1">Contact</h3>
              <p className="text-sm text-muted-foreground">
                Get in touch with our support team.
              </p>
            </Link>
            <Link
              href="/about"
              className="rounded-xl border border-border p-6 hover:border-primary hover:shadow-lg transition-all duration-300 text-left"
            >
              <h3 className="font-semibold mb-1">About</h3>
              <p className="text-sm text-muted-foreground">
                Learn more about SaveVex and our mission.
              </p>
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
