'use client'

import { ErrorCard } from '@/components/shared/ErrorCard'
import { PageLayout } from '@/components/shared/PageLayout'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Route-level error boundary. Catches errors in page components and shows
 * a retry-able error state while preserving the app layout.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <PageLayout>
      <div className="py-20">
        <ErrorCard
          title="Something went wrong"
          message={error.message || 'An unexpected error occurred loading this page.'}
          onRetry={reset}
        />
      </div>
    </PageLayout>
  )
}
