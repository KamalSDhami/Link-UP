import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'
import type { Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },

  refreshUser: async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      set({ user: userData })
    }
  },
}))

// Initialize auth state
supabase.auth.getSession().then(({ data: { session } }) => {
  useAuthStore.setState({ session, isLoading: false })
  if (session) {
    supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        useAuthStore.setState({ user: data })
      })
  }
})

// Listen to auth changes
supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.setState({ session })
  if (session) {
    supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        useAuthStore.setState({ user: data })
      })
  } else {
    useAuthStore.setState({ user: null })
  }
})
