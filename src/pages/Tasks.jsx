import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { t } from '../lib/i18n'

const TASK_TYPES = [
  { group: 'Lead Generation', options: [
    { value: 'leads-from-groups' },
    { value: 'leads-from-content' },
    { value: 'leads-from-peaple' },
    { value: 'leads-from-suggestions' },
  ]},
  { group: 'Engagement', options: [
    { value: 'contentToolsGainRaciprocity' },
    { value: 'contentToolsProspectByPost' },
    { value: 'contentToolsTagsForAttention' },
  ]},
  { group: 'Messaging', options: [
    { value: 'broadcast-message' },
  ]},
  { group: 'Friend Management', options: [
    { value: 'friends-sync' },
    { value: 'date-friended' },
    { value: 'cancel-friend-request' },
    { value: 'start-unfriending' },
    { value: 'scan-friend-activity' },
  ]},
]

const FILTERS = [
  { key: 'all', labelKey: 'tasks.all' },
  { key: 'inprogress', labelKey: 'tasks.inprogress' },
  { key: 'completed', labelKey: 'tasks.completed_filter' },
  { key: 'stopped', labelKey: 'tasks.stopped_filter' },
]

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ task_name: '', process_url: '', max_request: 50, message: '' })
  const [templates, setTemplates] = useState([])
  const [groups, setGroups] = useState([])
  const [saving, setSaving] = useState(false)
  const [groupPosts, setGroupPosts] = useState([])
  const [fetchingPosts, setFetchingPosts] = useState(false)

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  async function loadTemplates() {
    const { data } = await supabase.from('message_templates').select('*')
    setTemplates(data || [])
  }

  async function loadGroups() {
    const { data } = await supabase.from('fb_groups').select('*')
    setGroups(data || [])
  }

  function refreshGroups() {
    const EXT_ID = 'ehaendpolcffilhljadohefkgaaplfbg'
    if (typeof chrome !== 'undefined' && chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage(EXT_ID, { type: 'FETCH_MANAGED_GROUPS' }, async () => {
        await new Promise(r => setTimeout(r, 3000))
        loadGroups()
      })
    }
  }

  function openModal() {
    loadTemplates()
    loadGroups()
    setForm({ task_name: '', process_url: '', max_request: 50, message: '', sendFriendRequests: true, thingsInCommon: false, mutualFriendCount: 0, targetKeywords: '', avoidKeywords: '' })
    setShowModal(true)
  }

  const isGroupTask = ['leads-from-groups', 'leads-from-content'].includes(form.task_name)
  const isContentTask = form.task_name === 'leads-from-content'

  async function fetchPostsFromGroup() {
    if (!form.selectedGroup) return
    setFetchingPosts(true)
    setGroupPosts([])

    const EXT_ID = 'ehaendpolcffilhljadohefkgaaplfbg'
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()
    const fbUserName = profile?.fb_user_name || profile?.fb_user_id || ''

    // Create a temp task for post fetching
    const fetchTaskId = `fetchPostsUrl-${Date.now()}`
    await supabase.from('tasks').insert({
      task_id: fetchTaskId,
      user_id: user.id,
      task_name: 'fetchPostsUrl',
      process_url: form.selectedGroup,
      max_request: Number(form.maxPosts) || 10,
      message: { processUrl: form.selectedGroup, maxPosts: Number(form.maxPosts) || 10 },
      status: 'inprogress',
    })

    // Open group page with fetchPostsUrl params
    const groupUrl = `${form.selectedGroup}?userName=${fbUserName}&taskFor=fetchPostsUrl&taskId=${fetchTaskId}&ypwSource=t`
    chrome.runtime.sendMessage(EXT_ID, { type: 'CREATE_TAB', data: { url: groupUrl, focusOnFb: true } })

    // Poll for results
    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      const { data: results } = await supabase
        .from('task_results').select('result').eq('task_id', fetchTaskId)
      if (results?.length) {
        const posts = results.map(r => typeof r.result === 'string' ? JSON.parse(r.result) : r.result).filter(p => p?.postUrl)
        setGroupPosts(posts)
      }
      const { data: td } = await supabase.from('tasks').select('status').eq('task_id', fetchTaskId).maybeSingle()
      if (td?.status === 'completed' || td?.status === 'stopped' || attempts >= 30) {
        clearInterval(poll)
        setFetchingPosts(false)
        // Final fetch
        const { data: final } = await supabase.from('task_results').select('result').eq('task_id', fetchTaskId)
        if (final?.length) {
          setGroupPosts(final.map(r => typeof r.result === 'string' ? JSON.parse(r.result) : r.result).filter(p => p?.postUrl).filter((p, i, arr) => arr.findIndex(x => x.postUrl === p.postUrl) === i))
        }
      }
    }, 3000)
  }

  async function createTask(e) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const taskId = `${form.task_name}-${Date.now()}`
    let groupId = ''
    if (form.process_url?.includes('/groups/')) {
      groupId = form.process_url.split('/groups/')[1]?.split('/')[0]?.split('?')[0] || ''
    }
    const taskMessage = {
      processUrl: form.process_url,
      groupId,
      sendFriendRequests: form.sendFriendRequests !== false,
      thingsInCommon: form.thingsInCommon || false,
      mutualFriendCount: Number(form.mutualFriendCount) || 0,
      targetKeywords: form.targetKeywords ? form.targetKeywords.split(',').map(k => k.trim()).filter(Boolean) : [],
      avoidKeywords: form.avoidKeywords ? form.avoidKeywords.split(',').map(k => k.trim()).filter(Boolean) : [],
      messageTemplateId: form.message || '',
      country: '',
      gender: '',
      filterFromType: form.filterFromType || 'comments',
    }
    const { error } = await supabase.from('tasks').insert({
      task_id: taskId,
      user_id: user.id,
      task_name: form.task_name,
      process_url: form.process_url,
      max_request: Number(form.max_request),
      message: taskMessage,
      status: 'pending',
      friend_request_sent: 0,
    })
    setSaving(false)
    if (!error) {
      setShowModal(false)
      loadTasks()
    }
  }

  // Map task names to the taskType the extension content scripts expect
  const TASK_TYPE_MAP = {
    'leads-from-groups': 'GET_LEADS_API_EXTERNAL',
    'leads-from-content': 'GET_LEADS_API_EXTERNAL',
    'leads-from-peaple': 'GET_LEADS_API_EXTERNAL',
    'leads-from-suggestions': 'GET_LEADS_API_EXTERNAL',
    'broadcast-message': 'BROADCAST_MESSAGE_API_EXTERNAL',
    'friends-sync': 'FRIENDS_SYNC_API_EXTERNAL',
    'date-friended': 'DATE_FRIENDED_API_EXTERNAL',
    'cancel-friend-request': 'CANCEL_FRIEND_REQUESTS_API_EXTERNAL',
    'start-unfriending': 'UNFRIEND_FRIEND_API_EXTERNAL',
    'scan-friend-activity': 'SCAN_FRIEND_ACTIVITY_API_EXTERNAL',
    'contentToolsGainRaciprocity': 'GAIN_RECIPROCITY_API_EXTERNAL',
    'contentToolsProspectByPost': 'PROSPECT_BY_POST_API_EXTERNAL',
    'contentToolsTagsForAttention': 'TAGS_FOR_ATTENTION_API_EXTERNAL',
  }

  // Map task name to subTaskType for leads
  const SUB_TASK_MAP = {
    'leads-from-groups': 'GET_LEADS_FOR_GROUPS',
    'leads-from-content': 'GET_LEADS_FOR_CONTENT',
    'leads-from-peaple': 'GET_LEADS_FOR_PEOPLE',
    'leads-from-suggestions': 'GET_LEADS_FOR_SUGGESTIONS',
  }

  async function startTask(taskId) {
    const task = tasks.find(t => t.task_id === taskId)
    if (!task) return

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle()

    // Update status in DB
    await supabase.from('tasks').update({ status: 'inprogress' }).eq('task_id', taskId)
    setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, status: 'inprogress' } : t))

    // Build the task data structure that the extension expects
    const extensionTaskType = TASK_TYPE_MAP[task.task_name] || task.task_name
    const subTaskType = SUB_TASK_MAP[task.task_name] || task.task_name
    const fbUserName = profile?.fb_user_name || ''
    const fbUserId = profile?.fb_user_id || ''

    // Extract groupId from URL
    let groupId = ''
    if (task.process_url?.includes('/groups/')) {
      groupId = task.process_url.split('/groups/')[1]?.split('/')[0]?.split('?')[0] || ''
    }

    // Navigate to correct page based on task type and settings
    let baseUrl = task.process_url || 'https://www.facebook.com'
    if (task.task_name === 'leads-from-groups' && groupId) {
      if (task.message?.thingsInCommon) {
        baseUrl = `https://www.facebook.com/groups/${groupId}/members/things_in_common/`
      } else {
        baseUrl = `https://www.facebook.com/groups/${groupId}/members/`
      }
    }
    const taskUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'ypwSource=t'

    const taskData = {
      url: taskUrl,
      taskType: extensionTaskType,
      subTaskType: subTaskType,
      userName: fbUserName || fbUserId,
      focusOnFb: true,
      cursorTimeGapMin: 500,
      cursorTimeGapMax: 1000,
      task: {
        taskId: task.task_id,
        taskName: task.task_name,
        status: 'inprogress',
        maxRequest: task.max_request,
        friendRequestSent: task.friend_request_sent || 0,
        processUrl: task.process_url,
        facebookUserName: fbUserName,
        facebookUserId: fbUserId,
        userId: user?.id,
        groupId: groupId,
        mutualFriendCount: task.message?.mutualFriendCount || 0,
        message: {
          processUrl: task.process_url,
          groupId: groupId,
          subTask: subTaskType,
          country: task.message?.country || '',
          gender: task.message?.gender || '',
          targetKeywords: task.message?.targetKeywords || [],
          avoidKeywords: task.message?.avoidKeywords || [],
          mutualFriendCount: task.message?.mutualFriendCount || 0,
          thingsInCommon: task.message?.thingsInCommon || false,
          sendFriendRequests: task.message?.sendFriendRequests !== false,
          filterFromType: task.message?.filterFromType || 'comments',
        },
        messageTemplateId: '',
        accessToken: '',
      },
    }

    // Send command to extension
    try {
      const EXT_ID = 'ehaendpolcffilhljadohefkgaaplfbg'
      if (chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage(EXT_ID, { type: 'CREATE_TAB', data: taskData }, () => {})
      } else {
        // Fallback: open URL directly
        const url = `${task.process_url || 'https://www.facebook.com'}?taskId=${taskId}&sendRequest=true&taskFor=${task.task_name}`
        window.open(url, '_blank')
      }
    } catch (err) {
      console.error('Could not send to extension:', err)
      const url = `${task.process_url || 'https://www.facebook.com'}?taskId=${taskId}&sendRequest=true&taskFor=${task.task_name}`
      window.open(url, '_blank')
    }
  }

  async function stopTask(taskId) {
    await supabase.from('tasks').update({ status: 'stopped' }).eq('task_id', taskId)
    setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, status: 'stopped' } : t))

    // Tell extension to stop
    try {
      if (chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          'ehaendpolcffilhljadohefkgaaplfbg',
          { type: 'STOP_TASK_PROGRESS' },
          () => {}
        )
      }
    } catch {}
  }

  async function deleteTask(taskId) {
    if (!window.confirm(t('tasks.delete_confirm'))) return
    await supabase.from('task_results').delete().eq('task_id', taskId)
    await supabase.from('tasks').delete().eq('task_id', taskId)
    setTasks(prev => prev.filter(t => t.task_id !== taskId))
  }

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter)

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <>
      <PageHeader title={t('tasks.title')}>
        <button onClick={openModal} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
          {t('tasks.new')}
        </button>
      </PageHeader>

      <div className="p-7 space-y-5">
        <div className="flex gap-2">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                filter === f.key
                  ? 'bg-primary text-white'
                  : 'bg-white border border-[#e2e5f0] text-[#9196b0] hover:text-[#1a1d2e]'
              }`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-[#9196b0] text-sm">{t('tasks.no_tasks')}</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#f4f6fb]">
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.task')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.url')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.status')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.progress')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.created')}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-[#9196b0] uppercase tracking-[0.8px] font-bold">{t('tasks.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(task => (
                  <tr key={task.task_id} className="hover:bg-[rgba(24,119,242,0.03)] transition-colors border-t border-[#e2e5f0]">
                    <td className="px-4 py-3.5">
                      <Link to={`/tasks/${task.task_id}`} className="font-semibold text-sm text-[#1a1d2e] hover:text-primary">
                        {t('tasktype.' + task.task_name) || task.task_name || task.task_id}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-[11px] text-[#9196b0] max-w-[200px] truncate">{task.process_url || '-'}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={task.status} /></td>
                    <td className="px-4 py-3.5 text-sm text-[#1a1d2e]">{task.friend_request_sent || 0} / {task.max_request || '-'}</td>
                    <td className="px-4 py-3.5 text-sm text-[#9196b0]">{new Date(task.created_at).toLocaleDateString('de')}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1.5">
                        {task.status !== 'inprogress' && (
                          <button onClick={() => startTask(task.task_id)} className="px-2.5 py-1 text-[10px] font-semibold bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors">
                            {t('tasks.start')}
                          </button>
                        )}
                        {task.status === 'inprogress' && (
                          <button onClick={() => stopTask(task.task_id)} className="px-2.5 py-1 text-[10px] font-semibold bg-amber-50 text-amber-600 rounded-md hover:bg-amber-100 transition-colors">
                            {t('tasks.stop')}
                          </button>
                        )}
                        <button onClick={() => deleteTask(task.task_id)} className="px-2.5 py-1 text-[10px] font-semibold bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors">
                          {t('tasks.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1d2e]">{t('tasks.create_title')}</h3>
            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">{t('tasks.type')}</label>
                <select
                  value={form.task_name}
                  onChange={e => setForm({ ...form, task_name: e.target.value })}
                  required
                  className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">{t('tasks.type')}...</option>
                  {TASK_TYPES.map(group => (
                    <optgroup key={group.group} label={group.group}>
                      {group.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{t('tasktype.' + opt.value) || opt.value}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide">
                    {isGroupTask ? t('assistant.select_group') : t('tasks.fb_url')}
                  </label>
                  {isGroupTask && (
                    <button type="button" onClick={refreshGroups}
                      className="px-2.5 py-1 text-[10px] font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                      {t('assistant.refresh')}
                    </button>
                  )}
                </div>
                {isGroupTask ? (
                  <select
                    value={isContentTask ? (form.selectedGroup || '') : form.process_url}
                    onChange={e => {
                      if (isContentTask) {
                        setForm({ ...form, selectedGroup: e.target.value, process_url: '' })
                        setGroupPosts([])
                      } else {
                        setForm({ ...form, process_url: e.target.value })
                      }
                    }}
                    required={!isContentTask}
                    className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">-- {t('assistant.select_group')} --</option>
                    {groups.map(g => (
                      <option key={g.id} value={`https://www.facebook.com/groups/${g.group_id}`}>{g.group_name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="url"
                    value={form.process_url}
                    onChange={e => setForm({ ...form, process_url: e.target.value })}
                    placeholder={t('tasks.fb_url_placeholder')}
                    className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                )}

                {/* Content Task: Posts laden + Post auswählen + filterFromType */}
                {isContentTask && (
                  <>
                    {/* Anzahl Posts */}
                    <div className="mt-3">
                      <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">Anzahl Posts</label>
                      <select value={form.maxPosts || 10} onChange={e => setForm({ ...form, maxPosts: Number(e.target.value) })}
                        className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                        {[5, 10, 15, 20, 30, 50].map(n => <option key={n} value={n}>{n} Posts</option>)}
                      </select>
                    </div>

                    {/* Posts laden */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide">Post auswählen</label>
                        <button type="button" onClick={fetchPostsFromGroup}
                          disabled={!form.selectedGroup || fetchingPosts}
                          className="px-3 py-1.5 text-[10px] font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50">
                          {fetchingPosts ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Lädt...
                            </span>
                          ) : 'Posts laden'}
                        </button>
                      </div>

                      {groupPosts.length > 0 ? (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto border border-[#e2e5f0] rounded-lg p-2">
                          {groupPosts.map((p, idx) => (
                            <div key={idx}
                              className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs transition-colors cursor-pointer ${form.process_url === p.postUrl ? 'bg-primary text-white ring-2 ring-primary/40' : 'bg-[#f4f6fb] hover:bg-[#e8ebf4] text-[#1a1d2e]'}`}
                              onClick={() => setForm({ ...form, process_url: p.postUrl })}>
                              {/* Radio */}
                              <div className="mt-0.5 flex-shrink-0">
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.process_url === p.postUrl ? 'border-white' : 'border-[#c0c4d4]'}`}>
                                  {form.process_url === p.postUrl && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                              </div>
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="font-semibold">
                                    {p.postType === 'video' ? 'Video' : 'Post'} #{idx + 1}
                                  </span>
                                  <div className={`flex gap-3 text-[10px] font-medium ${form.process_url === p.postUrl ? 'text-white/80' : 'text-[#9196b0]'}`}>
                                    {p.getLikes && <span>{p.getLikes} Reakt.</span>}
                                    {p.getCommentCount && <span>{p.getCommentCount}</span>}
                                  </div>
                                </div>
                                {p.postText && (
                                  <div className={`text-[10px] leading-relaxed line-clamp-2 ${form.process_url === p.postUrl ? 'text-white/90' : 'text-[#555]'}`}>
                                    {p.postText}
                                  </div>
                                )}
                                <a href={p.postUrl} target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className={`inline-block mt-1 text-[10px] underline ${form.process_url === p.postUrl ? 'text-white/70 hover:text-white' : 'text-primary/70 hover:text-primary'}`}>
                                  Post ansehen
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="border border-dashed border-[#e2e5f0] rounded-lg p-4 text-center">
                          <p className="text-xs text-[#9196b0]">
                            {fetchingPosts ? 'Posts werden aus der Gruppe geladen...' : 'Wähle eine Gruppe und klicke "Posts laden"'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Nur nach Post-Auswahl: weitere Einstellungen */}
                    {form.process_url && (
                      <>
                        {/* Leads aus: Kommentare / Reaktionen / Beides */}
                        <div className="mt-3">
                          <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">Leads aus</label>
                          <div className="flex rounded-lg overflow-hidden border border-[#e2e5f0]">
                            {[
                              { value: 'comments', label: 'Kommentare' },
                              { value: 'likes', label: 'Reaktionen' },
                              { value: 'both', label: 'Beides' },
                            ].map(opt => (
                              <button key={opt.value} type="button"
                                onClick={() => setForm({ ...form, filterFromType: opt.value })}
                                className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${(form.filterFromType || 'comments') === opt.value ? 'bg-primary text-white' : 'bg-white text-[#9196b0] hover:bg-gray-50'}`}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {(isGroupTask && (!isContentTask || form.process_url)) && (
                <>
                  {/* Freundschaftsanfragen senden? */}
                  <div>
                    <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">Freundschaftsanfragen senden?</label>
                    <div className="flex rounded-lg overflow-hidden border border-[#e2e5f0]">
                      <button type="button" onClick={() => setForm({ ...form, sendFriendRequests: true })}
                        className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${form.sendFriendRequests ? 'bg-primary text-white' : 'bg-white text-[#9196b0] hover:bg-gray-50'}`}>Ja</button>
                      <button type="button" onClick={() => setForm({ ...form, sendFriendRequests: false })}
                        className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${!form.sendFriendRequests ? 'bg-primary text-white' : 'bg-white text-[#9196b0] hover:bg-gray-50'}`}>Nein</button>
                    </div>
                  </div>

                  {/* Nur Mitglieder mit Gemeinsamkeiten? (nur für Gruppen-Tasks, nicht Content) */}
                  {(isGroupTask && !isContentTask) && <div>
                    <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">Nur Mitglieder mit Gemeinsamkeiten?</label>
                    <div className="flex rounded-lg overflow-hidden border border-[#e2e5f0]">
                      <button type="button" onClick={() => setForm({ ...form, thingsInCommon: true })}
                        className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${form.thingsInCommon ? 'bg-primary text-white' : 'bg-white text-[#9196b0] hover:bg-gray-50'}`}>Ja</button>
                      <button type="button" onClick={() => setForm({ ...form, thingsInCommon: false })}
                        className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${!form.thingsInCommon ? 'bg-primary text-white' : 'bg-white text-[#9196b0] hover:bg-gray-50'}`}>Nein</button>
                    </div>
                  </div>}

                  {/* Erweiterte Filter? */}
                  <div>
                    <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">Erweiterte Filter?</label>
                    <div className="flex rounded-lg overflow-hidden border border-[#e2e5f0]">
                      <button type="button" onClick={() => setForm({ ...form, showAdvanced: true })}
                        className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${form.showAdvanced ? 'bg-primary text-white' : 'bg-white text-[#9196b0] hover:bg-gray-50'}`}>Ja</button>
                      <button type="button" onClick={() => setForm({ ...form, showAdvanced: false, mutualFriendCount: 0, targetKeywords: '', avoidKeywords: '' })}
                        className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${!form.showAdvanced ? 'bg-primary text-white' : 'bg-white text-[#9196b0] hover:bg-gray-50'}`}>Nein</button>
                    </div>
                  </div>

                  {form.showAdvanced && (
                    <>
                      {/* Min. gemeinsame Freunde */}
                      <div>
                        <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">Mindestanzahl gemeinsamer Freunde</label>
                        <select value={form.mutualFriendCount} onChange={e => setForm({ ...form, mutualFriendCount: Number(e.target.value) })}
                          className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                          {[0, 1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n === 0 ? 'Kein Filter' : `Mindestens ${n}`}</option>)}
                        </select>
                      </div>

                      {/* Ziel-Keywords */}
                      <div>
                        <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">Ziel-Keywords (Profil muss enthalten)</label>
                        <textarea value={form.targetKeywords} onChange={e => setForm({ ...form, targetKeywords: e.target.value })}
                          placeholder="Keywords kommagetrennt, z.B.: Coach, Marketing, Unternehmer"
                          className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-16 resize-none" />
                      </div>

                      {/* Ausschluss-Keywords */}
                      <div>
                        <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">Ausschluss-Keywords (Profil darf nicht enthalten)</label>
                        <textarea value={form.avoidKeywords} onChange={e => setForm({ ...form, avoidKeywords: e.target.value })}
                          placeholder="Keywords kommagetrennt, z.B.: Spam, MLM"
                          className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-16 resize-none" />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Nur wenn Freundschaftsanfragen = Ja */}
              {form.sendFriendRequests && isGroupTask && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">Max. Freundschaftsanfragen</label>
                    <select value={form.max_request} onChange={e => setForm({ ...form, max_request: e.target.value })}
                      className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                      {[5, 10, 25, 50, 100, 150, 200, 300, 500].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">{t('tasks.template')}</label>
                    <select
                      value={form.message}
                      onChange={e => setForm({ ...form, message: e.target.value })}
                      className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="">{t('tasks.template_none')}</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.template_body}>{t.template_name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-[#9196b0] hover:text-[#1a1d2e] transition-colors">
                  {t('tasks.cancel')}
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {saving ? t('tasks.creating') : t('tasks.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
