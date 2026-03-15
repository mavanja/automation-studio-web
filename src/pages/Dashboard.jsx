import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'

export default function Dashboard() {
  const [stats, setStats] = useState({})
  const [profile, setProfile] = useState(null)
  const [recentTasks, setRecentTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

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
      <PageHeader title="Dashboard" />
      <div className="p-7 space-y-7">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Aufgaben gesamt" value={stats.total} />
          <StatCard label="Aktive Aufgaben" value={stats.active} />
          <StatCard label="Abgeschlossen" value={stats.completed} />
          <StatCard label="Freunde sync." value={stats.friends} />
          <StatCard label="Ergebnisse gesamt" value={stats.results} />
          <StatCard label="Gruppen erfasst" value={stats.groups} />
        </div>

        <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm">
          <div className="flex items-center justify-between px-[22px] py-4 border-b border-[#e2e5f0]">
            <h3 className="text-[15px] font-bold text-[#1a1d2e]">Letzte Aufgaben</h3>
            <Link to="/tasks" className="text-xs text-primary font-semibold hover:underline">Alle anzeigen</Link>
          </div>
          {recentTasks.length === 0 ? (
            <div className="p-12 text-center text-[#9196b0] text-sm">Noch keine Aufgaben. Erstelle eine neue Aufgabe um zu starten.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#f4f6fb]">
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">Aufgabe</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">URL</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">Fortschritt</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">Erstellt</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map(task => (
                  <tr key={task.id} className="hover:bg-[rgba(24,119,242,0.03)] transition-colors">
                    <td className="px-4 py-3.5"><Link to={`/tasks/${task.task_id}`} className="font-semibold text-sm text-[#1a1d2e] hover:text-primary">{task.task_name || task.task_id}</Link></td>
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
