import type { FAQItem } from '@/types/common'

export const FAQS = [
  { question: 'Is SaveVex really free?', answer: 'Yes! SaveVex is 100% free with no hidden costs or premium upgrades required.' },
  { question: 'Are my files secure?', answer: 'Absolutely. All processing happens directly in your browser — your files never leave your device.' },
  { question: 'Do I need to create an account?', answer: 'No account or sign-up is required. Just visit, upload, process, and download.' },
  { question: 'What file types are supported?', answer: 'SaveVex supports PDF, images (JPG, PNG, WebP, GIF), video (MP4, MOV, WebM), audio (MP3, WAV, AAC), and many document formats.' },
  { question: 'Is there a file size limit?', answer: 'File sizes are limited only by your browser\'s available memory. Most modern browsers handle files up to several GB.' },
  { question: 'Can I use SaveVex on mobile?', answer: 'Yes! SaveVex works on any device with a modern browser — desktop, tablet, or mobile.' },
] as const satisfies FAQItem[]
