import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { t } from '../lib/i18n'

export default function Results() {
  const [tasks, setTasks] = useState([])
  const [selectedTask, setSelectedTask] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingResults, setLoadingResults] = useState(false)

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    const { data } = await supabase.from('tasks').select('task_id, task_name, created_at').order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  async function loadResults(taskId) {
    setSelectedTask(taskId)
    if (!taskId) { setResults([]); return }
    setLoadingResults(true)
    const { data } = await supabase.from('task_results').select('*').eq('task_id', taskId).order('created_at', { ascending: false })
    setResults(data || [])
    setLoadingResults(false)
  }

  function exportCSV() {
    if (!results.length) return
    const rows = [['Name', 'Username', 'FB User ID', 'Bio', 'Friendship Status', 'Mutual Friends', 'Profile Link', 'Date']]
    results.forEach(r => {
      const d = parseResult(r.result)
      rows.push([
        d.name || '', d.userName || '', d.fbUserId || '', (d.bioText || '').replace(/"/g, "'"),
        d.friendshipStatus || '', d.mutualCount || '',
        d.userName ? `https://facebook.com/${d.userName}` : '', r.created_at || ''
      ])
    })
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `results-${selectedTask}.csv`
    a.click()
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>

  return (
    <>
      <PageHeader title={t('results.title')}>
        {results.length > 0 && (
          <button onClick={exportCSV} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {t('results.export_csv')}
          </button>
        )}
      </PageHeader>

      <div className="p-7 space-y-5">
        <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-5">
          <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-2">{t('results.select_task')}</label>
          <select value={selectedTask} onChange={e => loadResults(e.target.value)}
            className="w-full max-w-md border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="">{t('results.select_option')}</option>
            {tasks.map(task => (
              <option key={task.task_id} value={task.task_id}>
                {t('tasktype.' + task.task_name) || task.task_name} ({new Date(task.created_at).toLocaleDateString('de')})
              </option>
            ))}
          </select>
        </div>

        {selectedTask && (
          <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm">
            <div className="px-[22px] py-4 border-b border-[#e2e5f0] flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-[#1a1d2e]">{results.length} {t('detail.results')}</h3>
            </div>

            {loadingResults ? (
              <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : results.length === 0 ? (
              <div className="p-12 text-center text-[#9196b0] text-sm">{t('results.no_results')}</div>
            ) : (
              <div className="divide-y divide-[#f4f6fb]">
                {results.map(r => {
                  const d = parseResult(r.result)
                  const profileUrl = d.userName ? `https://facebook.com/${d.userName}` : (d.fbUserId ? `https://facebook.com/profile.php?id=${d.fbUserId}` : null)
                  return (
                    <div key={r.result_id || r.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[rgba(24,119,242,0.02)] transition-colors">
                      {/* Profile Picture */}
                      <img
                        src={d.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name || '?')}&background=e2e5f0&color=5f647e&size=48&bold=true`}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-[#e2e5f0]"
                        onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name || '?')}&background=e2e5f0&color=5f647e&size=48&bold=true` }}
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#1a1d2e]">{d.name || 'Unknown'}</p>
                          <FriendshipBadge status={d.friendshipStatus} />
                        </div>
                        {d.userName && <p className="text-xs text-[#9196b0]">@{d.userName}</p>}
                        {d.bioText && <p className="text-xs text-[#5f647e] mt-0.5 line-clamp-1">{d.bioText}</p>}
                      </div>

                      {/* Mutual Friends */}
                      {d.mutualCount && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] text-[#9196b0] uppercase tracking-wide">Gemeinsam</p>
                          <p className="text-xs font-semibold text-[#1a1d2e]">{d.mutualCount}</p>
                        </div>
                      )}

                      {/* Profile Link */}
                      {profileUrl && (
                        <a href={profileUrl} target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 p-2 rounded-lg hover:bg-[rgba(24,119,242,0.08)] text-[#9196b0] hover:text-primary transition-colors">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function FriendshipBadge({ status }) {
  if (!status) return null
  const styles = {
    'ARE_FRIENDS': { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Freund' },
    'ALREADY_FRIENDS': { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Freund' },
    'NOT_FRIEND': { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Kein Freund' },
    'CAN_REQUEST': { bg: 'bg-blue-50', text: 'text-blue-600', label: 'Anfrage möglich' },
    'OUTGOING_REQUEST': { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Anfrage gesendet' },
    'INCOMING_REQUEST': { bg: 'bg-purple-50', text: 'text-purple-600', label: 'Anfrage erhalten' },
  }
  const s = styles[status] || { bg: 'bg-gray-100', text: 'text-gray-500', label: status }
  return <span className={`${s.bg} ${s.text} px-2 py-0.5 rounded-full text-[9px] font-semibold`}>{s.label}</span>
}

function parseResult(result) {
  if (!result) return {}
  if (typeof result === 'string') {
    try { return JSON.parse(result) } catch { return { name: result } }
  }
  return result
}
