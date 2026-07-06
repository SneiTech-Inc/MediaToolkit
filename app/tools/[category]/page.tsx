import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { ToolCard } from '@/components/shared/ToolCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { TOOLS, CATEGORIES } from '@/lib/constants'

interface CategoryPageProps {
  params: Promise<{ category: string }>
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params
  const category = CATEGORIES.find(c => c.slug === categorySlug)
  const categoryTools = TOOLS.filter(t => t.category === categorySlug)

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
