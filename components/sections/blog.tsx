import { SectionHeader } from '@/components/shared/SectionHeader'
import { BlogCard } from '@/components/shared/BlogCard'
import { Button } from '@/components/ui/button'
import { BLOG_POSTS } from '@/lib/constants'

export function Blog() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card border-y border-border">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          title="Latest from Our Blog"
          description="Tips, tutorials, and news about video downloading"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {BLOG_POSTS.map((post) => (
            <BlogCard key={post.slug} post={post} variant="featured" />
          ))}
        </div>

        <div className="text-center">
          <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground px-8 py-3 rounded-lg font-semibold">
            View All Articles
          </Button>
        </div>
      </div>
    </section>
  )
}
