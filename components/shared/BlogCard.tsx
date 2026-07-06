import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { BlogPost } from '@/types/common'

interface BlogCardProps {
  post: BlogPost
  variant?: 'default' | 'compact' | 'featured'
}

/**
 * Blog post card used in homepage featured posts, blog listing, and blog section component.
 * Three variants share the same data but differ in layout density.
 */
export function BlogCard({ post, variant = 'default' }: BlogCardProps) {
  const href = `/blog/${post.slug}`

  if (variant === 'compact') {
    return (
      <Link href={href}>
        <div className="group p-6 rounded-xl border border-border hover:border-primary hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
          <span className="inline-block bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full mb-3">
            {post.category}
          </span>
          <h3 className="text-lg font-semibold group-hover:text-primary transition-colors mb-2 line-clamp-2">
            {post.title}
          </h3>
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{post.excerpt}</p>
          <p className="text-xs text-muted-foreground">{post.date}</p>
        </div>
      </Link>
    )
  }

  if (variant === 'featured') {
    return (
      <article className="group rounded-xl border border-border bg-gradient-to-br from-background to-card overflow-hidden hover:shadow-xl hover:border-primary transition-all duration-300 cursor-pointer">
        <div className="h-48 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:from-primary/30 group-hover:to-accent/30 transition-colors">
          <div className="text-5xl opacity-50 group-hover:opacity-100 transition-opacity">📝</div>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary">
              {post.category}
            </span>
            <span className="text-xs text-muted-foreground">{post.date}</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
            {post.title}
          </h3>
          <p className="text-muted-foreground text-sm mb-4 leading-relaxed">{post.excerpt}</p>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity">
            Read More <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </article>
    )
  }

  // default variant — same as compact but used in blog listing with 3-line excerpt
  return (
    <Link href={href}>
      <div className="group p-6 rounded-xl border border-border hover:border-primary hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
        <span className="inline-block bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full mb-3">
          {post.category}
        </span>
        <h3 className="text-lg font-semibold group-hover:text-primary transition-colors mb-2 line-clamp-2">
          {post.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{post.excerpt}</p>
        <p className="text-xs text-muted-foreground">{post.date}</p>
      </div>
    </Link>
  )
}
