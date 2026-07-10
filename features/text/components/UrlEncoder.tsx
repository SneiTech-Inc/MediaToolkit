'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback, useMemo, useRef } from 'react'
import {
  RotateCcw,
  Upload,
  Copy,
  Download,
  Check,
  ArrowLeftRight,
  AlertTriangle,
  Link,
} from 'lucide-react'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { convertURL, type UrlMode } from '@/features/text/utils/urlEncoder'
import type { FAQItem } from '@/types/common'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What is URL encoding used for?',
    answer:
      'URL encoding converts special characters into a safe format for use in URLs. Characters like spaces, ampersands (&), question marks (?), and non-ASCII characters are replaced with percent-encoded values like %20, %26, etc. This ensures URLs work correctly across all browsers and servers.',
  },
  {
    question: "What is the difference between encodeURI and encodeURIComponent?",
    answer:
      "encodeURIComponent encodes ALL special characters including /, ?, #, and & — making it ideal for encoding query parameter values. encodeURI preserves URL structural characters and is better for encoding full URLs. This tool uses encodeURIComponent for maximum safety.",
  },
  {
    question: 'Is my text uploaded to a server?',
    answer:
      'No! All encoding and decoding happens entirely in your browser. Your text never leaves your device. We do not store, transmit, or have any access to the data you enter.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Choose a mode',
    desc: 'Select Encode to convert text to URL-safe format, or Decode to convert URL-encoded text back to plain text.',
  },
  {
    step: 2,
    title: 'Enter your text',
    desc: 'Type or paste text into the input area, or upload a .txt file.',
  },
  {
    step: 3,
    title: 'Copy or download',
    desc: 'Copy the converted text to clipboard or download it as a .txt file.',
  },
]

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
          className={`px-4 py-2 text-sm font-medium transition-colors ${
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

export function UrlEncoder() {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<UrlMode>('encode')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasText = text.length > 0

  const result = useMemo(() => convertURL(text, mode), [text, mode])

  const inputChars = text.length
  const outputChars = result.output.length
  const sizeChange =
    inputChars > 0
      ? ((outputChars - inputChars) / inputChars * 100).toFixed(0)
      : '0'

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value); setFileError(null)
    }, []
  )

  const handleFileUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null)
    if (!file.name.endsWith('.txt')) {
      setFileError('Please upload a .txt file.'); return
    }
    try {
      setText(await file.text())
      setFileName(file.name)
    } catch {
      setFileError('Failed to read the file.')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleClear = useCallback(() => {
    setText(''); setFileName(null); setFileError(null); setCopied(false)
  }, [])

  const handleSwap = useCallback(() => {
    if (result.output && !result.error) {
      setText(result.output)
      setMode(mode === 'encode' ? 'decode' : 'encode')
    }
  }, [result, mode])

  const handleCopy = useCallback(async () => {
    if (!result.output) return
    try { await navigator.clipboard.writeText(result.output) } catch {
      const ta = document.createElement('textarea'); ta.value = result.output
      ta.style.position = 'fixed'; ta.style.left = '-9999px'
      document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }, [result.output])

  const handleDownload = useCallback(() => {
    if (!result.output) return
    const blob = new Blob([result.output], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName(mode === 'encode' ? 'encoded-url.txt' : 'decoded-url.txt')
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result.output, mode])

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <SegmentedControl
              options={[
                { value: 'encode' as const, label: 'Encode' },
                { value: 'decode' as const, label: 'Decode' },
              ]}
              value={mode} onChange={setMode}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {mode === 'encode'
                ? 'Convert text to URL-safe percent-encoded format.'
                : 'Convert URL-encoded text back to plain text.'}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {mode === 'encode' ? 'Text to Encode' : 'URL-Encoded Text to Decode'}
              </h2>
              <div className="flex items-center gap-2">
                {fileName && <span className="text-xs text-muted-foreground truncate max-w-[160px]">{fileName}</span>}
                <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileChange} className="hidden" aria-label="Upload .txt file" />
                <Button variant="outline" size="sm" onClick={handleFileUpload}><Upload className="w-4 h-4 mr-1.5" />Upload .txt</Button>
                <Button variant="outline" size="sm" onClick={handleSwap} disabled={!result.output || !!result.error}><ArrowLeftRight className="w-4 h-4 mr-1.5" />Swap</Button>
                {hasText && <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground hover:text-destructive"><RotateCcw className="w-4 h-4 mr-1.5" />Clear</Button>}
              </div>
            </div>
            {fileError && <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">{fileError}</div>}
            <textarea value={text} onChange={handleTextChange}
              placeholder={mode === 'encode' ? 'Enter text to URL-encode...' : 'Enter URL-encoded text to decode...'}
              className="w-full min-h-[160px] max-h-[400px] rounded-xl border border-border bg-card p-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary resize-y transition-shadow font-mono text-sm"
              aria-label="Input text area" spellCheck={false}
            />
          </div>

          {result.error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div><p className="font-semibold text-destructive text-sm">Decoding Error</p><p className="text-sm text-muted-foreground mt-1">{result.error}</p></div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">{mode === 'encode' ? 'Encoded Output' : 'Decoded Text'}</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy} disabled={!result.output}>{copied ? <Check className="w-4 h-4 mr-1.5 text-green-500" /> : <Copy className="w-4 h-4 mr-1.5" />}{copied ? 'Copied!' : 'Copy'}</Button>
                <Button variant="outline" size="sm" onClick={handleDownload} disabled={!result.output}><Download className="w-4 h-4 mr-1.5" />Download .txt</Button>
              </div>
            </div>
            <textarea readOnly value={result.output} placeholder="Converted text will appear here..."
              className="w-full min-h-[140px] rounded-xl border border-border bg-muted/30 p-4 text-foreground placeholder:text-muted-foreground resize-y font-mono text-sm"
              aria-label="Output text area" spellCheck={false}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-3 text-center"><div className="text-lg font-bold tabular-nums">{inputChars}</div><div className="text-xs text-muted-foreground">Input Chars</div></div>
            <div className="rounded-xl border border-border bg-card p-3 text-center"><div className="text-lg font-bold tabular-nums">{outputChars}</div><div className="text-xs text-muted-foreground">Output Chars</div></div>
            <div className="rounded-xl border border-border bg-card p-3 text-center"><div className={`text-lg font-bold tabular-nums ${Number(sizeChange) > 0 ? 'text-amber-500' : Number(sizeChange) < 0 ? 'text-green-500' : ''}`}>{Number(sizeChange) >= 0 ? '+' : ''}{sizeChange}%</div><div className="text-xs text-muted-foreground">Size Change</div></div>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-6">How to Use URL Encoder/Decoder</h2>
            <ol className="space-y-4">
              {HOW_TO_STEPS.map(({ step, title, desc }) => (
                <li key={step} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">{step}</span>
                  <div><h4 className="font-semibold">{title}</h4><p className="text-muted-foreground text-sm">{desc}</p></div>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            <div className="border border-border rounded-xl p-6 bg-card">
              <h3 className="font-semibold mb-4">Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Mode</span><span className="font-semibold">{mode === 'encode' ? 'Encode' : 'Decode'}</span></div>
                <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Input</span><span className="font-semibold tabular-nums">{inputChars} chars</span></div>
                <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Output</span><span className="font-semibold tabular-nums">{result.error ? '—' : `${outputChars} chars`}</span></div>
                <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Status</span><span className={`font-semibold text-sm ${!hasText ? 'text-muted-foreground' : result.error ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>{!hasText ? '—' : result.error ? 'Error' : 'Ready'}</span></div>
                {fileName && <div className="pt-3 border-t border-border"><span className="text-xs text-muted-foreground">Source: {fileName}</span></div>}
              </div>
            </div>
            <div className="border border-border rounded-xl p-6 bg-muted/20">
              <h3 className="font-semibold mb-3">Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2"><span className="text-primary">•</span><span>URL encoding replaces special chars with %XX codes.</span></li>
                <li className="flex gap-2"><span className="text-primary">•</span><span>Use <strong>Swap</strong> to quickly decode what you just encoded.</span></li>
                <li className="flex gap-2"><span className="text-primary">•</span><span>This tool uses encodeURIComponent for maximum safety.</span></li>
                <li className="flex gap-2"><span className="text-primary">•</span><span>All processing happens in your browser — 100% private.</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
