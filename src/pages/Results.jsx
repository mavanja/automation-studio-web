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
    const { data } = await supabase
      .from('tasks')
      .select('task_id, task_name, created_at')
      .order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  async function loadResults(taskId) {
    setSelectedTask(taskId)
    if (!taskId) { setResults([]); return }
    setLoadingResults(true)
    const { data } = await supabase
      .from('task_results')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
    setResults(data || [])
    setLoadingResults(false)
  }

  function exportCSV() {
    if (results.length === 0) return

    const rows = results.map(r => {
      const data = parseResult(r.result)
      return {
        name: data.name || '',
        username: data.username || '',
        profile_link: data.profile_link || '',
        status: data.status || '',
        created_at: r.created_at || '',
      }
    })

    const header = Object.keys(rows[0]).join(',')
    const csv = [header, ...rows.map(row =>
      Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    )].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `results-${selectedTask}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <>
      <PageHeader title={t('results.title')}>
        {results.length > 0 && (
          <button onClick={exportCSV} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            {t('results.export_csv')}
          </button>
        )}
      </PageHeader>

      <div className="p-7 space-y-5">
        <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-5">
          <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-2">{t('results.select_task')}</label>
          <select
            value={selectedTask}
            onChange={e => loadResults(e.target.value)}
            className="w-full max-w-md border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">{t('results.select_option')}</option>
            {tasks.map(task => (
              <option key={task.task_id} value={task.task_id}>
                {t('tasktype.' + task.task_name) || task.task_name || task.task_id} ({new Date(task.created_at).toLocaleDateString('de')})
              </option>
            ))}
          </select>
        </div>

        {selectedTask && (
          <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm">
            <div className="px-[22px] py-4 border-b border-[#e2e5f0]">
              <h3 className="text-[15px] font-bold text-[#1a1d2e]">{results.length} {t('detail.results')}</h3>
            </div>

            {loadingResults ? (
              <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : results.length === 0 ? (
              <div className="p-12 text-center text-[#9196b0] text-sm">{t('results.no_results')}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-5">
                {results.map(r => {
                  const data = parseResult(r.result)
                  return (
                    <div key={r.result_id || r.id} className="bg-[#f4f6fb] rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                      <img
                        src={data.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || '?')}&background=e2e5f0&color=1a1d2e&size=44`}
                        alt=""
                        className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#1a1d2e] truncate">{data.name || 'Unknown'}</p>
                        {data.username && <p className="text-[11px] text-[#9196b0] truncate">@{data.username}</p>}
                        {data.profile_link && (
                          <a href={data.profile_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">
                            {t('friends.profile')}
                          </a>
                        )}
                      </div>
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

function parseResult(result) {
  if (!result) return {}
  if (typeof result === 'string') {
    try { return JSON.parse(result) } catch { return { name: result } }
  }
  return result
}
