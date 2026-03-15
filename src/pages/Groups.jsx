import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { t } from '../lib/i18n'

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('fb_groups')
      .select('*')
      .order('member_count', { ascending: false })
    setGroups(data || [])
    setLoading(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <>
      <PageHeader title={t('groups.title')}>
        <span className="text-sm text-[#9196b0] font-semibold">{groups.length} {t('nav.groups')}</span>
      </PageHeader>

      <div className="p-7">
        {groups.length === 0 ? (
          <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-12 text-center text-[#9196b0] text-sm">
            {t('groups.no_groups')}
          </div>
        ) : (
          <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f4f6fb]">
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('groups.name')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('groups.members')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('groups.role')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">Link</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(group => (
                  <tr key={group.group_id || group.id} className="hover:bg-[rgba(24,119,242,0.03)] transition-colors border-t border-[#e2e5f0]">
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-semibold text-[#1a1d2e]">{group.group_name}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#1a1d2e]">
                      {group.member_count ? group.member_count.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3.5">
                      {group.is_admin ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                          {t('groups.admin')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[#f1f3f9] text-[#9196b0]">
                          {t('groups.member')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {group.group_url ? (
                        <a href={group.group_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline font-semibold">
                          {t('groups.open')}
                        </a>
                      ) : (
                        <span className="text-sm text-[#9196b0]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
