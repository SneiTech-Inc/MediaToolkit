'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Copy, Check, Download, RefreshCw, Trash2, Fingerprint } from 'lucide-react'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { getSaveVexFileName } from '@/utils/fileNames'
import {
  generateUUIDs,
  VERSION_DESCRIPTIONS,
  type UUIDVersion,
} from '@/features/utility/utils/uuidGenerator'
import type { FAQItem } from '@/types/common'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What is a UUID?',
    answer:
      'A UUID (Universally Unique Identifier) is a 128-bit number used to uniquely identify information in computer systems. The chance of collision is astronomically low — you would need to generate billions of UUIDs per second for centuries to see a duplicate.',
  },
  {
    question: 'Which version should I use?',
    answer:
      'Version 4 (random) is the most common and suitable for most applications. Version 7 (timestamp-ordered) is recommended for database primary keys because it sorts chronologically. Versions 1 and 6 are specialized variants for specific use cases.',
  },
  {
    question: 'Are UUIDs truly unique?',
    answer:
      'UUIDs are generated using cryptographically secure random numbers from your browser. While absolutely guaranteed uniqueness is mathematically impossible, the probability of collision is so low (~1 in 2^122 for v4) that UUIDs are considered universally unique for all practical purposes.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Choose a version',
    desc: 'Select the UUID version that fits your use case. Version 4 is the default and works for most situations.',
  },
  {
    step: 2,
    title: 'Set the count',
    desc: 'Choose how many UUIDs you need — from 1 to 100. Higher counts are useful for batch operations or seeding databases.',
  },
  {
    step: 3,
    title: 'Copy or download',
    desc: 'Copy individual UUIDs, copy all at once, or download the entire set as a .txt file for use in your projects.',
  },
]

const VERSIONS: { key: UUIDVersion; label: string; description: string }[] = [
  { key: 'v4', label: 'Version 4', description: 'Random — most common' },
  { key: 'v7', label: 'Version 7', description: 'Timestamp-ordered — best for DBs' },
  { key: 'v1', label: 'Version 1', description: 'Time-based with node info' },
  { key: 'v6', label: 'Version 6', description: 'Reordered time-based' },
]

const MAX_COUNT = 100
const MIN_COUNT = 1

// ─── Component ─────────────────────────────────────────────────────────────────

export function UUIDGenerator() {
  const [version, setVersion] = useState<UUIDVersion>('v4')
  const [count, setCount] = useState(1)
  const [uuids, setUuids] = useState<string[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  // ── Generate ───────────────────────────────────────────────────────────────

  const regenerate = useCallback(() => {
    const newUUIDs = generateUUIDs(version, count)
    setUuids(newUUIDs)
    setGeneratedAt(new Date().toISOString())
    setCopiedIndex(null)
    setCopiedAll(false)
  }, [version, count])

  // Auto-generate on mount and when version changes
  useEffect(() => {
    regenerate()
  }, [version]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-generate when count changes
  const handleCountChange = useCallback(
    (value: number) => {
      setCount(value)
      const newUUIDs = generateUUIDs(version, value)
      setUuids(newUUIDs)
      setGeneratedAt(new Date().toISOString())
      setCopiedIndex(null)
      setCopiedAll(false)
    },
    [version],
  )

  // ── Copy Handlers ──────────────────────────────────────────────────────────

  const copySingle = useCallback(async (uuid: string, index: number) => {
    try {
      await navigator.clipboard.writeText(uuid)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = uuid
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedIndex(index)
    setCopiedAll(false)
    setTimeout(() => setCopiedIndex(null), 2000)
  }, [])

  const copyAll = useCallback(async () => {
    const text = uuids.join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedAll(true)
    setCopiedIndex(null)
    setTimeout(() => setCopiedAll(false), 2000)
  }, [uuids])

  // ── Download ───────────────────────────────────────────────────────────────

  const handleDownload = useCallback(() => {
    const text = uuids.join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName('uuids.txt')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [uuids])

  // ── Clear ──────────────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    setUuids([])
    setGeneratedAt(null)
    setCopiedIndex(null)
    setCopiedAll(false)
  }, [])

  // ── Version label ──────────────────────────────────────────────────────────

  const versionLabel = useMemo(
    () => VERSION_DESCRIPTIONS[version].label,
    [version],
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ════════════════════════════════════════════════════════════════
            LEFT COLUMN — Results
           ════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-8">
          {/* ── Results List ──────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">
                  Generated UUIDs
                  {uuids.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-2 font-normal">
                      ({uuids.length} of {count})
                    </span>
                  )}
                </h3>
              </div>
              {uuids.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {versionLabel}
                </span>
              )}
            </div>

            {uuids.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Fingerprint className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Click Generate to create UUIDs</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                {uuids.map((uuid, i) => (
                  <div
                    key={`${uuid}-${i}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors group"
                  >
                    <span className="text-xs text-muted-foreground font-mono w-8 flex-shrink-0 text-right tabular-nums">
                      #{i + 1}
                    </span>
                    <code className="flex-1 text-sm font-mono break-all select-all">
                      {uuid}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => copySingle(uuid, i)}
                      title="Copy UUID"
                    >
                      {copiedIndex === i ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Bulk Actions ──────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={copyAll}
              disabled={uuids.length === 0}
            >
              {copiedAll ? (
                <Check className="w-4 h-4 mr-1.5 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 mr-1.5" />
              )}
              {copiedAll ? 'Copied All!' : 'Copy All'}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={uuids.length === 0}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download .txt
            </Button>
            <Button
              variant="outline"
              onClick={regenerate}
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Regenerate
            </Button>
            <Button
              variant="ghost"
              onClick={handleClear}
              disabled={uuids.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Clear
            </Button>
          </div>

          {/* ── How To Use ─────────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-bold mb-6">How to Use UUID Generator</h2>
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
            RIGHT COLUMN — Controls
           ════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            {/* ── Version Selector ──────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">UUID Version</h3>
              <div className="space-y-2">
                {VERSIONS.map(({ key, label, description }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setVersion(key)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                      version === key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:border-primary/50'
                    }`}
                  >
                    <span className="font-semibold">{label}</span>
                    <span className="block text-xs opacity-70 mt-0.5">
                      {description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Count Selector ────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="font-semibold">Count</h3>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={MIN_COUNT}
                  max={MAX_COUNT}
                  value={count}
                  onChange={e => handleCountChange(parseInt(e.target.value, 10))}
                  className="flex-1 h-2 rounded-full bg-muted appearance-none cursor-pointer accent-primary"
                />
                <span className="text-sm font-bold text-primary tabular-nums w-8 text-right">
                  {count}
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1</span>
                <span>100</span>
              </div>
            </div>

            {/* ── Generate Button ───────────────────────────────────────── */}
            <Button
              className="w-full"
              size="lg"
              onClick={regenerate}
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Generate
            </Button>

            {/* ── Statistics ─────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Statistics</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Count</span>
                  <span className="font-semibold tabular-nums">{uuids.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-semibold">{versionLabel}</span>
                </div>
                {generatedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Generated</span>
                    <span className="font-semibold text-xs font-mono">
                      {new Date(generatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Tips ──────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>Use <strong>v4</strong> for general-purpose unique IDs — it&apos;s the most widely supported version.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>Use <strong>v7</strong> for database primary keys — the timestamp prefix improves index performance.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>Hover over any UUID row to reveal the copy button for that entry.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>All UUIDs are generated locally using cryptographically secure randomness.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
