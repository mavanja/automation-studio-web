import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { t } from '../lib/i18n'

const STEPS = [
  {
    id: 'leads-groups',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    titleKey: 'assistant.leads_groups',
    descKey: 'assistant.leads_groups_desc',
    taskType: 'GET_LEADS_API_EXTERNAL',
    subTaskType: 'GET_LEADS_FOR_GROUPS',
    taskName: 'leads-from-groups',
    hasSettings: true,
    settingsType: 'groups',
  },
  {
    id: 'leads-content',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
    titleKey: 'assistant.leads_content',
    descKey: 'assistant.leads_content_desc',
    taskType: 'GET_LEADS_API_EXTERNAL',
    subTaskType: 'GET_LEADS_FOR_CONTENT',
    taskName: 'leads-from-content',
    hasSettings: true,
    settingsType: 'content',
  },
  {
    id: 'approve-groups',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
    titleKey: 'assistant.approve_groups',
    descKey: 'assistant.approve_groups_desc',
    taskType: 'MANAGE_GROUP_API_EXTERNAL',
    taskName: 'manageGroupInvites',
    hasSettings: false,
  },
  {
    id: 'broadcast',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
    titleKey: 'assistant.broadcast',
    descKey: 'assistant.broadcast_desc',
    taskType: 'BROADCAST_MESSAGE_API_EXTERNAL',
    taskName: 'broadcast-message',
    hasSettings: true,
    settingsType: 'broadcast',
  },
  {
    id: 'friends-sync',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
    titleKey: 'assistant.friends_sync',
    descKey: 'assistant.friends_sync_desc',
    taskType: 'FRIENDS_SYNC_API_EXTERNAL',
    taskName: 'friends-sync',
    hasSettings: false,
  },
  {
    id: 'gain-reciprocity',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
    titleKey: 'assistant.reciprocity',
    descKey: 'assistant.reciprocity_desc',
    taskType: 'GAIN_RECIPROCITY_API_EXTERNAL',
    taskName: 'contentToolsGainRaciprocity',
    hasSettings: false,
  },
]

const DEFAULT_SETTINGS = {
  url: '',
  maxRequests: 50,
  thingsInCommon: true,
  mutualFriendCount: 0,
  targetKeywords: '',
  avoidKeywords: '',
  filterFromType: 'comments',
  messageTemplateId: '',
  maxMessageCount: 50,
}

