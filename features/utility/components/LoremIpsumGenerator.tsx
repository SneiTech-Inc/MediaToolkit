'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Copy, Check, Download, RefreshCw, Trash2, Type } from 'lucide-react'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { getSaveVexFileName } from '@/utils/fileNames'
import {
  generateLoremIpsum,
  getModeLimits,
  getPresetConfig,
  PRESET_OPTIONS,
  type GenerationMode,
  type PresetName,
} from '@/features/utility/utils/loremIpsumGenerator'
import type { FAQItem } from '@/types/common'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What is Lorem Ipsum?',
    answer:
      'Lorem Ipsum is placeholder text commonly used in design, publishing, and web development to fill space before real content is available. It has been the industry standard dummy text since the 1500s.',
  },
  {
    question: 'Can I customize the generated text?',
    answer:
      'Yes! You can choose between paragraphs, sentences, words, or characters modes, adjust the count, and optionally provide a starting word or phrase. Use the presets for quick common lengths.',
  },
  {
    question: 'Is the text generated in my browser?',
    answer:
      'All text is generated locally in your browser using a built-in word corpus — no data is ever uploaded anywhere. Generation is instant and requires no internet connection.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Choose a mode',
    desc: 'Select between paragraphs, sentences, words, or characters depending on what kind of placeholder you need.',
  },
  {
    step: 2,
    title: 'Adjust the count',
    desc: 'Use the slider to set how much text to generate, or click a preset for common lengths.',
  },
  {
    step: 3,
    title: 'Copy or download',
    desc: 'Copy the generated text to your clipboard or download it as a .txt file to use in your projects.',
  },
]

const MODES: { key: GenerationMode; label: string }[] = [
  { key: 'paragraphs', label: 'Paragraphs' },
  { key: 'sentences', label: 'Sentences' },
  { key: 'words', label: 'Words' },
  { key: 'characters', label: 'Characters' },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export function LoremIpsumGenerator() {
  const [mode, setMode] = useState<GenerationMode>('paragraphs')
  const [count, setCount] = useState(3)
  const [startWith, setStartWith] = useState('')
  const [generatedText, setGeneratedText] = useState('')
  const [copied, setCopied] = useState(false)

  // ── Mode limits ──────────────────────────────────────────────────────────

  const limits = useMemo(() => getModeLimits(mode), [mode])

  // ── Generate ──────────────────────────────────────────────────────────────

  const regenerate = useCallback(() => {
    const text = generateLoremIpsum(mode, count, startWith || undefined)
    setGeneratedText(text)
    setCopied(false)
  }, [mode, count, startWith])

  // Auto-generate on mount and when deps change
  useEffect(() => {
    regenerate()
  }, [regenerate])

  // Reset count when mode changes (clamp to new limits)
  const handleModeChange = useCallback(
    (newMode: GenerationMode) => {
      const newLimits = getModeLimits(newMode)
      setMode(newMode)
      setCount(prev => Math.max(newLimits.min, Math.min(newLimits.max, prev)))
    },
    [],
  )

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const text = generatedText
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const charsWithSpaces = text.length
    const charsWithoutSpaces = text.replace(/\s/g, '').length
    const paragraphs = text.trim() ? text.split(/\n\n+/).filter(Boolean).length : 0
    const sentences = text.match(/[.!?]+/g)?.length || 0
    return { words, charsWithSpaces, charsWithoutSpaces, paragraphs, sentences }
  }, [generatedText])

  // ── Copy ──────────────────────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedText)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = generatedText
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generatedText])

  // ── Download ──────────────────────────────────────────────────────────────

  const handleDownload = useCallback(() => {
    const blob = new Blob([generatedText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName('lorem-ipsum.txt')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [generatedText])

  // ── Clear ─────────────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    setGeneratedText('')
    setCopied(false)
  }, [])

  // ── Presets ───────────────────────────────────────────────────────────────

  const applyPreset = useCallback((preset: PresetName) => {
    const config = getPresetConfig(preset)
    setMode(config.mode)
    setCount(config.count)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ════════════════════════════════════════════════════════════════
            LEFT COLUMN — Output
           ════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-8">
          {/* ── Output Area ────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Type className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Generated Text</h3>
            </div>

            {generatedText ? (
              <div className="rounded-lg border border-border bg-background p-4 max-h-[500px] overflow-y-auto">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {generatedText}
                </p>
              </div>
            ) : (
              <div className="py-16 text-center text-muted-foreground">
                <Type className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Configure settings and generate placeholder text</p>
              </div>
            )}
          </div>

          {/* ── Action Buttons ─────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleCopy} disabled={!generatedText}>
              {copied ? (
                <Check className="w-4 h-4 mr-1.5 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 mr-1.5" />
              )}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={!generatedText}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download .txt
            </Button>
            <Button variant="outline" onClick={regenerate}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Regenerate
            </Button>
            <Button
              variant="ghost"
              onClick={handleClear}
              disabled={!generatedText}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Clear
            </Button>
          </div>

          {/* ── Statistics ─────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-4">Statistics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
              {([
                { label: 'Words', value: stats.words },
                { label: 'Chars (+spaces)', value: stats.charsWithSpaces },
                { label: 'Chars (-spaces)', value: stats.charsWithoutSpaces },
                { label: 'Paragraphs', value: stats.paragraphs },
                { label: 'Sentences', value: stats.sentences },
              ] as const).map(({ label, value }) => (
                <div key={label}>
                  <p className="text-2xl font-bold tabular-nums text-primary">
                    {value.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── How To Use ─────────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-bold mb-6">How to Use Lorem Ipsum Generator</h2>
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
            {/* ── Mode Selector ─────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Mode</h3>
              <div className="space-y-1">
                {MODES.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleModeChange(key)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      mode === key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:border-primary/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Count Slider ──────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="font-semibold">Count</h3>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={limits.min}
                  max={limits.max}
                  value={count}
                  onChange={e => setCount(parseInt(e.target.value, 10))}
                  className="flex-1 h-2 rounded-full bg-muted appearance-none cursor-pointer accent-primary"
                />
                <span className="text-sm font-bold text-primary tabular-nums w-8 text-right">
                  {count}
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{limits.min}</span>
                <span>{limits.max}</span>
              </div>
            </div>

            {/* ── Presets ───────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Presets</h3>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPreset(key)}
                    className="px-3 py-2 rounded-lg text-sm font-medium border border-border bg-background hover:border-primary/50 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Starting Word ──────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">
                Starting Word{' '}
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </h3>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                placeholder='e.g. "Once upon a time"'
                value={startWith}
                onChange={e => setStartWith(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Prefix the generated text with a custom word or phrase.
              </p>
            </div>

            {/* ── Tips ──────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>Use <strong>Paragraphs</strong> mode for layout mockups and page designs.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>Use <strong>Characters</strong> mode when you need text that fits within a specific length constraint.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>The starting word feature lets you prefix the text — useful for testing specific word placements.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>Every click of Regenerate produces different random text with the same settings.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
