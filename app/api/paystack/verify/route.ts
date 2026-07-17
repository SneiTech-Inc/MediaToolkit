/**
 * POST /api/paystack/verify
 *
 * Server-side verification of a Paystack transaction.
 * Called by the success page to confirm payment — never trusts client-supplied
 * query parameters.
 *
 * Body: { reference }
 * Response: { status, amount, currency, paid_at, metadata, customer }
 */

import { NextResponse } from 'next/server'
import { verifyTransaction } from '@/lib/paystack'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { reference } = body as { reference: string }

    if (!reference || typeof reference !== 'string') {
      return NextResponse.json({ error: 'Transaction reference is required' }, { status: 400 })
    }

    const transaction = await verifyTransaction(reference)

    // Only return safe, non-sensitive fields to the client
    return NextResponse.json({
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      paid_at: transaction.paid_at,
      channel: transaction.channel,
      metadata: transaction.metadata ?? null,
      customer: {
        email: transaction.customer.email,
      },
      plan: transaction.plan
        ? { plan_code: transaction.plan.plan_code, name: transaction.plan.name }
        : null,
    })
  } catch (error) {
    console.error('Paystack verify error:', error)
    const message = error instanceof Error ? error.message : 'Failed to verify payment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
