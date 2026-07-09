/**
 * Password Generator — cryptographically secure password generation.
 * Uses Web Crypto API (crypto.getRandomValues). No dependencies.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PasswordOptions {
  length: number
  useUppercase: boolean
  useLowercase: boolean
  useNumbers: boolean
  useSymbols: boolean
  excludeAmbiguous: boolean
  excludeDuplicates: boolean
}

export type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very-strong'

export interface PasswordResult {
  password: string
  strength: PasswordStrength
  entropy: number
  characterSet: string
  characterSetSize: number
}

// ─── Character Sets ───────────────────────────────────────────────────────────

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const NUMBERS = '0123456789'
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?/~'
const AMBIGUOUS_RE = /[O0Il1]/g

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULTS: PasswordOptions = {
  length: 16,
  useUppercase: true,
  useLowercase: true,
  useNumbers: true,
  useSymbols: true,
  excludeAmbiguous: false,
  excludeDuplicates: false,
}

// ─── Strength ─────────────────────────────────────────────────────────────────

export function getStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak':       return 'bg-red-500'
    case 'medium':     return 'bg-orange-500'
    case 'strong':     return 'bg-yellow-500'
    case 'very-strong':return 'bg-green-500'
  }
}

export function getStrengthLabel(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak':       return 'Weak'
    case 'medium':     return 'Medium'
    case 'strong':     return 'Strong'
    case 'very-strong':return 'Very Strong'
  }
}

function computeStrength(entropy: number): PasswordStrength {
  if (entropy < 28) return 'weak'
  if (entropy < 48) return 'medium'
  if (entropy < 78) return 'strong'
  return 'very-strong'
}

// ─── Generator ────────────────────────────────────────────────────────────────

export function generatePassword(options: PasswordOptions): PasswordResult {
  // Build character set
  let chars = ''

  if (options.useUppercase) chars += UPPER
  if (options.useLowercase) chars += LOWER
  if (options.useNumbers)   chars += NUMBERS
  if (options.useSymbols)   chars += SYMBOLS

  // Remove ambiguous characters if enabled
  if (options.excludeAmbiguous) {
    chars = chars.replace(AMBIGUOUS_RE, '')
  }

  // Enforce at least one character type
  if (!chars) {
    chars = LOWER + NUMBERS // sensible fallback
  }

  const characterSet = chars
  const characterSetSize = characterSet.length

  // Generate password using crypto.getRandomValues
  let password = ''
  const maxAttempts = options.excludeDuplicates ? 100 : 1

  for (let attempt = 0; attempt < maxAttempts && password.length < options.length; attempt++) {
    const pool = new Uint32Array(options.length * 2)
    crypto.getRandomValues(pool)

    for (let i = 0; i < pool.length && password.length < options.length; i++) {
      const char = characterSet[pool[i] % characterSetSize]
      if (options.excludeDuplicates && password.includes(char)) continue
      password += char
    }

    if (!options.excludeDuplicates) break // single pass when not excluding dupes
  }

  // Won't reach here with real crypto, but guard against edge case
  if (!password) {
    password = characterSet[0].repeat(options.length)
  }

  // Entropy: log2(characterSetSize ^ length)
  const entropy = options.length * Math.log2(characterSetSize)
  const strength = computeStrength(entropy)

  return {
    password,
    strength,
    entropy: Math.round(entropy * 10) / 10,
    characterSet: `[${characterSetSize} chars] ${options.useUppercase ? 'A-Z ' : ''}${options.useLowercase ? 'a-z ' : ''}${options.useNumbers ? '0-9 ' : ''}${options.useSymbols ? 'symbols' : ''}`.trim(),
    characterSetSize,
  }
}
