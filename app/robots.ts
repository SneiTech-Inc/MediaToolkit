import type { MetadataRoute } from 'next'

/**
 * Generate robots.txt dynamically.
 * Allow all crawlers on all pages.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://savevex.com/sitemap.xml',
  }
}
