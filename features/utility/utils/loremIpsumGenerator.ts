/**
 * Lorem Ipsum Generator — Pure text generation utilities.
 *
 * Uses a built-in word corpus. No external dependencies.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type GenerationMode = 'paragraphs' | 'sentences' | 'words' | 'characters'
export type PresetName = 'short' | 'medium' | 'long' | 'very-long'

export interface PresetConfig {
  mode: GenerationMode
  count: number
}

// ─── Word Corpus ───────────────────────────────────────────────────────────────

const WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea',
  'commodo', 'consequat', 'duis', 'aute', 'irure', 'reprehenderit',
  'voluptate', 'velit', 'esse', 'cillum', 'eu', 'fugiat', 'nulla',
  'pariatur', 'excepteur', 'sint', 'occaecat', 'cupidatat', 'non', 'proident',
  'sunt', 'culpa', 'qui', 'officia', 'deserunt', 'mollit', 'anim', 'id',
  'est', 'laborum', 'perspiciatis', 'unde', 'omnis', 'iste', 'natus', 'error',
  'voluptatem', 'accusantium', 'doloremque', 'laudantium', 'totam', 'rem',
  'aperiam', 'eaque', 'ipsa', 'quae', 'ab', 'illo', 'inventore', 'veritatis',
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickWord(): string {
  return WORDS[randomInt(0, WORDS.length - 1)]
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Generators ────────────────────────────────────────────────────────────────

function generateSentence(minWords = 8, maxWords = 20): string {
  const count = randomInt(minWords, maxWords)
  const words: string[] = []
  for (let i = 0; i < count; i++) {
    words.push(pickWord())
  }
  return capitalize(words.join(' ')) + '.'
}

function generateParagraph(minSentences = 3, maxSentences = 8): string {
  const count = randomInt(minSentences, maxSentences)
  const sentences: string[] = []
  for (let i = 0; i < count; i++) {
    sentences.push(generateSentence())
  }
  return sentences.join(' ')
}

// ─── Mode Limits ───────────────────────────────────────────────────────────────

const MODE_LIMITS: Record<GenerationMode, { min: number; max: number }> = {
  paragraphs: { min: 1, max: 20 },
  sentences: { min: 1, max: 50 },
  words: { min: 5, max: 200 },
  characters: { min: 10, max: 500 },
}

export function getModeLimits(mode: GenerationMode): { min: number; max: number } {
  return MODE_LIMITS[mode]
}

// ─── Presets ───────────────────────────────────────────────────────────────────

const PRESETS: Record<PresetName, PresetConfig> = {
  short: { mode: 'sentences', count: 3 },
  medium: { mode: 'paragraphs', count: 3 },
  long: { mode: 'paragraphs', count: 7 },
  'very-long': { mode: 'paragraphs', count: 15 },
}

export function getPresetConfig(preset: PresetName): PresetConfig {
  return PRESETS[preset]
}

export const PRESET_OPTIONS: { key: PresetName; label: string }[] = [
  { key: 'short', label: 'Short' },
  { key: 'medium', label: 'Medium' },
  { key: 'long', label: 'Long' },
  { key: 'very-long', label: 'Very Long' },
]

// ─── Main Generator ────────────────────────────────────────────────────────────

export function generateLoremIpsum(
  mode: GenerationMode,
  count: number,
  startWith?: string,
): string {
  const limits = MODE_LIMITS[mode]
  const clamped = Math.max(limits.min, Math.min(limits.max, Math.round(count)))
  let text = ''

  switch (mode) {
    case 'paragraphs': {
      const parts: string[] = []
      for (let i = 0; i < clamped; i++) {
        parts.push(generateParagraph())
      }
      text = parts.join('\n\n')
      break
    }
    case 'sentences': {
      const parts: string[] = []
      for (let i = 0; i < clamped; i++) {
        parts.push(generateSentence())
      }
      text = parts.join(' ')
      break
    }
    case 'words': {
      const parts: string[] = []
      for (let i = 0; i < clamped; i++) {
        parts.push(pickWord())
      }
      text = capitalize(parts.join(' ')) + '.'
      break
    }
    case 'characters': {
      const parts: string[] = []
      let charCount = 0
      while (charCount < clamped) {
        const word = pickWord()
        parts.push(word)
        charCount += word.length + 1 // +1 for space
      }
      text = capitalize(parts.join(' '))
      // Truncate to exact character count
      if (text.length > clamped) {
        text = text.slice(0, clamped).trimEnd()
      }
      // Ensure it ends with a period unless it would exceed count
      if (text.length < clamped && !text.endsWith('.')) {
        text += '.'
      }
      break
    }
  }

  // Prepend starting word/phrase if provided
  if (startWith && startWith.trim()) {
    const prefix = startWith.trim()
    // Remove existing capitalization of first word and use the prefix
    const firstChar = text.charAt(0).toLowerCase()
    text = capitalize(prefix) + ' ' + firstChar + text.slice(1)
  }

  return text
}
