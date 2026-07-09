/**
 * Word Counter — pure text analysis utilities.
 * All functions are pure, synchronous, and side-effect-free.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WordCountResult {
  words: number
  characters: number
  charactersNoSpaces: number
  sentences: number
  paragraphs: number
  lines: number
  readingTime: number // minutes (words / 200)
  speakingTime: number // minutes (words / 130)
  wordFrequency: WordFrequencyEntry[]
}

export interface WordFrequencyEntry {
  word: string
  count: number
}

// ─── Stop Words ────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'and', 'is', 'it', 'for', 'on', 'that',
  'with', 'as', 'at', 'by', 'or', 'be', 'was', 'are', 'this', 'from', 'but',
  'not', 'we', 'they', 'he', 'she', 'has', 'have', 'had', 'been', 'can', 'will',
  'would', 'could', 'should', 'may', 'do', 'so', 'if', 'no', 'up', 'its', 'also',
  'than', 'then', 'just', 'about', 'out', 'when', 'who', 'what', 'which', 'all',
  'these', 'those', 'them', 'their', 'his', 'her', 'my', 'your', 'our', 'i',
  'you', 'me', 'am', 'him', 'us', 'very', 'some', 'any', 'each', 'every', 'both',
  'few', 'more', 'most', 'other', 'into', 'over', 'such', 'only', 'own', 'same',
  'now', 'how', 'too', 'well', 'back', 'there', 'where', 'why',
])

// ─── Word Count ────────────────────────────────────────────────────────────────

const WORD_RE = /\S+/g

export function countWords(text: string): number {
  if (!text || !text.trim()) return 0
  const matches = text.match(WORD_RE)
  return matches ? matches.length : 0
}

// ─── Character Count ───────────────────────────────────────────────────────────

export function countCharacters(text: string): number {
  return text.length
}

export function countCharactersNoSpaces(text: string): number {
  let count = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ' ' && text[i] !== '\t' && text[i] !== '\n' && text[i] !== '\r') {
      count++
    }
  }
  return count
}

// ─── Sentence Count ────────────────────────────────────────────────────────────

const SENTENCE_RE = /[^.!?]+[.!?]+/g

export function countSentences(text: string): number {
  if (!text || !text.trim()) return 0
  const matches = text.match(SENTENCE_RE)
  return matches ? matches.length : 0
}

// ─── Paragraph Count ───────────────────────────────────────────────────────────

const PARAGRAPH_RE = /\S/

export function countParagraphs(text: string): number {
  if (!text || !text.trim()) return 0
  // Split by one or more blank lines
  const blocks = text.split(/\n\s*\n/)
  let count = 0
  for (const block of blocks) {
    if (PARAGRAPH_RE.test(block)) count++
  }
  return count
}

// ─── Line Count ────────────────────────────────────────────────────────────────

export function countLines(text: string): number {
  if (!text) return 0
  // Count all lines including empty ones; but if text is only whitespace, return 0
  if (!text.trim()) return 0
  return text.split('\n').length
}

// ─── Reading & Speaking Time ───────────────────────────────────────────────────

const WORDS_PER_MINUTE_READING = 200
const WORDS_PER_MINUTE_SPEAKING = 130

export function computeReadingTime(words: number): number {
  return Math.max(0, Math.ceil(words / WORDS_PER_MINUTE_READING))
}

export function computeSpeakingTime(words: number): number {
  return Math.max(0, Math.ceil(words / WORDS_PER_MINUTE_SPEAKING))
}

// ─── Word Frequency ────────────────────────────────────────────────────────────

const WORD_EXTRACT_RE = /\b[a-zA-Z]{2,}\b/g

export function computeWordFrequency(
  text: string,
  limit: number = 10
): WordFrequencyEntry[] {
  if (!text || !text.trim()) return []

  const freqMap = new Map<string, number>()
  const matches = text.toLowerCase().match(WORD_EXTRACT_RE)

  if (!matches) return []

  for (const word of matches) {
    if (STOP_WORDS.has(word)) continue
    freqMap.set(word, (freqMap.get(word) ?? 0) + 1)
  }

  return Array.from(freqMap.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// ─── Orchestrator ──────────────────────────────────────────────────────────────

export function countAll(text: string): WordCountResult {
  const words = countWords(text)

  return {
    words,
    characters: countCharacters(text),
    charactersNoSpaces: countCharactersNoSpaces(text),
    sentences: countSentences(text),
    paragraphs: countParagraphs(text),
    lines: countLines(text),
    readingTime: computeReadingTime(words),
    speakingTime: computeSpeakingTime(words),
    wordFrequency: computeWordFrequency(text),
  }
}
