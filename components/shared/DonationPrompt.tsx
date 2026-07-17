'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Heart, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDonationPrompt } from '@/hooks/useDonationPrompt'

const TOOL_VISITS_KEY = 'savevex-tool-visits'
const VISIT_THRESHOLD = 3

/**
 * A friendly, dismissible banner shown after a user has used SaveVex tools
 * a few times. Asks for support without being intrusive.
 *
 * Visibility logic:
 * - Increments a sessionStorage counter each time the component mounts (tool page visit)
 * - Shows after VISIT_THRESHOLD tool page visits in the same session
 * - Once dismissed (via localStorage), stays dismissed across sessions
 */
export function DonationPrompt() {
  const { dismissed, dismiss } = useDonationPrompt()
  const [shouldShow, setShouldShow] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Increment tool visit counter (session-scoped)
    let count = parseInt(sessionStorage.getItem(TOOL_VISITS_KEY) || '0', 10)
    count += 1
    sessionStorage.setItem(TOOL_VISITS_KEY, String(count))

    if (!dismissed && count >= VISIT_THRESHOLD) {
      setShouldShow(true)
    }
    setMounted(true)
  }, [dismissed])

  // Avoid hydration mismatch
  if (!mounted) return null
  if (!shouldShow) return null

  return (
    <div className="my-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-r from-primary/5 via-card to-accent/5 p-6 shadow-sm">
        {/* Decorative gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />

        <div className="flex items-start gap-4">
          {/* Heart icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">
              Enjoying SaveVex?
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Help us keep 50+ file processing tools free and private for everyone.
              Your support makes a difference!
            </p>

            <div className="flex items-center gap-2 mt-4">
              <Link href="/donate">
                <Button variant="default" size="sm" className="gap-1.5">
                  <Heart className="w-3.5 h-3.5" />
                  Support Us
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismiss}
                className="text-muted-foreground hover:text-foreground"
              >
                Not now
              </Button>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={dismiss}
            className="flex-shrink-0 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
