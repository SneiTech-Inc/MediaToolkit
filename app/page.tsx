'use client'

import { PageLayout } from '@/components/shared/PageLayout'
import { SectionHeader } from '@/components/shared/SectionHeader'
import { ToolCard } from '@/components/shared/ToolCard'
import { BlogCard } from '@/components/shared/BlogCard'
import { TrustBadge } from '@/components/shared/TrustBadge'
import { Button } from '@/components/ui/button'
import { TOOLS, CATEGORIES, BLOG_POSTS, TRUST_BADGES } from '@/lib/constants'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

export default function Page() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState('all')

  const scrollToTools = () => {
    document.getElementById('tools-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  const filteredTools = selectedCategory === 'all'
    ? TOOLS
    : TOOLS.filter(tool => tool.category === selectedCategory)

  const recentlyAdded = TOOLS.slice(0, 4)
  const featuredPosts = BLOG_POSTS.slice(0, 4)

  return (
    <PageLayout>
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary/10 to-accent/5 py-16 md:py-24 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-balance">
            Compress. Convert. Edit. Optimize.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground text-balance">
            SaveVex: Your all-in-one file & media toolkit. 100% free, no signup required, entirely in your browser.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" onClick={scrollToTools} className="bg-primary hover:bg-primary/90">
              Explore Tools
            </Button>
            <Button size="lg" variant="outline" onClick={() => router.push('/blog')}>
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="border-b border-border py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TRUST_BADGES.map((badge) => (
              <div key={badge.title} className="text-center">
                <div className="text-3xl mb-2">{badge.icon}</div>
                <h3 className="font-semibold text-lg">{badge.title}</h3>
                <p className="text-sm text-muted-foreground">{badge.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Tabs & Tool Grid */}
      <section id="tools-section" className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-8">
            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-border pb-4">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>

            {/* Tools Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredTools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  href={`/tools/${tool.category}/${tool.slug}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Recently Added Section */}
      <section className="bg-muted/30 py-16 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="Recently Added" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentlyAdded.map((tool) => (
              <Link key={tool.id} href={`/tools/${tool.category}/${tool.slug}`}>
                <div className="group p-6 rounded-xl border border-border hover:border-primary hover:shadow-lg transition-all duration-300 cursor-pointer h-full bg-card">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-3xl">{tool.icon}</div>
                    {tool.dateAdded && (
                      <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                        NEW
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                    {tool.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {tool.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <SectionHeader title="How It Works" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-4">1️⃣</div>
              <h3 className="text-xl font-semibold mb-2">Upload</h3>
              <p className="text-muted-foreground">Select your file and upload it to SaveVex</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">2️⃣</div>
              <h3 className="text-xl font-semibold mb-2">Process</h3>
              <p className="text-muted-foreground">100% browser-based processing—files never leave your device</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">3️⃣</div>
              <h3 className="text-xl font-semibold mb-2">Download</h3>
              <p className="text-muted-foreground">Get your processed file instantly</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Blog Posts */}
      <section className="bg-muted/30 py-16 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            title="Latest Articles"
            description="Tips, tutorials, and news about file processing"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredPosts.map((post) => (
              <BlogCard key={post.slug} post={post} variant="compact" />
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link href="/blog" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              View All Blog Posts
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
