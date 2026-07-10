'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback, useMemo, useRef } from 'react'
import {
  RotateCcw,
  Upload,
  Copy,
  Download,
  Check,
  FileText,
  Type,
  Hash,
} from 'lucide-react'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import {
  convertCase,
  CASE_OPTIONS,
  type CaseType,
} from '@/features/text/utils/caseConverter'
import type { FAQItem } from '@/types/common'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What case formats are supported?',
    answer:
      'Case Converter supports 8 formats: UPPERCASE, lowercase, Title Case, Sentence case, camelCase, PascalCase, kebab-case, and snake_case. Simply select a format to see your text converted instantly — no buttons to press.',
  },
  {
    question: 'Does the tool preserve special characters?',
    answer:
      'Special characters and numbers are preserved in UPPERCASE, lowercase, Title Case, and Sentence case conversions. They may be removed in camelCase, PascalCase, kebab-case, and snake_case conversions, where only letters and numbers are kept.',
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
    title: 'Choose a case format',
    desc: 'Select from 8 case formats — the preview updates instantly.',
  },
  {
    step: 3,
    title: 'Copy or download',
    desc: 'Copy the converted text to clipboard or download it as a .txt file.',
  },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export function CaseConverter() {
  const [text, setText] = useState('')
  const [selectedCase, setSelectedCase] = useState<CaseType>('lowercase')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasText = text.length > 0

  // ── Derived values ───────────────────────────────────────────────────────

  const converted = useMemo(
    () => convertCase(text, selectedCase),
    [text, selectedCase]
  )

  const wordCount = useMemo(() => {
    if (!converted) return 0
    const matches = converted.match(/\S+/g)
    return matches ? matches.length : 0
  }, [converted])

  const charCount = useMemo(() => converted.length, [converted])

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
    if (!converted) return
    try {
      await navigator.clipboard.writeText(converted)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select and copy manually
      const ta = document.createElement('textarea')
      ta.value = converted
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [converted])

  const handleDownload = useCallback(() => {
    if (!converted) return
    const blob = new Blob([converted], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName('converted-text.txt')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [converted])

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
              placeholder="Type or paste your text here..."
              className="w-full min-h-[160px] max-h-[400px] rounded-xl border border-border bg-card p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary resize-y transition-shadow"
              aria-label="Text input area"
            />

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{text.length} characters typed</span>
              {fileName && <span>Source: {fileName}</span>}
            </div>
          </div>

          {/* ── Case Format Buttons ──────────────────────────────────── */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Select Case Format</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CASE_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  onClick={() => setSelectedCase(option.type)}
                  disabled={!hasText}
                  className={`rounded-xl border p-3 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    selectedCase === option.type
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30'
                  }`}
                >
                  <div className="text-xs font-semibold text-foreground">
                    {option.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {option.example}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Live Preview ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Converted Text</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!hasText}
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
                  disabled={!hasText}
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download .txt
                </Button>
              </div>
            </div>
            <div
              className={`w-full min-h-[120px] rounded-xl border border-border bg-muted/30 p-4 text-foreground whitespace-pre-wrap break-words transition-all ${
                !hasText ? 'text-muted-foreground italic' : ''
              }`}
              aria-label="Converted text preview"
            >
              {hasText ? converted : 'Converted text will appear here...'}
            </div>
            {hasText && (
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Type className="w-3 h-3" />
                  {wordCount} words
                </span>
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {charCount} characters
                </span>
              </div>
            )}
          </div>

          {/* ── How To Use ───────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-bold mb-6">How to Use Case Converter</h2>
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
              <h3 className="font-semibold mb-4">Conversion Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Format</span>
                  <span className="font-semibold text-primary">
                    {CASE_OPTIONS.find((o) => o.type === selectedCase)?.label}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Words</span>
                  <span className="font-semibold tabular-nums">{wordCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Characters</span>
                  <span className="font-semibold tabular-nums">{charCount}</span>
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
                  <span>Click any case format button to see the result instantly.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>camelCase, PascalCase, kebab-case, and snake_case remove punctuation and special characters.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>UPPERCASE, lowercase, Title Case, and Sentence case preserve all characters.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Your text is processed entirely in your browser — 100% private.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
