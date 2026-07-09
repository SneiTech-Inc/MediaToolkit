'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import {
  RotateCcw,
  FileText,
  Clock,
  Mic,
  Hash,
  AlignLeft,
  Upload,
  Type,
} from 'lucide-react'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { countAll, type WordCountResult } from '@/features/text/utils/wordCounter'
import type { FAQItem } from '@/types/common'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What is included in the word count?',
    answer:
      'Word Counter counts words, characters (with and without spaces), sentences, paragraphs, and lines in real-time as you type or paste text. Reading time is estimated at 200 words per minute, and speaking time at 130 words per minute. All processing is done entirely in your browser.',
  },
  {
    question: 'What is the average reading speed used?',
    answer:
      'Reading time is calculated at 200 words per minute, which is the average reading speed for adults reading non-technical content. Speaking time is calculated at 130 words per minute, the average conversational speaking rate.',
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
    title: 'View real-time stats',
    desc: 'Statistics update instantly as you type — no buttons to press.',
  },
  {
    step: 3,
    title: 'Analyze word frequency',
    desc: 'See which words you use most often in the frequency table.',
  },
]

const STAT_CARDS = [
  { key: 'words', label: 'Words', icon: Type, prominent: true },
  { key: 'characters', label: 'Characters', icon: Hash, prominent: false },
  { key: 'charactersNoSpaces', label: 'Characters (no spaces)', icon: Hash, prominent: false },
  { key: 'sentences', label: 'Sentences', icon: AlignLeft, prominent: false },
  { key: 'paragraphs', label: 'Paragraphs', icon: FileText, prominent: false },
  { key: 'lines', label: 'Lines', icon: AlignLeft, prominent: false },
  { key: 'readingTime', label: 'Reading Time', icon: Clock, prominent: false, suffix: ' min' },
  { key: 'speakingTime', label: 'Speaking Time', icon: Mic, prominent: false, suffix: ' min' },
] as const

// ─── Component ─────────────────────────────────────────────────────────────────

export function WordCounter() {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasText = text.length > 0

  // ── Derived stats ────────────────────────────────────────────────────────

  const stats: WordCountResult = useMemo(() => countAll(text), [text])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    setFileError(null)
  }, [])

  const handleFileUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setFileError(null)

      // Validate file type
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

      // Reset input so the same file can be re-uploaded
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
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getStatValue = (key: string): string | number => {
    if (key === 'readingTime' || key === 'speakingTime') {
      return `~${stats[key as keyof WordCountResult]}`
    }
    return stats[key as keyof WordCountResult] as string | number
  }

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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFileUpload}
                >
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
              placeholder="Type or paste your text here..."
              className="w-full min-h-[200px] max-h-[500px] rounded-xl border border-border bg-card p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary resize-y transition-shadow"
              aria-label="Text input area"
            />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{text.length} characters typed</span>
              {fileName && <span>Source: {fileName}</span>}
            </div>
          </div>

          {/* ── Statistics Grid ──────────────────────────────────────── */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Text Statistics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STAT_CARDS.map(({ key, label, icon: Icon, prominent, ...rest }) => {
                const value = getStatValue(key)
                const suffix = 'suffix' in rest ? (rest as { suffix: string }).suffix : undefined
                const displayValue = suffix ? `${value}${suffix}` : value

                return (
                  <div
                    key={key}
                    className={`rounded-xl border border-border p-4 bg-card transition-all hover:border-primary hover:shadow-md ${
                      prominent
                        ? 'sm:col-span-2 bg-primary/5 border-primary/30'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">
                        {label}
                      </span>
                    </div>
                    <p
                      className={`font-bold tabular-nums ${
                        prominent
                          ? 'text-4xl text-primary'
                          : 'text-2xl text-foreground'
                      }`}
                    >
                      {displayValue}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Word Frequency Table ─────────────────────────────────── */}
          {stats.wordFrequency.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Word Frequency</h2>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground w-12">
                        #
                      </th>
                      <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">
                        Word
                      </th>
                      <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground w-24">
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.wordFrequency.map((entry, index) => (
                      <tr
                        key={entry.word}
                        className={`border-b border-border last:border-0 transition-colors hover:bg-muted/30 ${
                          index % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'
                        }`}
                      >
                        <td className="px-4 py-2.5 text-muted-foreground font-mono">
                          {index + 1}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{entry.word}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {entry.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── How To Use ───────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-bold mb-6">How to Use Word Counter</h2>
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
            {/* Quick Stats Summary */}
            <div className="border border-border rounded-xl p-6 bg-card">
              <h3 className="font-semibold mb-4">Quick Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Words</span>
                  <span className="text-2xl font-bold text-primary tabular-nums">
                    {stats.words}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Characters</span>
                  <span className="font-semibold tabular-nums">{stats.characters}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Reading Time</span>
                  <span className="font-semibold">
                    ~{stats.readingTime} min
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Speaking Time</span>
                  <span className="font-semibold">
                    ~{stats.speakingTime} min
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
                  <span>Paste text directly or upload a .txt file to get started.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Word frequency excludes common words like &quot;the&quot; and &quot;and.&quot;</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>All stats update in real-time as you type — no need to press a button.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Your text never leaves your browser. 100% private.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
