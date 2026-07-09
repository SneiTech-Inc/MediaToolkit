import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from 'next-themes'
import '@/lib/pdfjsSetup'
import './globals.css'

export const metadata: Metadata = {
  title: 'SaveVex — Free Online File & Media Toolkit',
  description: 'Compress, convert, edit, and optimize your files and media — 100% free, no signup, entirely in your browser.',
  metadataBase: new URL('https://savevex.com'),
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/savevex-favicon.png',
        type: 'image/png',
      },
    ],
    apple: '/savevex-favicon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#1e293b' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}
