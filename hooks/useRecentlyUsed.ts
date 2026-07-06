'use client'

import { useLocalStorage } from '@/hooks/useLocalStorage'

const MAX_RECENT = 8
const STORAGE_KEY = 'savevex-recently-used'

interface RecentTool {
  id: string
  slug: string
  name: string
  category: string
  icon: string
  usedAt: number
}

/**
 * Track recently used tools in localStorage.
 * Returns { recentTools, addTool, clearRecent }.
 */
export function useRecentlyUsed() {
  const [recentTools, setRecentTools] = useLocalStorage<RecentTool[]>(STORAGE_KEY, [])

  const addTool = (tool: { id: string; slug: string; name: string; category: string; icon: string }) => {
    setRecentTools((prev) => {
      const filtered = prev.filter((t) => t.id !== tool.id)
      return [
        { ...tool, usedAt: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENT)
    })
  }

  const clearRecent = () => {
    setRecentTools([])
  }

  return { recentTools, addTool, clearRecent }
}
