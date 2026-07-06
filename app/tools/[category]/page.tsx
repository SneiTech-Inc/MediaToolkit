import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { ToolCard } from '@/components/shared/ToolCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { TOOLS, CATEGORIES } from '@/lib/constants'

export default function CategoryPage({ params }: { params: { category: string } }) {
  const category = CATEGORIES.find(c => c.slug === params.category)
  const categoryTools = TOOLS.filter(t => t.category === params.category)

  if (!category) {
    return (
      <PageLayout>
        <EmptyState
          title="Category not found"
          action={{ label: 'Back to Home', href: '/' }}
        />
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <PageHero
        icon={category.icon}
        title={`${category.name} Tools`}
        description={`Free online ${category.name.toLowerCase()} tools for everyone. No signup required, 100% browser-based processing.`}
      />

      {/* Tools Grid */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Available {category.name} Tools ({categoryTools.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {categoryTools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                href={tool.isComingSoon ? undefined : `/tools/${tool.category}/${tool.slug}`}
              />
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
