import type { BlogPost } from '@/types/common'

export const BLOG_POSTS = [
  {
    title: 'How to Compress PDF Files Without Losing Quality',
    excerpt: 'Learn the best methods to reduce PDF file size while maintaining document quality...',
    date: 'Jan 15, 2024',
    category: 'Guide',
    slug: 'compress-pdf-guide',
  },
  {
    title: 'Online Image Compression: A Complete Guide',
    excerpt: 'Discover how to compress images for web without sacrificing visual quality...',
    date: 'Jan 12, 2024',
    category: 'Tutorial',
    slug: 'image-compression-guide',
  },
  {
    title: 'SaveVex Launch: Free File Processing for Everyone',
    excerpt: 'Introducing SaveVex—your all-in-one toolkit for files, images, and media...',
    date: 'Jan 10, 2024',
    category: 'News',
    slug: 'savevex-launch',
  },
  {
    title: 'Why 100% Browser-Based File Processing Matters',
    excerpt: 'Understand the privacy and security benefits of processing files locally in your browser...',
    date: 'Jan 08, 2024',
    category: 'Article',
    slug: 'browser-processing-benefits',
  },
] as const satisfies BlogPost[]
