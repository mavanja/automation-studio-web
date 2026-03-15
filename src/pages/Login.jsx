import React, { useState } from 'react'
import { t } from '../lib/i18n'

export default function Login({ onSignIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onSignIn(email, password)
    } catch (err) {
      setError(err.message || t('auth.login_failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f4f6fb]">
      <div className="w-[400px] bg-white border border-[#e2e5f0] rounded-[18px] p-10 shadow-[0_8px_24px_rgba(0,0,0,0.08)] text-center">
        <div className="w-[72px] h-[72px] rounded-[18px] overflow-hidden mx-auto mb-5 shadow-[0_6px_20px_rgba(24,119,242,0.2)]">
          <img src="/logo.png" alt="AS" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-[22px] font-extrabold text-[#1a1d2e] tracking-tight mb-1">Automation Studio</h1>
        <p className="text-xs text-[#9196b0] mb-7">Facebook Automation Toolkit</p>

        <form onSubmit={handleSubmit} className="text-left space-y-4">
          <div>
            <label className="block text-[11px] text-[#9196b0] font-semibold uppercase tracking-wide mb-1.5">{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full px-3.5 py-2.5 bg-[#f1f3f9] border border-[#e2e5f0] rounded-[10px] text-sm focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(24,119,242,0.12)] focus:bg-white transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#9196b0] font-semibold uppercase tracking-wide mb-1.5">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              className="w-full px-3.5 py-2.5 bg-[#f1f3f9] border border-[#e2e5f0] rounded-[10px] text-sm focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(24,119,242,0.12)] focus:bg-white transition-all"
              required
            />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-primary to-[#42a5f5] text-white rounded-[10px] text-sm font-semibold shadow-[0_2px_10px_rgba(24,119,242,0.15)] hover:shadow-[0_6px_20px_rgba(24,119,242,0.25)] hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            {loading ? t('auth.logging_in') : t('auth.login')}
          </button>
        </form>
      </div>
    </div>
  )
}
