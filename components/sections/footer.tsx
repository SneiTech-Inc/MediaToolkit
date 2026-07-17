import Link from 'next/link'
import Image from 'next/image'

const TOOL_LINKS = [
  { href: '/tools/pdf/compress-pdf', label: 'Compress PDF' },
  { href: '/tools/image/compress-image', label: 'Compress Image' },
  { href: '/tools/pdf/merge-pdf', label: 'Merge PDF' },
  { href: '/tools/document/word-to-pdf', label: 'Word to PDF' },
  { href: '/tools/text/word-counter', label: 'Word Counter' },
  { href: '/tools/text/remove-duplicates', label: 'Remove Duplicates' },
  { href: '/tools/text/password-generator', label: 'Password Generator' },
] as const

interface SocialLink {
  href: string
  label: string
  path: string
  viewBox: string
}

const SOCIAL_LINKS: SocialLink[] = [
  {
    href: 'https://web.facebook.com/profile.php?id=61587279568299',
    label: 'Facebook',
    viewBox: '0 0 24 24',
    path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  },
  {
    href: 'https://www.instagram.com/sneitechinc/',
    label: 'Instagram',
    viewBox: '0 0 24 24',
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  },
  {
    href: 'https://x.com/sneitech',
    label: 'X (Twitter)',
    viewBox: '0 0 24 24',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  {
    href: 'https://www.linkedin.com/company/sneitech/',
    label: 'LinkedIn',
    viewBox: '0 0 24 24',
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  },
] as const

function SocialIcon({ d, viewBox, label }: { d: string; viewBox: string; label: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox={viewBox}
      fill="currentColor"
      aria-hidden="true"
    >
      <title>{label}</title>
      <path d={d} />
    </svg>
  )
}

export function Footer() {
  return (
    <footer className="bg-foreground text-background dark:bg-slate-900 dark:text-white border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Brand Section */}
        <div className="pt-16">
          <div className="flex flex-col items-start">
            <Image
              src="/savevex-logo.png"
              alt="SaveVex"
              width={150}
              height={50}
              className="h-12 md:h-14 w-auto mb-4 brightness-0 invert dark:brightness-100 dark:invert-0"
            />
            <p className="text-sm opacity-75 leading-relaxed max-w-md">
              Your all-in-one file &amp; media toolkit. Compress, convert, edit, and optimize — 100% free, all in your browser.
            </p>
          </div>
        </div>

        {/* Link Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-16">
          {/* Product Column */}
          <div>
            <h4 className="font-semibold mb-4 text-lg">Product</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/tools/pdf" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  PDF Tools
                </Link>
              </li>
              <li>
                <Link href="/tools/image" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Image Tools
                </Link>
              </li>
              <li>
                <Link href="/tools/document" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Document Tools
                </Link>
              </li>
              <li>
                <Link href="/tools/video" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Video Tools
                </Link>
              </li>
              <li>
                <Link href="/tools/audio" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Audio Tools
                </Link>
              </li>
              <li>
                <Link href="/tools/text" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Text Tools
                </Link>
              </li>
              <li>
                <Link href="/tools/utility" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Utility Tools
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h4 className="font-semibold mb-4 text-lg">Company</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/blog" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/press" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Press
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/donate" className="text-sm opacity-75 hover:opacity-100 transition-opacity font-medium">
                  ❤️ Support SaveVex
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h4 className="font-semibold mb-4 text-lg">Legal</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/legal/privacy" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/legal/cookies" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/dmca" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  DMCA
                </Link>
              </li>
            </ul>
          </div>

          {/* Tools Column */}
          <div>
            <h4 className="font-semibold mb-4 text-lg">Tools</h4>
            <ul className="space-y-3">
              {TOOL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm opacity-75 hover:opacity-100 transition-opacity"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/20 dark:border-slate-700 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Copyright */}
          <p className="text-sm opacity-75 order-3 md:order-1">
            &copy; {new Date().getFullYear()} SaveVex. All rights reserved.
          </p>

          {/* Center: Powered by */}
          <p className="text-sm opacity-75 order-2">
            Powered by{' '}
            <a
              href="https://sneitech.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-100 transition-opacity font-medium"
            >
              Sneitech Inc.
            </a>
          </p>

          {/* Right: Social Icons */}
          <div className="flex items-center gap-3 order-1 md:order-3">
            {SOCIAL_LINKS.map(({ href, label, path, viewBox }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-75 hover:opacity-100 transition-opacity"
                aria-label={label}
              >
                <SocialIcon d={path} viewBox={viewBox} label={label} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
