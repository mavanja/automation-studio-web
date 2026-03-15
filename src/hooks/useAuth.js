import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if tokens were passed via URL hash (from extension)
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
    const hash = window.location.hash
    if (!hash.includes('access_token=')) return

    // Parse tokens from hash: #/auth?access_token=...&refresh_token=...
    const queryPart = hash.split('?')[1]
    if (!queryPart) return

    const params = new URLSearchParams(queryPart)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken) return

    // Set the session in Supabase
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    })

    if (!error) {
      // Clean up the URL - remove tokens
      window.location.hash = '#/'
    }
  } catch (err) {
    console.error('Auto-login from extension failed:', err)
  }
}
