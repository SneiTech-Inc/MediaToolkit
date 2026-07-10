'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Copy, Check, Clock, ArrowLeftRight, Globe } from 'lucide-react'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import {
  detectTimestampType,
  timestampToDate,
  dateToTimestamp,
  getCurrentTimestamp,
  type ConvertedDate,
  type ConvertedTimestamp,
  type TimestampType,
} from '@/features/utility/utils/timestampConverter'
import type { FAQItem } from '@/types/common'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What is a Unix timestamp?',
    answer:
      'A Unix timestamp is the number of seconds (or milliseconds) that have elapsed since January 1, 1970 at 00:00:00 UTC. It is a universal way to represent a point in time, independent of timezones, and is widely used in programming and databases.',
  },
  {
    question: 'What timezones are supported?',
    answer:
      'The converter supports both UTC and your local timezone. Toggle between them to see how the same timestamp translates to different timezone representations. The current timezone is detected automatically from your browser.',
  },
  {
    question: 'Is my data stored anywhere?',
    answer:
      'No data is stored or transmitted. All conversions happen locally in your browser using browser-native date parsing. The current timestamp updates automatically every second using your device clock.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Choose a mode',
    desc: 'Select "Timestamp → Date" to convert a Unix timestamp to a readable date, or "Date → Timestamp" to do the reverse.',
  },
  {
    step: 2,
    title: 'Enter your value',
    desc: 'Paste a Unix timestamp or pick a date and time. The converter auto-detects whether the input is in seconds or milliseconds.',
  },
  {
    step: 3,
    title: 'Copy the result',
    desc: 'Click the copy button next to any output format to copy the value to your clipboard.',
  },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export function TimestampConverter() {
  // ── State ──────────────────────────────────────────────────────────────────

  const [mode, setMode] = useState<'timestamp-to-date' | 'date-to-timestamp'>('timestamp-to-date')
  const [timestampInput, setTimestampInput] = useState('')
  const [useUTC, setUseUTC] = useState(true)
  const [dateInput, setDateInput] = useState('')
  const [timeInput, setTimeInput] = useState('')
  const [currentTs, setCurrentTs] = useState(() => getCurrentTimestamp())
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null)

  // ── Live Clock Effect ──────────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentTs(getCurrentTimestamp())
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ── Derived Values ─────────────────────────────────────────────────────────

  const detectedType: TimestampType = useMemo(
    () => (timestampInput ? detectTimestampType(timestampInput) : null) as TimestampType,
    [timestampInput],
  )

  const timestampNumber = useMemo((): number => {
    if (detectedType === 'invalid' || detectedType === null) return NaN
    const parsed = parseInt(timestampInput.trim(), 10)
    if (isNaN(parsed) || parsed < 0) return NaN
    // Normalize to seconds
    return detectedType === 'milliseconds' ? Math.floor(parsed / 1000) : parsed
  }, [timestampInput, detectedType])

  const convertedDate: ConvertedDate | null = useMemo(
    () => (isNaN(timestampNumber) ? null : timestampToDate(timestampNumber, useUTC)),
    [timestampNumber, useUTC],
  )

  const convertedTimestamp: ConvertedTimestamp | null = useMemo(
    () => dateToTimestamp(dateInput, timeInput),
    [dateInput, timeInput],
  )

  // ── Copy Handler ───────────────────────────────────────────────────────────

  const copyToClipboard = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = value
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedLabel(label)
    setTimeout(() => setCopiedLabel(null), 2000)
  }, [])

  // ── Current Timestamp Copy ─────────────────────────────────────────────────

  const copyCurrentTs = useCallback(
    (type: 'seconds' | 'milliseconds') => {
      const value = type === 'seconds'
        ? String(currentTs.seconds)
        : String(currentTs.milliseconds)
      copyToClipboard(value, `current-${type}`)
    },
    [currentTs, copyToClipboard],
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ════════════════════════════════════════════════════════════════
            LEFT COLUMN — Main content
           ════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-8">
          {/* ── Mode Toggle ────────────────────────────────────────────── */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-muted w-fit">
            {([
              { key: 'timestamp-to-date', label: 'Timestamp → Date' },
              { key: 'date-to-timestamp', label: 'Date → Timestamp' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === key
                    ? 'bg-background text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════
              Mode: Timestamp → Date
             ══════════════════════════════════════════════════════════════ */}
          {mode === 'timestamp-to-date' && (
            <>
              {/* ── Input ──────────────────────────────────────────────── */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Timestamp Input</h3>
                </div>
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background text-lg font-mono"
                    placeholder="e.g. 1710614400 (seconds) or 1710614400000 (milliseconds)"
                    value={timestampInput}
                    onChange={e => setTimestampInput(e.target.value)}
                  />
                  {detectedType && detectedType !== 'invalid' && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Detected:{' '}
                      <span className="font-semibold text-foreground">
                        {detectedType === 'seconds' ? 'Seconds (≤10 digits)' : 'Milliseconds (>10 digits)'}
                      </span>
                    </p>
                  )}
                  {detectedType === 'invalid' && timestampInput.trim() && (
                    <p className="text-xs text-destructive mt-1.5">
                      Please enter a valid numeric timestamp.
                    </p>
                  )}
                </div>

                {/* UTC / Local Toggle */}
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Timezone:</span>
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted">
                    {([
                      { key: true, label: 'UTC' },
                      { key: false, label: 'Local' },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setUseUTC(key)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          useUTC === key
                            ? 'bg-background text-foreground shadow-sm border border-border'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Results ────────────────────────────────────────────── */}
              {convertedDate && !isNaN(timestampNumber) && (
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <h3 className="font-semibold">Converted Date</h3>
                  <div className="space-y-3">
                    {([
                      { label: 'ISO 8601', value: convertedDate.iso },
                      { label: 'Locale', value: convertedDate.locale },
                      { label: 'Date', value: convertedDate.dateOnly },
                      { label: 'Time', value: convertedDate.timeOnly },
                      { label: 'UTC', value: convertedDate.utc },
                    ]).map(({ label, value }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {label}
                          </span>
                          <p className="text-sm font-mono mt-0.5 break-all">{value}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="flex-shrink-0"
                          onClick={() => copyToClipboard(value, label)}
                          title={`Copy ${label}`}
                        >
                          {copiedLabel === label ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                  {convertedDate.timezone && (
                    <p className="text-xs text-muted-foreground">
                      Timezone: {convertedDate.timezone}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════
              Mode: Date → Timestamp
             ══════════════════════════════════════════════════════════════ */}
          {mode === 'date-to-timestamp' && (
            <>
              {/* ── Input ──────────────────────────────────────────────── */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Date &amp; Time Input</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="ts-date-input" className="text-sm font-medium">
                      Date
                    </label>
                    <input
                      id="ts-date-input"
                      type="date"
                      className="w-full mt-1 px-4 py-2.5 rounded-lg border border-border bg-background text-sm"
                      value={dateInput}
                      onChange={e => setDateInput(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="ts-time-input" className="text-sm font-medium">
                      Time
                    </label>
                    <input
                      id="ts-time-input"
                      type="time"
                      step="1"
                      className="w-full mt-1 px-4 py-2.5 rounded-lg border border-border bg-background text-sm"
                      value={timeInput}
                      onChange={e => setTimeInput(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select a date and time to convert to a Unix timestamp. If no time is set, midnight (00:00:00) is used.
                </p>
              </div>

              {/* ── Results ────────────────────────────────────────────── */}
              {convertedTimestamp && dateInput && (
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <h3 className="font-semibold">Converted Timestamps</h3>
                  <div className="space-y-3">
                    {([
                      { label: 'Unix Seconds', value: String(convertedTimestamp.seconds) },
                      { label: 'Unix Milliseconds', value: String(convertedTimestamp.milliseconds) },
                    ]).map(({ label, value }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30"
                      >
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {label}
                          </span>
                          <p className="text-sm font-mono mt-0.5">{value}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="flex-shrink-0"
                          onClick={() => copyToClipboard(value, label)}
                          title={`Copy ${label}`}
                        >
                          {copiedLabel === label ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── How To Use ─────────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-bold mb-6">How to Use Timestamp Converter</h2>
            <ol className="space-y-4">
              {HOW_TO_STEPS.map(({ step, title, desc }) => (
                <li key={step} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                    {step}
                  </span>
                  <div>
                    <h4 className="font-semibold">{title}</h4>
                    <p className="text-muted-foreground text-sm">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* ── FAQ ─────────────────────────────────────────────────────── */}
          <div>
            <FAQSection
              faqs={TOOL_FAQS}
              title="Frequently Asked Questions"
              description=""
            />
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT COLUMN — Sidebar
           ════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            {/* ── Current Timestamp ────────────────────────────────────── */}
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Current Timestamp</h3>
              </div>

              <div className="text-center">
                <p className="text-3xl font-bold font-mono tabular-nums text-primary">
                  {currentTs.seconds.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Unix seconds</p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
                  onClick={() => copyCurrentTs('seconds')}
                >
                  <span className="font-mono text-xs truncate">
                    {currentTs.seconds.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                    {copiedLabel === 'current-seconds' ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Seconds
                  </span>
                </button>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
                  onClick={() => copyCurrentTs('milliseconds')}
                >
                  <span className="font-mono text-xs truncate">
                    {currentTs.milliseconds.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                    {copiedLabel === 'current-milliseconds' ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    MS
                  </span>
                </button>
              </div>

              <div className="text-xs text-muted-foreground space-y-0.5">
                <p className="font-mono">{currentTs.dateOnly}</p>
                <p className="font-mono">{currentTs.timeOnly}</p>
              </div>
            </div>

            {/* ── Tips ──────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>The converter auto-detects whether your input is in <strong>seconds</strong> (≤10 digits) or <strong>milliseconds</strong> (&gt;10 digits).</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>Unix timestamps are always in <strong>UTC</strong>. Use the timezone toggle to see the local equivalent.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>The current timestamp updates <strong>every second</strong> — great for testing or grabbing the current time programmatically.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>All conversions happen in your browser. Nothing is sent to a server.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
