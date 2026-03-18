import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { t } from '../lib/i18n'
import { useExtension } from '../hooks/useExtension'

const SUPABASE_URL = 'https://rzwfhokwmuuypvrrhfjq.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6d2Zob2t3bXV1eXB2cnJoZmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTI0NTQsImV4cCI6MjA4OTE2ODQ1NH0.DSmUNjUImGdSZX6ewl0f3SgNLF4yWd4Kx04wiXQ6Pt4'

const STATUS = {
  pending:    { color: 'bg-gray-100 text-gray-500',         dot: 'bg-gray-400',                     label: 'Ausstehend' },
  posting:    { color: 'bg-blue-50 text-blue-600',           dot: 'bg-blue-500',                     label: 'Wird gepostet…' },
  posted:     { color: 'bg-amber-50 text-amber-600',         dot: 'bg-amber-400',                    label: 'Post live' },
  commenting: { color: 'bg-blue-50 text-blue-600',           dot: 'bg-blue-500 animate-pulse',       label: 'Kommentiert…' },
  commented:  { color: 'bg-emerald-50 text-emerald-600',     dot: 'bg-emerald-500',                  label: 'Fertig' },
  error:      { color: 'bg-red-50 text-red-600',             dot: 'bg-red-500',                      label: 'Fehler' },
}

const POST_COLORS = [
  { id: 'white',      hex: null },
  { id: 'blue',       hex: '#1877f2' },
  { id: 'red',        hex: '#e41e3f' },
  { id: 'purple',     hex: '#7c3aed' },
  { id: 'pink',       hex: '#ec4899' },
  { id: 'teal',       hex: '#0891b2' },
  { id: 'teal_green', hex: '#059669' },
  { id: 'black',      hex: '#111827' },
]

const TONE_ACTIONS = [
  { id: 'tone_professional', label: 'Professionell', icon: '💼' },
  { id: 'tone_casual',       label: 'Locker',         icon: '😎' },
  { id: 'tone_friendly',     label: 'Freundlich',     icon: '🤗' },
  { id: 'tone_motivating',   label: 'Motivierend',    icon: '🚀' },
]

const STEPS = [
  { n: 1, label: 'Gruppe' },
  { n: 2, label: 'Post-Text' },
  { n: 3, label: 'Kommentar' },
  { n: 4, label: 'Optionen' },
]

