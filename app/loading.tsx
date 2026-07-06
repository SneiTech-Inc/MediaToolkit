import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'

/**
 * Loading UI shown during route transitions and page loads.
 */
export default function LoadingPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <LoadingSkeleton lines={4} />
      </div>
    </div>
  )
}
