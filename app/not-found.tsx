import type { Metadata } from 'next'
import { PageLayout } from '@/components/shared/PageLayout'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { FileQuestion, Home, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: '404 — Page Not Found | SaveVex',
  description: 'The page you are looking for does not exist or has been moved.',
}

/**
 * Custom 404 page for unmatched routes.
 * Branded with gradient hero, icon, and clear navigation back to the homepage.
 */
export default function NotFoundPage() {
  return (
    <PageLayout>
      {/* Gradient hero banner */}
      <section className="bg-gradient-to-b from-primary/10 to-accent/5 py-24 px-4 border-b border-border">
        <div className="max-w-6xl mx-auto text-center">
          {/* 404 visual */}
          <div className="mb-6">
            <FileQuestion className="w-20 h-20 text-primary mx-auto" />
          </div>

          {/* Heading */}
          <h1 className="text-4xl md:text-5xl font-bold">
            Page Not Found
          </h1>

          {/* Message */}
          <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            Let&apos;s get you back on track.
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-4 mt-8 flex-wrap">
            <Button asChild size="lg">
              <Link href="/">
                <Home className="w-4 h-4" />
                Back to Home
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/tools/text/sort-lines">
                Explore Tools
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Helpful links section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-8">Looking for something?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/blog"
              className="rounded-xl border border-border p-6 hover:border-primary hover:shadow-lg transition-all duration-300 text-left"
            >
              <h3 className="font-semibold mb-1">Blog</h3>
              <p className="text-sm text-muted-foreground">
                Tips, tutorials, and guides for file processing.
              </p>
            </Link>
            <Link
              href="/premium"
              className="rounded-xl border border-border p-6 hover:border-primary hover:shadow-lg transition-all duration-300 text-left"
            >
              <h3 className="font-semibold mb-1">Premium</h3>
              <p className="text-sm text-muted-foreground">
                Unlock advanced features and priority support.
              </p>
            </Link>
            <Link
              href="/about"
              className="rounded-xl border border-border p-6 hover:border-primary hover:shadow-lg transition-all duration-300 text-left"
            >
              <h3 className="font-semibold mb-1">About</h3>
              <p className="text-sm text-muted-foreground">
                Learn more about SaveVex and our mission.
              </p>
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
