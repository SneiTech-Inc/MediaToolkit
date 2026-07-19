import type { Metadata } from 'next'
import Link from 'next/link'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { BlogCard } from '@/components/shared/BlogCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { BlogShare } from '@/components/shared/BlogShare'
import { getPostBySlug, getPostSlugs, getAllPosts } from '@/lib/blog'
import { getBlogPostMetadata } from '@/lib/metadata'
import type { BlogPostWithContent } from '@/lib/blog'

interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  try {
    const post = getPostBySlug(slug)
    return getBlogPostMetadata(post)
  } catch {
    return { title: 'Post Not Found — SaveVex' }
  }
}

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }))
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params

  let post: BlogPostWithContent
  try {
    post = getPostBySlug(slug)
  } catch {
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

  const allPosts = getAllPosts()
  const relatedPosts = allPosts
    .filter((p) => p.slug !== slug)
    .slice(0, 2)

  // JSON-LD structured data for SEO / AdSense
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: {
      '@type': 'Person',
      name: post.author,
    },
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
          {/* Meta bar */}
          <div className="flex items-center gap-4 mb-8 flex-wrap">
            <span className="inline-block bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full">
              {post.category}
            </span>
            <span className="text-sm text-muted-foreground">{post.date}</span>
            <span className="text-sm text-muted-foreground">&middot;</span>
            <span className="text-sm text-muted-foreground">
              {post.readingTime}
            </span>
          </div>

          {/* Rendered markdown content */}
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Social sharing */}
          <BlogShare
            title={post.title}
            url={`https://savevex.com/blog/${post.slug}`}
          />

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <div className="mt-16 border-t border-border pt-12">
              <h2 className="text-2xl font-bold mb-8">More Articles</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {relatedPosts.map((related) => (
                  <BlogCard
                    key={related.slug}
                    post={related}
                    variant="compact"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-12 text-center">
            <Link
              href="/blog"
              className="text-primary hover:underline font-medium"
            >
              &larr; Back to all articles
            </Link>
          </div>
        </div>
      </article>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </PageLayout>
  )
}
