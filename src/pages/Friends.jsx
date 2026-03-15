import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { t } from '../lib/i18n'

export default function Friends() {
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('fb_friends')
      .select('*')
      .order('name', { ascending: true })
    setFriends(data || [])
    setLoading(false)
  }

  const filtered = search
    ? friends.filter(f =>
        (f.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (f.username || '').toLowerCase().includes(search.toLowerCase())
      )
    : friends

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <>
      <PageHeader title={t('friends.title')}>
        <span className="text-sm text-[#9196b0] font-semibold">{t('friends.count', { count: friends.length })}</span>
      </PageHeader>

      <div className="p-7 space-y-5">
        <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('friends.search')}
            className="w-full max-w-sm border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-12 text-center text-[#9196b0] text-sm">
            {search ? t('friends.no_friends') : t('friends.no_friends')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(friend => (
              <div key={friend.connected_fb_id || friend.id} className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                <img
                  src={friend.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.name || '?')}&background=e2e5f0&color=1a1d2e&size=44`}
                  alt=""
                  className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1a1d2e] truncate">{friend.name || 'Unknown'}</p>
                  {friend.username && <p className="text-[11px] text-[#9196b0] truncate">@{friend.username}</p>}
                  {friend.profile_link && (
                    <a href={friend.profile_link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">
                      {t('friends.profile')}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
