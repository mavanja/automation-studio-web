import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { t } from '../lib/i18n'

const TASK_TYPES = [
  { group: 'Lead Generation', options: [
    { value: 'leads-from-groups' },
    { value: 'leads-from-content' },
    { value: 'leads-from-peaple' },
    { value: 'leads-from-suggestions' },
  ]},
  { group: 'Engagement', options: [
    { value: 'contentToolsGainRaciprocity' },
    { value: 'contentToolsProspectByPost' },
    { value: 'contentToolsTagsForAttention' },
  ]},
  { group: 'Messaging', options: [
    { value: 'broadcast-message' },
  ]},
  { group: 'Friend Management', options: [
    { value: 'friends-sync' },
    { value: 'date-friended' },
    { value: 'cancel-friend-request' },
    { value: 'start-unfriending' },
    { value: 'scan-friend-activity' },
  ]},
]

const FILTERS = [
  { key: 'all', labelKey: 'tasks.all' },
  { key: 'inprogress', labelKey: 'tasks.inprogress' },
  { key: 'completed', labelKey: 'tasks.completed_filter' },
  { key: 'stopped', labelKey: 'tasks.stopped_filter' },
]

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ task_name: '', process_url: '', max_request: 50, message: '' })
  const [templates, setTemplates] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  async function loadTemplates() {
    const { data } = await supabase.from('message_templates').select('*')
    setTemplates(data || [])
  }

  function openModal() {
    loadTemplates()
    setForm({ task_name: '', process_url: '', max_request: 50, message: '' })
    setShowModal(true)
  }

  async function createTask(e) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const taskId = `${form.task_name}-${Date.now()}`
    const { error } = await supabase.from('tasks').insert({
      task_id: taskId,
      user_id: user.id,
      task_name: form.task_name,
      process_url: form.process_url,
      max_request: Number(form.max_request),
      message: form.message,
      status: 'pending',
      friend_request_sent: 0,
    })
    setSaving(false)
    if (!error) {
      setShowModal(false)
      loadTasks()
    }
  }

  async function startTask(taskId) {
    const task = tasks.find(t => t.task_id === taskId)
    if (!task) return

    // Update status in DB
    await supabase.from('tasks').update({ status: 'inprogress' }).eq('task_id', taskId)
    setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, status: 'inprogress' } : t))

    // Send command to extension to open Facebook tab
    try {
      const url = task.process_url
        ? `${task.process_url}${task.process_url.includes('?') ? '&' : '?'}taskId=${taskId}&sendRequest=true&taskFor=${task.task_name}`
        : `https://www.facebook.com/?taskId=${taskId}&sendRequest=true&taskFor=${task.task_name}`

      if (chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          'ehaendpolcffilhljadohefkgaaplfbg',
          { type: 'CREATE_TAB', data: { url, taskType: task.task_name, taskId, focusOnFb: true } },
          () => {}
        )
      } else {
        // Fallback: open URL directly
        window.open(url, '_blank')
      }
    } catch (err) {
      console.error('Could not send to extension:', err)
      // Fallback
      const url = task.process_url
        ? `${task.process_url}${task.process_url.includes('?') ? '&' : '?'}taskId=${taskId}&sendRequest=true&taskFor=${task.task_name}`
        : `https://www.facebook.com/?taskId=${taskId}&sendRequest=true&taskFor=${task.task_name}`
      window.open(url, '_blank')
    }
  }

  async function stopTask(taskId) {
    await supabase.from('tasks').update({ status: 'stopped' }).eq('task_id', taskId)
    setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, status: 'stopped' } : t))

    // Tell extension to stop
    try {
      if (chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          'ehaendpolcffilhljadohefkgaaplfbg',
          { type: 'STOP_TASK_PROGRESS' },
          () => {}
        )
      }
    } catch {}
  }

  async function deleteTask(taskId) {
    if (!window.confirm(t('tasks.delete_confirm'))) return
    await supabase.from('task_results').delete().eq('task_id', taskId)
    await supabase.from('tasks').delete().eq('task_id', taskId)
    setTasks(prev => prev.filter(t => t.task_id !== taskId))
  }

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <>
      <PageHeader title={t('tasks.title')}>
        <button onClick={openModal} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
          {t('tasks.new')}
        </button>
      </PageHeader>

      <div className="p-7 space-y-5">
        <div className="flex gap-2">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                filter === f.key
                  ? 'bg-primary text-white'
                  : 'bg-white border border-[#e2e5f0] text-[#9196b0] hover:text-[#1a1d2e]'
              }`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-[#9196b0] text-sm">{t('tasks.no_tasks')}</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#f4f6fb]">
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.task')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.url')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.status')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.progress')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.created')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(task => (
                  <tr key={task.task_id} className="hover:bg-[rgba(24,119,242,0.03)] transition-colors border-t border-[#e2e5f0]">
                    <td className="px-4 py-3.5">
                      <Link to={`/tasks/${task.task_id}`} className="font-semibold text-sm text-[#1a1d2e] hover:text-primary">
                        {t('tasktype.' + task.task_name) || task.task_name || task.task_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-[11px] text-[#9196b0] max-w-[200px] truncate">{task.process_url || '-'}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={task.status} /></td>
                    <td className="px-4 py-3.5 text-sm text-[#1a1d2e]">{task.friend_request_sent || 0} / {task.max_request || '-'}</td>
                    <td className="px-4 py-3.5 text-sm text-[#9196b0]">{new Date(task.created_at).toLocaleDateString('de')}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1.5">
                        {task.status !== 'inprogress' && (
                          <button onClick={() => startTask(task.task_id)} className="px-2.5 py-1 text-[10px] font-semibold bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors">
                            {t('tasks.start')}
                          </button>
                        )}
                        {task.status === 'inprogress' && (
                          <button onClick={() => stopTask(task.task_id)} className="px-2.5 py-1 text-[10px] font-semibold bg-amber-50 text-amber-600 rounded-md hover:bg-amber-100 transition-colors">
                            {t('tasks.stop')}
                          </button>
                        )}
                        <button onClick={() => deleteTask(task.task_id)} className="px-2.5 py-1 text-[10px] font-semibold bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors">
                          {t('tasks.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1d2e]">{t('tasks.create_title')}</h3>
            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">{t('tasks.type')}</label>
                <select
                  value={form.task_name}
                  onChange={e => setForm({ ...form, task_name: e.target.value })}
                  required
                  className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">{t('tasks.type')}...</option>
                  {TASK_TYPES.map(group => (
                    <optgroup key={group.group} label={group.group}>
                      {group.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{t('tasktype.' + opt.value) || opt.value}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">{t('tasks.fb_url')}</label>
                <input
                  type="url"
                  value={form.process_url}
                  onChange={e => setForm({ ...form, process_url: e.target.value })}
                  placeholder={t('tasks.fb_url_placeholder')}
                  className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">{t('tasks.max_requests')}</label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={form.max_request}
                  onChange={e => setForm({ ...form, max_request: e.target.value })}
                  className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">{t('tasks.template')}</label>
                <select
                  value={form.message}
                  onChange={e => setForm({ ...form, message: e.target.value })}
                  className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">{t('tasks.template_none')}</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.template_body}>{t.template_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-[#9196b0] hover:text-[#1a1d2e] transition-colors">
                  {t('tasks.cancel')}
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {saving ? t('tasks.creating') : t('tasks.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-[#f1f3f9] text-[#9196b0]',
    inprogress: 'bg-blue-50 text-blue-600',
    completed: 'bg-emerald-50 text-emerald-600',
    stopped: 'bg-amber-50 text-amber-600',
    blocked: 'bg-red-50 text-red-600',
  }
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${styles[status] || styles.pending}`}>{status}</span>
}
