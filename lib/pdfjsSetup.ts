/**
 * PDF.js produces a benign "Dependent image isn't ready yet" warning
 * when rendering pages with embedded images that haven't finished decoding.
 * This suppresses that specific warning to keep the console clean.
 */

const originalWarn = console.warn

console.warn = (...args: unknown[]) => {
  if (
    args[0] &&
    typeof args[0] === 'string' &&
    args[0].includes("Dependent image isn't ready yet")
  ) {
    return
  }
  originalWarn.apply(console, args)
}
