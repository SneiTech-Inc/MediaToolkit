/**
 * Timestamp Converter — Pure conversion utilities.
 *
 * All functions use the native `Date` API. No external dependencies.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ConvertedDate {
  iso: string
  locale: string
  dateOnly: string
  timeOnly: string
  utc: string
  dayName: string
  timezone: string
}

export interface ConvertedTimestamp {
  seconds: number
  milliseconds: number
}

export interface CurrentTimestamp {
  seconds: number
  milliseconds: number
  iso: string
  locale: string
  dateOnly: string
  timeOnly: string
}

export type TimestampType = 'seconds' | 'milliseconds' | 'invalid'

// ─── Detection ─────────────────────────────────────────────────────────────────

/** Auto-detect whether a numeric string is a seconds or milliseconds timestamp. */
export function detectTimestampType(input: string): TimestampType {
  const trimmed = input.trim()
  if (!/^\d+$/.test(trimmed)) return 'invalid'

  const num = parseInt(trimmed, 10)
  if (isNaN(num) || num < 0) return 'invalid'

  // Heuristic: ≤10 digits → seconds, >10 digits → milliseconds
  // Valid range check for seconds: 0 to ~9999999999 (year 2286)
  // Valid range check for milliseconds: 0 to ~9999999999999 (year 2286)
  return trimmed.length <= 10 ? 'seconds' : 'milliseconds'
}

// ─── Timestamp → Date ──────────────────────────────────────────────────────────

/**
 * Convert a Unix timestamp (in seconds) to human-readable date formats.
 *
 * @param timestamp — seconds since epoch (not milliseconds)
 * @param useUTC — if true, use UTC methods; otherwise use local timezone
 */
export function timestampToDate(timestamp: number, useUTC: boolean): ConvertedDate {
  const date = new Date(timestamp * 1000)

  // Invalid date check
  if (isNaN(date.getTime())) {
    return {
      iso: 'Invalid timestamp',
      locale: 'Invalid timestamp',
      dateOnly: 'Invalid timestamp',
      timeOnly: 'Invalid timestamp',
      utc: 'Invalid timestamp',
      dayName: '',
      timezone: '',
    }
  }

  const iso = date.toISOString()

  const locale = date.toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })

  const dayName = date.toLocaleString(undefined, { weekday: 'long' })

  const timezone = useUTC
    ? 'UTC'
    : Intl.DateTimeFormat().resolvedOptions().timeZone

  if (useUTC) {
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    const hh = String(date.getUTCHours()).padStart(2, '0')
    const mm = String(date.getUTCMinutes()).padStart(2, '0')
    const ss = String(date.getUTCSeconds()).padStart(2, '0')

    return {
      iso,
      locale,
      dateOnly: `${y}-${m}-${d}`,
      timeOnly: `${hh}:${mm}:${ss}`,
      utc: `${y}-${m}-${d} ${hh}:${mm}:${ss} UTC`,
      dayName,
      timezone,
    }
  }

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')

  return {
    iso,
    locale,
    dateOnly: `${y}-${m}-${d}`,
    timeOnly: `${hh}:${mm}:${ss}`,
    utc: date.toUTCString(),
    dayName,
    timezone,
  }
}

// ─── Date → Timestamp ──────────────────────────────────────────────────────────

/**
 * Convert a date string and time string to Unix timestamp values.
 *
 * @param dateStr — "YYYY-MM-DD" format
 * @param timeStr — "HH:MM" or "HH:MM:SS" format
 */
export function dateToTimestamp(dateStr: string, timeStr: string): ConvertedTimestamp | null {
  if (!dateStr) return null

  const timeWithSeconds = timeStr.includes(':')
    ? timeStr.split(':').length === 2
      ? `${timeStr}:00`
      : timeStr
    : `${timeStr}:00:00`

  const date = new Date(`${dateStr}T${timeWithSeconds}`)

  if (isNaN(date.getTime())) return null

  const milliseconds = date.getTime()
  return {
    seconds: Math.floor(milliseconds / 1000),
    milliseconds,
  }
}

// ─── Current Timestamp ─────────────────────────────────────────────────────────

/** Return the current time as both a Unix timestamp and human-readable formats. */
export function getCurrentTimestamp(): CurrentTimestamp {
  const now = new Date()
  const milliseconds = now.getTime()

  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')

  return {
    seconds: Math.floor(milliseconds / 1000),
    milliseconds,
    iso: now.toISOString(),
    locale: now.toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    dateOnly: `${y}-${m}-${d}`,
    timeOnly: `${hh}:${mm}:${ss}`,
  }
}
