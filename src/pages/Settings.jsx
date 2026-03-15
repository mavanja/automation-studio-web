import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'

export default function Settings() {
  const [profile, setProfile] = useState({ fb_user_name: '', fb_user_id: '' })
  const [language, setLanguage] = useState('DE')
  const [autoClick, setAutoClick] = useState(false)
  const [tabSwitching, setTabSwitching] = useState(false)
  const [extensionId, setExtensionId] = useState('')
  const [extensionConnected, setExtensionConnected] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (data) {
      setProfile({ fb_user_name: data.fb_user_name || '', fb_user_id: data.fb_user_id || '' })
    }

    const stored = localStorage.getItem('as_settings')
    if (stored) {
      try {
        const s = JSON.parse(stored)
        setLanguage(s.language || 'DE')
        setAutoClick(s.autoClick || false)
        setTabSwitching(s.tabSwitching || false)
        setExtensionId(s.extensionId || '')
      } catch { /* ignore */ }
    }

    checkExtension()
  }

  function checkExtension() {
    const id = extensionId || localStorage.getItem('as_extension_id')
    if (id && typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        chrome.runtime.sendMessage(id, { type: 'ping' }, response => {
          setExtensionConnected(Boolean(response))
        })
      } catch {
        setExtensionConnected(false)
      }
    } else {
      setExtensionConnected(false)
    }
  }

  async function saveProfile(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')

    const { data: existing } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (existing) {
      await supabase.from('user_profiles').update({
        fb_user_name: profile.fb_user_name,
        fb_user_id: profile.fb_user_id,
      }).eq('id', existing.id)
    } else {
      await supabase.from('user_profiles').insert({
        fb_user_name: profile.fb_user_name,
        fb_user_id: profile.fb_user_id,
      })
    }

    setSaving(false)
    setSaveMsg('Profile saved.')
    setTimeout(() => setSaveMsg(''), 3000)
  }

  function saveLocalSettings(updates) {
    const current = { language, autoClick, tabSwitching, extensionId, ...updates }
    localStorage.setItem('as_settings', JSON.stringify(current))
    if (updates.extensionId !== undefined) {
      localStorage.setItem('as_extension_id', updates.extensionId)
    }
  }

  async function exportAllData() {
    const [tasks, results, friends, groups, templates] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('task_results').select('*'),
      supabase.from('fb_friends').select('*'),
      supabase.from('fb_groups').select('*'),
      supabase.from('message_templates').select('*'),
    ])

    const exportData = {
      exported_at: new Date().toISOString(),
      tasks: tasks.data || [],
      task_results: results.data || [],
      fb_friends: friends.data || [],
      fb_groups: groups.data || [],
      message_templates: templates.data || [],
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `automation-studio-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importData() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)

        if (data.tasks && data.tasks.length > 0) {
          await supabase.from('tasks').upsert(data.tasks, { onConflict: 'task_id' })
        }
        if (data.task_results && data.task_results.length > 0) {
          await supabase.from('task_results').upsert(data.task_results, { onConflict: 'result_id' })
        }
        if (data.fb_friends && data.fb_friends.length > 0) {
          await supabase.from('fb_friends').upsert(data.fb_friends, { onConflict: 'connected_fb_id' })
        }
        if (data.fb_groups && data.fb_groups.length > 0) {
          await supabase.from('fb_groups').upsert(data.fb_groups, { onConflict: 'group_id' })
        }
        if (data.message_templates && data.message_templates.length > 0) {
          await supabase.from('message_templates').insert(data.message_templates)
        }

        alert('Data imported successfully.')
      } catch (err) {
        alert('Import failed: ' + err.message)
      }
    }
    input.click()
  }

  async function deleteAllData() {
    if (!window.confirm('DELETE ALL DATA? This cannot be undone!')) return
    if (!window.confirm('Are you absolutely sure? All tasks, results, friends, groups, and templates will be permanently deleted.')) return

    await Promise.all([
      supabase.from('task_results').delete().neq('id', 0),
      supabase.from('tasks').delete().neq('id', 0),
      supabase.from('fb_friends').delete().neq('id', 0),
      supabase.from('fb_groups').delete().neq('id', 0),
      supabase.from('message_templates').delete().neq('id', 0),
      supabase.from('broadcast_list_users').delete().neq('id', 0),
      supabase.from('broadcast_lists').delete().neq('id', 0),
      supabase.from('activity_logs').delete().neq('id', 0),
    ])

    alert('All data has been deleted.')
  }

  return (
    <>
      <PageHeader title="Settings" />

      <div className="p-7 space-y-6 max-w-3xl">
        {/* Facebook Profile */}
        <Section title="Facebook Profile">
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">Username</label>
              <input
                type="text"
                value={profile.fb_user_name}
                onChange={e => setProfile({ ...profile, fb_user_name: e.target.value })}
                placeholder="john.doe"
                className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">User ID</label>
              <input
                type="text"
                value={profile.fb_user_id}
                onChange={e => setProfile({ ...profile, fb_user_id: e.target.value })}
                placeholder="100000123456789"
                className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              {saveMsg && <span className="text-sm text-emerald-600 font-semibold">{saveMsg}</span>}
            </div>
          </form>
        </Section>

        {/* Language */}
        <Section title="Language">
          <div className="flex gap-2">
            {['DE', 'EN'].map(lang => (
              <button
                key={lang}
                onClick={() => { setLanguage(lang); saveLocalSettings({ language: lang }) }}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  language === lang
                    ? 'bg-primary text-white'
                    : 'bg-[#f4f6fb] text-[#9196b0] hover:text-[#1a1d2e]'
                }`}
              >
                {lang === 'DE' ? 'Deutsch' : 'English'}
              </button>
            ))}
          </div>
        </Section>

        {/* Automation Toggles */}
        <Section title="Automation">
          <div className="space-y-4">
            <Toggle
              label="Auto-Click"
              description="Automatically click Facebook elements during tasks"
              checked={autoClick}
              onChange={v => { setAutoClick(v); saveLocalSettings({ autoClick: v }) }}
            />
            <Toggle
              label="Tab Switching"
              description="Allow extension to switch browser tabs during automation"
              checked={tabSwitching}
              onChange={v => { setTabSwitching(v); saveLocalSettings({ tabSwitching: v }) }}
            />
          </div>
        </Section>

        {/* Extension Connection */}
        <Section title="Extension Connection">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${extensionConnected ? 'bg-emerald-500' : 'bg-red-400'}`} />
              <span className="text-sm font-semibold text-[#1a1d2e]">
                {extensionConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">Extension ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={extensionId}
                  onChange={e => setExtensionId(e.target.value)}
                  placeholder="abcdefghijklmnopqrstuvwxyz..."
                  className="flex-1 border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <button
                  onClick={() => { saveLocalSettings({ extensionId }); checkExtension() }}
                  className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        </Section>

        {/* Danger Zone */}
        <div className="bg-white border-2 border-red-200 rounded-[14px] shadow-sm p-6">
          <h3 className="text-sm font-bold text-red-600 uppercase tracking-wide mb-4">Danger Zone</h3>
          <div className="flex flex-wrap gap-3">
            <button onClick={exportAllData} className="px-4 py-2 text-sm font-semibold bg-[#f4f6fb] text-[#1a1d2e] rounded-lg hover:bg-[#e2e5f0] transition-colors">
              Export All Data
            </button>
            <button onClick={importData} className="px-4 py-2 text-sm font-semibold bg-[#f4f6fb] text-[#1a1d2e] rounded-lg hover:bg-[#e2e5f0] transition-colors">
              Import Data
            </button>
            <button onClick={deleteAllData} className="px-4 py-2 text-sm font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
              Delete All Data
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-6">
      <h3 className="text-[15px] font-bold text-[#1a1d2e] mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-[#1a1d2e]">{label}</p>
        <p className="text-[11px] text-[#9196b0]">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-[#e2e5f0]'}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}
