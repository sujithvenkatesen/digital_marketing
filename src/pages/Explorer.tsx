import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Card, Empty } from '../components/ui'
import { Profile, Row, exportCsv, parseCsv } from '../lib/data'

export function Explorer({ rows, total, p, onLoad, onReset, source }: { rows: Row[]; total: number; p: Profile; onLoad: (rows: Row[], p: Profile, name: string) => void; onReset: () => void; source: string }) {
  const [q, setQ] = useState(''), [sc, setSc] = useState<string>(''), [asc, setAsc] = useState(true), [pg, setPg] = useState(0)
  const [vis, setVis] = useState<string[]>(p.columns.slice(0, 10)), [err, setErr] = useState(''), [pre, setPre] = useState<any>(null)
  const cols = p.columns.filter(c => vis.includes(c))
  let list = q ? rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q.toLowerCase()))) : rows
  if (sc) list = [...list].sort((a, b) => ((a[sc] ?? '') > (b[sc] ?? '') ? 1 : -1) * (asc ? 1 : -1))
  const pages = Math.max(1, Math.ceil(list.length / 25)), cur = Math.min(pg, pages - 1)
  const pick = async (f?: File) => {
    setErr(''); setPre(null); if (!f) return
    if (!/\.csv$/i.test(f.name)) return setErr('Please choose a .csv file.')
    try { const r = parseCsv(await f.text()); setPre({ ...r, name: f.name }) } catch (e: any) { setErr(e.message) }
  }
  return <div className="space-y-4">
    <Card title="Dataset & CSV upload" right={<span className="text-xs text-slate-500">Source: {source}</span>}>
      <div className="flex flex-wrap gap-3 items-center"><label className="inline-flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-sm cursor-pointer"><Upload size={16} />Choose CSV
        <input type="file" accept=".csv" className="hidden" onChange={e => pick(e.target.files?.[0])} /></label>
        <button className="text-sm border rounded-lg px-3 py-1.5" onClick={() => { setPre(null); setErr(''); onReset() }}>Reset to bundled dataset</button></div>
      {err && <p role="alert" className="text-sm text-red-600 mt-2">{err} Check the file has a header row and comma-separated values, or reset to the bundled dataset.</p>}
      {pre && <div className="mt-3 text-sm"><p><b>{pre.name}</b>: {pre.rows.length.toLocaleString()} rows, {pre.profile.columns.length} columns ({pre.profile.columns.join(', ')})</p>
        <button className="mt-2 bg-teal-600 text-white rounded-lg px-3 py-1.5" onClick={() => { onLoad(pre.rows, pre.profile, pre.name); setPre(null) }}>Load into dashboard</button></div>}
      <p className="text-xs text-slate-500 mt-3">Profile: {total.toLocaleString()} rows · {p.numeric.length} numeric · {p.categorical.length} categorical · {p.dupes} duplicate rows · missing values: {Object.entries(p.missing).filter(([, v]) => v).map(([k, v]) => `${k} (${v})`).join(', ') || 'none'}</p>
    </Card>
    <Card title="Data Explorer" right={<button className="inline-flex items-center gap-1 text-sm border rounded-lg px-2 py-1" onClick={() => exportCsv(list)}><Download size={14} />Export {list.length.toLocaleString()} rows</button>}>
      <div className="flex flex-wrap gap-2 mb-2"><input aria-label="Search" placeholder="Search all columns…" value={q} onChange={e => { setQ(e.target.value); setPg(0) }} className="border rounded-lg px-2 py-1 text-sm flex-1 min-w-40" />
        <details className="text-sm"><summary className="cursor-pointer border rounded-lg px-2 py-1">Columns ({cols.length})</summary><div className="absolute z-10 bg-white border rounded-lg p-2 max-h-60 overflow-auto shadow">
          {p.columns.map(c => <label key={c} className="block"><input type="checkbox" checked={vis.includes(c)} onChange={() => setVis(vis.includes(c) ? vis.filter(x => x !== c) : [...vis, c])} /> {c}</label>)}</div></details></div>
      <p className="text-xs text-slate-500 mb-2">Showing {list.length.toLocaleString()} of {total.toLocaleString()} records</p>
      {list.length ? <><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b">{cols.map(c => <th key={c} className="px-2 py-1 whitespace-nowrap">
        <button onClick={() => { setAsc(sc === c ? !asc : true); setSc(c) }}>{c}{sc === c ? (asc ? ' ▲' : ' ▼') : ''}</button></th>)}</tr></thead>
        <tbody>{list.slice(cur * 25, cur * 25 + 25).map((r, i) => <tr key={i} className="border-b last:border-0">{cols.map(c => <td key={c} className="px-2 py-1 whitespace-nowrap">{typeof r[c] === 'number' && !Number.isInteger(r[c]) ? (r[c] as number).toFixed(3) : String(r[c] ?? '')}</td>)}</tr>)}</tbody></table></div>
        <div className="flex items-center gap-3 mt-3 text-sm"><button disabled={cur === 0} onClick={() => setPg(cur - 1)} className="border rounded px-2 disabled:opacity-40">Prev</button>Page {cur + 1} / {pages}
          <button disabled={cur >= pages - 1} onClick={() => setPg(cur + 1)} className="border rounded px-2 disabled:opacity-40">Next</button></div></> : <Empty text="No records match your search or filters." />}
    </Card></div>
}
