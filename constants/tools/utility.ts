import type { Tool } from '@/types/tool'

export const utilityTools = [
  {
    id: 'qr-generator', slug: 'qr-generator', name: 'QR Code Generator', category: 'utility',
    description: 'Generate QR codes from text or URLs', icon: '📲', badge: null,
    dateAdded: '2024-01-19', inputFormats: [], outputFormats: ['png', 'jpg'], isComingSoon: true,
  },
  {
    id: 'color-picker', slug: 'color-picker', name: 'Color Picker', category: 'utility',
    description: 'Pick and convert colors between formats', icon: '🎨', badge: null,
    dateAdded: '2024-01-19', inputFormats: [], outputFormats: ['txt'], isComingSoon: true,
  },
  {
    id: 'hash-generator', slug: 'hash-generator', name: 'Hash Generator', category: 'utility',
    description: 'Generate MD5, SHA hashes from text', icon: '🔏', badge: null,
    dateAdded: '2024-01-19', inputFormats: ['txt'], outputFormats: ['txt'], isComingSoon: true,
  },
  {
    id: 'uuid-generator', slug: 'uuid-generator', name: 'UUID Generator', category: 'utility',
    description: 'Generate unique UUIDs', icon: '🆔', badge: 'coming-soon',
    dateAdded: '2024-01-20', inputFormats: [], outputFormats: ['txt'], isComingSoon: true,
  },
  {
    id: 'timestamp-converter', slug: 'timestamp-converter', name: 'Timestamp Converter', category: 'utility',
    description: 'Convert between timestamps and dates', icon: '⏰', badge: 'coming-soon',
    dateAdded: '2024-01-20', inputFormats: ['txt'], outputFormats: ['txt'], isComingSoon: true,
  },
] as const satisfies Tool[]
