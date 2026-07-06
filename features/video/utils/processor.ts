/**
 * Video processing utilities.
 * ffmpeg.wasm will be dynamically imported here in Phase 2.
 *
 * @example
 *   const { createFFmpeg } = await import('@ffmpeg/ffmpeg')
 */
export async function createVideoProcessor() {
  // TODO: Lazy-load ffmpeg.wasm when video tool logic is implemented
  throw new Error('Video processing is not yet implemented.')
}

/**
 * Trim a video file to the specified time range.
 * Will use ffmpeg.wasm for in-browser processing.
 */
export async function trimVideo(_file: File, _start: number, _end: number): Promise<Blob> {
  throw new Error('trimVideo is not yet implemented.')
}
