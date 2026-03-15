import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUrlTokens().then(() => {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s)
        setUser(s?.user ?? null)
        setLoading(false)
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { user, session, loading, signIn, signOut }
}

async function checkUrlTokens() {
  try {
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('ext_token')
    const refreshToken = params.get('ext_refresh')

    if (!accessToken) return

    console.log('[AS] Auto-login from extension...')

    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    })

    console.log('[AS] setSession result:', { data: !!data?.session, error })

    // Clean URL
    window.history.replaceState({}, '', '/')
  } catch (err) {
    console.error('[AS] Auto-login failed:', err)
  }
}
