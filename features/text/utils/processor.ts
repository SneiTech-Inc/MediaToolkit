/**
 * Text processing utilities.
 * Pure functions — no heavy dependencies needed.
 */

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

export function countCharacters(text: string): number {
  return text.length
}

export function toUpperCase(text: string): string {
  return text.toUpperCase()
}

export function toLowerCase(text: string): string {
  return text.toLowerCase()
}

export function toTitleCase(text: string): string {
  return text.replace(
    /\w\S*/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  )
}

export function removeDuplicateLines(text: string): string {
  const lines = text.split('\n')
  const seen = new Set<string>()
  return lines.filter((line) => {
    if (seen.has(line)) return false
    seen.add(line)
    return true
  }).join('\n')
}

export function formatJson(text: string): string {
  const parsed = JSON.parse(text)
  return JSON.stringify(parsed, null, 2)
}
