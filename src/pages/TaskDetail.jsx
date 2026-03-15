import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'

export default function TaskDetail() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const [task, setTask] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [taskId])

  async function load() {
    setLoading(true)
    const [taskRes, resultsRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('task_id', taskId).maybeSingle(),
      supabase.from('task_results').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
    ])
    setTask(taskRes.data)
    setResults(resultsRes.data || [])
    setLoading(false)
  }

  async function updateStatus(status) {
    await supabase.from('tasks').update({ status }).eq('task_id', taskId)
    setTask(prev => ({ ...prev, status }))
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
  }

  if (!task) {
    return (
      <>
        <PageHeader title="Task Not Found" />
        <div className="p-7 text-center text-[#9196b0]">
          <p className="mb-4">This task does not exist.</p>
          <button onClick={() => navigate('/tasks')} className="text-primary font-semibold hover:underline">Back to Tasks</button>
        </div>
      </>
    )
  }

  const progress = task.max_request > 0
    ? Math.min(100, Math.round(((task.friend_request_sent || 0) / task.max_request) * 100))
    : 0

  return (
    <>
      <PageHeader title={task.task_name || task.task_id}>
        {task.status === 'inprogress' && (
          <button onClick={() => updateStatus('stopped')} className="px-4 py-2 text-sm font-semibold bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors">
            Stop
          </button>
        )}
        {(task.status === 'stopped' || task.status === 'pending') && (
          <button onClick={() => updateStatus('inprogress')} className="px-4 py-2 text-sm font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
            Resume
          </button>
        )}
        <button onClick={() => navigate('/tasks')} className="px-4 py-2 text-sm font-semibold text-[#9196b0] hover:text-[#1a1d2e] transition-colors">
          Back
        </button>
      </PageHeader>

      <div className="p-7 space-y-6">
        <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoItem label="Status" value={<StatusBadge status={task.status} />} />
            <InfoItem label="Task Type" value={task.task_name} />
            <InfoItem label="Created" value={new Date(task.created_at).toLocaleString('de')} />
            <InfoItem label="Max Requests" value={task.max_request || '-'} />
          </div>

          {task.process_url && (
            <div>
              <span className="text-[10px] text-[#9196b0] uppercase tracking-wide font-bold">URL</span>
              <a href={task.process_url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline mt-1 truncate">
                {task.process_url}
              </a>
            </div>
          )}

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-xs font-semibold text-[#9196b0]">Progress</span>
              <span className="text-xs font-bold text-[#1a1d2e]">{task.friend_request_sent || 0} / {task.max_request || '-'} ({progress}%)</span>
            </div>
            <div className="w-full h-3 bg-[#f4f6fb] rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm">
          <div className="px-[22px] py-4 border-b border-[#e2e5f0] flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-[#1a1d2e]">Results ({results.length})</h3>
          </div>

          {results.length === 0 ? (
            <div className="p-12 text-center text-[#9196b0] text-sm">No results yet.</div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto divide-y divide-[#e2e5f0]">
              {results.map(r => {
                const data = parseResult(r.result)
                return (
                  <div key={r.result_id || r.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[rgba(24,119,242,0.03)] transition-colors">
                    <img
                      src={data.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || '?')}&background=e2e5f0&color=1a1d2e&size=40`}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1a1d2e] truncate">{data.name || 'Unknown'}</p>
                      {data.username && <p className="text-[11px] text-[#9196b0] truncate">@{data.username}</p>}
                    </div>
                    <StatusBadge status={data.status || 'completed'} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function InfoItem({ label, value }) {
  return (
    <div>
      <span className="text-[10px] text-[#9196b0] uppercase tracking-wide font-bold">{label}</span>
      <div className="text-sm font-semibold text-[#1a1d2e] mt-1">{value}</div>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-[#f1f3f9] text-[#9196b0]',
    inprogress: 'bg-blue-50 text-blue-600',
    completed: 'bg-emerald-50 text-emerald-600',
    stopped: 'bg-amber-50 text-amber-600',
    blocked: 'bg-red-50 text-red-600',
    sent: 'bg-emerald-50 text-emerald-600',
    failed: 'bg-red-50 text-red-600',
  }
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${styles[status] || styles.completed}`}>{status}</span>
}

function parseResult(result) {
  if (!result) return {}
  if (typeof result === 'string') {
    try { return JSON.parse(result) } catch { return { name: result } }
  }
  return result
}
