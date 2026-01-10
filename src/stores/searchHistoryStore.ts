/**
 * Search History Store
 *
 * Zustand store for persisting recent property searches with AsyncStorage.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface RecentSearch {
  id: string
  address: string
  city?: string
  state?: string
  zip?: string
  timestamp: number
}

interface SearchHistoryState {
  recentSearches: RecentSearch[]
  maxHistory: number
  addSearch: (search: Omit<RecentSearch, 'id' | 'timestamp'>) => void
  removeSearch: (id: string) => void
  clearHistory: () => void
}

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set, get) => ({
      recentSearches: [],
      maxHistory: 5,

      addSearch: (search) => {
        const { recentSearches, maxHistory } = get()

        // Create new search entry
        const newSearch: RecentSearch = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          address: search.address,
          city: search.city,
          state: search.state,
          zip: search.zip,
          timestamp: Date.now(),
        }

        // Remove duplicate (same address)
        const filtered = recentSearches.filter(
          (s) => s.address.toLowerCase() !== search.address.toLowerCase()
        )

        // Add new search at beginning, limit to maxHistory
        const updated = [newSearch, ...filtered].slice(0, maxHistory)

        set({ recentSearches: updated })
      },

      removeSearch: (id) => {
        set((state) => ({
          recentSearches: state.recentSearches.filter((s) => s.id !== id),
        }))
      },

      clearHistory: () => {
        set({ recentSearches: [] })
      },
    }),
    {
      name: 'flipmantis-search-history',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
