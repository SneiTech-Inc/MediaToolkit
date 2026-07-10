/**
 * Color Picker — Pure color conversion and harmony utilities.
 *
 * All functions use plain JavaScript math. No external dependencies.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RGB {
  r: number
  g: number
  b: number
}

export interface HSL {
  h: number
  s: number
  l: number
}

export interface CMYK {
  c: number
  m: number
  y: number
  k: number
}

// ─── Validation ────────────────────────────────────────────────────────────────

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

/** Return true if the string is a valid 6-digit hex color (e.g. "#FF0000"). */
export function isValidHex(value: string): boolean {
  return HEX_RE.test(value)
}

// ─── HEX ↔ RGB ─────────────────────────────────────────────────────────────────

/** Parse a 6-digit hex color string into { r, g, b } integers (0–255). */
export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

/** Format RGB integers (0–255) as a 6-digit hex string. */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)))
    return clamped.toString(16).padStart(2, '0')
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// ─── RGB ↔ HSL ─────────────────────────────────────────────────────────────────

/** Convert RGB (0–255) to HSL (h: 0–360, s: 0–100, l: 0–100). */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6
    else if (max === gn) h = ((bn - rn) / delta + 2) / 6
    else h = ((rn - gn) / delta + 4) / 6
  }

  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

/** Convert HSL (h: 0–360, s: 0–100, l: 0–100) to RGB (0–255). */
export function hslToRgb(h: number, s: number, l: number): RGB {
  const sn = s / 100
  const ln = l / 100
  const hn = ((h % 360) + 360) % 360 / 360

  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  if (sn === 0) {
    const v = Math.round(ln * 255)
    return { r: v, g: v, b: v }
  }

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
  const p = 2 * ln - q

  return {
    r: Math.round(hueToRgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, hn) * 255),
    b: Math.round(hueToRgb(p, q, hn - 1 / 3) * 255),
  }
}

// ─── RGB → CMYK ────────────────────────────────────────────────────────────────

/** Convert RGB (0–255) to CMYK (0–100 percentages). */
export function rgbToCmyk(r: number, g: number, b: number): CMYK {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const k = 1 - Math.max(rn, gn, bn)
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 }

  const c = (1 - rn - k) / (1 - k)
  const m = (1 - gn - k) / (1 - k)
  const y = (1 - bn - k) / (1 - k)

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100),
  }
}

// ─── Color Harmonies ───────────────────────────────────────────────────────────

/** Return the complementary color (hue rotated 180°). */
export function getComplementary(hex: string): string {
  const { h, s, l } = rgbToHsl(hexToRgb(hex).r, hexToRgb(hex).g, hexToRgb(hex).b)
  const { r, g, b } = hslToRgb((h + 180) % 360, s, l)
  return rgbToHex(r, g, b)
}

/** Return two analogous colors (hue rotated ±30°). */
export function getAnalogous(hex: string): [string, string] {
  const { h, s, l } = rgbToHsl(hexToRgb(hex).r, hexToRgb(hex).g, hexToRgb(hex).b)
  const h1 = ((h - 30) % 360 + 360) % 360
  const h2 = (h + 30) % 360
  const c1 = hslToRgb(h1, s, l)
  const c2 = hslToRgb(h2, s, l)
  return [rgbToHex(c1.r, c1.g, c1.b), rgbToHex(c2.r, c2.g, c2.b)]
}

/** Return two triadic colors (hue rotated ±120°). */
export function getTriadic(hex: string): [string, string] {
  const { h, s, l } = rgbToHsl(hexToRgb(hex).r, hexToRgb(hex).g, hexToRgb(hex).b)
  const h1 = ((h - 120) % 360 + 360) % 360
  const h2 = (h + 120) % 360
  const c1 = hslToRgb(h1, s, l)
  const c2 = hslToRgb(h2, s, l)
  return [rgbToHex(c1.r, c1.g, c1.b), rgbToHex(c2.r, c2.g, c2.b)]
}

// ─── Palette Generator ─────────────────────────────────────────────────────────

/** Generate a 5-color monochromatic palette from a base color by varying lightness. */
export function generatePalette(hex: string): [string, string, string, string, string] {
  const { h, s } = rgbToHsl(hexToRgb(hex).r, hexToRgb(hex).g, hexToRgb(hex).b)

  const lightnesses = [90, 70, 50, 30, 10] // light → dark

  return lightnesses.map(l => {
    const { r, g, b } = hslToRgb(h, s, l)
    return rgbToHex(r, g, b)
  }) as [string, string, string, string, string]
}
