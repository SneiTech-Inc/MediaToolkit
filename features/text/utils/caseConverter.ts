/**
 * Case Converter — pure text case transformation utilities.
 * All functions are pure, synchronous, and side-effect-free.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export const CASE_TYPES = [
  'uppercase',
  'lowercase',
  'title',
  'sentence',
  'camel',
  'pascal',
  'kebab',
  'snake',
] as const

export type CaseType = (typeof CASE_TYPES)[number]

export interface CaseOption {
  type: CaseType
  label: string
  example: string
}

export const CASE_OPTIONS: CaseOption[] = [
  { type: 'uppercase', label: 'UPPERCASE', example: 'HELLO WORLD' },
  { type: 'lowercase', label: 'lowercase', example: 'hello world' },
  { type: 'title', label: 'Title Case', example: 'Hello World' },
  { type: 'sentence', label: 'Sentence case', example: 'Hello world' },
  { type: 'camel', label: 'camelCase', example: 'helloWorld' },
  { type: 'pascal', label: 'PascalCase', example: 'HelloWorld' },
  { type: 'kebab', label: 'kebab-case', example: 'hello-world' },
  { type: 'snake', label: 'snake_case', example: 'hello_world' },
]

// ─── Word Extraction Helper ───────────────────────────────────────────────────

const WORD_RE = /[a-zA-Z0-9]+/g

function extractWords(text: string): string[] {
  return text.toLowerCase().match(WORD_RE) || []
}

// ─── Case Transformations ─────────────────────────────────────────────────────

export function toTitleCase(text: string): string {
  if (!text) return ''
  return text.replace(/\S+/g, (word) => {
    // Preserve the original case pattern for acronyms and mixed-case words
    // by lowercasing first then capitalizing first letter
    const lowered = word.toLowerCase()
    return lowered.charAt(0).toUpperCase() + lowered.slice(1)
  })
}

export function toSentenceCase(text: string): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (!trimmed) return ''

  // Split into sentences, capitalize each sentence start
  return trimmed.replace(
    /(^|[.!?]\s+)([a-zA-Z])/g,
    (_match: string, prefix: string, letter: string) =>
      prefix + letter.toUpperCase()
  ).replace(/^[a-zA-Z]/, (letter) => letter.toUpperCase())
}

export function toCamelCase(text: string): string {
  const words = extractWords(text)
  if (words.length === 0) return ''
  return words
    .map((word, i) =>
      i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join('')
}

export function toPascalCase(text: string): string {
  const words = extractWords(text)
  if (words.length === 0) return ''
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

export function toKebabCase(text: string): string {
  const words = extractWords(text)
  return words.join('-')
}

export function toSnakeCase(text: string): string {
  const words = extractWords(text)
  return words.join('_')
}

// ─── Orchestrator ──────────────────────────────────────────────────────────────

export function convertCase(text: string, caseType: CaseType): string {
  if (!text) return ''

  switch (caseType) {
    case 'uppercase':
      return text.toUpperCase()
    case 'lowercase':
      return text.toLowerCase()
    case 'title':
      return toTitleCase(text)
    case 'sentence':
      return toSentenceCase(text)
    case 'camel':
      return toCamelCase(text)
    case 'pascal':
      return toPascalCase(text)
    case 'kebab':
      return toKebabCase(text)
    case 'snake':
      return toSnakeCase(text)
    default: {
      const _exhaustive: never = caseType
      return _exhaustive
    }
  }
}
