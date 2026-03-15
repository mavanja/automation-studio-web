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
    // Check full URL for access_token (could be in hash or query)
    const fullUrl = window.location.href
    if (!fullUrl.includes('access_token=')) return

    // Extract access_token from anywhere in the URL
    const match = fullUrl.match(/access_token=([^&]+)/)
    const refreshMatch = fullUrl.match(/refresh_token=([^&]+)/)

    const accessToken = match?.[1]
    const refreshToken = refreshMatch?.[1] || ''

    if (!accessToken) return

    const { error } = await supabase.auth.setSession({
      access_token: decodeURIComponent(accessToken),
      refresh_token: decodeURIComponent(refreshToken),
    })

    if (!error) {
      // Clean URL - redirect to root
      window.history.replaceState({}, '', '/')
    }
  } catch (err) {
    console.error('Auto-login from extension failed:', err)
  }
}
