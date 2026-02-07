import { create } from 'zustand'

interface UIStore {
  selectedNodeId: string | null
  inspectorOpen: boolean
  chatOpen: boolean
  policyMode: 'SAFE' | 'POWER'
  searchQuery: string
  minimapVisible: boolean
  setSelectedNode: (id: string | null) => void
  toggleInspector: () => void
  toggleChat: () => void
  setPolicyMode: (mode: 'SAFE' | 'POWER') => void
  setSearchQuery: (query: string) => void
  toggleMinimap: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  selectedNodeId: null,
  inspectorOpen: true,
  chatOpen: false,
  policyMode: 'SAFE',
  searchQuery: '',
  minimapVisible: false,
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  setPolicyMode: (mode) => set({ policyMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleMinimap: () => set((s) => ({ minimapVisible: !s.minimapVisible })),
}))
