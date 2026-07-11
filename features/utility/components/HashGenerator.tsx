'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Copy, Check, Download, Trash2, Upload, Hash, FileText } from 'lucide-react'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import { getSaveVexFileName } from '@/utils/fileNames'
import { formatBytes } from '@/utils/formatBytes'
import {
  generateHashes,
  ALL_ALGORITHMS,
  ALGORITHM_LABELS,
  ALGORITHM_DESCRIPTIONS,
  type HashAlgorithm,
  type HashResult,
} from '@/features/utility/utils/hashGenerator'
import type { FAQItem } from '@/types/common'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What is a cryptographic hash?',
    answer:
      'A cryptographic hash is a fixed-length string that uniquely represents input data. The same input always produces the same hash, and even a tiny change in input produces a completely different hash. Hashes are one-way — you cannot reverse a hash to get the original data.',
  },
  {
    question: 'What algorithms are supported?',
    answer:
      'MD5, SHA-1, SHA-256, SHA-384, and SHA-512. SHA-256 and above are recommended for security-sensitive applications. MD5 and SHA-1 are included for compatibility with legacy systems but are not considered cryptographically secure.',
  },
  {
    question: 'Are hashes secure?',
    answer:
      'SHA-256, SHA-384, and SHA-512 are considered secure for modern applications. MD5 and SHA-1 have known vulnerabilities and should not be used for security purposes. All hashing is performed locally in your browser using the advanced Password-Based Key Derivation technology — your data is never uploaded to any server.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Enter your text',
    desc: 'Type or paste text into the input area, or upload a .txt file. The tool accepts any text content.',
  },
  {
    step: 2,
    title: 'Select algorithms',
    desc: 'Choose which hash algorithms to compute. SHA-256 is selected by default. You can toggle any combination of algorithms.',
  },
  {
    step: 3,
    title: 'Copy or download results',
    desc: 'Copy individual hashes, or download all results as a formatted .txt file for reference.',
  },
]

const DEBOUNCE_MS = 400

// ─── Component ─────────────────────────────────────────────────────────────────

