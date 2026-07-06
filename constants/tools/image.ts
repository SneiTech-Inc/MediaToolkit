import type { Tool } from '@/types/tool'

export const imageTools = [
  {
    id: 'compress-image', slug: 'compress-image', name: 'Compress Image', category: 'image',
    description: 'Reduce image file size while maintaining quality', icon: '📉', badge: 'popular',
    dateAdded: '2024-01-04', inputFormats: ['jpg', 'png', 'webp', 'gif'], outputFormats: ['jpg', 'png', 'webp'], isComingSoon: false,
  },
  {
    id: 'resize-image', slug: 'resize-image', name: 'Resize Image', category: 'image',
    description: 'Change image dimensions and aspect ratios', icon: '📐', badge: null,
    dateAdded: '2024-01-04', inputFormats: ['jpg', 'png', 'webp'], outputFormats: ['jpg', 'png', 'webp'], isComingSoon: false,
  },
  {
    id: 'convert-image', slug: 'convert-image', name: 'Convert Image', category: 'image',
    description: 'Convert between JPG, PNG, WebP, and more', icon: '🔄', badge: null,
    dateAdded: '2024-01-05', inputFormats: ['jpg', 'png', 'webp', 'gif', 'bmp'], outputFormats: ['jpg', 'png', 'webp'], isComingSoon: false,
  },
  {
    id: 'crop-image', slug: 'crop-image', name: 'Crop Image', category: 'image',
    description: 'Remove unwanted areas from images', icon: '✂️', badge: null,
    dateAdded: '2024-01-05', inputFormats: ['jpg', 'png', 'webp'], outputFormats: ['jpg', 'png', 'webp'], isComingSoon: false,
  },
  {
    id: 'rotate-image', slug: 'rotate-image', name: 'Rotate Image', category: 'image',
    description: 'Rotate images 90°, 180°, or 270°', icon: '🔁', badge: null,
    dateAdded: '2024-01-05', inputFormats: ['jpg', 'png', 'webp'], outputFormats: ['jpg', 'png', 'webp'], isComingSoon: false,
  },
  {
    id: 'flip-image', slug: 'flip-image', name: 'Flip Image', category: 'image',
    description: 'Flip images horizontally or vertically', icon: '🔀', badge: null,
    dateAdded: '2024-01-06', inputFormats: ['jpg', 'png', 'webp'], outputFormats: ['jpg', 'png', 'webp'], isComingSoon: false,
  },
  {
    id: 'watermark-image', slug: 'watermark-image', name: 'Watermark Image', category: 'image',
    description: 'Add text or image watermarks to images', icon: '💧', badge: null,
    dateAdded: '2024-01-06', inputFormats: ['jpg', 'png', 'webp'], outputFormats: ['jpg', 'png', 'webp'], isComingSoon: false,
  },
  {
    id: 'blur-image', slug: 'blur-image', name: 'Blur Image', category: 'image',
    description: 'Blur entire image or specific areas', icon: '🌫️', badge: null,
    dateAdded: '2024-01-06', inputFormats: ['jpg', 'png', 'webp'], outputFormats: ['jpg', 'png', 'webp'], isComingSoon: false,
  },
  {
    id: 'image-to-pdf', slug: 'image-to-pdf', name: 'Image to PDF', category: 'image',
    description: 'Convert images to PDF document', icon: '📄', badge: null,
    dateAdded: '2024-01-07', inputFormats: ['jpg', 'png', 'webp'], outputFormats: ['pdf'], isComingSoon: false,
  },
  {
    id: 'add-border', slug: 'add-border', name: 'Add Border', category: 'image',
    description: 'Add colored borders to images', icon: '🖼️', badge: null,
    dateAdded: '2024-01-07', inputFormats: ['jpg', 'png', 'webp'], outputFormats: ['jpg', 'png', 'webp'], isComingSoon: false,
  },
  {
    id: 'remove-background', slug: 'remove-background', name: 'Remove Background', category: 'image',
    description: 'Remove backgrounds from images using AI', icon: '✨', badge: 'coming-soon',
    dateAdded: '2024-01-07', inputFormats: ['jpg', 'png', 'webp'], outputFormats: ['png'], isComingSoon: true,
  },
] as const satisfies Tool[]
