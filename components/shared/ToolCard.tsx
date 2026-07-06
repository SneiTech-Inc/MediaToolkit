import Link from 'next/link'
import type { Tool } from '@/types/tool'

interface ToolCardProps {
  tool: Tool
  href?: string
  variant?: 'default' | 'compact' | 'related'
}

/**
 * Card displaying a tool's icon, name, description, and badge.
 * Used in the homepage grid, category pages, recently added, and "related tools" sidebar.
 * Produces the exact same DOM as the original inline cards.
 */
export function ToolCard({ tool, href, variant = 'default' }: ToolCardProps) {
  const isCompact = variant === 'compact'
  const isRelated = variant === 'related'

  const card = (
    <div
      className={`group rounded-xl border transition-all duration-300 h-full ${
        tool.isComingSoon
          ? 'border-muted opacity-60 hover:opacity-100'
          : `border-border hover:border-primary hover:shadow-lg ${href ? 'cursor-pointer' : ''}`
      } ${isCompact ? 'p-4' : 'p-6'} ${isRelated ? 'p-3 hover:bg-muted' : ''}`}
    >
      <div className={`flex items-${isRelated ? 'center gap-3' : 'start justify-between mb-3'}`}>
        <div className={`${isRelated ? 'text-2xl' : 'text-3xl'}`}>{tool.icon}</div>
        {!isRelated && tool.badge === 'popular' && (
          <span className="bg-accent text-accent-foreground text-xs font-bold px-2 py-1 rounded">
            Popular
          </span>
        )}
        {!isRelated && tool.badge === 'coming-soon' && (
          <span className="bg-muted text-muted-foreground text-xs font-bold px-2 py-1 rounded">
            Coming Soon
          </span>
        )}
        {!isRelated && tool.badge === 'new' && (
          <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
            New
          </span>
        )}
      </div>

      {isRelated ? (
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{tool.name}</p>
        </div>
      ) : (
        <>
          <h3 className={`font-semibold text-lg transition-colors ${
            !tool.isComingSoon && 'group-hover:text-primary'
          }`}>
            {tool.name}
          </h3>
          <p className={`text-sm text-muted-foreground mt-2 ${isCompact ? 'line-clamp-1' : 'line-clamp-2'}`}>
            {tool.description}
          </p>
        </>
      )}

      {tool.isComingSoon && !isRelated && (
        <div className="mt-4 text-sm text-muted-foreground font-semibold">
          Coming Soon
        </div>
      )}
    </div>
  )

  if (href && !tool.isComingSoon) {
    return <Link href={href}>{card}</Link>
  }

  return card
}
