import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type CompareStore = {
  selectedIds: string[]
  toggleIllustrator: (id: string) => void
  clear: () => void
}

export const useCompareStore = create<CompareStore>()(
  persist(
    (set) => ({
      selectedIds: [],
      toggleIllustrator: (id) =>
        set((state) => {
          if (state.selectedIds.includes(id)) {
            return { selectedIds: state.selectedIds.filter((item) => item !== id) }
          }
          if (state.selectedIds.length >= 3) {
            alert('比較できるのは最大3人までです')
            return state
          }
          return { selectedIds: [...state.selectedIds, id] }
        }),
      clear: () => set({ selectedIds: [] }),
    }),
    { name: 'compare-storage' }
  )
)