import type { ToolCategory } from '@/types/tool'

export const CATEGORIES = [
  { id: 'pdf', name: 'PDF', slug: 'pdf', icon: '📄' },
  { id: 'image', name: 'Image', slug: 'image', icon: '🖼️' },
  { id: 'video', name: 'Video', slug: 'video', icon: '🎬' },
  { id: 'audio', name: 'Audio', slug: 'audio', icon: '🎵' },
  { id: 'document', name: 'Document', slug: 'document', icon: '📋' },
  { id: 'text', name: 'Text', slug: 'text', icon: '✏️' },
  { id: 'utility', name: 'Utility', slug: 'utility', icon: '🔧' },
] as const satisfies ToolCategory[]

// Derive slug type from the const array
export type CategorySlug = (typeof CATEGORIES)[number]['slug']
