import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { t } from '../lib/i18n'

const STEPS = [
  {
    id: 'leads-groups',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    titleKey: 'assistant.leads_groups',
    descKey: 'assistant.leads_groups_desc',
    taskType: 'GET_LEADS_API_EXTERNAL',
    subTaskType: 'GET_LEADS_FOR_GROUPS',
    taskName: 'leads-from-groups',
    needsUrl: true,
    urlPlaceholder: 'https://www.facebook.com/groups/...',
  },
  {
    id: 'leads-content',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
      </svg>
    ),
    titleKey: 'assistant.leads_content',
    descKey: 'assistant.leads_content_desc',
    taskType: 'GET_LEADS_API_EXTERNAL',
    subTaskType: 'GET_LEADS_FOR_CONTENT',
    taskName: 'leads-from-content',
    needsUrl: true,
    urlPlaceholder: 'https://www.facebook.com/post/...',
  },
  {
    id: 'approve-groups',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
    titleKey: 'assistant.approve_groups',
    descKey: 'assistant.approve_groups_desc',
    taskType: 'MANAGE_GROUP_API_EXTERNAL',
    taskName: 'manageGroupInvites',
    needsUrl: true,
    urlPlaceholder: 'https://www.facebook.com/groups/.../member-requests',
  },
  {
    id: 'broadcast',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
      </svg>
    ),
    titleKey: 'assistant.broadcast',
    descKey: 'assistant.broadcast_desc',
    taskType: 'BROADCAST_MESSAGE_API_EXTERNAL',
    taskName: 'broadcast-message',
    needsUrl: false,
  },
  {
    id: 'friends-sync',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
    ),
    titleKey: 'assistant.friends_sync',
    descKey: 'assistant.friends_sync_desc',
    taskType: 'FRIENDS_SYNC_API_EXTERNAL',
    taskName: 'friends-sync',
    needsUrl: false,
  },
  {
    id: 'gain-reciprocity',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
    titleKey: 'assistant.reciprocity',
    descKey: 'assistant.reciprocity_desc',
    taskType: 'GAIN_RECIPROCITY_API_EXTERNAL',
    taskName: 'contentToolsGainRaciprocity',
    needsUrl: false,
  },
]

