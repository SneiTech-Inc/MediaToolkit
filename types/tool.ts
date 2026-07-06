export interface ToolCategory {
  id: string
  name: string
  slug: string
  icon: string
}

export type ToolBadge = 'popular' | 'new' | 'coming-soon' | null

export interface Tool {
  id: string
  slug: string
  name: string
  category: string
  description: string
  icon: string
  badge: ToolBadge
  dateAdded: string
  inputFormats: string[]
  outputFormats: string[]
  isComingSoon: boolean
}
