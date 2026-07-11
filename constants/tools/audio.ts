import type { Tool } from '@/types/tool'

export const audioTools = [
  {
    id: 'convert-audio', slug: 'convert-audio', name: 'Convert Audio', category: 'audio',
    description: 'Convert audio files between MP3, WAV, AAC, OGG, FLAC, and M4A formats. Free, fast, and entirely in your browser.',
    icon: '🔄', badge: null,
    dateAdded: '2024-01-11', inputFormats: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'], outputFormats: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'], isComingSoon: false,
  },
  {
    id: 'merge-audio', slug: 'merge-audio', name: 'Merge Audio', category: 'audio',
    description: 'Combine multiple audio files into a single track. Free, fast, and entirely in your browser.',
    icon: '🔗', badge: null,
    dateAdded: '2024-01-12', inputFormats: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'], outputFormats: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'], isComingSoon: false,
  },
  {
    id: 'trim-audio', slug: 'trim-audio', name: 'Trim Audio', category: 'audio',
    description: 'Cut and trim audio files to extract the perfect segment. Free, fast, and entirely in your browser.',
    icon: '✂️', badge: null,
    dateAdded: '2024-01-12', inputFormats: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'], outputFormats: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'], isComingSoon: false,
  },
  {
    id: 'change-volume', slug: 'change-volume', name: 'Change Volume', category: 'audio',
    description: 'Adjust audio volume levels', icon: '🔊', badge: null,
    dateAdded: '2024-01-12', inputFormats: ['mp3', 'wav', 'aac'], outputFormats: ['mp3', 'wav'], isComingSoon: true,
  },
] as const satisfies Tool[]
