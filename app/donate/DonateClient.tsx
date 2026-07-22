'use client'

import { useState, useCallback } from 'react'
import { PageHero } from '@/components/shared/PageHero'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Heart, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import {
  ONE_TIME_PRESETS,
  MONTHLY_PRESETS,
  SUPPORT_FREQUENCIES,
  buildTier,
} from '@/constants/support'
import type { SupportTier, SupportFrequency } from '@/types/common'

type PageState = 'idle' | 'loading' | 'error'

export function DonateClient() {
  const [frequency, setFrequency] = useState<SupportFrequency>('one-time')
  const [selectedPreset, setSelectedPreset] = useState<SupportTier | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<PageState>('idle')
  const [error, setError] = useState<string | null>(null)

  const presets = frequency === 'one-time' ? ONE_TIME_PRESETS : MONTHLY_PRESETS

  const activeTier: SupportTier | null = (() => {
    if (customAmount) {
      const num = parseFloat(customAmount)
      if (!isNaN(num) && num > 0) {
        return buildTier(num)
      }
    }
    return selectedPreset
  })()

  const handlePresetClick = useCallback((tier: SupportTier) => {
    setSelectedPreset(tier)
    setCustomAmount('')
    setError(null)
  }, [])

  const handleCustomChange = useCallback((value: string) => {
    // Only allow digits and one decimal point
    const sanitized = value.replace(/[^0-9.]/g, '').replace(/(\..*?)\./g, '$1')
    if (sanitized === '' || /^\d+\.?\d{0,2}$/.test(sanitized)) {
      setCustomAmount(sanitized)
      setSelectedPreset(null)
      setError(null)
    }
  }, [])

  const handleSupport = useCallback(async () => {
    if (!activeTier) {
      setError('Please select or enter a support amount.')
      return
    }
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    setState('loading')
    setError(null)

    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          amountPesewas: activeTier.amountPesewas,
          frequency,
          amountUSD: activeTier.amountUSD,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'Failed to initialize payment')
      }

      // Redirect to Paystack checkout page
      window.location.href = data.authorization_url
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }, [activeTier, email, frequency])

  return (
    <>
      <PageHero
        title="Support SaveVex"
        description="Your support helps us maintain and improve 50+ free file processing tools. Every contribution keeps our tools fast, private, and accessible to everyone."
        icon="❤️"
      />

      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          {/* ── Frequency Tabs ──────────────────────────────────── */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex rounded-xl border border-border bg-muted/50 p-1">
              {SUPPORT_FREQUENCIES.map((freq) => (
                <button
                  key={freq}
                  onClick={() => {
                    setFrequency(freq)
                    setSelectedPreset(null)
                    setCustomAmount('')
                    setError(null)
                  }}
                  className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    frequency === freq
                      ? 'bg-background text-foreground shadow-sm border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {freq === 'one-time' ? 'One-Time' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Preset Amounts ──────────────────────────────────── */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-muted-foreground mb-4 text-center">
              Choose an amount (USD)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {presets.map((tier) => {
                const isSelected =
                  selectedPreset?.amountUSD === tier.amountUSD && !customAmount
                return (
                  <button
                    key={tier.amountUSD}
                    onClick={() => handlePresetClick(tier)}
                    className={`relative rounded-xl border-2 px-4 py-3 text-center transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <span className="text-xl font-bold">${tier.amountUSD}</span>
                    {frequency === 'monthly' && (
                      <span className="block text-xs text-muted-foreground mt-0.5">/mo</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Custom Amount ────────────────────────────────────── */}
          <div className="mb-8">
            <label
              htmlFor="custom-amount"
              className="block text-sm font-semibold text-muted-foreground mb-3 text-center"
            >
              Or enter a custom amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
                $
              </span>
              <Input
                id="custom-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={customAmount}
                onChange={(e) => handleCustomChange(e.target.value)}
                className="pl-10 py-6 text-lg text-center font-semibold rounded-xl"
              />
            </div>
          </div>

          {/* ── Email ─────────────────────────────────────────────── */}
          <div className="mb-8">
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-muted-foreground mb-3 text-center"
            >
              Your email address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(null)
              }}
              className="py-6 text-center rounded-xl"
            />
          </div>

          {/* ── CTA Button ────────────────────────────────────────── */}
          <div className="mb-6">
            <Button
              onClick={handleSupport}
              disabled
              className="w-full py-6 text-lg font-bold rounded-xl bg-primary hover:bg-primary/90 transition-all"
              size="lg"
            >
              {state === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Redirecting to Paystack...
                </>
              ) : activeTier ? (
                <>
                  <Heart className="w-5 h-5 mr-2" />
                  Support with ${activeTier.amountUSD}
                  {frequency === 'monthly' && '/mo'}
                </>
              ) : (
                <>
                  <Heart className="w-5 h-5 mr-2" />
                  Select an Amount to Support
                </>
              )}
            </Button>
          </div>

          {/* ── Error ─────────────────────────────────────────────── */}
          {state === 'error' && error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
              <button
                onClick={() => setState('idle')}
                className="ml-auto text-sm font-semibold hover:underline flex-shrink-0"
              >
                Try again
              </button>
            </div>
          )}

          {/* ── Fine Print ───────────────────────────────────────── */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4" />
              <span>Payments processed securely by Paystack</span>
            </div>
            {frequency === 'monthly' && (
              <p className="text-xs text-muted-foreground">
                You can cancel your monthly support at any time from your Paystack
                dashboard or by contacting us.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              SaveVex is a for-profit product. Contributions are not tax-deductible charitable donations.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
