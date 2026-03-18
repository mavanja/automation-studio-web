import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { t } from '../lib/i18n'
import { useRealtimeTable } from '../hooks/useRealtimeTable'

export default function Dashboard() {
  const [stats, setStats] = useState({})
  const [profile, setProfile] = useState(null)
  const [recentTasks, setRecentTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  // Realtime: live update recent tasks list
  useRealtimeTable('tasks', {
    onInsert: (row) => setRecentTasks(prev => [row, ...prev].slice(0, 10)),
    onUpdate: (row) => setRecentTasks(prev => prev.map(t => t.id === row.id ? { ...t, ...row } : t)),
    onDelete: (row) => setRecentTasks(prev => prev.filter(t => t.id !== row.id)),
  })

  async function load() {
    const [tasksRes, friendsRes, profileRes, groupsRes, resultsRes] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('fb_friends').select('id', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*').limit(1).maybeSingle(),
      supabase.from('fb_groups').select('id', { count: 'exact', head: true }),
      supabase.from('task_results').select('id', { count: 'exact', head: true }),
    ])
    const tasks = tasksRes.data || []
    setStats({
      total: tasks.length,
      active: tasks.filter(t => t.status === 'inprogress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      friends: friendsRes.count || 0,
      results: resultsRes.count || 0,
      groups: groupsRes.count || 0,
    })
    setProfile(profileRes.data)
    setRecentTasks(tasks.slice(0, 8))
    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>

  return (
    <>
      <PageHeader title={t('nav.dashboard')} />
      <div className="p-7 space-y-7">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label={t('dash.total_tasks')} value={stats.total} />
          <StatCard label={t('dash.active_tasks')} value={stats.active} />
          <StatCard label={t('dash.completed')} value={stats.completed} />
          <StatCard label={t('dash.friends_synced')} value={stats.friends} />
          <StatCard label={t('dash.total_results')} value={stats.results} />
          <StatCard label={t('dash.groups_tracked')} value={stats.groups} />
        </div>

        <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm">
          <div className="flex items-center justify-between px-[22px] py-4 border-b border-[#e2e5f0]">
            <h3 className="text-[15px] font-bold text-[#1a1d2e]">{t('dash.recent_tasks')}</h3>
            <Link to="/tasks" className="text-xs text-primary font-semibold hover:underline">{t('dash.view_all')}</Link>
          </div>
          {recentTasks.length === 0 ? (
            <div className="p-12 text-center text-[#9196b0] text-sm">{t('dash.no_tasks')}</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#f4f6fb]">
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.task')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.url')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.status')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.progress')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.created')}</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map(task => (
                  <tr key={task.id} className="hover:bg-[rgba(24,119,242,0.03)] transition-colors">
                    <td className="px-4 py-3.5"><Link to={`/tasks/${task.task_id}`} className="font-semibold text-sm text-[#1a1d2e] hover:text-primary">{t('tasktype.' + task.task_name) || task.task_name || task.task_id}</Link></td>
                    <td className="px-4 py-3.5 text-[11px] text-[#9196b0] max-w-[250px] truncate">{task.process_url || '-'}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={task.status} /></td>
                    <td className="px-4 py-3.5 text-sm text-[#1a1d2e]">{task.friend_request_sent || 0} / {task.max_request || '-'}</td>
                    <td className="px-4 py-3.5 text-sm text-[#9196b0]">{new Date(task.created_at).toLocaleDateString('de')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
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
