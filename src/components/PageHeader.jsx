import React from 'react'

export default function PageHeader({ title, children }) {
  return (
    <div className="px-8 py-[18px] border-b border-[#e2e5f0] flex items-center justify-between bg-white sticky top-0 z-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <h2 className="text-xl font-bold tracking-tight text-[#1a1d2e]">{title}</h2>
      <div className="flex gap-2">{children}</div>
    </div>
  )
}
