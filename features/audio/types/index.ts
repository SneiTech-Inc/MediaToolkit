/** Supported audio formats for both input and output. */
export type AudioFormat = 'mp3' | 'wav' | 'aac' | 'ogg' | 'flac' | 'm4a'

/** Available bitrate options for lossy formats (MP3/AAC/OGG/M4A). */
export type Bitrate = '64' | '128' | '192' | '256' | '320'

/** Available sample rate options for WAV output. */
export type SampleRate = '44100' | '48000'

/** FLAC compression levels (0 = fastest, 8 = smallest). */
export type FLACCompression = '0' | '5' | '8'

/** All options passed to the audio converter. */
export interface AudioConversionOptions {
  /** Target output format. */
  format: AudioFormat
  /** Bitrate in kbps (MP3/AAC/OGG/M4A only). */
  bitrate?: Bitrate
  /** Sample rate in Hz (WAV only). */
  sampleRate?: SampleRate
  /** FLAC compression level 0-8 (FLAC only). */
  compressionLevel?: FLACCompression
}

/** Result of a successful audio conversion. */
export interface AudioConversionResult {
  /** The converted audio as a Blob (ready for download). */
  blob: Blob
  /** MIME type of the converted audio. */
  mimeType: string
  /** Original file size in bytes. */
  originalSize: number
  /** Converted file size in bytes. */
  convertedSize: number
  /** Audio duration in seconds (extracted during decoding). */
  duration: number
}

/** Maps an AudioFormat to its MIME type. */
export const AUDIO_MIME_TYPES: Record<AudioFormat, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
}
