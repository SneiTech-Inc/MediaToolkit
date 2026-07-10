'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback, useMemo, useRef } from 'react'
import {
  RotateCcw,
  Upload,
  Copy,
  Download,
  Check,
  CheckCircle2,
  XCircle,
  Braces,
  Minus,
  AlignLeft,
  AlertTriangle,
} from 'lucide-react'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import {
  formatJSON,
  type JSONResult,
} from '@/features/text/utils/jsonFormatter'
import type { FAQItem } from '@/types/common'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What is JSON formatting?',
    answer:
      'JSON formatting (or "beautifying") adds consistent indentation and line breaks to make JSON data human-readable. Choose 2 or 4 spaces for indentation. Minifying does the opposite — it compresses JSON to a single line to minimize file size.',
  },
  {
    question: 'What does validate do?',
    answer:
      'Validation checks if your JSON is syntactically correct according to the JSON specification. If invalid, it shows the exact line and column where the error was found, along with a descriptive error message.',
  },
  {
    question: 'Is my JSON uploaded to a server?',
    answer:
      'No! All JSON processing happens entirely in your browser. Your data never leaves your device. We do not store, transmit, or have any access to the JSON you enter.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Enter your JSON',
    desc: 'Type or paste JSON into the text area, or upload a .json file.',
  },
  {
    step: 2,
    title: 'Format, minify, or validate',
    desc: 'Click Format to beautify, Minify to compress, or Validate to check for errors.',
  },
  {
    step: 3,
    title: 'Copy or download',
    desc: 'Copy the processed JSON to clipboard or download it as a .json file.',
  },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export function JSONFormatter() {
  const [text, setText] = useState('')
  const [indentSize, setIndentSize] = useState<2 | 4>(2)
  const [result, setResult] = useState<JSONResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasText = text.length > 0

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleFormat = useCallback(() => {
    setResult(formatJSON(text, indentSize))
  }, [text, indentSize])

  const handleMinify = useCallback(() => {
    const r = formatJSON(text, indentSize)
    setResult(r)
  }, [text, indentSize])

  const handleValidate = useCallback(() => {
    setResult(formatJSON(text, indentSize))
  }, [text, indentSize])

  // ── Output selection ──────────────────────────────────────────────────────

  const outputText = useMemo(() => {
    if (!result) return ''
    return result.isValid ? result.formatted : ''
  }, [result])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value)
      setResult(null)
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
      if (!file.name.endsWith('.json')) {
        setFileError('Please upload a .json file.')
        return
      }
      try {
        const content = await file.text()
        setText(content)
        setResult(null)
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
    setResult(null)
    setFileName(null)
    setFileError(null)
    setCopied(false)
  }, [])

  const handleCopy = useCallback(async () => {
    if (!outputText && !result?.minified) return
    const toCopy = outputText || result?.minified || ''
    try {
      await navigator.clipboard.writeText(toCopy)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = toCopy
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [outputText, result])

  const handleDownload = useCallback(() => {
    const toDownload = outputText || result?.minified || text
    const blob = new Blob([toDownload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(fileName || 'formatted.json')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [outputText, result, text, fileName])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Main Content ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          {/* ── Input Area ──────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Enter Your JSON</h2>
              <div className="flex items-center gap-2">
                {fileName && (
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                    {fileName}
                  </span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Upload .json file"
                />
                <Button variant="outline" size="sm" onClick={handleFileUpload}>
                  <Upload className="w-4 h-4 mr-1.5" />
                  Upload .json
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
              placeholder='Paste your JSON here... e.g. &#123;"hello": "world"&#125;'
              className="w-full min-h-[200px] max-h-[400px] rounded-xl border border-border bg-card p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary resize-y transition-shadow font-mono text-sm"
              aria-label="JSON input area"
              spellCheck={false}
            />
          </div>

          {/* ── Actions ──────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleFormat} disabled={!hasText} size="sm">
              <Braces className="w-4 h-4 mr-1.5" />
              Format
            </Button>
            <Button
              onClick={handleMinify}
              disabled={!hasText}
              variant="outline"
              size="sm"
            >
              <Minus className="w-4 h-4 mr-1.5" />
              Minify
            </Button>
            <Button
              onClick={handleValidate}
              disabled={!hasText}
              variant="outline"
              size="sm"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Validate
            </Button>

            <div className="h-6 w-px bg-border mx-1" />

            <span className="text-xs text-muted-foreground">Indent:</span>
            <button
              onClick={() => setIndentSize(2)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                indentSize === 2
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              2
            </button>
            <button
              onClick={() => setIndentSize(4)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                indentSize === 4
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              4
            </button>
          </div>

          {/* ── Validation Status ────────────────────────────────────── */}
          {result && (
            <div
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${
                result.isValid
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30'
                  : 'bg-destructive/10 text-destructive border border-destructive/30'
              }`}
            >
              {result.isValid ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              {result.isValid ? 'Valid JSON' : 'Invalid JSON'}
            </div>
          )}

          {/* ── Error Display ────────────────────────────────────────── */}
          {result && !result.isValid && result.error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-destructive font-semibold">
                <AlertTriangle className="w-4 h-4" />
                Syntax Error
              </div>
              <p className="text-sm text-foreground">{result.error.message}</p>
              {result.error.line > 0 && (
                <p className="text-xs text-muted-foreground">
                  Line {result.error.line}, Column {result.error.column}
                </p>
              )}
            </div>
          )}

          {/* ── Output Preview ───────────────────────────────────────── */}
          {result && result.isValid && (
            <>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Formatted Output</h2>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      disabled={!outputText}
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
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      Download .json
                    </Button>
                  </div>
                </div>
                <pre className="w-full min-h-[120px] max-h-[500px] overflow-auto rounded-xl border border-border bg-muted/30 p-4 text-foreground font-mono text-sm whitespace-pre">
                  {outputText}
                </pre>
              </div>

              {/* ── Stats ─────────────────────────────────────────── */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <div className="text-lg font-bold tabular-nums">
                    {result.stats.characters}
                  </div>
                  <div className="text-xs text-muted-foreground">Characters</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <div className="text-lg font-bold tabular-nums">
                    {result.stats.lines}
                  </div>
                  <div className="text-xs text-muted-foreground">Lines</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <div className="text-lg font-bold tabular-nums">
                    {result.stats.size}
                  </div>
                  <div className="text-xs text-muted-foreground">Bytes</div>
                </div>
              </div>
            </>
          )}

          {/* ── How To Use ───────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-bold mb-6">How to Use JSON Formatter</h2>
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
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span
                    className={`font-semibold text-sm ${
                      result?.isValid
                        ? 'text-green-600 dark:text-green-400'
                        : result
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {result
                      ? result.isValid
                        ? 'Valid'
                        : 'Invalid'
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Indent</span>
                  <span className="font-semibold">{indentSize} spaces</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Size</span>
                  <span className="font-semibold tabular-nums">
                    {result ? `${result.stats.size} B` : '—'}
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
                  <span>Click <strong>Format</strong> to beautify with indentation.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Click <strong>Minify</strong> to compress to a single line.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Click <strong>Validate</strong> to check for syntax errors.</span>
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
