import type { BlogPost } from '@/types/common'

/**
 * Blog post metadata for client-side display (cards, homepage sections).
 *
 * The canonical source of truth is the markdown files in content/blog/.
 * Update this array when adding new posts to keep client components in sync.
 */
export const BLOG_POSTS = [
  // ── July 20, 2026 ──
  {
    title: 'How to Generate Strong Passwords That You Will Actually Remember',
    excerpt:
      'A practical guide to password security that balances strength with usability. Learn how password entropy works, why length beats complexity, and how to generate passwords that keep your accounts safe without driving you crazy.',
    date: 'Jul 20, 2026',
    category: 'Guide',
    slug: 'password-generator-guide',
    content: '',
    author: 'Michael Schneider',
    readingTime: '5 min read',
  },
  // ── July 19, 2026 ──
  {
    title: 'Unix Timestamps Explained: A Tool I Use Every Day',
    excerpt:
      'What Unix timestamps are, why they are everywhere in software, and how a simple converter saves hours of debugging. A developers guide with real-world examples from API work and log analysis.',
    date: 'Jul 19, 2026',
    category: 'Guide',
    slug: 'timestamp-converter-guide',
    content: '',
    author: 'Michael Schneider',
    readingTime: '5 min read',
  },
  {
    title: 'Stop Copy-Pasting Lorem Ipsum — Generate It Instantly Instead',
    excerpt:
      'Why hunting for placeholder text wastes time and how a dedicated lorem ipsum generator speeds up design mockups, wireframes, and CMS templates. Practical tips for designers and developers.',
    date: 'Jul 19, 2026',
    category: 'Guide',
    slug: 'lorem-ipsum-generator-guide',
    content: '',
    author: 'Michael Schneider',
    readingTime: '5 min read',
  },
  // ── July 18, 2026 ──
  {
    title: 'What Is a Hash? A Developers Guide to Generating Secure Hashes',
    excerpt:
      'An accessible explanation of cryptographic hashing — deterministic output, fixed length, the avalanche effect — and how to use the SaveVex Hash Generator for file integrity checks and data verification.',
    date: 'Jul 18, 2026',
    category: 'Guide',
    slug: 'hash-generator-guide',
    content: '',
    author: 'Michael Schneider',
    readingTime: '5 min read',
  },
  {
    title: 'Why Unique IDs Matter and How to Generate Them Instantly',
    excerpt:
      'UUIDs are the invisible backbone of distributed systems, database keys, and API tracing. Learn how UUID v4 works, why collision probability is so low, and how to generate them in seconds.',
    date: 'Jul 18, 2026',
    category: 'Guide',
    slug: 'uuid-generator-guide',
    content: '',
    author: 'Michael Schneider',
    readingTime: '5 min read',
  },
  // ── July 17, 2026 ──
  {
    title: 'QR Codes Are Everywhere — Here Is How to Create Them Without Compromising Privacy',
    excerpt:
      'Most online QR code generators send your data through their servers. Learn how to generate QR codes locally — for URLs, WiFi credentials, and more — with full control over error correction and output format.',
    date: 'Jul 17, 2026',
    category: 'Guide',
    slug: 'qr-code-generator-guide',
    content: '',
    author: 'Michael Schneider',
    readingTime: '5 min read',
  },
  {
    title: 'Why Every Designer Needs a Reliable Color Picker (And What I Use)',
    excerpt:
      'A practical guide to choosing, picking, and converting colors across HEX, RGB, HSL, and OKLCH formats. Learn why color accessibility matters and how a good color picker fits into a real design workflow.',
    date: 'Jul 17, 2026',
    category: 'Guide',
    slug: 'color-picker-guide',
    content: '',
    author: 'Michael Schneider',
    readingTime: '5 min read',
  },
  // ── July 11, 2026 ──
  {
    title: 'SaveVex Utility Tools: Now Available — Everything You Need in One Place',
    excerpt:
      'Announcing the launch of SaveVex Utility Tools: QR Code Generator, Color Picker, Timestamp Converter, UUID Generator, Hash Generator, Lorem Ipsum Generator, and Password Generator. Free, private, and entirely browser-based.',
    date: 'Jul 11, 2026',
    category: 'News',
    slug: 'savevex-utility-tools-now-available',
    content: '',
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
    readingTime: '3 min read',
  },
  {
    title: 'New Video Tools: Reverse, Extract Audio, and Video to GIF — Now Available on SaveVex',
    excerpt:
      'We\'ve added three powerful new video tools to SaveVex: Reverse Video, Extract Audio, and Video to GIF. Create creative effects, extract soundtracks, and make animated GIFs — all free and in your browser.',
    date: 'Jul 16, 2026',
    category: 'News',
    slug: 'new-video-tools-reverse-extract-audio-gif',
    content: '',
    author: 'Michael Schneider',
    readingTime: '6 min read',
  },
  // ── July 15, 2026 ──
  {
    title: 'SaveVex Video Tools: Now Available — Compress, Convert, Trim, Merge, Crop, Rotate, Resize, and Speed Control',
    excerpt:
      'Announcing the launch of all 8 SaveVex video tools. Compress, convert, trim, merge, crop, rotate, resize, and adjust video speed — all free, private, and entirely in your browser.',
    date: 'Jul 15, 2026',
    category: 'News',
    slug: 'savevex-video-tools-launch',
    content: '',
    author: 'Michael Schneider',
    readingTime: '6 min read',
  },
  {
    title: 'How to Crop Video: Remove Unwanted Edges and Focus on What Matters',
    excerpt:
      'Learn how to crop videos to remove unwanted edges, reframe shots, and fit social media formats. Free, private, and entirely in your browser.',
    date: 'Jul 15, 2026',
    category: 'Guide',
    slug: 'how-to-crop-video',
    content: '',
    author: 'Michael Schneider',
    readingTime: '4 min read',
  },
  {
    title: 'How to Rotate Video: Fix Orientation and Get Creative',
    excerpt:
      'Learn how to rotate videos to fix orientation, create artistic angles, and flip footage. Free, private, and entirely in your browser.',
    date: 'Jul 15, 2026',
    category: 'Guide',
    slug: 'how-to-rotate-video',
    content: '',
    author: 'Michael Schneider',
    readingTime: '4 min read',
  },
  {
    title: 'How to Resize Video: Change Resolution and Aspect Ratio',
    excerpt:
      'Learn how to resize videos for any platform — scale to 1080p, fit Instagram dimensions, or reduce file size. Free, private, and entirely in your browser.',
    date: 'Jul 15, 2026',
    category: 'Guide',
    slug: 'how-to-resize-video',
    content: '',
    author: 'Michael Schneider',
    readingTime: '4 min read',
  },
  {
    title: 'How to Change Video Speed: Slow Motion, Fast Motion, and Everything In Between',
    excerpt:
      'Learn how to speed up or slow down any video while keeping audio pitch natural. Perfect for slow motion, time-lapse, and fast-forward. Free and private.',
    date: 'Jul 15, 2026',
    category: 'Guide',
    slug: 'video-speed-controller-guide',
    content: '',
    author: 'Michael Schneider',
    readingTime: '4 min read',
  },
  // ── July 14, 2026 (Video Tools) ──
  {
    title: 'How to Compress Video Files Without Losing Quality — Free Online Tool',
    excerpt:
      'Learn how to compress video files without sacrificing quality using our free online tool. Fast, secure, and entirely in your browser.',
    date: 'Jul 14, 2026',
    category: 'Guide',
    slug: 'compress-video-guide',
    content: '',
    author: 'Michael Schneider',
    readingTime: '4 min read',
  },
  {
    title: 'How to Convert Video Files to Any Format — Free Online Converter',
    excerpt:
      'Learn how to convert video files between formats with our free online converter. Support for MP4, MOV, AVI, and MKV. Fast, secure, and entirely in your browser.',
    date: 'Jul 14, 2026',
    category: 'Guide',
    slug: 'convert-video-guide',
    content: '',
    author: 'Michael Schneider',
    readingTime: '4 min read',
  },
  {
    title: 'How to Trim Video Clips Like a Pro — Free Online Video Trimmer',
    excerpt:
      'Learn how to trim video clips with precision using our free online trimmer. Frame-accurate cuts, instant preview, and entirely browser-based.',
    date: 'Jul 14, 2026',
    category: 'Guide',
    slug: 'trim-video-guide',
    content: '',
    author: 'Michael Schneider',
    readingTime: '4 min read',
  },
  {
    title: 'How to Merge Videos into One Seamless File — Free Online Video Merger',
    excerpt:
      'Learn how to combine multiple videos into one seamless file with our free online video merger. Drag to reorder, instant merging, entirely browser-based.',
    date: 'Jul 14, 2026',
    category: 'Guide',
    slug: 'merge-video-guide',
    content: '',
    author: 'Michael Schneider',
    readingTime: '4 min read',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
    readingTime: '3 min read',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
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
    author: 'Michael Schneider',
    readingTime: '3 min read',
  },
] as const satisfies BlogPost[]
