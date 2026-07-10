'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Copy, Check, Palette, Droplets } from 'lucide-react'
import { FAQSection } from '@/components/shared/FAQSection'
import { Button } from '@/components/ui/button'
import {
  hexToRgb,
  rgbToHsl,
  rgbToCmyk,
  getComplementary,
  getAnalogous,
  getTriadic,
  generatePalette,
  isValidHex,
  type RGB,
  type HSL,
  type CMYK,
} from '@/features/utility/utils/colorPicker'
import type { FAQItem } from '@/types/common'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOOL_FAQS: FAQItem[] = [
  {
    question: 'What color formats are supported?',
    answer:
      'Color Picker supports HEX, RGB, HSL, and CMYK formats. Copy values in any format with one click. All conversions are performed instantly in your browser with no data sent anywhere.',
  },
  {
    question: 'What are color harmonies?',
    answer:
      'Color harmonies are combinations of colors that are visually pleasing together. Complementary colors sit opposite each other on the color wheel, analogous colors are adjacent, and triadic colors are evenly spaced at 120° intervals. These harmonies help designers create balanced color schemes.',
  },
  {
    question: 'Is my color data stored anywhere?',
    answer:
      'All color data is stored locally in your browser. No data is ever uploaded to any server. Your recently picked colors persist between visits but never leave your device.',
  },
]

const HOW_TO_STEPS = [
  {
    step: 1,
    title: 'Pick a color',
    desc: 'Use the native color picker or click any color swatch to select a starting color.',
  },
  {
    step: 2,
    title: 'Copy color values',
    desc: 'Click the copy button next to any format (HEX, RGB, HSL, or CMYK) to copy the value to your clipboard.',
  },
  {
    step: 3,
    title: 'Explore harmonies',
    desc: 'View complementary, analogous, and triadic color harmonies, or generate a 5-color palette from your base color.',
  },
]

const RECENT_COLORS_KEY = 'savevex-color-history'
const MAX_RECENT_COLORS = 20

const DEFAULT_COLOR = '#2563EB'

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Format an RGB object as a readable string. */
function formatRgb(rgb: RGB): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

/** Format an HSL object as a readable string. */
function formatHsl(hsl: HSL): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
}

/** Format a CMYK object as a readable string. */
function formatCmyk(cmyk: CMYK): string {
  return `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`
}

