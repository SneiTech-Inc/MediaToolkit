import type { Tool } from '@/types/tool'

export const videoTools = [
  {
    id: 'compress-video', slug: 'compress-video', name: 'Compress Video', category: 'video',
    description: 'Reduce video file size without sacrificing quality. Free, fast, and entirely in your browser.', icon: '📉', badge: 'popular',
    dateAdded: '2024-01-08', inputFormats: ['mp4', 'mov', 'webm', 'mkv'], outputFormats: ['mp4'], isComingSoon: false,
  },
  {
    id: 'convert-video', slug: 'convert-video', name: 'Convert Video', category: 'video',
    description: 'Convert video files between MP4, MOV, AVI, and MKV formats. Free, fast, and entirely in your browser.', icon: '🔄', badge: 'new',
    dateAdded: '2024-01-08', inputFormats: ['mp4', 'webm', 'mov', 'avi', 'mkv'], outputFormats: ['mp4', 'mov', 'avi', 'mkv'], isComingSoon: false,
  },
  {
    id: 'trim-video', slug: 'trim-video', name: 'Trim Video', category: 'video',
    description: 'Cut and trim video clips to extract the perfect segment. Free, fast, and entirely in your browser.', icon: '✂️', badge: 'new',
    dateAdded: '2024-01-08', inputFormats: ['mp4', 'webm', 'mov', 'avi', 'mkv'], outputFormats: ['mp4', 'mov', 'avi', 'mkv'], isComingSoon: false,
  },
  {
    id: 'merge-video', slug: 'merge-video', name: 'Merge Video', category: 'video',
    description: 'Combine multiple videos into one seamless file', icon: '🔗', badge: null,
    dateAdded: '2024-01-09', inputFormats: ['mp4', 'mov', 'webm'], outputFormats: ['mp4', 'webm'], isComingSoon: true,
  },
  {
    id: 'crop-video', slug: 'crop-video', name: 'Crop Video', category: 'video',
    description: 'Remove unwanted edges from videos', icon: '🎯', badge: null,
    dateAdded: '2024-01-09', inputFormats: ['mp4', 'mov', 'webm'], outputFormats: ['mp4', 'webm'], isComingSoon: true,
  },
  {
    id: 'rotate-video', slug: 'rotate-video', name: 'Rotate Video', category: 'video',
    description: 'Rotate videos 90°, 180°, or 270°', icon: '🔁', badge: null,
    dateAdded: '2024-01-09', inputFormats: ['mp4', 'mov', 'webm'], outputFormats: ['mp4', 'webm'], isComingSoon: true,
  },
  {
    id: 'resize-video', slug: 'resize-video', name: 'Resize Video', category: 'video',
    description: 'Change video resolution and aspect ratio', icon: '📐', badge: null,
    dateAdded: '2024-01-10', inputFormats: ['mp4', 'mov', 'webm'], outputFormats: ['mp4', 'webm'], isComingSoon: true,
  },
  {
    id: 'video-speed', slug: 'video-speed', name: 'Video Speed Controller', category: 'video',
    description: 'Adjust video playback speed (0.5x to 4x)', icon: '⚡', badge: null,
    dateAdded: '2024-01-10', inputFormats: ['mp4', 'mov', 'webm'], outputFormats: ['mp4', 'webm'], isComingSoon: true,
  },
  {
    id: 'reverse-video', slug: 'reverse-video', name: 'Reverse Video', category: 'video',
    description: 'Play videos backwards for creative effects', icon: '↩️', badge: null,
    dateAdded: '2024-01-10', inputFormats: ['mp4', 'mov', 'webm'], outputFormats: ['mp4', 'webm'], isComingSoon: true,
  },
  {
    id: 'extract-audio', slug: 'extract-audio', name: 'Extract Audio', category: 'video',
    description: 'Extract audio from videos as MP3 or WAV', icon: '🎧', badge: 'popular',
    dateAdded: '2024-01-11', inputFormats: ['mp4', 'mov', 'webm', 'mkv'], outputFormats: ['mp3', 'wav'], isComingSoon: true,
  },
  {
    id: 'video-to-gif', slug: 'video-to-gif', name: 'Video to GIF', category: 'video',
    description: 'Create animated GIFs from video clips', icon: '🎞️', badge: 'popular',
    dateAdded: '2024-01-11', inputFormats: ['mp4', 'mov', 'webm'], outputFormats: ['gif'], isComingSoon: true,
  },
] as const satisfies Tool[]
