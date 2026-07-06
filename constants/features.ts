import type { Feature } from '@/types/common'

export const FEATURES = [
  { icon: '🚀', title: 'Lightning Fast', description: 'Process files instantly with our optimized browser-based engine.' },
  { icon: '🔒', title: '100% Secure', description: 'Files never leave your device — all processing happens locally.' },
  { icon: '🎨', title: 'Beautiful Interface', description: 'Clean, intuitive design that makes file processing a pleasure.' },
  { icon: '📱', title: 'Works Everywhere', description: 'Desktop, tablet, or mobile — SaveVex works on any device.' },
  { icon: '🆓', title: 'Completely Free', description: 'No hidden fees, no premium tiers, no account required.' },
  { icon: '🔄', title: 'Batch Processing', description: 'Process multiple files at once to save time and effort.' },
] as const satisfies Feature[]
