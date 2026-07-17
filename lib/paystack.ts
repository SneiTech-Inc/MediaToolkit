/**
 * Server-side Paystack API client.
 * DO NOT import this module from client components — it exposes the secret key.
 *
 * All amounts are in the smallest currency unit (pesewas for GHS, kobo for NGN, etc.).
 */

import { kv } from '@vercel/kv'
import crypto from 'crypto'

// ─── Configuration ────────────────────────────────────────────────────────────

const PAYSTACK_BASE = 'https://api.paystack.co'

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY is not set')
  }
  return key
}

function getCallbackUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/donate/success`
    : 'http://localhost:3000/donate/success'
}

// ─── Shared Fetch Wrapper ─────────────────────────────────────────────────────

interface PaystackResponse<T = unknown> {
  status: boolean
  message: string
  data: T
}

async function paystackFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<PaystackResponse<T>> {
  const url = `${PAYSTACK_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const json = (await res.json()) as PaystackResponse<T>

  if (!json.status) {
    throw new Error(`Paystack error: ${json.message}`)
  }

  return json
}

// ─── Plans API ────────────────────────────────────────────────────────────────

export interface CreatePlanParams {
  name: string
  amount: number // in subunit (pesewas for GHS)
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'annually'
  currency?: string
  description?: string
  invoice_limit?: number
}

export interface PaystackPlan {
  id: number
  name: string
  plan_code: string
  amount: number
  interval: string
  currency: string
  status: string
  createdAt: string
}

export async function createPlan(params: CreatePlanParams): Promise<PaystackPlan> {
  const body: Record<string, unknown> = {
    name: params.name,
    amount: params.amount,
    interval: params.interval,
  }

  if (params.currency) body.currency = params.currency
  if (params.description) body.description = params.description
  if (params.invoice_limit !== undefined) body.invoice_limit = params.invoice_limit

  const res = await paystackFetch<PaystackPlan>('/plan', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return res.data
}

// ─── Transaction Initialize ───────────────────────────────────────────────────

export interface InitializeTransactionParams {
  email: string
  amount?: number // in subunit; omit if providing `plan`
  currency?: string
  plan?: string // plan_code — when set, amount is ignored (plan's amount used)
  callback_url?: string
  reference?: string
  metadata?: Record<string, string>
  channels?: string[]
}

export interface InitializeTransactionResult {
  authorization_url: string
  access_code: string
  reference: string
}

export async function initializeTransaction(
  params: InitializeTransactionParams
): Promise<InitializeTransactionResult> {
  const body: Record<string, unknown> = {
    email: params.email,
    callback_url: params.callback_url ?? getCallbackUrl(),
  }

  if (params.plan) {
    // When plan is provided, amount is invalidated — plan amount is used
    body.plan = params.plan
  } else if (params.amount !== undefined) {
    body.amount = params.amount
  }

  if (params.currency) body.currency = params.currency
  if (params.reference) body.reference = params.reference
  if (params.metadata) body.metadata = JSON.stringify(params.metadata)
  if (params.channels) body.channels = params.channels

  const res = await paystackFetch<InitializeTransactionResult>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return res.data
}

// ─── Transaction Verify ──────────────────────────────────────────────────────

export interface PaystackTransaction {
  id: number
  status: string
  reference: string
  amount: number
  currency: string
  paid_at: string
  created_at: string
  channel: string
  metadata?: Record<string, string>
  customer: {
    id: number
    email: string
    customer_code: string
  }
  plan?: {
    plan_code: string
    name: string
  } | null
  plan_object?: {
    plan_code: string
    name: string
    interval: string
  }
}

export async function verifyTransaction(reference: string): Promise<PaystackTransaction> {
  const res = await paystackFetch<PaystackTransaction>(`/transaction/verify/${reference}`)
  return res.data
}

// ─── Webhook Signature Verification ──────────────────────────────────────────

/**
 * Verify a Paystack webhook signature using HMAC-SHA512.
 * `rawBody` must be the raw, unparsed request body string (req.text()).
 * `signature` is the value of the `x-paystack-signature` header.
 *
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = getSecretKey()

  const hash = crypto.createHmac('sha512', secret).update(rawBody, 'utf-8').digest('hex')

  // Timing-safe comparison
  try {
    const expected = Buffer.from(hash, 'hex')
    const actual = Buffer.from(signature, 'hex')
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

// ─── Plan Management (with Vercel KV caching) ─────────────────────────────────

const PLAN_CACHE_PREFIX = 'paystack:plan:monthly:'

/**
 * Get or create a Paystack Plan for a monthly support amount.
 * Caches the plan_code in Vercel KV so repeated donations of the same amount
 * reuse the same plan.
 *
 * @param amountPesewas — amount in pesewas (GHS subunit)
 * @param amountUSD — USD amount for display in plan name
 * @returns the plan_code (e.g. "PLN_xxx")
 */
export async function getOrCreatePlan(
  amountPesewas: number,
  amountUSD: number
): Promise<string> {
  const cacheKey = `${PLAN_CACHE_PREFIX}${amountPesewas}`

  // Check cache first
  try {
    const cached = await kv.get<string>(cacheKey)
    if (cached) {
      return cached
    }
  } catch {
    // KV unavailable — fall through to create
  }

  // Create the plan
  const plan = await createPlan({
    name: `SaveVex Monthly Support — $${amountUSD} USD`,
    amount: amountPesewas,
    interval: 'monthly',
    currency: 'GHS',
    description: `Monthly recurring support for SaveVex at $${amountUSD} USD`,
  })

  // Cache the plan_code
  try {
    await kv.set(cacheKey, plan.plan_code)
  } catch {
    // KV write failed — non-fatal, plan still exists
  }

  return plan.plan_code
}

// ─── Webhook Donation Recording ───────────────────────────────────────────────

export interface RecordedDonation {
  reference: string
  amount: number
  currency: string
  email: string
  paid_at: string
  plan_code: string | null
  frequency: string | null
  recorded_at: string
}

const DONATION_CACHE_PREFIX = 'donation:'

/**
 * Check if a donation reference has already been recorded (idempotency check).
 */
export async function isDonationRecorded(reference: string): Promise<boolean> {
  try {
    const existing = await kv.get(`${DONATION_CACHE_PREFIX}${reference}`)
    return existing !== null
  } catch {
    return false
  }
}

/**
 * Record a verified donation in Vercel KV.
 * Called by the webhook handler after signature verification.
 */
export async function recordDonation(donation: Omit<RecordedDonation, 'recorded_at'>): Promise<void> {
  const record: RecordedDonation = {
    ...donation,
    recorded_at: new Date().toISOString(),
  }

  try {
    await kv.set(`${DONATION_CACHE_PREFIX}${donation.reference}`, JSON.stringify(record))
  } catch (error) {
    console.error('Failed to record donation in KV:', error)
    throw error
  }
}