const STATUS_STYLES = {
  waiting: { bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-300', text: 'text-gray-400' },
  running: { bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500 animate-pulse', text: 'text-blue-600' },
  done: { bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  error: { bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500', text: 'text-red-600' },
  skipped: { bg: 'bg-gray-50', border: 'border-gray-100', dot: 'bg-gray-200', text: 'text-gray-300' },
}

export default function DailyAssistant() {
  const [steps, setSteps] = useState(
    STEPS.map(s => ({ ...s, enabled: false, url: '', status: 'waiting', maxRequests: 50 }))
  )
  const [running, setRunning] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)

  function toggleStep(id) {
    if (running) return
    setSteps(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s))
  }

  function updateStep(id, field, value) {
    if (running) return
    setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  async function startAssistant() {
    const enabled = steps.filter(s => s.enabled)
    if (enabled.length === 0) return

    setRunning(true)
    const { data: { user } } = await supabase.auth.getUser()

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (!step.enabled) {
        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'skipped' } : s))
        continue
      }

      setCurrentStep(i)
      setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'running' } : s))

      try {
        // Create task in Supabase
        const taskId = `${step.taskName}-${Date.now()}`
        await supabase.from('tasks').insert({
          task_id: taskId,
          user_id: user.id,
          task_name: step.taskName,
          process_url: step.url || '',
          max_request: step.maxRequests,
          status: 'inprogress',
          friend_request_sent: 0,
          message: { processUrl: step.url, subTask: step.subTaskType, isDailyWizardTask: true },
        })

        // Send to extension
        const taskData = {
          url: step.url || 'https://www.facebook.com',
          taskType: step.taskType,
          subTaskType: step.subTaskType || step.taskName,
          focusOnFb: true,
          isDailyWizardTask: true,
          cursorTimeGapMin: 500,
          cursorTimeGapMax: 1000,
          task: {
            taskId,
            taskName: step.taskName,
            status: 'inprogress',
            maxRequest: step.maxRequests,
            friendRequestSent: 0,
            processUrl: step.url,
            message: { processUrl: step.url, subTask: step.subTaskType, isDailyWizardTask: true },
          },
        }

        try {
          if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage('ehaendpolcffilhljadohefkgaaplfbg', { type: 'CREATE_TAB', data: taskData }, () => {})
          }
        } catch {}

        // Wait for this step (simulate progress)
        await new Promise(r => setTimeout(r, 3000))

        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'done' } : s))
      } catch (err) {
        setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'error' } : s))
      }
    }

    setRunning(false)
    setCurrentStep(-1)
  }

  function resetAssistant() {
    setSteps(prev => prev.map(s => ({ ...s, status: 'waiting' })))
    setRunning(false)
    setCurrentStep(-1)
  }

  const enabledCount = steps.filter(s => s.enabled).length

  return (
    <>
      <PageHeader title={t('assistant.title')}>
        {!running ? (
          <button
            onClick={startAssistant}
            disabled={enabledCount === 0}
            className="px-5 py-2.5 bg-gradient-to-r from-primary to-[#42a5f5] text-white rounded-[10px] text-sm font-semibold shadow-[0_2px_10px_rgba(24,119,242,0.15)] hover:shadow-[0_6px_20px_rgba(24,119,242,0.25)] hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            {t('assistant.start')} ({enabledCount})
          </button>
        ) : (
          <button
            onClick={resetAssistant}
            className="px-5 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-[10px] text-sm font-semibold hover:bg-red-100 transition-all"
          >
            {t('assistant.stop')}
          </button>
        )}
      </PageHeader>

      <div className="p-7">
        {/* Hero */}
        <div className="bg-gradient-to-br from-[#1a1d2e] to-[#2d3148] rounded-[18px] p-8 mb-7 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <h2 className="text-2xl font-extrabold tracking-tight mb-2">{t('assistant.hero_title')}</h2>
            <p className="text-sm text-gray-300 max-w-lg">{t('assistant.hero_desc')}</p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const style = STATUS_STYLES[step.status]
            return (
              <div
                key={step.id}
                className={`${style.bg} border ${style.border} rounded-[14px] p-5 transition-all ${
                  running ? '' : 'cursor-pointer hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]'
                } ${step.enabled && step.status === 'waiting' ? 'border-primary/30 shadow-[0_0_0_1px_rgba(24,119,242,0.1)]' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {/* Toggle / Status */}
                  <div className="pt-0.5">
                    {step.status === 'waiting' ? (
                      <button
                        onClick={() => toggleStep(step.id)}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          step.enabled
                            ? 'bg-primary border-primary'
                            : 'border-gray-300 hover:border-primary/50'
                        }`}
                      >
                        {step.enabled && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </button>
                    ) : (
                      <div className={`w-6 h-6 rounded-full ${style.dot} flex items-center justify-center`}>
                        {step.status === 'done' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        {step.status === 'error' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                        {step.status === 'running' && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                      </div>
                    )}
                  </div>

                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    step.enabled || step.status !== 'waiting' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {step.icon}
                  </div>

                  {/* Content */}
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
                    <p className="text-xs text-[#9196b0] mb-2">{t(step.descKey)}</p>

                    {/* Config fields (only when enabled and not running) */}
                    {step.enabled && step.status === 'waiting' && (
                      <div className="flex gap-3 mt-3">
                        {step.needsUrl && (
                          <input
                            type="text"
                            value={step.url}
                            onChange={(e) => updateStep(step.id, 'url', e.target.value)}
                            placeholder={step.urlPlaceholder}
                            className="flex-1 px-3 py-2 bg-white border border-[#e2e5f0] rounded-lg text-xs focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(24,119,242,0.08)] transition-all"
                          />
                        )}
                        <input
                          type="number"
                          value={step.maxRequests}
                          onChange={(e) => updateStep(step.id, 'maxRequests', Number(e.target.value))}
                          className="w-20 px-3 py-2 bg-white border border-[#e2e5f0] rounded-lg text-xs text-center focus:outline-none focus:border-primary transition-all"
                          min={1}
                          max={500}
                          title={t('tasks.max_requests')}
                        />
                      </div>
                    )}
                  </div>

                  {/* Step number */}
                  <div className={`text-xs font-bold ${step.enabled ? 'text-primary' : 'text-gray-300'}`}>
                    #{idx + 1}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
