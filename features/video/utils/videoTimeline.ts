/**
 * Pure time parsing and formatting utilities.
 * Used by Trim, Crop, Merge, Speed, and any other time-based video tools.
 */

/**
 * Parse a time string into total seconds.
 * Supports three formats:
 *   "90"        → 90 seconds
 *   "1:30"      → 90 seconds (MM:SS)
 *   "1:30:00"   → 5400 seconds (HH:MM:SS)
 *
 * Returns null if the input is empty or unparseable.
 */
export function parseTimeInput(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const parts = trimmed.split(':').map(Number)

  // All parts must be valid non-negative numbers
  if (parts.some((p) => isNaN(p) || p < 0)) return null

  if (parts.length === 1) {
    // SS
    return parts[0]
  }

  if (parts.length === 2) {
    // MM:SS — validate seconds < 60
    if (parts[1] >= 60) return null
    return parts[0] * 60 + parts[1]
  }

  if (parts.length === 3) {
    // HH:MM:SS — validate minutes < 60, seconds < 60
    if (parts[1] >= 60 || parts[2] >= 60) return null
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  return null
}

/**
 * Format seconds as a human-readable time string.
 *  90     → "1:30"
 *  3661   → "1:01:01"
 *  0      → "0:00"
 *
 * Uses HH:MM:SS format when the duration is ≥ 1 hour.
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Format seconds as mm:ss. Used for duration display in file info bars.
 * Returns "--:--" for invalid/zero durations.
 */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