/** Determine whether to use light or dark text on a given background color. */
function contrastTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  // Relative luminance (sRGB)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#000000' : '#FFFFFF'
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ColorPicker() {
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [recentColors, setRecentColors] = useState<string[]>([])
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)

  // ── Derived values ────────────────────────────────────────────────────────

  const rgb = useMemo(() => hexToRgb(color), [color])
  const hsl = useMemo(() => rgbToHsl(rgb.r, rgb.g, rgb.b), [rgb])
  const cmyk = useMemo(() => rgbToCmyk(rgb.r, rgb.g, rgb.b), [rgb])
  const complementary = useMemo(() => getComplementary(color), [color])
  const analogous = useMemo(() => getAnalogous(color), [color])
  const triadic = useMemo(() => getTriadic(color), [color])
  const palette = useMemo(() => generatePalette(color), [color])
  const textColor = useMemo(() => contrastTextColor(color), [color])

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_COLORS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setRecentColors(parsed.slice(0, MAX_RECENT_COLORS))
      }
    } catch {
      // Corrupt data — silently reset
    }
  }, [])

  // ── Save to recent ─────────────────────────────────────────────────────────

  const saveToRecent = useCallback((newColor: string) => {
    if (!isValidHex(newColor)) return
    const normalized = newColor.toUpperCase()
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== normalized)
      const updated = [normalized, ...filtered].slice(0, MAX_RECENT_COLORS)
      try {
        localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updated))
      } catch {
        // localStorage quota exceeded — silently ignore
      }
      return updated
    })
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleColorChange = useCallback(
    (value: string) => {
      setColor(value)
      saveToRecent(value)
    },
    [saveToRecent],
  )

  const handleNativePickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleColorChange(e.target.value)
    },
    [handleColorChange],
  )

  const handleSwatchClick = useCallback(
    (swatchColor: string) => {
      handleColorChange(swatchColor)
    },
    [handleColorChange],
  )

  const copyToClipboard = useCallback(
    async (value: string, format: string) => {
      try {
        await navigator.clipboard.writeText(value)
      } catch {
        // Fallback for older browsers
        const ta = document.createElement('textarea')
        ta.value = value
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiedFormat(format)
      setTimeout(() => setCopiedFormat(null), 2000)
    },
    [],
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ════════════════════════════════════════════════════════════════
            LEFT COLUMN — Main content
           ════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-8">
          {/* ── Color Preview ─────────────────────────────────────────── */}
          <div
            className="rounded-xl border border-border overflow-hidden"
            style={{ backgroundColor: color }}
          >
            <div className="p-10 md:p-16 flex flex-col items-center justify-center min-h-[200px]">
              <Droplets
                className="w-10 h-10 mb-4 opacity-60"
                style={{ color: textColor }}
              />
              <h2
                className="text-3xl md:text-4xl font-bold font-mono tracking-tight"
                style={{ color: textColor }}
              >
                {color.toUpperCase()}
              </h2>
              <p className="mt-2 text-sm opacity-70" style={{ color: textColor }}>
                {formatRgb(rgb)}
              </p>
            </div>
          </div>

          {/* ── Color Format Cards ────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              { format: 'HEX', value: color.toUpperCase() },
              { format: 'RGB', value: formatRgb(rgb) },
              { format: 'HSL', value: formatHsl(hsl) },
              { format: 'CMYK', value: formatCmyk(cmyk) },
            ] as const).map(({ format, value }) => (
              <div
                key={format}
                className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {format}
                  </span>
                  <p className="text-sm font-mono mt-0.5 break-all">{value}</p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={() => copyToClipboard(value, format)}
                  title={`Copy ${format}`}
                >
                  {copiedFormat === format ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>

          {/* ── Color Harmonies ────────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-5">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Color Harmonies</h3>
            </div>

            {/* Complementary */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Complementary
              </h4>
              <div className="flex gap-3">
                <ColorSwatch hex={color} label="Base" onClick={handleSwatchClick} />
                <ColorSwatch hex={complementary} label="Complementary" onClick={handleSwatchClick} />
              </div>
            </div>

            {/* Analogous */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Analogous
              </h4>
              <div className="flex gap-3">
                {analogous.map((c, i) => (
                  <ColorSwatch key={c} hex={c} label={`Analogous ${i + 1}`} onClick={handleSwatchClick} />
                ))}
                <ColorSwatch hex={color} label="Base" onClick={handleSwatchClick} />
              </div>
            </div>

            {/* Triadic */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Triadic
              </h4>
              <div className="flex gap-3">
                {triadic.map((c, i) => (
                  <ColorSwatch key={c} hex={c} label={`Triadic ${i + 1}`} onClick={handleSwatchClick} />
                ))}
                <ColorSwatch hex={color} label="Base" onClick={handleSwatchClick} />
              </div>
            </div>
          </div>

          {/* ── Palette Generator ──────────────────────────────────────── */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold mb-4">Palette Generator</h3>
            <div className="flex rounded-lg overflow-hidden border border-border">
              {palette.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  className="flex-1 h-20 min-w-0 transition-transform hover:scale-105 focus:scale-105 focus:outline-none"
                  style={{ backgroundColor: c }}
                  onClick={() => handleSwatchClick(c)}
                  title={`${c} — click to select`}
                >
                  <span
                    className="block text-[10px] font-mono px-1 truncate"
                    style={{ color: contrastTextColor(c) }}
                  >
                    {c.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              A monochromatic palette derived from your base color by varying lightness.
            </p>
          </div>

          {/* ── Recent Colors ──────────────────────────────────────────── */}
          {recentColors.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold mb-4">
                Recent Colors
                <span className="text-xs text-muted-foreground ml-2 font-normal">
                  (stored locally)
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {recentColors.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`w-10 h-10 rounded-lg border-2 transition-transform hover:scale-110 focus:scale-110 focus:outline-none ${
                      c === color.toUpperCase()
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-border'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => handleSwatchClick(c)}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── How To Use ─────────────────────────────────────────────── */}
          <div>
            <h2 className="text-xl font-bold mb-6">How to Use Color Picker</h2>
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
            RIGHT COLUMN — Sidebar
           ════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-6">
            {/* ── Color Picker ─────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="font-semibold">Pick a Color</h3>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg border-2 border-border flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <input
                  type="color"
                  value={color}
                  onChange={handleNativePickerChange}
                  className="w-full h-10 rounded-lg cursor-pointer border border-border"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use the native color picker or click any swatch to select a color.
              </p>
            </div>

            {/* ── Color Info ───────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Color Details</h3>
              <div className="space-y-2.5">
                {[
                  { label: 'HEX', value: color.toUpperCase() },
                  { label: 'RGB', value: `${rgb.r}, ${rgb.g}, ${rgb.b}` },
                  { label: 'HSL', value: `${hsl.h}°, ${hsl.s}%, ${hsl.l}%` },
                  { label: 'CMYK', value: `${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%` },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Tips ──────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold">Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>Click any color swatch to instantly select it as the base color.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>Use <strong>complementary</strong> colors for high-contrast designs and call-to-action buttons.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span><strong>Analogous</strong> colors create harmonious, low-contrast palettes — great for backgrounds.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary flex-shrink-0">•</span>
                  <span>All processing happens in your browser. Colors never leave your device.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Sub-component: Color Swatch ───────────────────────────────────────────────

function ColorSwatch({
  hex,
  label,
  onClick,
}: {
  hex: string
  label: string
  onClick: (hex: string) => void
}) {
  const textColor = contrastTextColor(hex)

  return (
    <button
      type="button"
      className="flex-1 rounded-lg border border-border overflow-hidden transition-transform hover:scale-105 focus:scale-105 focus:outline-none"
      style={{ backgroundColor: hex }}
      onClick={() => onClick(hex)}
      title={`${label}: ${hex}`}
    >
      <div className="px-2 py-4 flex flex-col items-center justify-center min-h-[60px]">
        <span
          className="text-xs font-mono font-medium"
          style={{ color: textColor }}
        >
          {hex.toUpperCase()}
        </span>
        <span className="text-[10px] opacity-60 mt-0.5" style={{ color: textColor }}>
          {label}
        </span>
      </div>
    </button>
  )
}
