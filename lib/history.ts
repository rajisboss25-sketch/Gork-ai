export interface HistoryItem {
  id: string
  type: "text-to-video" | "image-to-video" | "video-extend" | "image-generation"
  prompt: string
  inputUrl?: string // For image-to-video or video-extend
  outputUrl: string
  duration?: number
  aspectRatio?: string
  resolution?: string
  createdAt: number
  thumbnail?: string
}

const HISTORY_KEY = "grok-studio-history"
const API_KEY_KEY = "grok-studio-api-key"
const MAX_HISTORY_ITEMS = 100

export function getHistory(): HistoryItem[] {
  if (typeof window === "undefined") return []
  try {
    const data = localStorage.getItem(HISTORY_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function addToHistory(item: Omit<HistoryItem, "id" | "createdAt">): HistoryItem {
  const history = getHistory()
  const newItem: HistoryItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  }
  
  const updatedHistory = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS)
  
  if (typeof window !== "undefined") {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory))
  }
  
  return newItem
}

export function removeFromHistory(id: string): void {
  const history = getHistory()
  const updatedHistory = history.filter((item) => item.id !== id)
  
  if (typeof window !== "undefined") {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory))
  }
}

export function clearHistory(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(HISTORY_KEY)
  }
}

export function getSavedApiKey(): string {
  if (typeof window === "undefined") return ""
  try {
    return localStorage.getItem(API_KEY_KEY) || ""
  } catch {
    return ""
  }
}

export function saveApiKey(key: string): void {
  if (typeof window !== "undefined") {
    if (key) {
      localStorage.setItem(API_KEY_KEY, key)
    } else {
      localStorage.removeItem(API_KEY_KEY)
    }
  }
}
