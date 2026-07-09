'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import {
  RotateCcw,
  Upload,
  Copy,
  Download,
  Check,
  ArrowUpDown,
  ArrowDownAZ,
  ArrowUpAZ,
  Hash,
} from 'lucide-react'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import {
  sortLines,
  DEFAULTS,
  type SortOptions,
} from '@/features/text/utils/sortLines'
import type { FAQItem } from '@/types/common'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What sorting types are supported?',
    answer:
      'Sort Lines supports alphabetical sorting (A-Z, Z-A) using natural language comparison, and numerical sorting that extracts and compares numbers within each line. Numbers are detected automatically — "item10" sorts after "item2" in numerical mode.',
  },
  {
    question: 'What does case sensitive mean?',
    answer:
      "With case sensitivity on, uppercase letters sort before lowercase letters (A, B, C, ..., a, b, c). With it off, 'Apple' and 'apple' are treated equally regardless of capitalization.",
  },
  {
    question: 'Is my text uploaded to a server?',
    answer:
      'No! All text processing happens entirely in your browser. Your text never leaves your device. We do not store, transmit, or have any access to the text you enter.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Enter your text',
    desc: 'Type or paste text into the text area, or upload a .txt file.',
  },
  {
    step: 2,
    title: 'Choose sort options',
    desc: 'Select sort order (A→Z or Z→A), type (alphabetical or numerical), and additional options.',
  },
  {
    step: 3,
    title: 'Copy or download',
    desc: 'Copy the sorted text to clipboard or download it as a .txt file.',
  },
]

// ─── Inline Toggle Switch ─────────────────────────────────────────────────────

function ToggleSwitch({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-3 cursor-pointer select-none"
    >
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-9 h-5 rounded-full transition-colors ${
            checked ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </label>
  )
}

// ─── Segmented Control ────────────────────────────────────────────────────────

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3.5 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-muted-foreground hover:bg-muted/50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SortLines() {
  const [text, setText] = useState('')
  const [options, setOptions] = useState<SortOptions>({ ...DEFAULTS })
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasText = text.length > 0

  // ── Derived values ───────────────────────────────────────────────────────

  const result = useMemo(
    () => sortLines(text, options),
    [text, options]
  )

  const sortedText = useMemo(
    () => result.sortedLines.join('\n'),
    [result.sortedLines]
  )

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value)
      setFileError(null)
    },
    []
  )

  const handleFileUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setFileError(null)
      if (!file.name.endsWith('.txt')) {
        setFileError('Please upload a .txt file.')
        return
      }
      try {
        const content = await file.text()
        setText(content)
        setFileName(file.name)
      } catch {
        setFileError('Failed to read the file. Please try another file.')
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    []
  )

  const handleClear = useCallback(() => {
    setText('')
    setFileName(null)
    setFileError(null)
    setCopied(false)
  }, [])

  const handleCopy = useCallback(async () => {
    if (!sortedText) return
    try {
      await navigator.clipboard.writeText(sortedText)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = sortedText
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [sortedText])

  const handleDownload = useCallback(() => {
    if (!sortedText) return
    const blob = new Blob([sortedText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sorted-text.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [sortedText])

  const setOpt = useCallback(
    <K extends keyof SortOptions>(key: K, value: SortOptions[K]) => {
      setOptions((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Main Content ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {/* ── Input Area ──────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Enter Your Text</h2>
              <div className="flex items-center gap-2">
                {fileName && (
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                    {fileName}
                  </span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Upload .txt file"
                />
                <Button variant="outline" size="sm" onClick={handleFileUpload}>
                  <Upload className="w-4 h-4 mr-1.5" />
                  Upload .txt
                </Button>
                {hasText && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {fileError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">
                {fileError}
              </div>
            )}

            <textarea
              value={text}
              onChange={handleTextChange}
              placeholder="Type or paste your text here (one item per line)..."
              className="w-full min-h-[180px] max-h-[400px] rounded-xl border border-border bg-card p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary resize-y transition-shadow"
              aria-label="Text input area"
            />
          </div>

          {/* ── Options Panel ────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-5">
            <h3 className="font-semibold flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
              Sort Options
            </h3>

            {/* Sort Order & Type */}
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Sort Order
                </span>
                <SegmentedControl
                  options={[
                    { value: 'asc' as const, label: 'A → Z' },
                    { value: 'desc' as const, label: 'Z → A' },
                  ]}
                  value={options.order}
                  onChange={(v) => setOpt('order', v)}
                />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Sort Type
                </span>
                <SegmentedControl
                  options={[
                    { value: 'alphabetical' as const, label: 'Alphabetical' },
                    { value: 'numerical' as const, label: 'Numerical' },
                  ]}
                  value={options.type}
                  onChange={(v) => setOpt('type', v)}
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <ToggleSwitch
                id="case-sensitive"
                label="Case sensitive"
                checked={options.caseSensitive}
                onChange={(v) => setOpt('caseSensitive', v)}
              />
              <ToggleSwitch
                id="trim-whitespace"
                label="Trim whitespace"
                checked={options.trimWhitespace}
                onChange={(v) => setOpt('trimWhitespace', v)}
              />
              <ToggleSwitch
                id="remove-empty"
                label="Remove empty lines"
                checked={options.removeEmptyLines}
                onChange={(v) => setOpt('removeEmptyLines', v)}
              />
            </div>
          </div>

          {/* ── Statistics ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-foreground tabular-nums">
                {result.originalCount}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Original Lines</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-primary tabular-nums">
                {result.sortedCount}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Sorted Lines</div>
            </div>
          </div>

          {/* ── Preview ──────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Sorted Result</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!hasText || result.sortedCount === 0}
                >
                  {copied ? (
                    <Check className="w-4 h-4 mr-1.5 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1.5" />
                  )}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={!hasText || result.sortedCount === 0}
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download .txt
                </Button>
              </div>
            </div>
            <div
              className={`w-full min-h-[120px] rounded-xl border border-border bg-muted/30 p-4 text-foreground whitespace-pre-wrap break-words font-mono text-sm transition-all ${
                !hasText ? 'text-muted-foreground italic' : ''
              }`}
              aria-label="Sorted text preview"
            >
              {hasText ? sortedText : 'Sorted text will appear here...'}
            </div>
          </div>

          {/* ── How To Use ───────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-bold mb-6">How to Use Sort Lines</h2>
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

          {/* ── FAQ ───────────────────────────────────────────────────── */}
          <div>
            <FAQSection
              faqs={TOOL_FAQS}
              title="Frequently Asked Questions"
              description=""
            />
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            <div className="border border-border rounded-xl p-6 bg-card">
              <h3 className="font-semibold mb-4">Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Order</span>
                  <span className="font-semibold">
                    {options.order === 'asc' ? 'A → Z' : 'Z → A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Type</span>
                  <span className="font-semibold">
                    {options.type === 'alphabetical' ? 'Alphabetical' : 'Numerical'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Lines</span>
                  <span className="font-semibold text-primary tabular-nums">
                    {result.sortedCount}
                  </span>
                </div>
                {fileName && (
                  <div className="pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      Source: {fileName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="border border-border rounded-xl p-6 bg-muted/20">
              <h3 className="font-semibold mb-3">Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Numerical sort extracts the first number from each line for comparison.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Lines without numbers in numerical mode sort alphabetically.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Case sensitive ON: uppercase sorts before lowercase.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>All processing happens in your browser — 100% private.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
