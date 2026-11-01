import { ReactNode } from 'react'
export const Card = ({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) => (
  <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
    {(title || right) && <div className="flex items-center justify-between gap-2 mb-3 flex-wrap"><h3 className="font-semibold text-slate-800">{title}</h3>{right}</div>}
    {children}
  </section>
)
export const Empty = ({ text }: { text: string }) => <div className="text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 text-center">{text}</div>
export const Kpi = ({ label, value, note }: { label: string; value: string; note: string }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
    <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    <div className="text-2xl font-bold text-indigo-700 mt-1">{value}</div>
    <div className="text-xs text-slate-400 mt-1">{note}</div>
  </div>
)
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className="border border-slate-300 rounded-lg px-2 py-1 text-sm bg-white" />
