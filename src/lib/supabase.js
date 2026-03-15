import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rzwfhokwmuuypvrrhfjq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6d2Zob2t3bXV1eXB2cnJoZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTI0NTQsImV4cCI6MjA4OTE2ODQ1NH0.DSmUNjUImGdSZX6ewl0f3SgNLF4yWd4Kx04wiXQ6Pt4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
