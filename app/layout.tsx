import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from 'next-themes'
import '@/lib/pdfjsSetup'
import './globals.css'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'SaveVex — Free Online File & Media Toolkit',
  description: 'Compress, convert, edit, and optimize your files and media — 100% free, no signup, entirely in your browser.',
  metadataBase: new URL('https://savevex.com'),
  keywords: [
    "SneiTech Inc",
    "Savevex",
    "Consulting",
    "Sporvex",
    "Compress files",
    "convert files",
    "edit files",
    "optimize files",
    "Edit PDF",
    "Sign PDF",
    "Docx/Doc to PDF",
    "qr code generator",
    "uuid generator",
    "password generator",
    "merge videos",
    "merge audio",
    "video to gif",
    "compress video",
    "compress video",
    "Michael Schneider",
  ],
  generator: 'v0.app',
  authors: [{ name: "SneiTech Inc" }],
  creator: "SneiTech Inc",
  publisher: "SneiTech Inc",
  openGraph: {
    title: "Savevex | Free Online File & Media Toolkit",
    description: "Compress, convert, edit, and optimize your files and media — 100% free, no signup, entirely in your browser.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Savevex | Free Online File & Media Toolkit",
    description: "Compress, convert, edit, and optimize your files and media — 100% free, no signup, entirely in your browser.",
  },
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
      <head>
        {/* Google Analytics */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-GJBDWNSKBB"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-GJBDWNSKBB');
          `}
        </Script>

        {/* Google AdSense — Add this */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4116402342121729"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className="antialiased bg-background text-foreground" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}
