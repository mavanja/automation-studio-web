import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { t } from '../lib/i18n'
import { useExtension } from '../hooks/useExtension'

const STATUS_COLORS = {
  pending:    'bg-gray-100 text-gray-600',
  posting:    'bg-blue-100 text-blue-700',
  posted:     'bg-yellow-100 text-yellow-700',
  commenting: 'bg-blue-100 text-blue-700',
  commented:  'bg-emerald-100 text-emerald-700',
  error:      'bg-red-100 text-red-700',
}
const STATUS_LABELS = {
  pending:    'Ausstehend',
  posting:    'Wird gepostet…',
  posted:     'Gepostet',
  commenting: 'Kommentiert…',
  commented:  'Fertig ✓',
  error:      'Fehler',
}
const POST_COLORS = [
  { id: 'white',          label: 'Kein Hintergrund' },
  { id: 'blue',           label: 'Blau' },
  { id: 'red',            label: 'Rot' },
  { id: 'purple',         label: 'Lila' },
  { id: 'pink',           label: 'Pink' },
  { id: 'teal',           label: 'Türkis' },
  { id: 'teal_green',     label: 'Türkis-Grün' },
  { id: 'black',          label: 'Schwarz' },
]

const EMPTY = {
  group_id: '', group_name: '', post_text: '',
  comment_text: '', image_url: '', post_color: 'white', scheduled_at: '',
}

