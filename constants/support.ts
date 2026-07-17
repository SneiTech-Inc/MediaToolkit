import type { SupportTier, SupportFrequency } from '@/types/common'

/**
 * Fixed USD → GHS conversion rate.
 * Updated manually; do NOT call a live exchange-rate API during the payment flow.
 */
export const USD_TO_GHS_RATE = 14.7

/** Supported donation/support frequencies. */
export const SUPPORT_FREQUENCIES: readonly SupportFrequency[] = [
  'one-time',
  'monthly',
] as const

/**
 * Build a SupportTier from a USD amount.
 * Uses the fixed conversion rate — never makes network calls.
 */
export function buildTier(amountUSD: number): SupportTier {
  const amountGHS = Math.round(amountUSD * USD_TO_GHS_RATE * 100) / 100
  const amountPesewas = Math.round(amountGHS * 100)
  return { amountUSD, amountGHS, amountPesewas }
}

export const ONE_TIME_PRESETS: readonly SupportTier[] = [
  buildTier(10),
  buildTier(20),
  buildTier(50),
  buildTier(100),
] as const satisfies SupportTier[]

export const MONTHLY_PRESETS: readonly SupportTier[] = [
  buildTier(10),
  buildTier(25),
  buildTier(50),
  buildTier(100),
] as const satisfies SupportTier[]
