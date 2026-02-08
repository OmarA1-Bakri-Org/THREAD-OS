'use client'

import { create } from 'zustand'

interface UIStore {
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void
  inspectorOpen: boolean
  toggleInspector: () => void
  chatOpen: boolean
  toggleChat: () => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  minimapVisible: boolean
  toggleMinimap: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id, ...(id != null ? { inspectorOpen: true } : {}) }),
  inspectorOpen: true,
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  chatOpen: false,
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  minimapVisible: true,
  toggleMinimap: () => set((s) => ({ minimapVisible: !s.minimapVisible })),
}))
