import { PageLayout } from '@/components/shared/PageLayout'
import { EmptyState } from '@/components/shared/EmptyState'

/**
 * Custom 404 page for unmatched routes.
 */
export default function NotFoundPage() {
  return (
    <PageLayout>
      <EmptyState
        title="Page Not Found"
        message="The page you're looking for doesn't exist or has been moved."
        action={{ label: 'Back to Home', href: '/' }}
      />
    </PageLayout>
  )
}
