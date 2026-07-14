'use client'

import { Suspense, useState, useMemo } from 'react'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { BlogCard } from '@/components/shared/BlogCard'
import { BLOG_POSTS } from '@/constants/blog'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

const POSTS_PER_PAGE = 9

function BlogContent() {
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  // Sort newest first
  const allPosts = useMemo(
    () =>
      [...BLOG_POSTS].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    []
  )

  // Client-side filter
  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return allPosts
    const q = searchQuery.toLowerCase()
    return allPosts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    )
  }, [allPosts, searchQuery])

  // Reset to page 1 when search changes
  const effectivePage = searchQuery.trim() ? 1 : currentPage
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE)
  const clampedPage = Math.max(1, Math.min(effectivePage, totalPages || 1))
  const paginatedPosts = filteredPosts.slice(
    (clampedPage - 1) * POSTS_PER_PAGE,
    clampedPage * POSTS_PER_PAGE
  )

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  return (
    <>
      {/* Search bar */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Search blog articles"
            />
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-16">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">
                No posts found for &quot;{searchQuery}&quot;
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Try a different search term or{' '}
                <button
                  onClick={() => { setSearchQuery(''); setCurrentPage(1) }}
                  className="text-primary hover:underline"
                >
                  clear the search
                </button>
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedPosts.map((post) => (
                  <BlogCard key={post.slug} post={post} variant="default" />
                ))}
              </div>

              {/* Pagination — instant client-side, no page reload */}
              {totalPages > 1 && (
                <nav
                  className="flex items-center justify-center gap-2 mt-12"
                  aria-label="Blog pagination"
                >
                  <button
                    onClick={() => goToPage(clampedPage - 1)}
                    disabled={clampedPage <= 1}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => goToPage(p)}
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        p === clampedPage
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border hover:bg-muted'
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    onClick={() => goToPage(clampedPage + 1)}
                    disabled={clampedPage >= totalPages}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </nav>
              )}

              <p className="text-center text-sm text-muted-foreground mt-6">
                Showing {paginatedPosts.length} of {filteredPosts.length} post
                {filteredPosts.length !== 1 ? 's' : ''}
              </p>
            </>
          )}
        </div>
      </section>
    </>
  )
}

export default function BlogPage() {
  return (
    <PageLayout>
      <PageHero
        title="SaveVex Blog"
        description="Tips, tutorials, and guides for file processing and media conversion."
      />
      <Suspense
        fallback={
          <section className="py-16 px-4">
            <div className="max-w-6xl mx-auto">
              <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-48 bg-muted rounded-xl" />
                ))}
              </div>
            </div>
          </section>
        }
      >
        <BlogContent />
      </Suspense>
    </PageLayout>
  )
}