export default function ScheduledPosts() {
  const { connected, send } = useExtension()
  const [posts, setPosts]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [runningId, setRunningId] = useState(null)
  const [progress, setProgress]   = useState(null)
  const [error, setError]         = useState(null)

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

    // Live-updates via Supabase Realtime (background.js updates status in DB)
    const channel = supabase
      .channel('scheduled_post_comments_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'scheduled_post_comments',
      }, (payload) => {
        const row = payload.new
        if (row.status === 'posting') {
          setProgress('Post wird erstellt…')
        } else if (row.status === 'posted') {
          setProgress('Post erstellt! Kommentar wird gepostet…')
        } else if (row.status === 'commenting') {
          setProgress('Kommentar wird gepostet…')
        } else if (row.status === 'commented') {
          setProgress('Fertig! ✓')
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

  const handleSave = async () => {
    if (!form.group_id.trim() || !form.post_text.trim() || !form.comment_text.trim()) {
      setError('Gruppen-ID, Post-Text und Kommentar sind Pflichtfelder.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: err } = await supabase.from('scheduled_post_comments').insert({
        user_id:      user?.id || 'unknown',
        group_id:     form.group_id.trim(),
        group_name:   form.group_name.trim() || null,
        post_text:    form.post_text.trim(),
        comment_text: form.comment_text.trim(),
        image_url:    form.image_url.trim() || null,
        post_color:   form.post_color,
        scheduled_at: form.scheduled_at || null,
        status:       'pending',
      })
      if (err) throw err
      setShowForm(false)
      setForm(EMPTY)
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
      // Extract numeric group ID from full URL or plain ID
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
            groupId:      groupId,
            postText:     post.post_text,
            imageURL:     post.image_url || null,
            postColor:    post.post_color || 'white',
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

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <>
      <PageHeader title={t('posts.title')} />
      <div className="p-7 space-y-6">

        {/* Progress Banner */}
        {progress && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-[12px] px-5 py-3.5">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-sm text-blue-700 font-medium">{progress}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-[12px] px-5 py-3.5 text-sm text-red-700 flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#9196b0]">Post in Gruppe erstellen + automatisch kommentieren</p>
          <button
            onClick={() => { setShowForm(!showForm); setError(null) }}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-[10px] text-sm font-semibold transition-colors shadow-sm"
          >
            {showForm ? 'Abbrechen' : '+ Neuer Post'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-6 space-y-5">
            <h2 className="text-base font-bold text-[#1a1d2e]">Neuen geplanten Post erstellen</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#5f647e]">Gruppen-ID *</label>
                <input value={form.group_id} onChange={f('group_id')}
                  placeholder="z.B. 1234567890"
                  className="w-full px-3 py-2 text-sm border border-[#e2e5f0] rounded-[8px] focus:outline-none focus:border-primary bg-[#f9fafb]" />
                <p className="text-[11px] text-[#9196b0]">Aus der Gruppen-URL: facebook.com/groups/<b>ID</b></p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#5f647e]">Gruppenname (optional)</label>
                <input value={form.group_name} onChange={f('group_name')}
                  placeholder="z.B. Meine Gruppe"
                  className="w-full px-3 py-2 text-sm border border-[#e2e5f0] rounded-[8px] focus:outline-none focus:border-primary bg-[#f9fafb]" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#5f647e]">Post-Text *</label>
              <textarea value={form.post_text} onChange={f('post_text')}
                rows={4} placeholder="Dein Beitrags-Text…"
                className="w-full px-3 py-2 text-sm border border-[#e2e5f0] rounded-[8px] focus:outline-none focus:border-primary bg-[#f9fafb] resize-none" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#5f647e]">Kommentar-Text * <span className="font-normal text-[#9196b0]">(wird automatisch nach dem Post gepostet)</span></label>
              <textarea value={form.comment_text} onChange={f('comment_text')}
                rows={3} placeholder="Kommentar der automatisch gepostet wird…"
                className="w-full px-3 py-2 text-sm border border-[#e2e5f0] rounded-[8px] focus:outline-none focus:border-primary bg-[#f9fafb] resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#5f647e]">Bild-URL (optional)</label>
                <input value={form.image_url} onChange={f('image_url')}
                  type="url" placeholder="https://…"
                  className="w-full px-3 py-2 text-sm border border-[#e2e5f0] rounded-[8px] focus:outline-none focus:border-primary bg-[#f9fafb]" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#5f647e]">Hintergrundfarbe</label>
                <select value={form.post_color} onChange={f('post_color')}
                  className="w-full px-3 py-2 text-sm border border-[#e2e5f0] rounded-[8px] focus:outline-none focus:border-primary bg-[#f9fafb]">
                  {POST_COLORS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#5f647e]">Geplant für (optional)</label>
              <input value={form.scheduled_at} onChange={f('scheduled_at')}
                type="datetime-local"
                className="w-full px-3 py-2 text-sm border border-[#e2e5f0] rounded-[8px] focus:outline-none focus:border-primary bg-[#f9fafb]" />
              <p className="text-[11px] text-[#9196b0]">Leer lassen = sofort wenn du auf "Starten" klickst</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-[10px] text-sm font-semibold transition-colors disabled:opacity-50">
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
              <button onClick={() => { setShowForm(false); setForm(EMPTY); setError(null) }}
                className="px-5 py-2.5 border border-[#e2e5f0] text-[#5f647e] rounded-[10px] text-sm hover:bg-[#f4f6fb] transition-colors">
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-14 text-center">
            <div className="text-5xl mb-3">📅</div>
            <p className="font-semibold text-[#1a1d2e] mb-1">Noch keine geplanten Posts</p>
            <p className="text-sm text-[#9196b0]">Klicke auf "+ Neuer Post" um anzufangen</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                isRunning={runningId === post.id}
                onRun={() => handleRun(post)}
                onDelete={() => handleDelete(post.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function PostCard({ post, isRunning, onRun, onDelete }) {
  const canRun = post.status === 'pending' || post.status === 'error'
  const statusColor = STATUS_COLORS[post.status] || STATUS_COLORS.pending
  const statusLabel = STATUS_LABELS[post.status] || post.status

  return (
    <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${statusColor}`}>
              {statusLabel}
            </span>
            <span className="text-xs font-semibold text-[#1a1d2e]">
              {post.group_name || `Gruppe ${post.group_id}`}
            </span>
            {post.scheduled_at && (
              <span className="text-[11px] text-[#9196b0]">
                · {new Date(post.scheduled_at).toLocaleString('de-DE')}
              </span>
            )}
            <span className="text-[11px] text-[#c4c7d6] ml-auto">
              {new Date(post.created_at).toLocaleDateString('de-DE')}
            </span>
          </div>

          {/* Post text */}
          <p className="text-sm text-[#1a1d2e] leading-relaxed line-clamp-2 mb-2">{post.post_text}</p>

          {/* Comment */}
          <div className="flex items-start gap-1.5 bg-[#f4f6fb] rounded-[8px] px-3 py-2">
            <span className="text-xs shrink-0 mt-px">💬</span>
            <p className="text-xs text-[#5f647e] line-clamp-1">{post.comment_text}</p>
          </div>

          {/* Error */}
          {post.error_message && (
            <p className="text-[11px] text-red-500 mt-2 bg-red-50 rounded-[6px] px-2.5 py-1.5">
              {post.error_message}
            </p>
          )}

          {/* FB Post ID */}
          {post.fb_post_id && (
            <p className="text-[11px] text-emerald-600 mt-1.5 font-medium">
              ✓ Post-ID: {post.fb_post_id}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 shrink-0">
          {canRun && (
            <button onClick={onRun} disabled={isRunning}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-[8px] text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap">
              {isRunning
                ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Läuft…</>
                : <>▶ Starten</>}
            </button>
          )}
          <button onClick={onDelete} disabled={isRunning}
            className="px-3.5 py-2 border border-[#e2e5f0] text-[#9196b0] rounded-[8px] text-xs hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors disabled:opacity-50">
            Löschen
          </button>
        </div>
      </div>
    </div>
  )
}
