'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  Home,
  BookOpen,
  Newspaper,
  FileText,
  ImageIcon,
  Film,
  Music,
  FileSpreadsheet,
  Type,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { ToolDropdown } from '@/components/shared/ToolDropdown'
import type { Tool } from '@/types/tool'
import type { CategorySlug } from '@/constants/categories'
import { CATEGORIES } from '@/constants/categories'
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

const navLinkIcons: Record<string, LucideIcon> = {
  '/': Home,
  '/blog': BookOpen,
  '/press': Newspaper,
}

const categoryIconMap: Record<CategorySlug, LucideIcon> = {
  pdf: FileText,
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileSpreadsheet,
  text: Type,
  utility: Wrench,
}

const categoryToolsMap: Record<CategorySlug, readonly Tool[]> = {
  pdf: pdfTools,
  image: imageTools,
  video: videoTools,
  audio: audioTools,
  document: documentTools,
  text: textTools,
  utility: utilityTools,
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

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
            className="h-12 md:h-14 w-auto hover:scale-105 transition-transform"
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
          </Link>
          <Link
            href="/press"
            className="text-sm font-medium hover:text-primary transition-colors whitespace-nowrap"
          >
            Press
          </Link>

          <div className="w-px h-5 bg-border mx-1" /> */}

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
              theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )
            ) : (
              <div className="w-5 h-5" />
            )}
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </nav>

      {/* ── Mobile Menu Overlay (portaled to body) ── */}
      {mobileMenuOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] md:hidden">
            {/* Backdrop */}
            <div
              className="animate-in fade-in duration-300 absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Slide-in Panel */}
            <div
              className={`fixed top-0 right-0 h-full w-full max-w-sm bg-background shadow-2xl transition-transform duration-300 ease-out ${
                mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              {/* Gradient accent bar */}
              <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />

              {/* Panel Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <Link
                  href="/"
                  className="flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Image
                    src="/savevex-logo.png"
                    alt="SaveVex"
                    width={180}
                    height={54}
                    className="h-12 w-auto"
                  />
                </Link>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setTheme(theme === 'dark' ? 'light' : 'dark')
                    }
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    aria-label="Toggle theme"
                    suppressHydrationWarning
                  >
                    {mounted ? (
                      theme === 'dark' ? (
                        <Sun className="w-5 h-5" />
                      ) : (
                        <Moon className="w-5 h-5" />
                      )
                    ) : (
                      <div className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    aria-label="Close menu"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Panel Body — scrollable */}
              <div className="overflow-y-auto h-[calc(100%-78px)]">
                {/* Static Links */}
                <div className="px-4 pt-4 pb-2 space-y-0.5">
                  {NAV_LINKS.map((link) => {
                    const NavIcon = navLinkIcons[link.href]
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-3 px-4 py-3 text-base font-medium rounded-xl hover:bg-muted transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {NavIcon && (
                          <NavIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span>{link.label}</span>
                      </Link>
                    )
                  })}
                </div>

                {/* Tools Section */}
                <div className="px-4 pt-2 pb-6">
                  <div className="flex items-center gap-3 mb-2 px-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Tools
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-0.5">
                    {CATEGORIES.map((cat) => (
                      <MobileCategorySection
                        key={cat.id}
                        category={cat}
                        tools={categoryToolsMap[cat.slug]}
                        onClose={() => setMobileMenuOpen(false)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  )
}

/** Single expandable category in the mobile menu. */
function MobileCategorySection({
  category,
  tools,
  onClose,
}: {
  category: { id: string; name: string; slug: string; icon: string }
  tools: readonly Tool[]
  onClose: () => void
}) {
  const [open, setOpen] = useState(false)
  const Icon = categoryIconMap[category.slug as CategorySlug]

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-base font-medium rounded-xl hover:bg-muted transition-colors"
      >
        {Icon && <Icon className="w-5 h-5 text-primary flex-shrink-0" />}
        <span className="flex-1 text-left">{category.name}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expandable tools list */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="ml-9 mr-2 space-y-0.5 pt-0.5 pb-2">
            {tools.map((tool) => (
              <Link
                key={tool.id}
                href={`/tools/${category.slug}/${tool.slug}`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                onClick={onClose}
              >
                <span className="text-base flex-shrink-0">{tool.icon}</span>
                <span>{tool.name}</span>
                {tool.isComingSoon && (
                  <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                    Soon
                  </span>
                )}
              </Link>
            ))}
            <Link
              href={`/tools/${category.slug}`}
              className="flex items-center px-3 py-2 text-sm font-medium text-primary hover:bg-muted rounded-lg transition-colors"
              onClick={onClose}
            >
              View all {category.name} tools &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
