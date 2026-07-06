/**
 * Image processing utilities.
 * Canvas API for basic ops; sharp/WASM modules for advanced processing in Phase 2.
 *
 * @example
 *   // Client-side image resize via Canvas API
 *   const resized = await resizeImage(file, { width: 800 })
 */
export async function createImageProcessor() {
  // TODO: Lazy-load image processing WASM modules when needed
  throw new Error('Advanced image processing is not yet implemented.')
}

/**
 * Resize an image file to the specified dimensions using Canvas API.
 * (Basic implementation will use native browser Canvas.)
 */
export async function resizeImage(_file: File, _options: { width?: number; height?: number }): Promise<Blob> {
  throw new Error('resizeImage is not yet implemented.')
}
