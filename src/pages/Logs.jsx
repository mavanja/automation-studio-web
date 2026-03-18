import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { t } from '../lib/i18n'
import { useRealtimeTable } from '../hooks/useRealtimeTable'

const TYPE_STYLES = {
  info: 'bg-blue-50 text-blue-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  error: 'bg-red-50 text-red-600',
}

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  useRealtimeTable('activity_logs', {
    onInsert: (row) => setLogs(prev => [row, ...prev]),
    onUpdate: (row) => setLogs(prev => prev.map(l => l.id === row.id ? { ...l, ...row } : l)),
    onDelete: (row) => setLogs(prev => prev.filter(l => l.id !== row.id)),
  })

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    setLogs(data || [])
    setLoading(false)
  }

  async function clearLogs() {
    if (!window.confirm(t('logs.clear_confirm'))) return
    await supabase.from('activity_logs').delete().neq('id', 0)
    setLogs([])
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <>
      <PageHeader title={t('logs.title')}>
        {logs.length > 0 && (
          <button onClick={clearLogs} className="px-4 py-2 text-sm font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
            {t('logs.clear')}
          </button>
        )}
      </PageHeader>

      <div className="p-7">
        <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-[#9196b0] text-sm">{t('logs.no_logs')}</div>
          ) : (
            <div className="max-h-[700px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0">
                  <tr className="bg-[#f4f6fb]">
                    <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold w-[180px]">{t('logs.time')}</th>
                    <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold w-[100px]">{t('logs.type')}</th>
                    <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('logs.message')}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-[rgba(24,119,242,0.03)] transition-colors border-t border-[#e2e5f0]">
                      <td className="px-4 py-3 text-xs text-[#9196b0] font-mono whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('de')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold ${TYPE_STYLES[log.type] || TYPE_STYLES.info}`}>
                          {log.type || 'info'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#1a1d2e]">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
