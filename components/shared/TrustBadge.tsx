import { CheckCircle } from 'lucide-react'
import type { TrustBadge as TrustBadgeType } from '@/types/common'

interface TrustBadgeProps {
  badge: TrustBadgeType
}

/**
 * Individual trust badge with icon, title, and description.
 * Used in homepage trust badges section and hero trust section.
 */
export function TrustBadge({ badge }: TrustBadgeProps) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-card border border-border">
      <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
      <div>
        <p className="font-semibold text-foreground text-sm">{badge.title}</p>
        <p className="text-muted-foreground text-xs mt-1">{badge.description}</p>
      </div>
    </div>
  )
}
