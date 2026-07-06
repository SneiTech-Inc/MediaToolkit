import { pdfTools } from './pdf'
import { imageTools } from './image'
import { videoTools } from './video'
import { audioTools } from './audio'
import { documentTools } from './document'
import { textTools } from './text'
import { utilityTools } from './utility'
import type { Tool } from '@/types/tool'

/** Unified array of all 62 tools across 7 categories */
export const TOOLS: readonly Tool[] = [
  ...pdfTools,
  ...imageTools,
  ...videoTools,
  ...audioTools,
  ...documentTools,
  ...textTools,
  ...utilityTools,
] as const

// Re-export individual domain arrays for granular imports
export { pdfTools, imageTools, videoTools, audioTools, documentTools, textTools, utilityTools }
