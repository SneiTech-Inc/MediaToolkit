import type { Tool } from '@/types/tool'

export const pdfTools = [
  {
    id: 'merge-pdf', slug: 'merge-pdf', name: 'Merge PDF', category: 'pdf',
    description: 'Combine multiple PDFs into a single file', icon: '🔗', badge: null,
    dateAdded: '2024-01-01', inputFormats: ['pdf'], outputFormats: ['pdf'], isComingSoon: false,
  },
  {
    id: 'split-pdf', slug: 'split-pdf', name: 'Split PDF', category: 'pdf',
    description: 'Extract pages or divide PDF into separate files', icon: '✂️', badge: null,
    dateAdded: '2024-01-01', inputFormats: ['pdf'], outputFormats: ['pdf'], isComingSoon: false,
  },
  {
    id: 'compress-pdf', slug: 'compress-pdf', name: 'Compress PDF', category: 'pdf',
    description: 'Reduce PDF file size without losing quality', icon: '📉', badge: 'popular',
    dateAdded: '2024-01-01', inputFormats: ['pdf'], outputFormats: ['pdf'], isComingSoon: false,
  },
  {
    id: 'pdf-to-jpg', slug: 'pdf-to-jpg', name: 'PDF to JPG', category: 'pdf',
    description: 'Convert PDF pages to JPG images', icon: '🖼️', badge: null,
    dateAdded: '2024-01-01', inputFormats: ['pdf'], outputFormats: ['jpg'], isComingSoon: false,
  },
  {
    id: 'jpg-to-pdf', slug: 'jpg-to-pdf', name: 'JPG to PDF', category: 'pdf',
    description: 'Convert images to PDF document', icon: '📸', badge: null,
    dateAdded: '2024-01-01', inputFormats: ['jpg', 'png', 'webp'], outputFormats: ['pdf'], isComingSoon: false,
  },
  {
    id: 'rotate-pdf', slug: 'rotate-pdf', name: 'Rotate PDF', category: 'pdf',
    description: 'Rotate PDF pages 90°, 180°, or 270°', icon: '🔁', badge: null,
    dateAdded: '2024-01-02', inputFormats: ['pdf'], outputFormats: ['pdf'], isComingSoon: false,
  },
  {
    id: 'watermark-pdf', slug: 'watermark-pdf', name: 'Watermark PDF', category: 'pdf',
    description: 'Add text or image watermarks to PDFs', icon: '💧', badge: null,
    dateAdded: '2024-01-02', inputFormats: ['pdf'], outputFormats: ['pdf'], isComingSoon: false,
  },
  {
    id: 'organize-pdf', slug: 'organize-pdf', name: 'Organize PDF', category: 'pdf',
    description: 'Reorder, delete, or rearrange PDF pages', icon: '📑', badge: null,
    dateAdded: '2024-01-02', inputFormats: ['pdf'], outputFormats: ['pdf'], isComingSoon: false,
  },
  {
    id: 'pdf-page-numbers', slug: 'pdf-page-numbers', name: 'PDF Page Numbers', category: 'pdf',
    description: 'Add page numbers to PDF documents', icon: '🔢', badge: null,
    dateAdded: '2024-01-03', inputFormats: ['pdf'], outputFormats: ['pdf'], isComingSoon: false,
  },
  {
    id: 'protect-pdf', slug: 'protect-pdf', name: 'Protect PDF', category: 'pdf',
    description: 'Add password protection to PDFs', icon: '🔐', badge: null,
    dateAdded: '2024-01-03', inputFormats: ['pdf'], outputFormats: ['pdf'], isComingSoon: true,
  },
  {
    id: 'unlock-pdf', slug: 'unlock-pdf', name: 'Unlock PDF', category: 'pdf',
    description: 'Remove password protection from PDFs', icon: '🔓', badge: null,
    dateAdded: '2024-01-03', inputFormats: ['pdf'], outputFormats: ['pdf'], isComingSoon: true,
  },
  {
    id: 'crop-pdf', slug: 'crop-pdf', name: 'Crop PDF', category: 'pdf',
    description: 'Remove unwanted borders from PDF pages', icon: '🎯', badge: null,
    dateAdded: '2024-01-04', inputFormats: ['pdf'], outputFormats: ['pdf'], isComingSoon: false,
  },
] as const satisfies Tool[]
