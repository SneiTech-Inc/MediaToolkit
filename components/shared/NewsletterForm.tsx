'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Mail } from 'lucide-react'

interface NewsletterFormProps {
  variant?: 'newsletter' | 'waitlist'
  onSubscribe?: (email: string) => void
}

/**
 * Reusable email subscription form.
 * Used in the Newsletter section and Premium waitlist.
 */
export function NewsletterForm({ variant = 'newsletter', onSubscribe }: NewsletterFormProps) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim()) {
      setSubmitted(true)
      onSubscribe?.(email)
      setEmail('')
      setTimeout(() => setSubmitted(false), 3000)
    }
  }

  const isWaitlist = variant === 'waitlist'

  return (
    <div className="text-center">
      {isWaitlist ? null : (
        <Mail className="w-12 h-12 text-primary mx-auto mb-4 opacity-75" />
      )}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
        <Input
          type="email"
          placeholder={isWaitlist ? 'Enter your email' : 'Enter your email address'}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1"
        />
        <Button
          type="submit"
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold whitespace-nowrap"
        >
          {isWaitlist ? (submitted ? 'Thank you!' : 'Join Waitlist') : 'Subscribe'}
        </Button>
      </form>

      {submitted && (
        <p className="mt-4 text-green-600 dark:text-green-400 font-medium animate-pulse">
          ✓ {isWaitlist ? "You're on the list! Check your email." : 'Thanks for subscribing! Check your email.'}
        </p>
      )}

      {!isWaitlist && (
        <p className="text-xs text-muted-foreground mt-4">
          We respect your privacy. Unsubscribe at any time.
        </p>
      )}
    </div>
  )
}
