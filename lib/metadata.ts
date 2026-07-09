import type { Metadata } from 'next'
import type { Tool, ToolCategory } from '@/types/tool'
import type { BlogPost } from '@/types/common'

const SITE_NAME = 'SaveVex'
const SITE_URL = 'https://savevex.com'
const DEFAULT_OG_IMAGE = '/savevex-logo.svg'

function buildMetadata({
  title,
  description,
  path,
  ogImage,
}: {
  title: string
  description: string
  path: string
  ogImage?: string
}): Metadata {
  const url = `${SITE_URL}${path}`
  const image = ogImage || DEFAULT_OG_IMAGE

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    alternates: {
      canonical: url,
    },
  }
}

/** Homepage metadata */
export function getHomeMetadata(): Metadata {
  return buildMetadata({
    title: 'SaveVex — Compress. Convert. Edit. Optimize.',
    description: 'Your all-in-one file & media toolkit. 100% free, no signup required, entirely in your browser.',
    path: '/',
  })
}

/** Tool page metadata */
export function getToolMetadata(tool: Tool): Metadata {
  return buildMetadata({
    title: `${tool.name} — Free Online Tool | ${SITE_NAME}`,
    description: `${tool.description}. Free, browser-based, no signup required.`,
    path: `/tools/${tool.category}/${tool.slug}`,
  })
}

/** Category page metadata */
export function getCategoryMetadata(category: ToolCategory): Metadata {
  return buildMetadata({
    title: `Free Online ${category.name} Tools | ${SITE_NAME}`,
    description: `Free online ${category.name.toLowerCase()} tools for everyone. No signup required, 100% browser-based processing.`,
    path: `/tools/${category.slug}`,
  })
}

/** Blog post metadata */
export function getBlogPostMetadata(post: BlogPost): Metadata {
  return buildMetadata({
    title: `${post.title} | ${SITE_NAME} Blog`,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
  })
}

/** Static page metadata (about, contact, privacy, terms, premium, blog) */
const staticPageMeta: Record<string, { title: string; description: string }> = {
  blog: {
    title: `SaveVex Blog — Tips, Tutorials & Guides`,
    description: 'Tips, tutorials, and guides for file processing and media conversion.',
  },
  premium: {
    title: `Premium Features — SaveVex`,
    description: 'Get early access to exclusive features and unlimited processing power.',
  },
  about: {
    title: `About Us — SaveVex`,
    description: 'Learn about the team and mission behind SaveVex.',
  },
  contact: {
    title: `Contact Us — SaveVex`,
    description: 'Get in touch with the SaveVex team. We\'d love to hear from you.',
  },
  privacy: {
    title: `Privacy Policy — SaveVex`,
    description: 'Learn how SaveVex protects your privacy and handles your data.',
  },
  terms: {
    title: `Terms of Service — SaveVex`,
    description: 'Read the terms and conditions for using SaveVex services.',
  },
  cookies: {
    title: `Cookie Policy — SaveVex`,
    description: 'Learn how SaveVex uses cookies and similar technologies.',
  },
  dmca: {
    title: `DMCA Notice — SaveVex`,
    description: 'Copyright infringement notification procedures for SaveVex.',
  },
}

export function getStaticPageMetadata(page: string): Metadata {
  const meta = staticPageMeta[page]
  if (!meta) {
    return buildMetadata({
      title: SITE_NAME,
      description: 'Your all-in-one file & media toolkit.',
      path: '/',
    })
  }

  const pathMap: Record<string, string> = {
    blog: '/blog',
    premium: '/premium',
    about: '/about',
    contact: '/contact',
    privacy: '/legal/privacy',
    terms: '/legal/terms',
    cookies: '/legal/cookies',
    dmca: '/legal/dmca',
  }

  return buildMetadata({
    title: meta.title,
    description: meta.description,
    path: pathMap[page] || '/',
  })
}

export { buildMetadata }
