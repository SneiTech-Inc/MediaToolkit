import type { Metadata } from 'next'
import { PageLayout } from '@/components/shared/PageLayout'
import { DonateClient } from './DonateClient'

export const metadata: Metadata = {
  title: 'Support SaveVex — Help Keep Our Tools Free',
  description:
    'Support SaveVex with a one-time or monthly contribution. Help us keep 50+ file processing tools free, private, and accessible to everyone.',
  openGraph: {
    title: 'Support SaveVex — Help Keep Our Tools Free!',
    description:
      'Your support helps us maintain and improve 50+ free file processing tools. Choose a one-time or monthly contribution.',
  },
}

export default function DonatePage() {
  return (
    <PageLayout>
      <DonateClient />
    </PageLayout>
  )
}
