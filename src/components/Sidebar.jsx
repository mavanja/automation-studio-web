import React from 'react'
import { NavLink } from 'react-router-dom'
import { useExtension } from '../hooks/useExtension'

const sections = [
  {
    title: 'Hauptmenü',
    items: [
      { path: '/', label: 'Dashboard', icon: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
      { path: '/tasks', label: 'Aufgaben', icon: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
      { path: '/results', label: 'Ergebnisse', icon: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg> },
    ],
  },
  {
    title: 'Werkzeuge',
    items: [
      { path: '/templates', label: 'Vorlagen', icon: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
      { path: '/broadcasts', label: 'Broadcast-Listen', icon: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
      { path: '/groups', label: 'Gruppen', icon: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
      { path: '/friends', label: 'Freunde', icon: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
    ],
  },
  {
    title: 'System',
    items: [
      { path: '/logs', label: 'Aktivitäts-Logs', icon: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
      { path: '/settings', label: 'Einstellungen', icon: <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
    ],
  },
]

export default function Sidebar({ user, onSignOut }) {
  const { connected } = useExtension()

  return (
    <aside className="w-[260px] bg-white border-r border-[#e2e5f0] fixed top-0 left-0 bottom-0 flex flex-col z-10 shadow-[2px_0_8px_rgba(0,0,0,0.03)]">
      <div className="px-5 py-[22px] border-b border-[#e2e5f0]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-[0_4px_12px_rgba(24,119,242,0.12)]">
            <img src="/logo.png" alt="AS" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-[17px] font-extrabold text-[#1a1d2e] tracking-tight">Automation Studio</h1>
            <p className="text-[11px] text-[#9196b0] font-medium mt-0.5">Facebook Toolkit v2.0</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="text-[10px] text-[#9196b0] uppercase tracking-[1.2px] font-bold px-3.5 pt-4 pb-2">
              {section.title}
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-[11px] px-3.5 py-2.5 rounded-[10px] text-[13px] font-medium mb-0.5 relative transition-all ${
                    isActive
                      ? 'bg-[rgba(24,119,242,0.06)] text-primary font-semibold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-[3px] before:bg-gradient-to-b before:from-primary before:to-[#42a5f5]'
                      : 'text-[#5f647e] hover:bg-[rgba(24,119,242,0.05)] hover:text-[#1a1d2e]'
                  }`
                }
              >
                <span className={`opacity-60 group-hover:opacity-100`}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-[#e2e5f0]">
        <div className="flex items-center gap-[11px] px-3 py-2.5 rounded-[10px] bg-[#f4f6fb] border border-[#e2e5f0]">
          <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-primary to-[#42a5f5] flex items-center justify-center font-bold text-white text-sm shrink-0">
            {user?.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-[#1a1d2e] truncate">{user?.email}</div>
            <div className={`text-[10px] font-semibold flex items-center gap-1 ${connected ? 'text-emerald-500' : 'text-[#9196b0]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]' : 'bg-[#9196b0]'}`} />
              {connected ? 'Extension verbunden' : 'Extension nicht verbunden'}
            </div>
          </div>
          <button onClick={onSignOut} className="text-[#9196b0] hover:text-red-500 transition-colors" title="Abmelden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
