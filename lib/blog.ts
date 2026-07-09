import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { marked } from 'marked'
import type { BlogPost } from '@/types/common'

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

export interface BlogPostWithContent extends BlogPost {
  author: string
}

/** Get all blog post slugs, sorted by frontmatter date (newest first). */
export function getPostSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return []

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'))

  const slugsWithDates = files.map((file) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8')
    const { data } = matter(raw)
    return {
      slug: file.replace(/\.md$/, ''),
      date: data.date || '1970-01-01',
    }
  })

  slugsWithDates.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  return slugsWithDates.map((s) => s.slug)
}

/** Get all posts with full content, sorted by date (newest first). */
export function getAllPosts(): BlogPostWithContent[] {
  const slugs = getPostSlugs()
  return slugs.map((slug) => getPostBySlug(slug))
}

/** Get a single post by slug, with full HTML content. Throws if not found. */
export function getPostBySlug(slug: string): BlogPostWithContent {
  const filePath = path.join(BLOG_DIR, `${slug}.md`)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Blog post not found: ${slug}`)
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)

  const title = String(data.title || slug)
  const date = data.date ? formatDate(String(data.date)) : ''
  const category = String(data.category || 'Uncategorized')
  const excerpt = String(data.excerpt || '')
  const readingTime = String(data.readingTime || '1 min read')
  const author = String(data.author || 'SaveVex Team')

  const htmlContent = marked.parse(content) as string

  return {
    slug,
    title,
    date,
    category,
    excerpt,
    readingTime,
    content: htmlContent,
    author,
  }
}

/**
 * Get blog posts metadata only (no HTML content).
 * Used by client components that cannot import this module directly —
 * they should use `constants/blog.ts` instead. This is a server-only fallback.
 */
export function getPostsMeta(): Omit<BlogPostWithContent, 'content'>[] {
  const slugs = getPostSlugs()
  return slugs.map((slug) => {
    const post = getPostBySlug(slug)
    const { content: _, ...meta } = post
    return meta
  })
}

/** Format ISO date string (YYYY-MM-DD) to "Mon DD, YYYY" for display. */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