export function HashGenerator() {
  const [inputText, setInputText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<Set<HashAlgorithm>>(
    new Set<HashAlgorithm>(['SHA-256']),
  )
  const [results, setResults] = useState<HashResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [copiedAlgorithm, setCopiedAlgorithm] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Statistics ─────────────────────────────────────────────────────────────

  const stats = {
    characters: inputText.length,
    words: inputText.trim() ? inputText.trim().split(/\s+/).length : 0,
    lines: inputText ? inputText.split('\n').length : 0,
  }

  // ── Auto-hash on input/algorithm change (debounced) ────────────────────────

  useEffect(() => {
    if (!inputText) {
      setResults([])
      setIsProcessing(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    setIsProcessing(true)

    debounceRef.current = setTimeout(async () => {
      const algos = Array.from(selectedAlgorithms)
      if (algos.length === 0) {
        setResults([])
        setIsProcessing(false)
        return
      }
      try {
        const hashResults = await generateHashes(inputText, algos)
        setResults(hashResults)
      } catch {
        // Hashing failed — silently handle
      } finally {
        setIsProcessing(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText, selectedAlgorithms])

  // ── Algorithm Toggle ───────────────────────────────────────────────────────

  const toggleAlgorithm = useCallback((algo: HashAlgorithm) => {
    setSelectedAlgorithms(prev => {
      const next = new Set(prev)
      if (next.has(algo)) {
        if (next.size > 1) next.delete(algo) // Keep at least 1 selected
      } else {
        next.add(algo)
      }
      return next
    })
  }, [])

  // ── File Upload ────────────────────────────────────────────────────────────

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      setInputText(text)
      setFileName(file.name)
      setFileSize(file.size)
    }
    reader.onerror = () => {
      // File read failed
    }
    reader.readAsText(file)

    // Reset the input so the same file can be re-uploaded
    e.target.value = ''
  }, [])

  // ── Copy ───────────────────────────────────────────────────────────────────

  const copyHash = useCallback(async (algorithm: string, hash: string) => {
    try {
      await navigator.clipboard.writeText(hash)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = hash
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedAlgorithm(algorithm)
    setTimeout(() => setCopiedAlgorithm(null), 2000)
  }, [])

  // ── Download ───────────────────────────────────────────────────────────────

  const handleDownload = useCallback(() => {
    const lines = results.map(r => `${r.algorithm}: ${r.hash}`)
    const text = lines.join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getSaveVexFileName('hashes.txt')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [results])

  // ── Clear ──────────────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    setInputText('')
    setFileName(null)
    setFileSize(null)
    setResults([])
    setCopiedAlgorithm(null)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ════════════════════════════════════════════════════════════════
            LEFT COLUMN — Input + Results
           ════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-8">
          {/* ── Input Section ─────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Input Text</h3>
              </div>
              <div className="flex items-center gap-2">
                {/* File upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  className="sr-only"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  Upload .txt
                </Button>
                {inputText && (
                  <Button variant="ghost" size="sm" onClick={handleClear}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <textarea
              className="w-full px-4 py-3 rounded-lg border border-border bg-background min-h-[140px] resize-y font-mono text-sm"
              placeholder="Type or paste text to hash..."
              value={inputText}
              onChange={e => {
                setInputText(e.target.value)
                setFileName(null)
                setFileSize(null)
              }}
            />

            {/* File info banner */}
            {fileName && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium truncate">{fileName}</span>
                {fileSize !== null && (
                  <span className="text-muted-foreground flex-shrink-0">
                    ({formatBytes(fileSize)})
                  </span>
                )}
                <button
                  type="button"
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
                  onClick={() => { setFileName(null); setFileSize(null) }}
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* ── Results Grid ──────────────────────────────────────────── */}
          {results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map(({ algorithm, hash }) => (
                <div
                  key={algorithm}
                  className="rounded-xl border border-border bg-card p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {ALGORITHM_LABELS[algorithm]}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => copyHash(algorithm, hash)}
                      title={`Copy ${algorithm}`}
                    >
                      {copiedAlgorithm === algorithm ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs font-mono break-all leading-relaxed text-muted-foreground">
                    {hash}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Computing hashes...
            </div>
          )}

          {/* ── Download ──────────────────────────────────────────────── */}
          {results.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-1.5" />
                Download Results (.txt)
              </Button>
            </div>
          )}

          {/* ── How To Use ─────────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-bold mb-6">How to Use Hash Generator</h2>
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
            {/* ── Algorithm Selector ───────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Algorithms</h3>
              <div className="space-y-1">
                {ALL_ALGORITHMS.map(algo => (
                  <label
                    key={algo}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedAlgorithms.has(algo)
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-transparent hover:bg-muted/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAlgorithms.has(algo)}
                      onChange={() => toggleAlgorithm(algo)}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <span className="text-sm font-medium">{ALGORITHM_LABELS[algo]}</span>
                      <span className="block text-xs text-muted-foreground">
                        {ALGORITHM_DESCRIPTIONS[algo]}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Statistics ────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Statistics</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Characters</span>
                  <span className="font-semibold tabular-nums">{stats.characters.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Words</span>
                  <span className="font-semibold tabular-nums">{stats.words.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lines</span>
                  <span className="font-semibold tabular-nums">{stats.lines.toLocaleString()}</span>
                </div>
                {fileName && fileSize !== null && (
                  <>
                    <hr className="border-border" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">File</span>
                      <span className="font-semibold text-xs truncate max-w-[140px]">{fileName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">File size</span>
                      <span className="font-semibold">{formatBytes(fileSize)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Tips ──────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span><strong>SHA-256</strong> is the best all-around choice — secure, fast, and widely supported.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>Select multiple algorithms to compare hash outputs for the same input side by side.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>Upload a <strong>.txt</strong> file to hash its contents without copy-pasting.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>All hashing happens locally in your browser. Your data is never uploaded anywhere.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
