import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import { t } from '../lib/i18n'

export default function Templates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ template_name: '', template_body: '', variables: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('message_templates')
      .select('*')
      .order('created_at', { ascending: false })
    setTemplates(data || [])
    setLoading(false)
  }

  function openModal() {
    setForm({ template_name: '', template_body: '', variables: '' })
    setShowModal(true)
  }

  async function createTemplate(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('message_templates').insert({
      template_name: form.template_name,
      template_body: form.template_body,
      variables: form.variables ? form.variables.split(',').map(v => v.trim()) : [],
    })
    setSaving(false)
    if (!error) {
      setShowModal(false)
      load()
    }
  }

  async function deleteTemplate(id) {
    if (!window.confirm(t('templates.delete_confirm'))) return
    await supabase.from('message_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <>
      <PageHeader title={t('templates.title')}>
        <button onClick={openModal} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
          {t('templates.new')}
        </button>
      </PageHeader>

      <div className="p-7">
        {templates.length === 0 ? (
          <div className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-12 text-center text-[#9196b0] text-sm">
            {t('templates.no_templates')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(tmpl => (
              <div key={tmpl.id} className="bg-white border border-[#e2e5f0] rounded-[14px] shadow-sm p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#1a1d2e]">{tmpl.template_name}</h3>
                  <button onClick={() => deleteTemplate(tmpl.id)} className="text-[10px] font-semibold text-red-500 hover:text-red-700 transition-colors flex-shrink-0 ml-2">
                    {t('common.delete')}
                  </button>
                </div>
                {tmpl.variables && tmpl.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(Array.isArray(tmpl.variables) ? tmpl.variables : []).map(v => (
                      <span key={v} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-semibold rounded-md">
                        {'{' + v + '}'}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-[#9196b0] leading-relaxed flex-1 whitespace-pre-wrap">{tmpl.template_body}</p>
                <p className="text-[10px] text-[#9196b0] mt-3 pt-3 border-t border-[#e2e5f0]">
                  {tmpl.created_at ? new Date(tmpl.created_at).toLocaleDateString('de') : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1d2e]">{t('templates.new')}</h3>
            <form onSubmit={createTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">{t('templates.name')}</label>
                <input
                  type="text"
                  value={form.template_name}
                  onChange={e => setForm({ ...form, template_name: e.target.value })}
                  required
                  placeholder={t('templates.name_placeholder')}
                  className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">{t('templates.body')}</label>
                <textarea
                  value={form.template_body}
                  onChange={e => setForm({ ...form, template_body: e.target.value })}
                  required
                  rows={5}
                  placeholder={t('templates.body_placeholder')}
                  className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#9196b0] uppercase tracking-wide mb-1.5">{t('templates.variables')}</label>
                <input
                  type="text"
                  value={form.variables}
                  onChange={e => setForm({ ...form, variables: e.target.value })}
                  placeholder="name, group, link"
                  className="w-full border border-[#e2e5f0] rounded-lg px-3 py-2.5 text-sm text-[#1a1d2e] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-semibold text-[#9196b0] hover:text-[#1a1d2e] transition-colors">
                  {t('templates.cancel')}
                </button>
                <button type="submit" disabled={saving} className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {saving ? t('tasks.creating') : t('templates.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
