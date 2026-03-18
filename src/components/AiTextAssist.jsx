import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = 'https://rzwfhokwmuuypvrrhfjq.supabase.co'

const ACTIONS = {
  withText: [
    { id: 'improve', icon: '✨', label: 'Verbessern', desc: 'Klarer & professioneller' },
    { id: 'shorten', icon: '✂️', label: 'Kürzen', desc: 'Kompakter formulieren' },
    { id: 'expand', icon: '📝', label: 'Erweitern', desc: 'Mehr Details hinzufügen' },
    { id: 'rephrase', icon: '🔄', label: 'Umformulieren', desc: 'Alternative Variante' },
    { id: 'fix_grammar', icon: '📖', label: 'Grammatik korrigieren', desc: 'Rechtschreibung & Grammatik' },
  ],
  tones: [
    { id: 'tone_professional', icon: '💼', label: 'Professionell' },
    { id: 'tone_casual', icon: '😎', label: 'Locker' },
    { id: 'tone_friendly', icon: '🤗', label: 'Freundlich' },
    { id: 'tone_motivating', icon: '🚀', label: 'Motivierend' },
  ],
}

export default function AiTextAssist({ value, onAccept, fieldType = 'post', context = '' }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showTones, setShowTones] = useState(false)
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [showGenerate, setShowGenerate] = useState(false)
  const menuRef = useRef(null)

  const hasText = (value || '').trim().length > 0

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
        setShowTones(false)
        setShowGenerate(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const callAi = async (action, text) => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-text-assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6d2Zob2t3bXV1eXB2cnJoZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTI0NTQsImV4cCI6MjA4OTE2ODQ1NH0.DSmUNjUImGdSZX6ewl0f3SgNLF4yWd4Kx04wiXQ6Pt4',
        },
        body: JSON.stringify({ action, text, context }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'AI Fehler')
      setResult(data.result)
      setOpen(false)
      setShowTones(false)
      setShowGenerate(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = () => {
    if (!generatePrompt.trim()) return
    const action = fieldType === 'comment' ? 'generate_comment' : 'generate'
    callAi(action, generatePrompt, context)
  }

  const handleAccept = () => {
    onAccept(result)
    setResult(null)
  }

  const handleDiscard = () => {
    setResult(null)
  }

  const handleRegenerate = () => {
    if (result) {
      const lastAction = fieldType === 'comment' ? 'generate_comment' : 'rephrase'
      callAi(lastAction, value || generatePrompt)
    }
  }

  // Result preview card
  if (result) {
    return (
      <div className="mt-2 border border-[#e2e5f0] rounded-[12px] overflow-hidden bg-gradient-to-b from-[#f8f9ff] to-white shadow-sm">
        <div className="px-4 py-2.5 bg-gradient-to-r from-[#1877f2]/5 to-[#42a5f5]/5 border-b border-[#e2e5f0] flex items-center gap-2">
          <span className="text-sm">✨</span>
          <span className="text-xs font-semibold text-[#1877f2]">AI Vorschlag</span>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm text-[#1a1d2e] leading-relaxed whitespace-pre-wrap">{result}</p>
        </div>
        <div className="px-4 py-3 border-t border-[#e2e5f0] flex items-center gap-2">
          <button
            onClick={handleAccept}
            className="flex-1 py-2 bg-[#1877f2] hover:bg-[#1565c0] text-white rounded-[8px] text-xs font-semibold transition-colors"
          >
            Übernehmen
          </button>
          <button
            onClick={handleRegenerate}
            disabled={loading}
            className="px-3 py-2 border border-[#e2e5f0] text-[#5f647e] rounded-[8px] text-xs hover:bg-[#f4f6fb] transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="w-3.5 h-3.5 border-2 border-[#1877f2] border-t-transparent rounded-full animate-spin inline-block" />
            ) : '↻ Neu'}
          </button>
          <button
            onClick={handleDiscard}
            className="px-3 py-2 border border-[#e2e5f0] text-[#9196b0] rounded-[8px] text-xs hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setShowTones(false); setShowGenerate(false); setError(null) }}
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-xs font-medium transition-all
          ${open
            ? 'bg-[#1877f2] text-white shadow-md shadow-[#1877f2]/20'
            : 'bg-gradient-to-r from-[#1877f2]/8 to-[#42a5f5]/8 text-[#1877f2] hover:from-[#1877f2]/15 hover:to-[#42a5f5]/15 border border-[#1877f2]/15'
          }
        `}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
        </svg>
        AI
      </button>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-white border border-[#e2e5f0] rounded-[12px] shadow-lg shadow-black/8 p-6 w-[280px] flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-[#1877f2] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#5f647e] font-medium">AI denkt nach...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-white border border-red-200 rounded-[12px] shadow-lg p-4 w-[280px]">
          <p className="text-xs text-red-600 mb-2">{error}</p>
          <button onClick={() => setError(null)} className="text-xs text-[#9196b0] hover:text-[#5f647e]">Schließen</button>
        </div>
      )}

      {/* Menu */}
      {open && !loading && !error && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-white border border-[#e2e5f0] rounded-[14px] shadow-xl shadow-black/10 w-[300px] overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-[#1877f2]/5 to-[#42a5f5]/5 border-b border-[#e2e5f0]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-[6px] bg-gradient-to-br from-[#1877f2] to-[#42a5f5] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
                </svg>
              </div>
              <span className="text-xs font-bold text-[#1a1d2e]">AI Text-Assistent</span>
            </div>
          </div>

          <div className="py-1.5 max-h-[360px] overflow-y-auto">
            {/* Generate option */}
            {!showTones && (
              <div>
                <button
                  onClick={() => setShowGenerate(!showGenerate)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f4f6fb] transition-colors text-left"
                >
                  <span className="text-base w-5 text-center">🪄</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#1a1d2e]">
                      {fieldType === 'comment' ? 'Kommentar generieren' : 'Text generieren'}
                    </div>
                    <div className="text-[11px] text-[#9196b0]">Beschreibe was du schreiben willst</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9196b0" strokeWidth="2" strokeLinecap="round">
                    <polyline points={showGenerate ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
                  </svg>
                </button>

                {showGenerate && (
                  <div className="px-4 pb-3 space-y-2">
                    <textarea
                      value={generatePrompt}
                      onChange={(e) => setGeneratePrompt(e.target.value)}
                      placeholder={fieldType === 'comment' ? 'z.B. Einladender Kommentar der zum Mitmachen motiviert...' : 'z.B. Willkommenspost für neue Mitglieder, motivierend...'}
                      rows={2}
                      className="w-full px-3 py-2 text-xs border border-[#e2e5f0] rounded-[8px] focus:outline-none focus:border-[#1877f2] bg-[#f9fafb] resize-none placeholder:text-[#c4c7d6]"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate() } }}
                    />
                    <button
                      onClick={handleGenerate}
                      disabled={!generatePrompt.trim()}
                      className="w-full py-2 bg-gradient-to-r from-[#1877f2] to-[#42a5f5] hover:from-[#1565c0] hover:to-[#1877f2] text-white rounded-[8px] text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-[#1877f2]/15"
                    >
                      Generieren
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            {hasText && !showTones && !showGenerate && (
              <div className="mx-4 my-1 border-t border-[#e2e5f0]" />
            )}

            {/* Text actions — only when text exists */}
            {hasText && !showTones && !showGenerate && (
              <>
                {ACTIONS.withText.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => callAi(action.id, value)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f4f6fb] transition-colors text-left group"
                  >
                    <span className="text-base w-5 text-center">{action.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[#1a1d2e] group-hover:text-[#1877f2] transition-colors">{action.label}</div>
                      <div className="text-[11px] text-[#9196b0]">{action.desc}</div>
                    </div>
                  </button>
                ))}

                <div className="mx-4 my-1 border-t border-[#e2e5f0]" />

                {/* Tone submenu trigger */}
                <button
                  onClick={() => setShowTones(true)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f4f6fb] transition-colors text-left"
                >
                  <span className="text-base w-5 text-center">🎭</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#1a1d2e]">Ton ändern</div>
                    <div className="text-[11px] text-[#9196b0]">Professionell, locker, freundlich...</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9196b0" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </>
            )}

            {/* Tone submenu */}
            {showTones && (
              <>
                <button
                  onClick={() => setShowTones(false)}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-[#f4f6fb] transition-colors text-left border-b border-[#e2e5f0]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9196b0" strokeWidth="2" strokeLinecap="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span className="text-xs font-medium text-[#9196b0]">Zurück</span>
                </button>
                {ACTIONS.tones.map((tone) => (
                  <button
                    key={tone.id}
                    onClick={() => callAi(tone.id, value)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f4f6fb] transition-colors text-left group"
                  >
                    <span className="text-base w-5 text-center">{tone.icon}</span>
                    <div className="text-[13px] font-semibold text-[#1a1d2e] group-hover:text-[#1877f2] transition-colors">{tone.label}</div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
