import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  title: string
  message?: string
  action?: {
    label: string
    href: string
  }
}

/**
 * Standard "not found" / empty state displayed when data is missing.
 * Replaces duplicated fallback UI in category and tool pages.
 */
export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        {message && <p className="text-muted-foreground mt-2">{message}</p>}
        {action && (
          <Link href={action.href}>
            <Button className="mt-4">{action.label}</Button>
          </Link>
        )}
      </div>
    </div>
  )
}
