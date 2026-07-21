/**
 * POST /api/paystack/initialize
 *
 * Initializes a Paystack transaction for a one-time or monthly support payment.
 * For monthly payments, creates/reuses a Paystack Plan first so a real
 * subscription is created on successful payment.
 *
 * Body: { email, amountPesewas, frequency, amountUSD }
 * Response: { authorization_url, reference }
 */

import { NextResponse } from 'next/server'
import {
  initializeTransaction,
  getOrCreatePlan,
} from '@/lib/paystack'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, amountPesewas, frequency, amountUSD } = body as {
      email: string
      amountPesewas: number
      frequency: 'one-time' | 'monthly'
      amountUSD: number
    }

    // Validate required fields
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    if (!amountPesewas || typeof amountPesewas !== 'number' || amountPesewas <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    }

    if (!frequency || !['one-time', 'monthly'].includes(frequency)) {
      return NextResponse.json({ error: 'Frequency must be "one-time" or "monthly"' }, { status: 400 })
    }

    // Build metadata
    const metadata: Record<string, string> = {
      frequency,
      amount_usd: String(amountUSD),
      source: 'savevex-support-page',
    }

    if (frequency === 'monthly') {
      // Create or reuse a Paystack Plan so a REAL subscription is created,
      // not just a one-time transaction with a metadata tag.
      const planCode = await getOrCreatePlan(amountPesewas, amountUSD)
      metadata.plan_code = planCode

      const result = await initializeTransaction({
        email,
        plan: planCode,
        amount: amountPesewas,
        metadata,
      })

      return NextResponse.json({
        authorization_url: result.authorization_url,
        reference: result.reference,
      })
    }

    // One-time payment — no plan, just a regular transaction
    const result = await initializeTransaction({
      email,
      amount: amountPesewas,
      currency: 'GHS',
      metadata,
    })

    return NextResponse.json({
      authorization_url: result.authorization_url,
      reference: result.reference,
    })
  } catch (error) {
    console.error('Paystack initialize error:', error)
    const message = error instanceof Error ? error.message : 'Failed to initialize payment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
