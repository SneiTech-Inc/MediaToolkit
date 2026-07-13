/**
 * Shared video file validation utilities.
 * Used by all video tools for consistent size and format checking.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default max file size (300 MB) — used by Compress, Convert, and most tools. */
export const MAX_FILE_SIZE_DEFAULT = 300 * 1024 * 1024

/** Max file size for Trim Video (500 MB) — larger since trimming often keeps the source. */
export const MAX_FILE_SIZE_TRIM = 500 * 1024 * 1024

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate that a file does not exceed the given size limit.
 * Throws with a human-readable message on failure.
 */
export function validateFileSize(file: File, maxSize: number): void {
  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024))
    throw new Error(
      `File too large for browser-based processing — try a shorter clip or lower resolution source. Maximum file size is ${maxMB} MB.`
    )
  }
}

/**
 * Validate that a file's extension is in the accepted list.
 * Throws with a human-readable message listing supported formats on failure.
 */
export function validateInputFormat(
  file: File,
  acceptedFormats: readonly string[]
): void {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !acceptedFormats.includes(ext)) {
    throw new Error(
      `Unsupported format: ".${ext || 'unknown'}". Supported formats: ${acceptedFormats.map(f => f.toUpperCase()).join(', ')}.`
    )
  }
}
