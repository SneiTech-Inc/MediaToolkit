import type { TrustBadge } from '@/types/common'

export const TRUST_BADGES = [
  {
    title: '100% Free',
    description: 'No hidden costs, no premium upgrades required',
    icon: '💝',
  },
  {
    title: 'No Sign-Up Required',
    description: 'Start using tools instantly without creating an account',
    icon: '⚡',
  },
  {
    title: 'Files Never Leave Your Browser',
    description: 'All processing happens locally on your device for maximum privacy',
    icon: '🔒',
  },
] as const satisfies TrustBadge[]
