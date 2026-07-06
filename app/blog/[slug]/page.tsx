import type { Metadata } from 'next'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { BlogCard } from '@/components/shared/BlogCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { BLOG_POSTS } from '@/lib/constants'
import { getBlogPostMetadata } from '@/lib/metadata'
import Link from 'next/link'

interface BlogPostPageProps {
  params: { slug: string }
}

export function generateMetadata({ params }: BlogPostPageProps): Metadata {
  const post = BLOG_POSTS.find(p => p.slug === params.slug)
  if (!post) return { title: 'Post Not Found — SaveVex' }
  return getBlogPostMetadata(post)
}

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }))
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const post = BLOG_POSTS.find(p => p.slug === params.slug)

  if (!post) {
    return (
      <PageLayout>
        <EmptyState
          title="Post Not Found"
          message="The blog post you're looking for doesn't exist."
          action={{ label: 'View All Posts', href: '/blog' }}
        />
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <PageHero
        title={post.title}
        description={post.excerpt}
        backHref="/blog"
        backLabel="Blog"
      />

      <article className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Meta */}
          <div className="flex items-center gap-4 mb-8">
            <span className="inline-block bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full">
              {post.category}
            </span>
            <span className="text-sm text-muted-foreground">{post.date}</span>
          </div>

          {/* Content placeholder — full blog content will be added later */}
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p>{post.excerpt}</p>
            <p>
              This is a placeholder for the full blog post content. Detailed articles with step-by-step
              guides, screenshots, and tips will be added here in a future update.
            </p>
          </div>

          {/* Related Posts */}
          <div className="mt-16 border-t border-border pt-12">
            <h2 className="text-2xl font-bold mb-8">More Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {BLOG_POSTS.filter(p => p.slug !== post.slug).slice(0, 2).map((related) => (
                <BlogCard key={related.slug} post={related} variant="compact" />
              ))}
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/blog"
              className="text-primary hover:underline font-medium"
            >
              ← Back to all articles
            </Link>
          </div>
        </div>
      </article>
    </PageLayout>
  )
}
