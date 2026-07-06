import Link from 'next/link'
import type { Tool } from '@/types/tool'
import { ToolCard } from '@/components/shared/ToolCard'

interface RelatedToolsProps {
  tools: readonly Tool[]
}

/**
 * Sidebar widget showing up to 4 related tools in the same category.
 * Extracted from the tool page's right sidebar.
 */
export function RelatedTools({ tools }: RelatedToolsProps) {
  if (tools.length === 0) return null

  return (
    <div>
      <h3 className="font-semibold text-lg mb-4">Related Tools</h3>
      <div className="space-y-3">
        {tools.map((tool) => (
          <Link key={tool.id} href={`/tools/${tool.category}/${tool.slug}`}>
            <ToolCard tool={tool} variant="related" />
          </Link>
        ))}
      </div>
    </div>
  )
}
