import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Database, Layers, Lightbulb, LayoutDashboard, Megaphone, Menu, Target, Users } from 'lucide-react'
import { Empty } from './components/ui'
import { Filters, Profile, Row, applyFilters, parseCsv } from './lib/data'
import { Explorer } from './pages/Explorer'
import { DimView, Insights, Overview } from './pages/Views'

const NAV = [['Overview', LayoutDashboard], ['Campaign Performance', Megaphone], ['Marketing Channel Analysis', Layers], ['Audience Analytics', Users], ['Conversion Analysis', Target], ['Data Explorer', Database], ['Marketing Insights', Lightbulb]] as const
type DS = { rows: Row[]; p: Profile; source: string; at: Date }

export default function App() {
  const [ds, setDs] = useState<DS | null>(null), [err, setErr] = useState(''), [page, setPage] = useState(0), [f, setF] = useState<Filters>({}), [open, setOpen] = useState(false)
  const loadBundled = () => { setErr(''); fetch(`${import.meta.env.BASE_URL}data.csv`).then(r => { if (!r.ok) throw new Error('data.csv not found in /public'); return r.text() })
    .then(t => { const r = parseCsv(t); setDs({ rows: r.rows, p: r.profile, source: 'Bundled dataset (data.csv)', at: new Date() }); setF({}) }).catch(e => setErr(e.message)) }
  useEffect(loadBundled, [])
  const rows = useMemo(() => (ds ? applyFilters(ds.rows, f) : []), [ds, f])
  if (err) return <div className="p-8"><Empty text={`Could not load the dataset: ${err}. Place your CSV at public/data.csv and restart, or refresh.`} /></div>
  if (!ds) return <div className="p-8 text-slate-500">Loading dataset…</div>
  const { p } = ds, filterable = p.categorical
  const toggle = (c: string, v: string) => setF({ ...f, [c]: f[c]?.includes(v) ? f[c].filter(x => x !== v) : [...(f[c] || []), v] })
  const vals = (c: string) => [...new Set(ds.rows.map(r => String(r[c])))].sort()
  const views = [
    <Overview rows={rows} p={p} />,
    <DimView rows={rows} p={p} title="Campaign segments (Campaign Type × Channel)" options={[['CampaignType', 'CampaignChannel'], ['CampaignType']]} metric0="cpa" />,
    <DimView rows={rows} p={p} title="Channel performance & contribution" options={[['CampaignChannel']]} metric0="spend" />,
    <DimView rows={rows} p={p} title="Audience groups" options={[['Age_Group'], ['Gender'], ['Engagement_Group']]} />,
    <DimView rows={rows} p={p} title="Conversions by channel, type and audience" options={[['CampaignChannel'], ['CampaignType'], ['Age_Group']]} metric0="conv" />,
    <Explorer rows={rows} total={ds.rows.length} p={p} source={ds.source} onReset={loadBundled} onLoad={(r, pr, n) => { setDs({ rows: r, p: pr, source: `Uploaded: ${n}`, at: new Date() }); setF({}) }} />,
    <Insights rows={rows} p={p} />]
  return <div className="min-h-screen lg:flex">
    <aside className={`${open ? 'block' : 'hidden'} lg:block bg-slate-900 text-slate-200 lg:w-64 p-4 lg:min-h-screen`}>
      <div className="flex items-center gap-2 font-bold text-white mb-6"><BarChart3 className="text-teal-400" />Marketing BI</div>
      <nav className="space-y-1">{NAV.map(([n, Icon], i) => <button key={n} onClick={() => { setPage(i); setOpen(false) }} className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-sm ${i === page ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Icon size={16} />{n}</button>)}</nav></aside>
    <main className="flex-1 p-4 sm:p-6 min-w-0">
      <header className="flex items-start justify-between gap-3 mb-4"><div><h1 className="text-2xl font-bold">Digital Marketing Analytics</h1><p className="text-slate-500 text-sm">Campaign Performance & Business Intelligence</p>
        <p className="text-xs text-slate-500 mt-1"><span className="inline-block w-2 h-2 rounded-full bg-teal-500 mr-1" />{ds.source} · {ds.rows.length.toLocaleString()} rows · updated {ds.at.toLocaleString()}</p></div>
        <button className="lg:hidden border rounded-lg p-2" aria-label="Menu" onClick={() => setOpen(!open)}><Menu size={18} /></button></header>
      <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4"><div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {filterable.map(c => <div key={c} className="flex items-center gap-1 flex-wrap"><span className="text-slate-500">{c}:</span>{vals(c).map(v => <button key={v} onClick={() => toggle(c, v)} aria-pressed={!!f[c]?.includes(v)} className={`px-2 py-0.5 rounded-full border text-xs ${f[c]?.includes(v) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white'}`}>{v}</button>)}</div>)}
        <button className="ml-auto border rounded-lg px-2 py-1" onClick={() => setF({})}>Clear all filters</button></div>
        <p className="text-xs text-slate-500 mt-2">{rows.length.toLocaleString()} of {ds.rows.length.toLocaleString()} records{!p.columns.some(c => /date/i.test(c)) && ' · No date column, so no date filter'}</p></div>
      {views[page]}</main></div>
}
