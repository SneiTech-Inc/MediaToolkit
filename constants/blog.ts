import type { BlogPost } from '@/types/common'

/**
 * Blog post metadata for client-side display (cards, homepage sections).
 *
 * The canonical source of truth is the markdown files in content/blog/.
 * Update this array when adding new posts to keep client components in sync.
 */
export const BLOG_POSTS = [
  // ── July 11, 2026 ──
  {
    title: 'SaveVex Utility Tools: Now Available — Everything You Need in One Place',
    excerpt:
      'Announcing the launch of SaveVex Utility Tools: QR Code Generator, Color Picker, Timestamp Converter, UUID Generator, Hash Generator, Lorem Ipsum Generator, and Password Generator. Free, private, and entirely browser-based.',
    date: 'Jul 11, 2026',
    category: 'News',
    slug: 'savevex-utility-tools-now-available',
    content: '',
    readingTime: '5 min read',
  },
  {
    title: 'SaveVex Audio Tools: Now Available — Convert, Merge, Trim, and Boost Your Audio',
    excerpt:
      'Announcing the launch of SaveVex Audio Tools: Convert Audio, Merge Audio, Trim Audio, and Change Volume. Process audio entirely in your browser — free, fast, and private.',
    date: 'Jul 11, 2026',
    category: 'News',
    slug: 'savevex-audio-tools-now-available',
    content: '',
    readingTime: '3 min read',
  },
  // ── July 10, 2026 ──
  {
    title: 'Why SaveVex is the Best and Most Secure Media Toolkit',
    excerpt:
      'Discover why SaveVex is the most secure, private, and capable free media toolkit available. Browser-based processing, no uploads, zero compromise on quality.',
    date: 'Jul 10, 2026',
    category: 'Guide',
    slug: 'why-savevex-best-secure-toolkit',
    content: '',
    readingTime: '5 min read',
  },
  {
    title: 'Does SaveVex Collect or Record User Data?',
    excerpt:
      'A clear explanation of SaveVex privacy practices. Learn what data we do and do not collect, how local processing keeps your files safe, and what you can expect.',
    date: 'Jul 10, 2026',
    category: 'Guide',
    slug: 'savevex-privacy-data-policy',
    content: '',
    readingTime: '4 min read',
  },
  {
    title: 'The Complete Guide to SaveVex Image Tools',
    excerpt:
      'Your comprehensive guide to all SaveVex image tools: compress, resize, crop, convert, rotate, flip, watermark, blur, add border, and image to PDF. Learn when and how to use each one.',
    date: 'Jul 10, 2026',
    category: 'Guide',
    slug: 'savevex-image-tools-guide',
    content: '',
    readingTime: '5 min read',
  },
  // ── July 9, 2026 ──
  {
    title: 'How to Compress PDF Files Without Losing Quality',
    excerpt:
      'Learn the best methods to reduce PDF file size while maintaining document quality, including compression settings, image optimization, and advanced techniques.',
    date: 'Jul 9, 2026',
    category: 'Guide',
    slug: 'compress-pdf-guide',
    content: '',
    readingTime: '5 min read',
  },
  {
    title: 'How to Compress PDF: Reduce File Size Without Sacrificing Quality',
    excerpt:
      'A practical guide to PDF compression. Learn the best compression settings, how to balance file size against quality, and the exact workflow for compressing any PDF.',
    date: 'Jul 9, 2026',
    category: 'Guide',
    slug: 'compress-pdf-advanced',
    content: '',
    readingTime: '4 min read',
  },
  {
    title: 'How to Count Words and Characters Like a Pro',
    excerpt:
      'Master word and character counting for writing, SEO, and content optimization. Tips for hitting word counts, tracking progress, and using counters effectively.',
    date: 'Jul 9, 2026',
    category: 'Guide',
    slug: 'word-counter-guide',
    content: '',
    readingTime: '3 min read',
  },
  {
    title: 'How to Generate Strong Passwords: A Complete Guide',
    excerpt:
      'Learn how to create and manage strong passwords that keep your accounts secure. Tips for generating uncrackable passwords, avoiding common mistakes, and using password tools.',
    date: 'Jul 9, 2026',
    category: 'Guide',
    slug: 'password-generator-guide',
    content: '',
    readingTime: '4 min read',
  },
  // ── July 8, 2026 ──
  {
    title: 'The Ultimate Guide to Online Image Compression',
    excerpt:
      'Discover how to compress images for web without sacrificing visual quality. Learn about lossy vs lossless compression, format selection, and best practices for faster websites.',
    date: 'Jul 8, 2026',
    category: 'Tutorial',
    slug: 'image-compression-guide',
    content: '',
    readingTime: '4 min read',
  },
  {
    title: 'How to Crop Images: A Step-by-Step Guide',
    excerpt:
      'Master image cropping for better composition. Learn about aspect ratios, composition rules, and how to crop images perfectly for any platform or purpose.',
    date: 'Jul 8, 2026',
    category: 'Tutorial',
    slug: 'crop-image-guide',
    content: '',
    readingTime: '3 min read',
  },
  {
    title: 'How to Convert Word to PDF: Preserve Formatting Every Time',
    excerpt:
      'Learn how to convert Word documents to PDF while keeping fonts, images, and layout intact. Step-by-step guide for professional document sharing.',
    date: 'Jul 8, 2026',
    category: 'Guide',
    slug: 'word-to-pdf-guide',
    content: '',
    readingTime: '4 min read',
  },
  {
    title: 'How to Convert PDF to Excel: Extract Tables Like a Pro',
    excerpt:
      'Master the art of converting PDF tables to Excel spreadsheets. Learn how to extract data cleanly, handle complex tables, and avoid common formatting pitfalls.',
    date: 'Jul 8, 2026',
    category: 'Guide',
    slug: 'pdf-to-excel-guide',
    content: '',
    readingTime: '4 min read',
  },
  // ── July 7, 2026 ──
  {
    title: 'SaveVex Launch: Free File Processing for Everyone',
    excerpt:
      'Introducing SaveVex — your all-in-one toolkit for files, images, and media. 100% free, no signup, entirely browser-based processing.',
    date: 'Jul 7, 2026',
    category: 'News',
    slug: 'savevex-launch',
    content: '',
    readingTime: '3 min read',
  },
  {
    title: 'How to Compress Images for Web: A Complete Guide',
    excerpt:
      'Master image compression for the web. Learn how to optimize JPEG, PNG, WebP, and AVIF images for faster loading, better SEO, and improved user experience.',
    date: 'Jul 7, 2026',
    category: 'Guide',
    slug: 'compress-image-guide',
    content: '',
    readingTime: '4 min read',
  },
  {
    title: 'How to Resize Images Without Losing Quality',
    excerpt:
      'Learn how to resize images for social media, websites, and email while maintaining sharp, professional quality. Tips for aspect ratios, resolution, and batch resizing.',
    date: 'Jul 7, 2026',
    category: 'Tutorial',
    slug: 'resize-image-guide',
    content: '',
    readingTime: '4 min read',
  },
  {
    title: 'How to Convert Images: JPG, PNG, WebP & More',
    excerpt:
      'Master image format conversion. Learn when to use JPG, PNG, WebP, AVIF, SVG, and other formats, plus how to convert between them without quality loss.',
    date: 'Jul 7, 2026',
    category: 'Tutorial',
    slug: 'convert-image-guide',
    content: '',
    readingTime: '4 min read',
  },
  // ── July 6, 2026 ──
  {
    title: 'How to Merge PDF Files: The Complete Guide',
    excerpt:
      'Learn how to combine multiple PDF files into a single document with ease. Step-by-step tutorial with tips, use cases, and best practices for merging PDFs online.',
    date: 'Jul 6, 2026',
    category: 'Guide',
    slug: 'merge-pdf-guide',
    content: '',
    readingTime: '4 min read',
  },
  {
    title: 'How to Split PDF Files: Extract Pages Like a Pro',
    excerpt:
      'Master the art of splitting PDFs. Learn when and why to split documents, how to extract specific pages, and the best practices for organizing your files.',
    date: 'Jul 6, 2026',
    category: 'Guide',
    slug: 'split-pdf-guide',
    content: '',
    readingTime: '4 min read',
  },
  {
    title: 'How to Rotate PDF Pages: A Quick & Easy Guide',
    excerpt:
      'Learn how to rotate PDF pages to fix orientation issues. Quick guide for fixing scanned documents, rotating individual pages, and handling bulk rotation.',
    date: 'Jul 6, 2026',
    category: 'Guide',
    slug: 'rotate-pdf-guide',
    content: '',
    readingTime: '3 min read',
  },
] as const satisfies BlogPost[]