const EMPTY = {
  group_id: '', group_name: '', post_text: '',
  comment_text: '', image_url: '', post_color: 'white', scheduled_at: '',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScheduledPosts() {
  const { connected, send } = useExtension()
  const [posts, setPosts]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [step, setStep]           = useState(1)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [runningId, setRunningId] = useState(null)
  const [progress, setProgress]   = useState(null)
  const [error, setError]         = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('scheduled_post_comments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setPosts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('scheduled_post_comments_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scheduled_post_comments' }, (payload) => {
        const row = payload.new
        if (row.status === 'posting')    setProgress('Post wird erstellt…')
        else if (row.status === 'posted')     setProgress('Post live! Kommentar folgt…')
        else if (row.status === 'commenting') setProgress('Kommentar wird gepostet…')
        else if (row.status === 'commented') {
          setProgress('Fertig ✓')
          setRunningId(null)
          load()
          setTimeout(() => setProgress(null), 3000)
        } else if (row.status === 'error') {
          setError(row.error_message || 'Unbekannter Fehler')
          setRunningId(null)
          setProgress(null)
          load()
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [load])

  // Auto-scheduler: every 30s check for due posts and run them
  const runningIdRef = useRef(null)
  useEffect(() => { runningIdRef.current = runningId }, [runningId])

  useEffect(() => {
    const check = () => {
      if (!connected) return
      if (runningIdRef.current) return  // one at a time
      const now = new Date()
      const due = posts.find(p =>
        p.status === 'pending' &&
        p.scheduled_at &&
        new Date(p.scheduled_at) <= now
      )
      if (due) handleRun(due)
    }
    check()
    const timer = setInterval(check, 30_000)
    return () => clearInterval(timer)
  }, [posts, connected]) // eslint-disable-line react-hooks/exhaustive-deps

  const uploadImage = async (file) => {
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('post-images')
      .upload(path, file, { contentType: file.type })
    if (uploadErr) throw uploadErr
    return `${SUPABASE_URL}/storage/v1/object/public/post-images/${path}`
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      let imageUrl = form.image_url.trim() || null
      if (imageFile) {
        setUploading(true)
        imageUrl = await uploadImage(imageFile)
        setUploading(false)
      }
      const { data: { user } } = await supabase.auth.getUser()
      const { error: err } = await supabase.from('scheduled_post_comments').insert({
        user_id:      user?.id || 'unknown',
        group_id:     form.group_id.trim(),
        group_name:   form.group_name.trim() || null,
        post_text:    form.post_text.trim(),
        comment_text: form.comment_text.trim(),
        image_url:    imageUrl,
        post_color:   form.post_color,
        scheduled_at: form.scheduled_at || null,
        status:       'pending',
      })
      if (err) throw err
      setShowWizard(false)
      setForm(EMPTY)
      setStep(1)
      setImageFile(null)
      setImagePreview(null)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRun = async (post) => {
    if (!connected) { setError('Extension nicht verbunden. Bitte Extension installieren und Seite neu laden.'); return }
    setRunningId(post.id)
    setProgress('Verbinde mit Facebook…')
    setError(null)
    try {
      const rawId = post.group_id || ''
      const groupId = rawId.replace(/^https?:\/\/(www\.)?facebook\.com\/groups\//i, '').replace(/[/?#].*$/, '')
      await send({
        type: 'CREATE_TAB',
        data: {
          url:      `https://www.facebook.com/groups/${groupId}?ypwSource=t`,
          taskType: 'CREATE_SCHEDULED_POST_WITH_COMMENT',
          pinned:   true,
          recordId:    post.id,
          commentText: post.comment_text,
          post: {
            groupId, postText: post.post_text,
            imageURL:  post.image_url || null,
            postColor: post.post_color || 'white',
            postLocation: 'group',
          },
        },
      })
      await supabase
        .from('scheduled_post_comments')
        .update({ status: 'posting', updated_at: new Date().toISOString() })
        .eq('id', post.id)
      load()
    } catch (e) {
      setError(e.message)
      setRunningId(null)
      setProgress(null)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Eintrag löschen?')) return
    await supabase.from('scheduled_post_comments').delete().eq('id', id)
    load()
  }

  const openWizard = () => {
    setShowWizard(true)
    setStep(1)
    setForm(EMPTY)
    setImageFile(null)
    setImagePreview(null)
    setError(null)
  }

  const closeWizard = () => {
    setShowWizard(false)
    setStep(1)
    setError(null)
  }

  return (
    <>
      <PageHeader title={t('posts.title')} />
      <div className="p-6 space-y-5">

        {/* Progress Banner */}
        {progress && (
          <div className="flex items-center gap-3 bg-[#f0f7ff] border border-[#c2d9ff] rounded-[12px] px-4 py-3">
            <div className="w-4 h-4 border-2 border-[#1877f2] border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-sm text-[#1877f2] font-medium">{progress}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-[12px] px-4 py-3 flex items-center gap-3">
            <span className="text-red-500 shrink-0 text-base">⚠</span>
            <span className="text-sm text-red-700 flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors">✕</button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#9196b0]">Post in Facebook-Gruppe erstellen und automatisch kommentieren</p>
          <button
            onClick={showWizard ? closeWizard : openWizard}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-semibold transition-all shadow-sm ${
              showWizard
                ? 'bg-[#f4f6fb] border border-[#e2e5f0] text-[#5f647e] hover:bg-red-50 hover:border-red-200 hover:text-red-500'
                : 'bg-primary hover:bg-primary-hover text-white shadow-[#1877f2]/15'
            }`}
          >
            {showWizard
              ? <><span>✕</span> Abbrechen</>
              : <><span className="text-lg leading-none font-light">+</span> Neuer Post</>}
          </button>
        </div>

        {/* Wizard */}
        {showWizard && (
          <PostWizard
            form={form}
            setForm={setForm}
            step={step}
            setStep={setStep}
            saving={saving}
            uploading={uploading}
            onSave={handleSave}
            onCancel={closeWizard}
            imageFile={imageFile}
            setImageFile={setImageFile}
            imagePreview={imagePreview}
            setImagePreview={setImagePreview}
            fileInputRef={fileInputRef}
          />
        )}

        {/* Posts List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState onNew={openWizard} />
        ) : (
          <PostsTable posts={posts} runningId={runningId} onRun={handleRun} onDelete={handleDelete} />
        )}
      </div>
    </>
  )
}

// ─── Post Wizard ──────────────────────────────────────────────────────────────

function PostWizard({ form, setForm, step, setStep, saving, uploading, onSave, onCancel, imageFile, setImageFile, imagePreview, setImagePreview, fileInputRef }) {
  const f = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  const canGoNext = () => {
    if (step === 1) return form.group_id.trim().length > 0
    if (step === 2) return form.post_text.trim().length > 0
    if (step === 3) return form.comment_text.trim().length > 0
    return true
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setForm(prev => ({ ...prev, image_url: '' }))
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setForm(prev => ({ ...prev, image_url: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="bg-white border border-[#e2e5f0] rounded-[16px] shadow-sm overflow-hidden">
      {/* Step Indicator */}
      <div className="px-6 py-4 border-b border-[#e2e5f0] bg-gradient-to-r from-[#f0f7ff] to-transparent">
        <div className="flex items-center">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <div className="flex items-center gap-2 shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step > s.n
                    ? 'bg-emerald-500 text-white'
                    : step === s.n
                      ? 'bg-[#1877f2] text-white shadow-sm'
                      : 'bg-[#f4f6fb] text-[#c4c7d6] border border-[#e2e5f0]'
                }`}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span className={`text-xs font-semibold hidden sm:block ${step === s.n ? 'text-[#1a1d2e]' : 'text-[#c4c7d6]'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-3 transition-colors ${step > s.n ? 'bg-emerald-300' : 'bg-[#e2e5f0]'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="p-6">
        {step === 1 && <WizardStep1 form={form} setForm={setForm} onChange={f} />}
        {step === 2 && (
          <WizardStep2
            form={form}
            setForm={setForm}
            onChange={f}
            imageFile={imageFile}
            imagePreview={imagePreview}
            fileInputRef={fileInputRef}
            onFileSelect={handleFileSelect}
            onClearImage={clearImage}
          />
        )}
        {step === 3 && <WizardStep3 form={form} setForm={setForm} />}
        {step === 4 && <WizardStep4 form={form} onChange={f} />}
      </div>

      {/* Navigation */}
      <div className="px-6 py-4 border-t border-[#e2e5f0] bg-[#f9fafb] flex items-center justify-between">
        <button
          type="button"
          onClick={() => step > 1 ? setStep(step - 1) : onCancel()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-[#9196b0] hover:text-[#5f647e] transition-colors"
        >
          ← {step > 1 ? 'Zurück' : 'Abbrechen'}
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#c4c7d6]">{step} / 4</span>
          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canGoNext()}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-[10px] text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              Weiter →
            </button>
          ) : (
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !canGoNext()}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-[10px] text-sm font-semibold transition-all disabled:opacity-50 shadow-sm"
            >
              {uploading ? 'Bild lädt…' : saving ? 'Speichert…' : '✓ Speichern'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Wizard Steps ─────────────────────────────────────────────────────────────

function WizardStep1({ form, setForm, onChange }) {
  const [savedGroups, setSavedGroups] = useState([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [showManual, setShowManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const loadGroups = () => {
    supabase
      .from('fb_groups')
      .select('group_id, group_name, group_url, is_admin, member_count')
      .eq('saved_for_posts', true)
      .order('group_name', { ascending: true })
      .then(({ data }) => {
        const seen = new Set()
        const unique = (data || []).filter(g => {
          const key = extractId(g.group_url || g.group_id)
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setSavedGroups(unique)
        setLoadingGroups(false)
      })
  }

  useEffect(() => { loadGroups() }, [])

  const extractId = (raw) =>
    (raw || '').replace(/^https?:\/\/(www\.)?facebook\.com\/groups\//i, '').replace(/[/?#].*$/, '').trim()

  const selectGroup = (g) => {
    const id = extractId(g.group_url || g.group_id) || g.group_id
    setForm(prev => ({ ...prev, group_id: id, group_name: g.group_name || '' }))
    setShowManual(false)
  }

  const isSelected = (g) => {
    const id = extractId(g.group_url || g.group_id) || g.group_id
    return form.group_id === id
  }

  const handleSaveGroup = async () => {
    const rawId = form.group_id.trim()
    if (!rawId) return
    const id = extractId(rawId) || rawId
    setSaving(true)
    setSaveMsg(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('fb_groups').upsert({
      user_id:          user?.id,
      group_id:         id,
      group_name:       form.group_name.trim() || null,
      group_url:        rawId.startsWith('http') ? rawId : `https://www.facebook.com/groups/${id}`,
      saved_for_posts:  true,
    }, { onConflict: 'group_id,user_id' })
    setSaving(false)
    if (error) {
      setSaveMsg({ ok: false, text: error.message })
    } else {
      setSaveMsg({ ok: true, text: 'Gespeichert ✓' })
      loadGroups()
      setTimeout(() => setSaveMsg(null), 2500)
    }
  }

  const alreadySaved = savedGroups.some(g => isSelected(g))

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[15px] font-bold text-[#1a1d2e] mb-1">Welche Gruppe?</h3>
        <p className="text-sm text-[#9196b0]">Wähle eine gespeicherte Gruppe oder gib eine neue ein.</p>
      </div>

      {/* Saved groups */}
      {loadingGroups ? (
        <div className="flex items-center gap-2 text-xs text-[#9196b0]">
          <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Gruppen laden…
        </div>
      ) : savedGroups.length > 0 ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 max-h-[240px] overflow-y-auto pr-0.5">
            {savedGroups.map((g) => {
              const selected = isSelected(g)
              return (
                <button
                  key={g.group_id}
                  type="button"
                  onClick={() => selectGroup(g)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-[10px] border text-left transition-all ${
                    selected
                      ? 'border-primary bg-[#f0f7ff] shadow-sm'
                      : 'border-[#e2e5f0] bg-white hover:border-primary/40 hover:bg-[#fafbff]'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 text-base ${
                    selected ? 'bg-primary/10' : 'bg-[#f4f6fb]'
                  }`}>👥</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${selected ? 'text-primary' : 'text-[#1a1d2e]'}`}>
                      {g.group_name || g.group_id}
                    </div>
                    <div className="text-[11px] text-[#9196b0] flex items-center gap-2 mt-0.5">
                      {g.is_admin && <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-[4px] font-semibold text-[10px]">Admin</span>}
                      {g.member_count > 0 && <span>{g.member_count.toLocaleString('de-DE')} Mitglieder</span>}
                    </div>
                  </div>
                  {selected && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Manual input toggle */}
      {savedGroups.length > 0 && (
        <button
          type="button"
          onClick={() => setShowManual(v => !v)}
          className="flex items-center gap-1.5 text-xs text-[#9196b0] hover:text-primary transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points={showManual ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
          </svg>
          {showManual ? 'Ausblenden' : '+ Neue Gruppe eingeben'}
        </button>
      )}

      {/* Manual input fields */}
      {(showManual || savedGroups.length === 0) && (
        <div className="space-y-3 p-4 bg-[#f9fafb] border border-[#e2e5f0] rounded-[12px]">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#5f647e] uppercase tracking-wide">Gruppen-ID oder URL *</label>
            <input
              value={form.group_id}
              onChange={onChange('group_id')}
              placeholder="z.B. 1234567890 oder facebook.com/groups/meinegruppe"
              autoFocus={savedGroups.length === 0}
              className="w-full px-4 py-3 text-sm border border-[#e2e5f0] rounded-[10px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white transition-all"
            />
            <p className="text-[11px] text-[#9196b0]">Die ID findest du in der URL: facebook.com/groups/<strong>ID</strong></p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#5f647e] uppercase tracking-wide">Gruppenname (optional)</label>
            <input
              value={form.group_name}
              onChange={onChange('group_name')}
              placeholder="z.B. Meine Marketing-Gruppe"
              className="w-full px-4 py-3 text-sm border border-[#e2e5f0] rounded-[10px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white transition-all"
            />
          </div>
          {/* Save button */}
          {form.group_id.trim() && (
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleSaveGroup}
                disabled={saving || alreadySaved}
                className="flex items-center gap-2 px-4 py-2 bg-[#f0f7ff] border border-[#c2d9ff] text-[#1877f2] rounded-[8px] text-xs font-semibold hover:bg-[#e0efff] transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <><div className="w-3 h-3 border-2 border-[#1877f2] border-t-transparent rounded-full animate-spin" /> Speichern…</>
                ) : alreadySaved ? (
                  <>✓ Bereits gespeichert</>
                ) : (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Gruppe speichern</>
                )}
              </button>
              {saveMsg && (
                <span className={`text-xs font-medium ${saveMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                  {saveMsg.text}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function WizardStep2({ form, setForm, onChange, imageFile, imagePreview, fileInputRef, onFileSelect, onClearImage }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[15px] font-bold text-[#1a1d2e] mb-1">Post-Text</h3>
        <p className="text-sm text-[#9196b0]">Was möchtest du posten? Nutze den AI-Assistenten für Ideen.</p>
      </div>

      <InlineAiTextarea
        value={form.post_text}
        onChange={(v) => setForm(prev => ({ ...prev, post_text: v }))}
        placeholder="Dein Beitrags-Text…"
        rows={5}
        fieldType="post"
        context={form.group_name || form.group_id}
      />

      {/* Image Upload */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-[#5f647e] uppercase tracking-wide">Bild (optional)</label>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelect} className="hidden" />
        {imagePreview ? (
          <div className="relative inline-block">
            <img src={imagePreview} alt="Vorschau" className="rounded-[10px] max-h-48 object-cover border border-[#e2e5f0]" />
            <button
              type="button"
              onClick={onClearImage}
              className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center text-xs transition-colors"
            >✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-[#c4c7d6] rounded-[10px] text-sm text-[#9196b0] hover:border-primary hover:text-primary hover:bg-[#f0f7ff] transition-all shrink-0"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Hochladen
            </button>
            <span className="text-xs text-[#c4c7d6]">oder</span>
            <input
              value={form.image_url}
              onChange={onChange('image_url')}
              type="url"
              placeholder="Bild-URL: https://…"
              className="flex-1 px-4 py-2.5 text-sm border border-[#e2e5f0] rounded-[10px] focus:outline-none focus:border-primary bg-white"
            />
          </div>
        )}
      </div>

      {/* Color swatches */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-[#5f647e] uppercase tracking-wide">Hintergrundfarbe</label>
        <div className="flex items-center gap-2 flex-wrap">
          {POST_COLORS.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setForm(prev => ({ ...prev, post_color: c.id }))}
              title={c.id}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                form.post_color === c.id ? 'border-[#1877f2] scale-110 shadow-md' : 'border-[#e2e5f0] hover:scale-105'
              }`}
              style={{ backgroundColor: c.hex || '#f4f6fb' }}
            />
          ))}
        </div>
        <p className="text-[11px] text-[#9196b0]">Hintergrundfarbe gilt nur für Text-Posts ohne Bild</p>
      </div>
    </div>
  )
}

function WizardStep3({ form, setForm }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[15px] font-bold text-[#1a1d2e] mb-1">Auto-Kommentar</h3>
        <p className="text-sm text-[#9196b0]">
          Dieser Kommentar wird <strong>automatisch</strong> direkt nach dem Post gepostet — perfekt als erster Kommentar.
        </p>
      </div>

      <InlineAiTextarea
        value={form.comment_text}
        onChange={(v) => setForm(prev => ({ ...prev, comment_text: v }))}
        placeholder="z.B. Hinterlasse hier deinen Kommentar 👇 Ich freue mich auf den Austausch!"
        rows={4}
        fieldType="comment"
        context={form.post_text}
      />

      <div className="flex items-start gap-3 bg-[#f0f7ff] border border-[#c2d9ff] rounded-[10px] px-4 py-3">
        <span className="text-[#1877f2] text-base shrink-0 mt-0.5">ℹ</span>
        <p className="text-xs text-[#5f647e] leading-relaxed">
          Der Kommentar wird sofort nach dem Erstellen des Posts automatisch gepostet.
          Er erscheint als erster Kommentar und erhöht so die Interaktion.
        </p>
      </div>
    </div>
  )
}

function WizardStep4({ form, onChange }) {
  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h3 className="text-[15px] font-bold text-[#1a1d2e] mb-1">Zeitplan & Zusammenfassung</h3>
        <p className="text-sm text-[#9196b0]">Optional: Lege fest, wann du starten möchtest.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-[#5f647e] uppercase tracking-wide">Geplant für (optional)</label>
        <input
          value={form.scheduled_at}
          onChange={onChange('scheduled_at')}
          type="datetime-local"
          className="w-full px-4 py-3 text-sm border border-[#e2e5f0] rounded-[10px] focus:outline-none focus:border-primary bg-white"
        />
        <p className="text-[11px] text-[#9196b0]">Leer lassen = sofort wenn du auf "Starten" klickst</p>
      </div>

      <div className="bg-[#f9fafb] border border-[#e2e5f0] rounded-[12px] p-4 space-y-3">
        <p className="text-[11px] font-bold text-[#9196b0] uppercase tracking-wide">Zusammenfassung</p>
        <div className="space-y-2.5">
          <SummaryRow label="Gruppe" value={form.group_name || form.group_id || '—'} />
          <SummaryRow label="Post-Text" value={form.post_text} truncate />
          <SummaryRow label="Kommentar" value={form.comment_text} truncate />
          {form.image_url && <SummaryRow label="Bild" value="✓ Bild hochgeladen" />}
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, truncate }) {
  const display = truncate && value?.length > 70 ? value.substring(0, 70) + '…' : value
  return (
    <div className="flex items-start gap-3">
      <span className="text-[11px] text-[#9196b0] w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-[#1a1d2e] font-medium leading-relaxed flex-1">{display || '—'}</span>
    </div>
  )
}

// ─── Emoji Data ───────────────────────────────────────────────────────────────

const EMOJI_CATS = [
  { label: '😊', title: 'Smileys', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😋','😜','🤪','😎','🥳','🤗','😏','🤔','😐','😑','😶','🙄','😬','😔','😢','😭','😤','😠','😡','🤬','😈','💀','🤡','😷','🤒','🤕','🥴','😵','🤯','🥱','😴'] },
  { label: '👍', title: 'Gesten', emojis: ['👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','🤏','👋','🙌','👏','🤝','🙏','💪','💯','☝️','👆','👇','👈','👉','🫶','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕','💞','💓','💗','💖','💘','💝'] },
  { label: '🔥', title: 'Symbole', emojis: ['🔥','✨','💫','⭐','🌟','💥','❗','❓','💡','🎉','🎊','🎁','🏆','🥇','🎯','🚀','✈️','🌈','🎵','🎶','📱','💻','📷','🎮','💰','💸','🛒','📦','🔑','✅','❌','⚠️','💬','📢','📣','🔔','🔕','♻️','🆕','🆙','🆒','🆓','🔝'] },
  { label: '🌸', title: 'Natur', emojis: ['🌸','🌺','🌼','🌻','🌹','🌷','🍀','🌱','🌲','🌴','🌊','❄️','☀️','🌙','⭐','🌍','🐶','🐱','🦊','🐻','🐼','🦁','🐯','🐸','🦋','🐝','🌿','🍁','🍂','🌾','🍄','🌈','⛅','🌤️','🌧️','⚡','🌬️','💧','🌺','🎋'] },
  { label: '🍕', title: 'Essen', emojis: ['🍕','🍔','🌮','🍜','🍱','🍰','🎂','🍭','🍫','🍩','🍪','🍺','☕','🍵','🥤','🍹','🥗','🍣','🥪','🧁','🍦','🥞','🧇','🥐','🍞','🧀','🥚','🥓','🍗','🍖','🥩','🍜','🍝','🥘','🍲','🥣','🫐','🍓','🍒','🍎','🍊','🍋','🍌','🍉','🍇'] },
]

// ─── Inline AI Textarea (Chatwoot-style) ──────────────────────────────────────

function InlineAiTextarea({ value, onChange, placeholder, rows = 4, fieldType, context }) {
  const [aiLoading, setAiLoading]         = useState(false)
  const [aiResult, setAiResult]           = useState(null)
  const [aiResultText, setAiResultText]   = useState('')   // editable copy
  const [aiError, setAiError]             = useState(null)
  const [showPrompt, setShowPrompt]       = useState(false)
  const [promptText, setPromptText]       = useState('')
  const [referenceText, setReferenceText] = useState('')
  const [showReference, setShowReference] = useState(false)
  const [showTones, setShowTones]         = useState(false)
  const [showEmoji, setShowEmoji]         = useState(false)
  const [emojiCat, setEmojiCat]           = useState(0)
  const promptRef    = useRef(null)
  const toneRef      = useRef(null)
  const emojiRef     = useRef(null)
  const textareaRef  = useRef(null)

  const hasText = (value || '').trim().length > 0

  // Sync editable copy when result arrives
  useEffect(() => { if (aiResult) setAiResultText(aiResult) }, [aiResult])

  useEffect(() => {
    const handler = (e) => {
      if (toneRef.current && !toneRef.current.contains(e.target)) setShowTones(false)
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const callAi = async (action, text) => {
    setAiLoading(true)
    setAiError(null)
    setAiResult(null)
    setAiResultText('')
    setShowPrompt(false)
    setShowTones(false)
    try {
      let { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        const refreshed = await supabase.auth.refreshSession()
        session = refreshed.data?.session
      }
      const token = session?.access_token || ANON_KEY
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-text-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': ANON_KEY },
        body: JSON.stringify({ action, text, context, reference: referenceText.trim() || undefined }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || `Fehler ${resp.status}`)
      setAiResult(data.result)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleGenerate = () => {
    if (!promptText.trim()) return
    const action = fieldType === 'comment' ? 'generate_comment' : 'generate'
    callAi(action, promptText)
    setPromptText('')
  }

  const handleAccept = () => {
    onChange(aiResultText)
    setAiResult(null)
    setAiResultText('')
  }

  const togglePrompt = () => {
    setShowPrompt(v => !v)
    setShowTones(false)
    setShowEmoji(false)
    if (!showPrompt) setTimeout(() => promptRef.current?.focus(), 50)
  }

  const insertEmoji = (emoji) => {
    const ta = textareaRef.current
    if (!ta) { onChange((value || '') + emoji); return }
    const start = ta.selectionStart ?? (value || '').length
    const end   = ta.selectionEnd   ?? (value || '').length
    const next  = (value || '').substring(0, start) + emoji + (value || '').substring(end)
    onChange(next)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + emoji.length, start + emoji.length) }, 0)
    setShowEmoji(false)
  }

  return (
    <div className="space-y-2">
      {/* Textarea container */}
      <div className={`rounded-[12px] border overflow-hidden transition-colors ${
        aiLoading ? 'border-[#1877f2]/40' : 'border-[#e2e5f0] focus-within:border-[#1877f2]'
      }`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-4 py-3 text-sm bg-white resize-none focus:outline-none leading-relaxed"
        />

        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-3 py-2 bg-[#f9fafb] border-t border-[#f0f0f5]">
          {/* Emoji picker button */}
          <div className="relative" ref={emojiRef}>
            <ToolbarBtn active={showEmoji} onClick={() => { setShowEmoji(v => !v); setShowPrompt(false); setShowTones(false) }}>
              😊
            </ToolbarBtn>
            {showEmoji && (
              <div className="absolute bottom-full left-0 mb-1 bg-white border border-[#e2e5f0] rounded-[12px] shadow-xl z-40 w-[300px] overflow-hidden">
                {/* Category tabs */}
                <div className="flex border-b border-[#f0f0f5]">
                  {EMOJI_CATS.map((cat, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setEmojiCat(i)}
                      title={cat.title}
                      className={`flex-1 py-2 text-base transition-colors ${emojiCat === i ? 'bg-[#f0f7ff] border-b-2 border-[#1877f2]' : 'hover:bg-[#f9fafb]'}`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                {/* Emoji grid */}
                <div className="p-2 grid grid-cols-8 gap-0.5 max-h-[180px] overflow-y-auto">
                  {EMOJI_CATS[emojiCat].emojis.map((e, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => insertEmoji(e)}
                      className="w-8 h-8 flex items-center justify-center text-lg hover:bg-[#f0f7ff] rounded-[6px] transition-colors"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-3.5 bg-[#e2e5f0] mx-1" />
          <span className="text-[10px] text-[#c4c7d6] font-bold mr-1 tracking-wider">AI</span>

          {/* Generieren */}
          <ToolbarBtn active={showPrompt} onClick={togglePrompt} disabled={aiLoading}>
            🪄 Generieren
          </ToolbarBtn>

          {/* Text actions */}
          {hasText && (
            <>
              <ToolbarBtn onClick={() => callAi('improve', value)} disabled={aiLoading}>✨ Verbessern</ToolbarBtn>
              <ToolbarBtn onClick={() => callAi('shorten', value)} disabled={aiLoading}>✂️ Kürzen</ToolbarBtn>
              <ToolbarBtn onClick={() => callAi('rephrase', value)} disabled={aiLoading}>🔄 Umformulieren</ToolbarBtn>
              <div className="w-px h-3.5 bg-[#e2e5f0] mx-1" />
              <div className="relative" ref={toneRef}>
                <ToolbarBtn active={showTones} onClick={() => { setShowTones(v => !v); setShowPrompt(false); setShowEmoji(false) }} disabled={aiLoading}>
                  🎭 Ton
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ml-0.5"><polyline points="6 9 12 15 18 9"/></svg>
                </ToolbarBtn>
                {showTones && (
                  <div className="absolute bottom-full left-0 mb-1 bg-white border border-[#e2e5f0] rounded-[10px] shadow-xl py-1 z-30 w-44 overflow-hidden">
                    {TONE_ACTIONS.map(tone => (
                      <button key={tone.id} type="button" onClick={() => { callAi(tone.id, value); setShowTones(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-[#1a1d2e] hover:bg-[#f4f6fb] transition-colors text-left">
                        <span>{tone.icon}</span> {tone.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {aiLoading && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-[#1877f2]">
              <div className="w-3 h-3 border-2 border-[#1877f2] border-t-transparent rounded-full animate-spin" />
              <span>AI denkt…</span>
            </div>
          )}
        </div>

        {/* Generate prompt area */}
        {showPrompt && !aiLoading && (
          <div className="px-3 pb-3 pt-2 bg-[#f9fafb] border-t border-[#eef0f7] space-y-2">
            <div className="flex items-center gap-2">
              <input
                ref={promptRef}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); if (e.key === 'Escape') setShowPrompt(false) }}
                placeholder={fieldType === 'comment' ? 'z.B. Einladender Kommentar der zum Mitmachen motiviert…' : 'z.B. Willkommenspost für neue Mitglieder, motivierend…'}
                className="flex-1 px-3 py-1.5 text-xs border border-[#e2e5f0] rounded-[6px] focus:outline-none focus:border-[#1877f2] bg-white"
              />
              <button type="button" onClick={handleGenerate} disabled={!promptText.trim()}
                className="px-3 py-1.5 bg-[#1877f2] hover:bg-[#1565c0] text-white rounded-[6px] text-xs font-semibold disabled:opacity-40 transition-colors shrink-0">
                Generieren
              </button>
              <button type="button" onClick={() => setShowPrompt(false)} className="text-[#c4c7d6] hover:text-[#9196b0] text-sm">✕</button>
            </div>

            {/* Reference toggle */}
            <button type="button" onClick={() => setShowReference(v => !v)}
              className="flex items-center gap-1.5 text-[11px] text-[#9196b0] hover:text-primary transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              {showReference ? 'Referenz ausblenden' : '📎 Referenz-Post hinzufügen'}
            </button>

            {showReference && (
              <textarea
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                placeholder="Füge hier einen Beispiel-Post ein, an dem sich die KI orientieren soll (Stil, Länge, Ton)…"
                rows={3}
                className="w-full px-3 py-2 text-xs border border-[#e2e5f0] rounded-[8px] focus:outline-none focus:border-[#1877f2] bg-white resize-none"
              />
            )}
          </div>
        )}
      </div>

      {/* AI Error */}
      {aiError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-[8px]">
          <span className="text-xs text-red-600 flex-1">{aiError}</span>
          <button type="button" onClick={() => setAiError(null)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>
      )}

      {/* AI Result — editable */}
      {aiResult && (
        <div className="border border-[#c2d9ff] rounded-[12px] overflow-hidden bg-gradient-to-b from-[#f0f7ff] to-white">
          <div className="px-4 py-2.5 bg-[#f0f7ff] border-b border-[#c2d9ff] flex items-center gap-2">
            <span>✨</span>
            <span className="text-xs font-bold text-[#1877f2]">AI Vorschlag</span>
            <span className="ml-auto text-[10px] text-[#9196b0]">Bearbeitbar</span>
          </div>
          <div className="px-4 py-3">
            <textarea
              value={aiResultText}
              onChange={(e) => setAiResultText(e.target.value)}
              rows={Math.max(3, (aiResultText.match(/\n/g) || []).length + 2)}
              className="w-full text-sm text-[#1a1d2e] leading-relaxed resize-none focus:outline-none bg-transparent"
            />
          </div>
          <div className="px-4 py-3 border-t border-[#e8efff] flex items-center gap-2">
            <button type="button" onClick={handleAccept}
              className="flex-1 py-2 bg-[#1877f2] hover:bg-[#1565c0] text-white rounded-[8px] text-xs font-semibold transition-colors">
              Übernehmen
            </button>
            <button type="button" onClick={() => { setAiResult(null); setAiResultText('') }}
              className="px-3 py-2 border border-[#e2e5f0] text-[#9196b0] rounded-[8px] text-xs hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors">
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ToolbarBtn({ children, onClick, disabled, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] text-[11px] font-medium transition-all disabled:opacity-40 ${
        active
          ? 'bg-[#1877f2] text-white shadow-sm'
          : 'text-[#9196b0] hover:bg-white hover:text-[#1877f2] hover:shadow-sm'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Posts Table ──────────────────────────────────────────────────────────────

function PostsTable({ posts, runningId, onRun, onDelete }) {
  return (
    <div className="bg-white border border-[#e2e5f0] rounded-[14px] overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-[#e2e5f0] bg-[#f9fafb] flex items-center gap-2">
        <span className="text-[11px] font-bold text-[#9196b0] uppercase tracking-wide">
          {posts.length} {posts.length === 1 ? 'Eintrag' : 'Einträge'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f0f0f5]">
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[#9196b0] uppercase tracking-wide">Status</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[#9196b0] uppercase tracking-wide">Gruppe</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[#9196b0] uppercase tracking-wide">Post-Text</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[#9196b0] uppercase tracking-wide">Kommentar</th>
              <th className="text-left px-5 py-3 text-[10px] font-bold text-[#9196b0] uppercase tracking-wide">Erstellt</th>
              <th className="text-right px-5 py-3 text-[10px] font-bold text-[#9196b0] uppercase tracking-wide">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f7f7fb]">
            {posts.map(post => (
              <PostRow
                key={post.id}
                post={post}
                isRunning={runningId === post.id}
                onRun={() => onRun(post)}
                onDelete={() => onDelete(post.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PostRow({ post, isRunning, onRun, onDelete }) {
  const canRun = post.status === 'pending' || post.status === 'error'
  const s = STATUS[post.status] || STATUS.pending

  return (
    <tr className="hover:bg-[#fafbff] transition-colors">
      <td className="px-5 py-3.5 align-top">
        <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold whitespace-nowrap ${s.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
          {s.label}
        </span>
        {post.fb_post_id && (
          <div className="text-[10px] text-emerald-600 font-medium mt-1">✓ ID: {post.fb_post_id}</div>
        )}
      </td>
      <td className="px-5 py-3.5 align-top">
        <div className="text-sm font-medium text-[#1a1d2e] max-w-[130px] truncate">
          {post.group_name || `Gruppe ${post.group_id}`}
        </div>
        {post.scheduled_at && (
          <div className="text-[11px] text-[#9196b0] mt-0.5">
            🕐 {new Date(post.scheduled_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        )}
      </td>
      <td className="px-5 py-3.5 align-top max-w-[220px]">
        <div className="flex items-start gap-2">
          {post.image_url && (
            <img src={post.image_url} alt="" className="w-9 h-9 rounded-[6px] object-cover shrink-0 border border-[#e2e5f0]" />
          )}
          <p className="text-sm text-[#5f647e] line-clamp-2 leading-relaxed">{post.post_text}</p>
        </div>
        {post.error_message && (
          <p className="text-[10px] text-red-500 mt-1.5 bg-red-50 rounded-[5px] px-2 py-1 line-clamp-1">
            {post.error_message}
          </p>
        )}
      </td>
      <td className="px-5 py-3.5 align-top max-w-[180px]">
        <p className="text-xs text-[#9196b0] line-clamp-2 leading-relaxed">💬 {post.comment_text}</p>
      </td>
      <td className="px-5 py-3.5 align-top whitespace-nowrap">
        <span className="text-xs text-[#9196b0]">
          {new Date(post.created_at).toLocaleDateString('de-DE')}
        </span>
      </td>
      <td className="px-5 py-3.5 align-top">
        <div className="flex items-center gap-2 justify-end">
          {canRun && (
            <button
              onClick={onRun}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-[7px] text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isRunning
                ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <>▶ Starten</>}
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={isRunning}
            className="p-1.5 text-[#c4c7d6] hover:text-red-500 rounded-[6px] hover:bg-red-50 transition-colors disabled:opacity-40"
            title="Löschen"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }) {
  return (
    <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1877f2]/8 to-[#42a5f5]/8 flex items-center justify-center text-3xl mx-auto mb-4">
        📅
      </div>
      <h3 className="font-bold text-[#1a1d2e] mb-2">Noch keine geplanten Posts</h3>
      <p className="text-sm text-[#9196b0] mb-6 max-w-xs mx-auto leading-relaxed">
        Erstelle deinen ersten Post mit automatischem Kommentar für eine Facebook-Gruppe.
      </p>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-[10px] text-sm font-semibold transition-colors shadow-sm shadow-[#1877f2]/15"
      >
        <span className="text-base font-light">+</span> Ersten Post erstellen
      </button>
    </div>
  )
}
