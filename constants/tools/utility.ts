import type { Tool } from '@/types/tool'

export const utilityTools = [
  {
    id: 'qr-generator', slug: 'qr-generator', name: 'QR Code Generator', category: 'utility',
    description: 'Generate QR codes from text or URLs', icon: '📲', badge: 'new',
    dateAdded: '2024-01-19', inputFormats: [], outputFormats: ['png', 'svg', 'pdf'], isComingSoon: false,
  },
  {
    id: 'color-picker', slug: 'color-picker', name: 'Color Picker', category: 'utility',
    description: 'Pick and convert colors between formats', icon: '🎨', badge: 'new',
    dateAdded: '2024-01-19', inputFormats: [], outputFormats: ['txt'], isComingSoon: false,
  },
  {
    id: 'hash-generator', slug: 'hash-generator', name: 'Hash Generator', category: 'utility',
    description: 'Generate MD5, SHA hashes from text', icon: '🔏', badge: 'new',
    dateAdded: '2024-01-19', inputFormats: ['txt'], outputFormats: ['txt'], isComingSoon: false,
  },
  {
    id: 'uuid-generator', slug: 'uuid-generator', name: 'UUID Generator', category: 'utility',
    description: 'Generate unique UUIDs', icon: '🆔', badge: 'new',
    dateAdded: '2024-01-20', inputFormats: [], outputFormats: ['txt'], isComingSoon: false,
  },
  {
    id: 'timestamp-converter', slug: 'timestamp-converter', name: 'Timestamp Converter', category: 'utility',
    description: 'Convert between timestamps and dates', icon: '⏰', badge: 'new',
    dateAdded: '2024-01-20', inputFormats: ['txt'], outputFormats: ['txt'], isComingSoon: false,
  },
  {
    id: 'lorem-ipsum-generator', slug: 'lorem-ipsum-generator', name: 'Lorem Ipsum Generator', category: 'utility',
    description: 'Generate placeholder text for designs', icon: '📝', badge: 'new',
    dateAdded: '2024-07-10', inputFormats: [], outputFormats: ['txt'], isComingSoon: false,
  },
  {
    id: 'password-generator', slug: 'password-generator', name: 'Password Generator', category: 'utility',
    description: 'Generate strong, random passwords', icon: '🔑', badge: 'new',
    dateAdded: '2024-01-18', inputFormats: [], outputFormats: ['txt'], isComingSoon: false,
  },
] as const satisfies Tool[]
