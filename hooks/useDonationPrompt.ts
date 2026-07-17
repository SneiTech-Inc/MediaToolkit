'use client'

import { useCallback } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'

const DISMISS_KEY = 'savevex-support-dismissed'

/**
 * Hook for managing the donation/support prompt dismiss state.
 * Uses localStorage for persistent dismissal across sessions.
 */
export function useDonationPrompt() {
  const [dismissed, setDismissed] = useLocalStorage<boolean>(DISMISS_KEY, false)

  const dismiss = useCallback(() => {
    setDismissed(true)
  }, [setDismissed])

  const reset = useCallback(() => {
    setDismissed(false)
  }, [setDismissed])

  return { dismissed, dismiss, reset }
}
