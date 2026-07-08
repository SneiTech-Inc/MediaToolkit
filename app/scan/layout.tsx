import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Scan Document - SaveVex',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
}

/** Minimal layout for the mobile scanner — no nav, no footer. */
export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
