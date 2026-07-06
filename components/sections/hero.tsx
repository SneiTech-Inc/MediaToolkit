'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TrustBadge } from '@/components/shared/TrustBadge'
import { Download } from 'lucide-react'

const heroBadges = [
  { title: 'Completely Free', description: 'No hidden fees or premium plans', icon: '' },
  { title: '100% Secure', description: 'Your data is encrypted always', icon: '' },
  { title: 'Ultra Fast', description: 'Downloads in seconds, not minutes', icon: '' },
]

export function Hero() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setUrl('')
    }, 2000)
  }

  return (
    <section className="min-h-screen flex items-center justify-center pt-20 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-background via-background to-blue-50/50 dark:to-blue-950/20">
      <div className="max-w-4xl mx-auto w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6 leading-tight">
            Save Your Favorite <span className="text-primary">Videos</span> Instantly
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Download videos from any platform in seconds. No installation, no watermarks, completely free.
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-xl p-6 sm:p-8 mb-12 border border-border">
          <form onSubmit={handleDownload} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="url"
                placeholder="Paste video URL here... (YouTube, TikTok, Instagram, etc.)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 px-4 py-3 rounded-lg border border-border focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <Button
                type="submit"
                disabled={loading || !url.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-semibold flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⚙️</span> Processing...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" /> Download
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Supports 1000+ websites • No account required • 100% secure
            </p>
          </form>
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {heroBadges.map((badge) => (
            <TrustBadge key={badge.title} badge={badge} />
          ))}
        </div>
      </div>
    </section>
  )
}
