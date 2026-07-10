import type { Tool } from '@/types/tool'

export const textTools = [
  {
    id: 'word-counter', slug: 'word-counter', name: 'Word Counter', category: 'text',
    description: 'Count words, characters, sentences in text', icon: '📊', badge: null,
    dateAdded: '2024-01-16', inputFormats: ['txt'], outputFormats: ['txt'], isComingSoon: false,
  },
  {
    id: 'case-converter', slug: 'case-converter', name: 'Case Converter', category: 'text',
    description: 'Convert text between uppercase, lowercase, title case', icon: '🔤', badge: null,
    dateAdded: '2024-01-16', inputFormats: ['txt'], outputFormats: ['txt'], isComingSoon: false,
  },
  {
    id: 'remove-duplicates', slug: 'remove-duplicates', name: 'Remove Duplicates', category: 'text',
    description: 'Remove duplicate lines from text', icon: '🔄', badge: null,
    dateAdded: '2024-01-17', inputFormats: ['txt'], outputFormats: ['txt'], isComingSoon: false,
  },
  {
    id: 'sort-lines', slug: 'sort-lines', name: 'Sort Lines', category: 'text',
    description: 'Sort lines alphabetically or numerically', icon: '📝', badge: null,
    dateAdded: '2024-01-17', inputFormats: ['txt'], outputFormats: ['txt'], isComingSoon: false,
  },
  {
    id: 'json-formatter', slug: 'json-formatter', name: 'JSON Formatter', category: 'text',
    description: 'Format and validate JSON code', icon: '⚙️', badge: null,
    dateAdded: '2024-01-17', inputFormats: ['json'], outputFormats: ['json'], isComingSoon: false,
  },
  {
    id: 'base64-encoder', slug: 'base64-encoder', name: 'Base64 Encoder', category: 'text',
    description: 'Encode text to Base64 format', icon: '🔐', badge: null,
    dateAdded: '2024-01-18', inputFormats: ['txt'], outputFormats: ['txt'], isComingSoon: false,
  },
  {
    id: 'url-encoder', slug: 'url-encoder', name: 'URL Encoder/Decoder', category: 'text',
    description: 'Encode and decode URLs', icon: '🌐', badge: null,
    dateAdded: '2024-01-18', inputFormats: ['txt'], outputFormats: ['txt'], isComingSoon: false,
  },
] as const satisfies Tool[]
