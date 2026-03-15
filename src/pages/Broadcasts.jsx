import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { t } from '../lib/i18n'

export default function Broadcasts() {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: broadcastLists } = await supabase
      .from('broadcast_lists')
      .select('*')
      .order('created_at', { ascending: false })

    if (!broadcastLists || broadcastLists.length === 0) {
      setLists([])
      setLoading(false)
      return
    }

    const listIds = broadcastLists.map(l => l.id)
    const { data: users } = await supabase
      .from('broadcast_list_users')
      .select('broadcast_list_id')
      .in('broadcast_list_id', listIds)

    const countMap = {}
    for (const u of (users || [])) {
      countMap[u.broadcast_list_id] = (countMap[u.broadcast_list_id] || 0) + 1
    }

    const enriched = broadcastLists.map(list => ({
      ...list,
      user_count: countMap[list.id] || 0,
    }))

    setLists(enriched)
    setLoading(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <>
      <PageHeader title={t('broadcasts.title')} />

      <div className="p-7">
        {lists.length === 0 ? (
          <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-12 text-center text-[#9196b0] text-sm">
            {t('broadcasts.no_lists')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {lists.map(list => (
              <div key={list.id} className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-[#1a1d2e] truncate">{list.list_name}</h3>
                    <p className="text-[11px] text-[#9196b0]">{list.user_count} {t('broadcasts.users')}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[#e2e5f0]">
                  <span className="text-[10px] text-[#9196b0]">
                    {list.created_at ? new Date(list.created_at).toLocaleDateString('de') : ''}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-1 bg-[#f4f6fb] rounded-full text-[11px] font-semibold text-[#1a1d2e]">
                    {list.user_count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
