import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { BlogCard } from '@/components/shared/BlogCard'
import { BLOG_POSTS } from '@/lib/constants'

export default function BlogPage() {
  return (
    <PageLayout>
      <PageHero
        title="SaveVex Blog"
        description="Tips, tutorials, and guides for file processing and media conversion."
      />

      {/* Blog Posts Grid */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BLOG_POSTS.map((post) => (
              <BlogCard key={post.slug} post={post} variant="default" />
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
