'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback, useMemo, useRef } from 'react'
import {
  RotateCcw,
  Upload,
  Copy,
  Download,
  Check,
  List,
  ListFilter,
  Trash2,
} from 'lucide-react'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import {
  removeDuplicates,
  DEFAULTS,
  type RemoveDuplicatesOptions,
} from '@/features/text/utils/removeDuplicates'
import type { FAQItem } from '@/types/common'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What does case sensitive mean?',
    answer:
      "'Case sensitive' means that 'Hello' and 'hello' are treated as different lines. When turned off, they are considered duplicates of each other — regardless of capitalization.",
  },
  {
    question: 'Does the tool preserve line order?',
    answer:
      'Yes! The first occurrence of each line is preserved in its original position. Only subsequent duplicates are removed. The original order is always maintained.',
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
    title: 'Configure options',
    desc: 'Toggle case sensitivity, whitespace trimming, or empty line removal as needed.',
  },
  {
    step: 3,
    title: 'Copy or download',
    desc: 'Copy the deduplicated text to clipboard or download it as a .txt file.',
  },
]

// ─── Toggle Switch (inline — no external dependency) ───────────────────────────

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

// ─── Component ─────────────────────────────────────────────────────────────────

export function RemoveDuplicates() {
  const [text, setText] = useState('')
  const [options, setOptions] = useState<RemoveDuplicatesOptions>({ ...DEFAULTS })
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasText = text.length > 0

  // ── Derived values ───────────────────────────────────────────────────────

  const result = useMemo(
    () => removeDuplicates(text, options),
    [text, options]
  )

  const dedupedText = useMemo(
    () => result.uniqueLines.join('\n'),
    [result.uniqueLines]
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

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
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
    if (!dedupedText) return
    try {
      await navigator.clipboard.writeText(dedupedText)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = dedupedText
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [dedupedText])

  const handleDownload = useCallback(() => {
    if (!dedupedText) return
    const blob = new Blob([dedupedText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName('deduplicated-text.txt')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [dedupedText])

  const setOpt = useCallback(
    <K extends keyof RemoveDuplicatesOptions>(
      key: K,
      value: RemoveDuplicatesOptions[K]
    ) => {
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
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ListFilter className="w-4 h-4" />
              Options
            </h3>
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
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-foreground tabular-nums">
                {result.originalCount}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Original Lines</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-primary tabular-nums">
                {result.uniqueCount}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Unique Lines</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-destructive tabular-nums">
                {result.duplicatesRemoved}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Removed</div>
            </div>
          </div>

          {/* ── Preview ──────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Result</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!hasText || result.uniqueCount === 0}
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
                  disabled={!hasText || result.uniqueCount === 0}
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
              aria-label="Deduplicated text preview"
            >
              {hasText ? dedupedText : 'Deduplicated text will appear here...'}
            </div>
          </div>

          {/* ── How To Use ───────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-bold mb-6">
              How to Use Remove Duplicates
            </h2>
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
            {/* Quick Summary */}
            <div className="border border-border rounded-xl p-6 bg-card">
              <h3 className="font-semibold mb-4">Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Original lines
                  </span>
                  <span className="font-semibold tabular-nums">
                    {result.originalCount}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Unique lines
                  </span>
                  <span className="font-semibold text-primary tabular-nums">
                    {result.uniqueCount}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Duplicates removed
                  </span>
                  <span className="font-semibold text-destructive tabular-nums">
                    {result.duplicatesRemoved}
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

            {/* Tips */}
            <div className="border border-border rounded-xl p-6 bg-muted/20">
              <h3 className="font-semibold mb-3">Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>First occurrence of each line is always preserved.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Turn off &quot;Case sensitive&quot; to treat &quot;Hello&quot; and &quot;hello&quot; as the same.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Enable &quot;Trim whitespace&quot; to ignore leading/trailing spaces.</span>
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
