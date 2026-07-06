import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { TOOLS } from '@/lib/constants'
import { getToolMetadata } from '@/lib/metadata'
import { ToolPageClient } from './ToolPageClient'

interface ToolPageProps {
  params: Promise<{ category: string; tool: string }>
}

/** Generate metadata for every tool page from the central config. */
export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { tool } = await params
  const toolData = TOOLS.find(t => t.slug === tool)
  if (!toolData) return { title: 'Tool Not Found — SaveVex' }
  return getToolMetadata(toolData)
}

/**
 * Dynamic tool route with a registry of real tool implementations.
 *
 * Tools with real processing logic are registered via dynamic import in ToolPageClient.
 * Tools without a registered implementation fall back to the generic placeholder UI.
 */
export default async function ToolPage({ params }: ToolPageProps) {
  const { category, tool } = await params
  const toolData = TOOLS.find(t => t.slug === tool)

  if (!toolData) {
    return (
      <PageLayout>
        <EmptyState
          title="Tool not found"
          message="The tool you're looking for doesn't exist."
          action={{ label: 'Back to Home', href: '/' }}
        />
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <PageHero
        icon={toolData.icon}
        title={toolData.name}
        description={toolData.description}
        backHref={`/tools/${category}`}
        backLabel={category}
      />
      <Suspense fallback={
        <div className="py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <LoadingSkeleton lines={4} />
          </div>
        </div>
      }>
        <ToolPageClient toolSlug={tool} toolData={toolData} />
      </Suspense>
    </PageLayout>
  )
}
