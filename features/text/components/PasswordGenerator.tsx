'use client'

import { getSaveVexFileName } from '@/utils/fileNames'
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Copy,
  Download,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Shield,
  Key,
} from 'lucide-react'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import {
  generatePassword,
  getStrengthColor,
  getStrengthLabel,
  DEFAULTS,
  type PasswordOptions,
  type PasswordResult,
} from '@/features/text/utils/passwordGenerator'
import type { FAQItem } from '@/types/common'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'How strong are the generated passwords?',
    answer:
      'Passwords are generated using the Web Crypto API (crypto.getRandomValues), which provides cryptographically secure random numbers. Strength depends on length and character set — longer passwords with more character types are exponentially harder to crack. A 16-character password with all character types has over 95 bits of entropy.',
  },
  {
    question: 'What does entropy mean?',
    answer:
      'Entropy measures password randomness in bits. Higher entropy = stronger password. Roughly: under 28 bits is weak, 28-48 is medium, 48-78 is strong, and 78+ is very strong. Each added character and character type increases entropy exponentially.',
  },
  {
    question: 'Are the passwords stored anywhere?',
    answer:
      'No! Passwords are generated entirely in your browser and are never stored, transmitted, or saved anywhere. Once you close the page or generate a new password, the previous one is gone. We recommend using a password manager to store your passwords securely.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Choose your settings',
    desc: 'Set the password length and toggle which character types to include.',
  },
  {
    step: 2,
    title: 'Review the password',
    desc: 'Check the strength indicator and entropy to ensure it meets your needs.',
  },
  {
    step: 3,
    title: 'Copy and store',
    desc: 'Copy the password to clipboard and save it in a secure password manager.',
  },
]

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function ToggleSwitch({ id, label, checked, onChange }: {
  id: string; label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer select-none">
      <div className="relative">
        <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
        <div className={`w-9 h-5 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </label>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function PasswordGenerator() {
  const [options, setOptions] = useState<PasswordOptions>({ ...DEFAULTS })
  const [result, setResult] = useState<PasswordResult | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const maskTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Auto-generate on mount and when options change
  useEffect(() => {
    setResult(generatePassword(options))
  }, [options])

  // Auto-hide password after 30 seconds
  useEffect(() => {
    if (showPassword) {
      clearTimeout(maskTimerRef.current)
      maskTimerRef.current = setTimeout(() => setShowPassword(false), 30000)
    }
    return () => clearTimeout(maskTimerRef.current)
  }, [showPassword])

  const handleRegenerate = useCallback(() => {
    setResult(generatePassword(options))
    setShowPassword(false)
    setCopied(false)
  }, [options])

  const handleCopy = useCallback(async () => {
    if (!result) return
    try { await navigator.clipboard.writeText(result.password) } catch {
      const ta = document.createElement('textarea'); ta.value = result.password
      ta.style.position = 'fixed'; ta.style.left = '-9999px'
      document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }, [result])

  const handleDownload = useCallback(() => {
    if (!result) return
    const blob = new Blob([result.password], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = getSaveVexFileName('password.txt')
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [result])

  const setOpt = useCallback(<K extends keyof PasswordOptions>(k: K, v: PasswordOptions[K]) => {
    setOptions(prev => {
      // Enforce at least one char type
      if (k.startsWith('use') && v === false) {
        const others = ['useUppercase','useLowercase','useNumbers','useSymbols']
          .filter(o => o !== k)
          .every(o => prev[o as keyof PasswordOptions] === false)
        if (others) return prev // block unchecking last type
      }
      return { ...prev, [k]: v }
    })
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* ── Password Display ────────────────────────────────────── */}
          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Key className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Generated Password</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-lg border border-border bg-card px-5 py-4 font-mono text-xl break-all select-all">
                {result ? (
                  showPassword ? result.password : '•'.repeat(result.password.length)
                ) : 'Generating...'}
              </div>
              <Button variant="outline" size="icon" onClick={() => setShowPassword(!showPassword)} title={showPassword ? 'Hide' : 'Show'}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={handleRegenerate} title="Regenerate">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={handleCopy} disabled={!result}>
                {copied ? <Check className="w-4 h-4 mr-1.5 text-green-500" /> : <Copy className="w-4 h-4 mr-1.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!result}>
                <Download className="w-4 h-4 mr-1.5" />Download .txt
              </Button>
            </div>
          </div>

          {/* ── Strength Indicator ──────────────────────────────────── */}
          {result && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4" />Strength
                </h3>
                <span className="text-sm font-semibold">{getStrengthLabel(result.strength)}</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getStrengthColor(result.strength)}`}
                  style={{ width: `${Math.min(100, (result.entropy / 100) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{result.entropy} bits entropy</span>
                <span>{result.characterSet}</span>
              </div>
            </div>
          )}

          {/* ── Options ─────────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-5">
            <h3 className="font-semibold">Password Options</h3>

            {/* Length Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Length</span>
                <span className="text-sm font-bold text-primary tabular-nums">{options.length}</span>
              </div>
              <input
                type="range" min={4} max={64} value={options.length}
                onChange={e => setOpt('length', parseInt(e.target.value))}
                className="w-full h-2 rounded-full bg-muted appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>4</span><span>64</span>
              </div>
            </div>

            {/* Char Type Toggles */}
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <ToggleSwitch id="use-upper" label="Uppercase (A-Z)" checked={options.useUppercase} onChange={v => setOpt('useUppercase', v)} />
              <ToggleSwitch id="use-lower" label="Lowercase (a-z)" checked={options.useLowercase} onChange={v => setOpt('useLowercase', v)} />
              <ToggleSwitch id="use-nums" label="Numbers (0-9)" checked={options.useNumbers} onChange={v => setOpt('useNumbers', v)} />
              <ToggleSwitch id="use-syms" label="Symbols (!@#$...)" checked={options.useSymbols} onChange={v => setOpt('useSymbols', v)} />
            </div>

            <div className="border-t border-border pt-4 flex flex-wrap gap-x-6 gap-y-3">
              <ToggleSwitch id="exclude-ambig" label="Exclude ambiguous (O0Il1)" checked={options.excludeAmbiguous} onChange={v => setOpt('excludeAmbiguous', v)} />
              <ToggleSwitch id="exclude-dup" label="Exclude duplicates" checked={options.excludeDuplicates} onChange={v => setOpt('excludeDuplicates', v)} />
            </div>
          </div>

          {/* ── How To Use ───────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-bold mb-6">How to Use Password Generator</h2>
            <ol className="space-y-4">
              {HOW_TO_STEPS.map(({ step, title, desc }) => (
                <li key={step} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">{step}</span>
                  <div><h4 className="font-semibold">{title}</h4><p className="text-muted-foreground text-sm">{desc}</p></div>
                </li>
              ))}
            </ol>
          </div>

          {/* ── FAQ ───────────────────────────────────────────────────── */}
          <div>
            <FAQSection faqs={TOOL_FAQS} title="Frequently Asked Questions" description="" />
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            <div className="border border-border rounded-xl p-6 bg-card">
              <h3 className="font-semibold mb-4">Password Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Length</span><span className="font-semibold tabular-nums">{result?.password.length ?? options.length}</span></div>
                <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Char set</span><span className="font-semibold tabular-nums">{result?.characterSetSize ?? '—'}</span></div>
                <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Entropy</span><span className="font-semibold tabular-nums">{result ? `${result.entropy} bits` : '—'}</span></div>
                <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Strength</span>
                  <span className={`font-semibold text-sm ${result ? (result.strength === 'very-strong' ? 'text-green-500' : result.strength === 'weak' ? 'text-destructive' : 'text-amber-500') : ''}`}>{result ? getStrengthLabel(result.strength) : '—'}</span>
                </div>
              </div>
            </div>
            <div className="border border-border rounded-xl p-6 bg-muted/20">
              <h3 className="font-semibold mb-3">Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2"><span className="text-primary">•</span><span>Longer passwords with mixed character types are much stronger.</span></li>
                <li className="flex gap-2"><span className="text-primary">•</span><span>Aim for <strong>Very Strong</strong> (78+ bits) for important accounts.</span></li>
                <li className="flex gap-2"><span className="text-primary">•</span><span>Use a password manager to store generated passwords.</span></li>
                <li className="flex gap-2"><span className="text-primary">•</span><span>All generation happens in your browser using crypto-grade randomness.</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
