import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="bg-foreground text-background dark:bg-slate-900 dark:text-white border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 py-16">
          {/* Brand Column */}
          <div>
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/SaveVex-logo-c1xr3UPv1kVKKzEThRXASNEs5481td.png"
              alt="SaveVex"
              width={150}
              height={50}
              className="h-10 w-auto mb-4 brightness-0 invert dark:brightness-100 dark:invert-0"
            />
            <p className="text-sm opacity-75 leading-relaxed">
              The easiest way to download and save videos from any platform.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold mb-4 text-lg">Product</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/tools" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Tools
                </Link>
              </li>
              <li>
                <Link href="/premium" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Premium
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  About
                </Link>
              </li>
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-semibold mb-4 text-lg">Company</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/about" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm opacity-75 hover:opacity-100 transition-opacity">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
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
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/20 dark:border-slate-700 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm opacity-75">
            © 2024 SaveVex. All rights reserved. Made with ❤️ for creators worldwide.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="opacity-75 hover:opacity-100 transition-opacity">
              <span className="text-xl">𝕏</span>
            </a>
            <a href="#" className="opacity-75 hover:opacity-100 transition-opacity">
              <span className="text-xl">f</span>
            </a>
            <a href="#" className="opacity-75 hover:opacity-100 transition-opacity">
              <span className="text-xl">📸</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
