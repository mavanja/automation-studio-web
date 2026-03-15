import React from 'react'

export default function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-[#e2e5f0] rounded-[14px] p-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] relative overflow-hidden transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-[rgba(24,119,242,0.2)] hover:-translate-y-0.5 group before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-gradient-to-r before:from-primary before:to-[#42a5f5] before:opacity-0 hover:before:opacity-100 before:transition-opacity">
      <div className="text-[11px] text-[#9196b0] uppercase tracking-[0.8px] font-semibold">{label}</div>
      <div className="text-[32px] font-extrabold bg-gradient-to-r from-primary to-[#42a5f5] bg-clip-text text-transparent mt-1.5 leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-[#9196b0] mt-1 font-medium">{sub}</div>}
    </div>
  )
}
