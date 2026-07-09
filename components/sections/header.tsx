'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Menu, X, Sun, Moon, ChevronDown } from 'lucide-react'
import { useTheme } from 'next-themes'
import { ToolDropdown } from '@/components/shared/ToolDropdown'
import type { Tool } from '@/types/tool'
import { pdfTools } from '@/constants/tools/pdf'
import { imageTools } from '@/constants/tools/image'
import { documentTools } from '@/constants/tools/document'
import { textTools } from '@/constants/tools/text'
import { videoTools } from '@/constants/tools/video'
import { audioTools } from '@/constants/tools/audio'
import { utilityTools } from '@/constants/tools/utility'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Blog' },
  { href: '/press', label: 'Press' },
]

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => { setMounted(true) }, [])

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <Image
            src="/savevex-logo.png"
            alt="SaveVex"
            width={200}
            height={60}
            className="h-10 md:h-14 w-auto hover:scale-105 transition-transform"
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {/* <Link
            href="/"
            className="text-sm font-medium hover:text-primary transition-colors whitespace-nowrap"
          >
            Home
          </Link>
          <Link
            href="/blog"
            className="text-sm font-medium hover:text-primary transition-colors whitespace-nowrap"
          >
            Blog
          </Link> */}

          {/* Tool Dropdowns */}
          <ToolDropdown label="All PDF Tools" category="pdf" tools={pdfTools} />
          <ToolDropdown label="All Image Tools" category="image" tools={imageTools} />
          <ToolDropdown label="All Document Tools" category="document" tools={documentTools} />
          <ToolDropdown label="All Video Tools" category="video" tools={videoTools} />
          <ToolDropdown label="All Audio Tools" category="audio" tools={audioTools} />
          <ToolDropdown label="All Text Tools" category="text" tools={textTools} />
          <ToolDropdown label="All Utility Tools" category="utility" tools={utilityTools} />
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Toggle theme"
            suppressHydrationWarning
          >
            {mounted ? (
              theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />
            ) : (
              <div className="w-5 h-5" />
            )}
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 hover:bg-muted rounded-lg"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile: PDF tools as expandable section */}
            <MobileToolSection
              label="All PDF Tools"
              category="pdf"
              tools={pdfTools}
              onClose={() => setMobileMenuOpen(false)}
            />
            <MobileToolSection
              label="All Image Tools"
              category="image"
              tools={imageTools}
              onClose={() => setMobileMenuOpen(false)}
            />
            <MobileToolSection
              label="All Document Tools"
              category="document"
              tools={documentTools}
              onClose={() => setMobileMenuOpen(false)}
            />
            <MobileToolSection
              label="All Video Tools"
              category="video"
              tools={videoTools}
              onClose={() => setMobileMenuOpen(false)}
            />
            <MobileToolSection
              label="All Audio Tools"
              category="audio"
              tools={audioTools}
              onClose={() => setMobileMenuOpen(false)}
            />
            <MobileToolSection
              label="All Text Tools"
              category="text"
              tools={textTools}
              onClose={() => setMobileMenuOpen(false)}
            />
            <MobileToolSection
              label="All Utility Tools"
              category="utility"
              tools={utilityTools}
              onClose={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}
    </header>
  )
}

/** Expandable tool section for mobile menu. */
function MobileToolSection({
  label,
  category,
  tools,
  onClose,
}: {
  label: string
  category: string
  tools: readonly Tool[]
  onClose: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
      >
        {label}
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="ml-4 space-y-1 mt-1">
          {tools.map((tool) => (
            <Link
              key={tool.id}
              href={`/tools/${category}/${tool.slug}`}
              className="block px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              onClick={onClose}
            >
              {tool.icon} {tool.name}
              {tool.isComingSoon && (
                <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  Soon
                </span>
              )}
            </Link>
          ))}
          <Link
            href={`/tools/${category}`}
            className="block px-4 py-1.5 text-sm font-medium text-primary hover:bg-muted rounded-lg transition-colors"
            onClick={onClose}
          >
            View all →
          </Link>
        </div>
      )}
    </div>
  )
}
