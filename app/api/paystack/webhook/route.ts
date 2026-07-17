/**
 * POST /api/paystack/webhook
 *
 * Paystack webhook handler.
 *
 * CRITICAL SECURITY REQUIREMENTS:
 * 1. Reads the RAW request body (req.text()) — must hash the exact bytes Paystack sent
 * 2. Verifies HMAC-SHA512 signature using the secret key
 * 3. Handles charge.success events idempotently (Vercel KV dedup)
 *
 * This is the source of truth for recorded donations — do NOT rely on the
 * client-side success page redirect as the authoritative record.
 */

import { NextResponse } from 'next/server'
import {
  verifyWebhookSignature,
  isDonationRecorded,
  recordDonation,
} from '@/lib/paystack'

export async function POST(request: Request) {
  // ── 1. Read the RAW body ──────────────────────────────────────────
  // Must use .text() not .json() — signature verification requires
  // the exact byte sequence Paystack signed.
  const rawBody = await request.text()

  // ── 2. Verify signature ───────────────────────────────────────────
  const signature = request.headers.get('x-paystack-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature header' }, { status: 401 })
  }

  const isValid = verifyWebhookSignature(rawBody, signature)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // ── 3. Parse the verified body ────────────────────────────────────
  let event: { event: string; data: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── 4. Handle charge.success ──────────────────────────────────────
  // Only process charge.success — ignore all other event types but
  // still return 200 so Paystack doesn't retry.
  if (event.event !== 'charge.success') {
    return NextResponse.json({ received: true })
  }

  const data = event.data
  const reference = data.reference as string | undefined
  if (!reference) {
    return NextResponse.json({ error: 'Missing reference in event data' }, { status: 400 })
  }

  // ── 5. Idempotency check ──────────────────────────────────────────
  // Paystack may retry webhook delivery. Don't double-record.
  const alreadyRecorded = await isDonationRecorded(reference)
  if (alreadyRecorded) {
    return NextResponse.json({ received: true, already_recorded: true })
  }

  // ── 6. Record the donation ────────────────────────────────────────
  const metadata = data.metadata as Record<string, string> | undefined

  await recordDonation({
    reference,
    amount: data.amount as number,
    currency: (data.currency as string) ?? 'GHS',
    email: (data.customer as { email: string })?.email ?? 'unknown',
    paid_at: (data.paid_at as string) ?? new Date().toISOString(),
    plan_code: (data.plan as { plan_code?: string })?.plan_code ?? null,
    frequency: metadata?.frequency ?? null,
  })

  console.log(`✅ Donation recorded: ${reference}`)
  return NextResponse.json({ received: true })
}