const STATUS_STYLES = {
  waiting: { bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-300', text: 'text-gray-400' },
  running: { bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500 animate-pulse', text: 'text-blue-600' },
  done: { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  error: { bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', text: 'text-red-600' },
  skipped: { bg: 'bg-gray-50', border: 'border-gray-100', dot: 'bg-gray-200', text: 'text-gray-300' },
}

export default function DailyAssistant() {
  const [steps, setSteps] = useState(
    STEPS.map(s => ({ ...s, enabled: false, settings: { ...DEFAULT_SETTINGS }, status: 'waiting', showSettings: false }))
  )
  const [running, setRunning] = useState(false)
  const [groups, setGroups] = useState([])
  const [templates, setTemplates] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [g, t] = await Promise.all([
      supabase.from('fb_groups').select('*'),
      supabase.from('message_templates').select('*'),
    ])
    setGroups(g.data || [])
    setTemplates(t.data || [])
  }

  const [refreshing, setRefreshing] = useState(false)

  async function refreshGroups() {
    setRefreshing(true)
    try {
      const EXT_ID = 'ehaendpolcffilhljadohefkgaaplfbg'
      if (typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
        console.log('[AS Web] Sending FETCH_MANAGED_GROUPS to extension...')
        chrome.runtime.sendMessage(EXT_ID, { type: 'FETCH_MANAGED_GROUPS' }, async (response) => {
          console.log('[AS Web] Extension response:', response)
          if (response?.groups?.length) {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              // Delete old groups first, then insert fresh
              await supabase.from('fb_groups').delete().eq('user_id', user.id)
              const rows = response.groups.map(g => ({
                user_id: user.id,
                group_id: g.groupId,
                group_name: g.groupName,
                member_count: g.memberCount || 0,
                is_admin: false,
                group_url: g.url || 'https://www.facebook.com/groups/' + g.groupId,
              }))
              await supabase.from('fb_groups').insert(rows)
              console.log('[AS Web] Saved', rows.length, 'groups to Supabase')
            }
          }
          const { data } = await supabase.from('fb_groups').select('*')
          console.log('[AS Web] Loaded groups from Supabase:', data?.length)
          setGroups(data || [])
          setRefreshing(false)
        })
      } else {
        console.warn('[AS Web] chrome.runtime.sendMessage not available')
        setRefreshing(false)
      }
    } catch (e) {
      console.error('[AS Web] refreshGroups error:', e)
    }
  }

  function toggleStep(id) {
    if (running) return
    setSteps(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  function toggleSettings(id) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, showSettings: !s.showSettings } : s))
  }

  function updateSetting(id, key, value) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, settings: { ...s.settings, [key]: value } } : s))
  }

  async function startAssistant() {
    const enabled = steps.filter(s => s.enabled)
    if (enabled.length === 0) return
    setRunning(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (!step.enabled) {
        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'skipped' } : s))
        continue
      }
      setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'running' } : s))

      try {
        const taskId = `${step.taskName}-${Date.now()}`
        const s = step.settings

        const message = {
          processUrl: s.url,
          subTask: step.subTaskType,
          isDailyWizardTask: true,
          thingsInCommon: s.thingsInCommon,
          mutualFriendCount: Number(s.mutualFriendCount) || 0,
          targetKeywords: s.targetKeywords ? s.targetKeywords.split(',').map(k => k.trim()).filter(Boolean) : [],
          avoidKeywords: s.avoidKeywords ? s.avoidKeywords.split(',').map(k => k.trim()).filter(Boolean) : [],
          filterFromType: s.filterFromType,
          messageTemplateId: s.messageTemplateId,
          maxMessageCount: Number(s.maxMessageCount) || 50,
          country: '',
          gender: '',
        }

        await supabase.from('tasks').insert({
          task_id: taskId, user_id: user.id, task_name: step.taskName,
          process_url: s.url, max_request: Number(s.maxRequests) || 50,
          status: 'inprogress', friend_request_sent: 0, message,
        })

        let groupId = ''
        if (s.url?.includes('/groups/')) {
          groupId = s.url.split('/groups/')[1]?.split('/')[0]?.split('?')[0] || ''
        }
        const baseUrl = s.url || 'https://www.facebook.com'
        const taskUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'ypwSource=t'

        const taskData = {
          url: taskUrl,
          taskType: step.taskType,
          subTaskType: step.subTaskType || step.taskName,
          userName: profile?.fb_user_name || profile?.fb_user_id || '',
          focusOnFb: true, isDailyWizardTask: true,
          cursorTimeGapMin: 500, cursorTimeGapMax: 1000,
          task: { taskId, taskName: step.taskName, status: 'inprogress', maxRequest: Number(s.maxRequests), friendRequestSent: 0, processUrl: s.url, groupId, facebookUserName: profile?.fb_user_name || '', facebookUserId: profile?.fb_user_id || '', message: { ...message, groupId } },
        }

        try {
          if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage('ehaendpolcffilhljadohefkgaaplfbg', { type: 'CREATE_TAB', data: taskData }, () => {})
          }
        } catch {}

        await new Promise(r => setTimeout(r, 3000))
        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'done' } : s))
      } catch {
        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'error' } : s))
      }
    }
    setRunning(false)
  }

  function resetAssistant() {
    setSteps(prev => prev.map(s => ({ ...s, status: 'waiting' })))
    setRunning(false)
  }

  const enabledCount = steps.filter(s => s.enabled).length

  return (
    <>
      <PageHeader title={t('assistant.title')}>
        {!running ? (
          <button onClick={startAssistant} disabled={enabledCount === 0}
            className="px-5 py-2.5 bg-gradient-to-r from-primary to-[#42a5f5] text-white rounded-[10px] text-sm font-semibold shadow-[0_2px_10px_rgba(24,119,242,0.15)] hover:shadow-[0_6px_20px_rgba(24,119,242,0.25)] hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:hover:translate-y-0 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            {t('assistant.start')} ({enabledCount})
          </button>
        ) : (
          <button onClick={resetAssistant} className="px-5 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-[10px] text-sm font-semibold hover:bg-red-100 transition-all">
            {t('assistant.stop')}
          </button>
        )}
      </PageHeader>

      <div className="p-7">
        <div className="bg-gradient-to-br from-[#1a1d2e] to-[#2d3148] rounded-[18px] p-8 mb-7 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <h2 className="text-2xl font-extrabold tracking-tight mb-2">{t('assistant.hero_title')}</h2>
            <p className="text-sm text-gray-300 max-w-lg">{t('assistant.hero_desc')}</p>
          </div>
        </div>

        <div className="space-y-3">
          {steps.map((step, idx) => {
            const style = STATUS_STYLES[step.status]
            return (
              <div key={step.id} className={`${style.bg} border ${style.border} rounded-[14px] transition-all ${step.enabled && step.status === 'waiting' ? 'border-primary/30 shadow-[0_0_0_1px_rgba(24,119,242,0.1)]' : ''}`}>
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="pt-0.5">
                      {step.status === 'waiting' ? (
                        <button onClick={() => toggleStep(step.id)}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${step.enabled ? 'bg-primary border-primary' : 'border-gray-300 hover:border-primary/50'}`}>
                          {step.enabled && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </button>
                      ) : (
                        <div className={`w-6 h-6 rounded-full ${style.dot} flex items-center justify-center`}>
                          {step.status === 'done' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          {step.status === 'error' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                          {step.status === 'running' && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                        </div>
                      )}
                    </div>

                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${step.enabled || step.status !== 'waiting' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                      {step.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-sm font-semibold ${step.enabled || step.status !== 'waiting' ? 'text-[#1a1d2e]' : 'text-gray-400'}`}>
                          {t(step.titleKey)}
                        </h3>
                        {step.status !== 'waiting' && step.status !== 'skipped' && (
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${style.text}`}>
                            {step.status === 'running' ? t('assistant.status_running') : step.status === 'done' ? t('assistant.status_done') : t('assistant.status_error')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#9196b0]">{t(step.descKey)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {step.hasSettings && step.enabled && step.status === 'waiting' && (
                        <button onClick={() => toggleSettings(step.id)}
                          className={`p-2 rounded-lg transition-all ${step.showSettings ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100 text-gray-400'}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                          </svg>
                        </button>
                      )}
                      <span className={`text-xs font-bold ${step.enabled ? 'text-primary' : 'text-gray-300'}`}>#{idx + 1}</span>
                    </div>
                  </div>
                </div>

                {/* Settings Panel */}
                {step.enabled && step.showSettings && step.status === 'waiting' && (
                  <div className="border-t border-[#e2e5f0] bg-white/60 rounded-b-[14px] p-5">
                    {step.settingsType === 'groups' && (
                      <GroupSettings step={step} groups={groups} onChange={(k, v) => updateSetting(step.id, k, v)} onRefreshGroups={refreshGroups} />
                    )}
                    {step.settingsType === 'content' && (
                      <ContentSettings step={step} onChange={(k, v) => updateSetting(step.id, k, v)} />
                    )}
                    {step.settingsType === 'broadcast' && (
                      <BroadcastSettings step={step} templates={templates} onChange={(k, v) => updateSetting(step.id, k, v)} />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ============ SETTINGS COMPONENTS ============

function GroupSettings({ step, groups, onChange, onRefreshGroups }) {
  const s = step.settings
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label>{t('assistant.select_group')}</Label>
          <button onClick={onRefreshGroups}
            className="px-3 py-1 text-[10px] font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            {t('assistant.refresh')}
          </button>
        </div>
        <select value={s.url} onChange={(e) => onChange('url', e.target.value)} className="input-field">
          <option value="">-- {t('assistant.select_group')} --</option>
          {groups.map(g => (
            <option key={g.id} value={`https://www.facebook.com/groups/${g.group_id}`}>
              {g.group_name}
            </option>
          ))}
          <option value="__custom__">{t('assistant.custom_url')}</option>
        </select>
        {s.url === '__custom__' && (
          <input type="text" placeholder="https://www.facebook.com/groups/..." className="input-field mt-2"
            onChange={(e) => onChange('url', e.target.value)} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>{t('assistant.max_requests')}</Label>
          <select value={s.maxRequests} onChange={(e) => onChange('maxRequests', e.target.value)} className="input-field">
            {[10, 25, 50, 100, 150, 200, 300, 500].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <Label>{t('assistant.mutual_friends')}</Label>
          <select value={s.mutualFriendCount} onChange={(e) => onChange('mutualFriendCount', e.target.value)} className="input-field">
            {[0, 1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n === 0 ? t('assistant.no_filter') : `${t('assistant.min')} ${n}`}</option>)}
          </select>
        </div>
      </div>

      <div>
        <Label>{t('assistant.things_in_common')}</Label>
        <div className="flex rounded-lg overflow-hidden border border-[#e2e5f0]">
          <button onClick={() => onChange('thingsInCommon', true)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${s.thingsInCommon ? 'bg-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            {t('common.yes') || 'Ja'}
          </button>
          <button onClick={() => onChange('thingsInCommon', false)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${!s.thingsInCommon ? 'bg-primary text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            {t('common.no') || 'Nein'}
          </button>
        </div>
      </div>

      <div>
        <Label>{t('assistant.target_keywords')}</Label>
        <textarea value={s.targetKeywords} onChange={(e) => onChange('targetKeywords', e.target.value)}
          placeholder={t('assistant.keywords_placeholder')} className="input-field h-16 resize-none" />
      </div>

      <div>
        <Label>{t('assistant.avoid_keywords')}</Label>
        <textarea value={s.avoidKeywords} onChange={(e) => onChange('avoidKeywords', e.target.value)}
          placeholder={t('assistant.keywords_placeholder')} className="input-field h-16 resize-none" />
      </div>
    </div>
  )
}

function ContentSettings({ step, onChange }) {
  const s = step.settings
  return (
    <div className="space-y-4">
      <div>
        <Label>{t('assistant.post_url')}</Label>
        <input type="text" value={s.url} onChange={(e) => onChange('url', e.target.value)}
          placeholder="https://www.facebook.com/post/..." className="input-field" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>{t('assistant.max_requests')}</Label>
          <select value={s.maxRequests} onChange={(e) => onChange('maxRequests', e.target.value)} className="input-field">
            {[10, 25, 50, 100, 150, 200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <Label>{t('assistant.filter_type')}</Label>
          <select value={s.filterFromType} onChange={(e) => onChange('filterFromType', e.target.value)} className="input-field">
            <option value="comments">{t('assistant.filter_comments')}</option>
            <option value="likes">{t('assistant.filter_likes')}</option>
            <option value="both">{t('assistant.filter_both')}</option>
          </select>
        </div>
      </div>

      <div>
        <Label>{t('assistant.mutual_friends')}</Label>
        <select value={s.mutualFriendCount} onChange={(e) => onChange('mutualFriendCount', e.target.value)} className="input-field">
          {[0, 1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n === 0 ? t('assistant.no_filter') : `${t('assistant.min')} ${n}`}</option>)}
        </select>
      </div>

      <div>
        <Label>{t('assistant.target_keywords')}</Label>
        <textarea value={s.targetKeywords} onChange={(e) => onChange('targetKeywords', e.target.value)}
          placeholder={t('assistant.keywords_placeholder')} className="input-field h-16 resize-none" />
      </div>
    </div>
  )
}

function BroadcastSettings({ step, templates, onChange }) {
  const s = step.settings
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>{t('assistant.max_messages')}</Label>
          <select value={s.maxMessageCount} onChange={(e) => onChange('maxMessageCount', e.target.value)} className="input-field">
            {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <Label>{t('tasks.template')}</Label>
          <select value={s.messageTemplateId} onChange={(e) => onChange('messageTemplateId', e.target.value)} className="input-field">
            <option value="">{t('tasks.template_none')}</option>
            {templates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.template_name}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

function Label({ children }) {
  return <label className="block text-[11px] text-[#9196b0] font-semibold uppercase tracking-wide mb-1.5">{children}</label>
}
