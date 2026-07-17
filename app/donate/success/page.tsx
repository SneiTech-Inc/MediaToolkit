'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PageLayout } from '@/components/shared/PageLayout'
import { PageHero } from '@/components/shared/PageHero'
import { Button } from '@/components/ui/button'
import { Heart, Loader2, AlertCircle, CheckCircle, ArrowRight, XCircle } from 'lucide-react'

interface VerifiedPayment {
  status: string
  amount: number
  currency: string
  paid_at: string
  channel: string
  metadata: {
    frequency?: string
    amount_usd?: string
  } | null
  customer: {
    email: string
  }
  plan: {
    plan_code: string
    name: string
  } | null
}

type VerifyState = 'loading' | 'success' | 'failed' | 'missing'

export default function DonateSuccessPage() {
  const searchParams = useSearchParams()
  const reference = searchParams.get('reference')

  const [verifyState, setVerifyState] = useState<VerifyState>(
    reference ? 'loading' : 'missing'
  )
  const [payment, setPayment] = useState<VerifiedPayment | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!reference) {
      setVerifyState('missing')
      return
    }

    let cancelled = false

    async function verify() {
      try {
        const res = await fetch('/api/paystack/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference }),
        })

        const data = await res.json()

        if (cancelled) return

        if (!res.ok || data.error) {
          throw new Error(data.error ?? 'Verification failed')
        }

        if (data.status !== 'success') {
          throw new Error(`Payment status is "${data.status}", not "success"`)
        }

        setPayment(data)
        setVerifyState('success')
      } catch (err) {
        if (cancelled) return
        setErrorMessage(err instanceof Error ? err.message : 'Could not verify payment')
        setVerifyState('failed')
      }
    }

    verify()

    return () => {
      cancelled = true
    }
  }, [reference])

  // ── Format helpers ──────────────────────────────────────────
  function formatAmount(amount: number, currency: string): string {
    // Paystack amounts are in subunit (pesewas for GHS, kobo for NGN)
    const majorUnit = amount / 100
    const currencySymbol = currency === 'GHS' ? '₵' : currency === 'NGN' ? '₦' : '$'
    return `${currencySymbol}${majorUnit.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  const frequency = payment?.metadata?.frequency ?? 'one-time'
  const amountUSD = payment?.metadata?.amount_usd

  // ── Render ──────────────────────────────────────────────────
  return (
    <PageLayout>
      <PageHero
        title="Thank You!"
        description="Your support helps us keep SaveVex free for everyone."
        icon="❤️"
      />

      <section className="py-16 px-4">
        <div className="max-w-xl mx-auto">
          {/* Loading */}
          {verifyState === 'loading' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 mx-auto mb-6 text-primary animate-spin" />
              <h2 className="text-xl font-bold mb-2">Verifying your payment...</h2>
              <p className="text-muted-foreground">
                Please wait while we confirm your support with Paystack.
              </p>
            </div>
          )}

          {/* Success */}
          {verifyState === 'success' && payment && (
            <div className="rounded-xl border border-border bg-card p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold">Payment Confirmed!</h2>
                <p className="text-muted-foreground mt-2">
                  Thank you for supporting SaveVex{payment.plan ? ' with a monthly contribution' : ''}!
                </p>
              </div>

              <div className="space-y-3 border-t border-border pt-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold">
                    {amountUSD ? `$${amountUSD} USD` : formatAmount(payment.amount, payment.currency)}
                    {frequency === 'monthly' && ' / month'}
                  </span>
                </div>
                {payment.amount && payment.currency && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount (local)</span>
                    <span className="font-mono text-sm">
                      {formatAmount(payment.amount, payment.currency)} {payment.currency}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span>{formatDate(payment.paid_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{payment.customer.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono text-xs">{reference}</span>
                </div>
              </div>
            </div>
          )}

          {/* Failed */}
          {verifyState === 'failed' && (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold mb-2">Could Not Verify Payment</h2>
              <p className="text-muted-foreground mb-4">
                {errorMessage ?? 'We were unable to verify this payment with Paystack.'}
              </p>
              {reference && (
                <p className="text-xs text-muted-foreground mb-6 font-mono">
                  Reference: {reference}
                </p>
              )}
              <p className="text-sm text-muted-foreground mb-8">
                If you believe your payment was processed, please{' '}
                <Link href="/contact" className="text-primary underline">
                  contact us
                </Link>{' '}
                with the reference above.
              </p>
            </div>
          )}

          {/* Missing reference */}
          {verifyState === 'missing' && (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <AlertCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold mb-2">No Payment Reference</h2>
              <p className="text-muted-foreground">
                No payment reference was provided. This page shows the result of a completed payment.
              </p>
            </div>
          )}

          {/* Always show the CTA */}
          <div className="mt-8 text-center space-y-4">
            <Link href="/donate">
              <Button variant="outline" className="gap-2">
                <Heart className="w-4 h-4" />
                Make Another Contribution
              </Button>
            </Link>
            <div>
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
              >
                <ArrowRight className="w-3 h-3" />
                Back to SaveVex tools
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
