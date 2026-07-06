import type { HowItWorksStep } from '@/types/common'

export const HOW_IT_WORKS = [
  { step: 1, title: 'Upload', description: 'Select your file and upload it to SaveVex' },
  { step: 2, title: 'Process', description: '100% browser-based processing — files never leave your device' },
  { step: 3, title: 'Download', description: 'Get your processed file instantly' },
] as const satisfies HowItWorksStep[]
