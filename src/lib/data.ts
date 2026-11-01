import Papa from 'papaparse'
export type Row = Record<string, string | number | null>
export type Profile = { columns: string[]; numeric: string[]; categorical: string[]; constant: string[]; missing: Record<string, number>; dupes: number }
export type Filters = Record<string, string[]>
export type Agg = { name: string; n: number; spend: number; conv: number; convRate: number | null; cpa: number | null; avgCtr: number | null; avgEng: number | null; spendShare: number | null }

export function parseCsv(text: string): { rows: Row[]; profile: Profile } {
  const r = Papa.parse<Row>(text, { header: true, dynamicTyping: true, skipEmptyLines: true })
  const rows = r.data, columns = r.meta.fields || []
  if (!rows.length || !columns.length) throw new Error('No data rows found. Use a CSV file with a header row and at least one record.')
  const numeric: string[] = [], categorical: string[] = [], constant: string[] = [], missing: Record<string, number> = {}
  for (const c of columns) {
    const vals = rows.map(x => x[c]).filter(v => v !== null && v !== undefined && v !== '')
    missing[c] = rows.length - vals.length
    const u = new Set(vals).size
    if (u <= 1) constant.push(c)
    else if (vals.every(v => typeof v === 'number')) numeric.push(c)
    else if (u <= 30) categorical.push(c)
  }
  const dupes = rows.length - new Set(rows.map(x => JSON.stringify(x))).size
  return { rows, profile: { columns, numeric, categorical, constant, missing, dupes } }
}
export const col = (p: Profile, name: string) => p.columns.find(c => c.toLowerCase() === name.toLowerCase())
export const applyFilters = (rows: Row[], f: Filters) =>
  rows.filter(r => Object.entries(f).every(([c, v]) => !v.length || v.includes(String(r[c]))))
const num = (v: any) => (typeof v === 'number' && isFinite(v) ? v : 0)
const sum = (rows: Row[], c?: string) => (c ? rows.reduce((a, r) => a + num(r[c]), 0) : 0)
const div = (a: number, b: number) => (b > 0 ? a / b : null)
const isBinary = (rows: Row[], c?: string) => !!c && rows.every(r => r[c] === 0 || r[c] === 1 || r[c] === null)

export const METRICS = [
  { key: 'n', label: 'Customers', fmt: 'int' }, { key: 'spend', label: 'Ad Spend', fmt: 'money' },
  { key: 'conv', label: 'Conversions', fmt: 'int' }, { key: 'convRate', label: 'Conversion Rate', fmt: 'pct' },
  { key: 'cpa', label: 'Cost per Acquisition', fmt: 'money' }, { key: 'avgCtr', label: 'Avg CTR (per customer)', fmt: 'pct' },
  { key: 'avgEng', label: 'Avg Engagement Score', fmt: 'num' }, { key: 'spendShare', label: 'Share of Spend', fmt: 'pct' },
] as const
export function fmt(v: number | null | undefined, kind: string) {
  if (v === null || v === undefined || !isFinite(v)) return 'n/a'
  if (kind === 'pct') return (v * 100).toFixed(1) + '%'
  if (kind === 'num') return v.toLocaleString(undefined, { maximumFractionDigits: 1 })
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function aggregate(rows: Row[], p: Profile, dims: string[]): Agg[] {
  const s = col(p, 'AdSpend'), cv = col(p, 'Conversion'), ct = col(p, 'ClickThroughRate'), en = col(p, 'Engagement_Score')
  const useConv = isBinary(rows, cv) ? cv : undefined
  const g = new Map<string, Row[]>()
  for (const r of rows) { const k = dims.map(d => String(r[d])).join(' × '); (g.get(k) || g.set(k, []).get(k)!).push(r) }
  const total = sum(rows, s)
  return [...g].map(([name, rs]) => {
    const spend = sum(rs, s), conv = sum(rs, useConv)
    return { name, n: rs.length, spend, conv, convRate: useConv ? div(conv, rs.length) : null, cpa: s && useConv ? div(spend, conv) : null,
      avgCtr: ct ? div(sum(rs, ct), rs.length) : null, avgEng: en ? div(sum(rs, en), rs.length) : null, spendShare: s ? div(spend, total) : null }
  })
}

export function kpis(rows: Row[], p: Profile) {
  const a = aggregate(rows, p, [])[0]
  if (!a) return []
  const hasS = !!col(p, 'AdSpend'), hasC = isBinary(rows, col(p, 'Conversion')) && !!col(p, 'Conversion')
  return [
    { label: 'Customer Records', v: a.n, k: 'int', note: 'Rows after filters' },
    hasS && { label: 'Total Ad Spend', v: a.spend, k: 'money', note: 'Currency not specified in data' },
    hasC && { label: 'Conversions', v: a.conv, k: 'int', note: 'Sum of Conversion flag' },
    hasC && { label: 'Conversion Rate', v: a.convRate, k: 'pct', note: 'Conversions ÷ customers' },
    hasS && hasC && { label: 'Cost per Acquisition', v: a.cpa, k: 'money', note: 'Total spend ÷ conversions' },
    col(p, 'ClickThroughRate') && { label: 'Avg CTR', v: a.avgCtr, k: 'pct', note: 'Mean of per-customer CTR (no click/impression counts)' },
    col(p, 'Engagement_Score') && { label: 'Avg Engagement Score', v: a.avgEng, k: 'num', note: 'Mean per customer' },
  ].filter(Boolean) as { label: string; v: number | null; k: string; note: string }[]
}

export function limitations(p: Profile) {
  const L: string[] = []
  if (!p.columns.some(c => /date/i.test(c))) L.push('No date column: trend-over-time charts and the date filter are unavailable.')
  if (!col(p, 'Revenue')) L.push('No revenue column: revenue and ROAS cannot be calculated.')
  if (!col(p, 'Impressions') || !col(p, 'Clicks')) L.push('No impressions/click counts: aggregate CTR and CPC cannot be calculated; CTR shown is a mean of per-customer values.')
  if (!col(p, 'Campaign')) L.push('No campaign name: "campaigns" are shown as Campaign Type × Channel segments.')
  if (p.constant.length) L.push(`Single-valued columns ignored for filters/charts: ${p.constant.join(', ')}.`)
  return L
}

export function insights(rows: Row[], p: Profile) {
  const out: { title: string; metric: string; text: string; rec: string }[] = []
  const ch = col(p, 'CampaignChannel'), ty = col(p, 'CampaignType'), eg = col(p, 'Engagement_Group')
  const totConv = sum(rows, col(p, 'Conversion'))
  if (ch) {
    const a = aggregate(rows, p, [ch]).filter(x => x.n >= 30)
    const best = [...a].filter(x => x.convRate !== null).sort((x, y) => y.convRate! - x.convRate!)
    const cpa = [...a].filter(x => x.cpa !== null).sort((x, y) => x.cpa! - y.cpa!)
    if (best.length > 1) out.push({ title: 'Highest conversion rate by channel', metric: `${best[0].name}: ${fmt(best[0].convRate, 'pct')}`,
      text: `Lowest is ${best.at(-1)!.name} at ${fmt(best.at(-1)!.convRate, 'pct')}. This is an observed difference, not proof of cause.`, rec: `Review what ${best[0].name} does differently before shifting budget.` })
    if (cpa.length > 1) out.push({ title: 'Lowest cost per acquisition by channel', metric: `${cpa[0].name}: ${fmt(cpa[0].cpa, 'money')}`,
      text: `Highest CPA is ${cpa.at(-1)!.name} at ${fmt(cpa.at(-1)!.cpa, 'money')}.`, rec: `Consider testing more spend in ${cpa[0].name} and tighter targeting in ${cpa.at(-1)!.name}.` })
    const gap = a.filter(x => x.spendShare !== null && totConv > 0).map(x => ({ x, d: x.spendShare! - x.conv / totConv })).sort((u, v) => v.d - u.d)[0]
    if (gap && gap.d > 0.02) out.push({ title: 'Spend share exceeds conversion share', metric: `${gap.x.name}: ${fmt(gap.x.spendShare, 'pct')} of spend vs ${fmt(gap.x.conv / totConv, 'pct')} of conversions`,
      text: 'This channel takes a larger share of budget than of conversions in the filtered data.', rec: 'Audit this channel’s targeting and creative.' })
  }
  if (ch && ty) {
    const a = aggregate(rows, p, [ty, ch]).filter(x => x.n >= 30 && x.cpa !== null).sort((x, y) => x.cpa! - y.cpa!)
    if (a.length > 1) out.push({ title: 'Segment efficiency range (CPA)', metric: `${a[0].name}: ${fmt(a[0].cpa, 'money')} vs ${a.at(-1)!.name}: ${fmt(a.at(-1)!.cpa, 'money')}`,
      text: 'Segments with at least 30 customers, ranked by cost per acquisition.', rec: `Prioritise learning from ${a[0].name}; reassess ${a.at(-1)!.name}.` })
  }
  if (eg) {
    const a = aggregate(rows, p, [eg]).filter(x => x.n >= 30 && x.convRate !== null).sort((x, y) => y.convRate! - x.convRate!)
    if (a.length > 1) out.push({ title: 'Conversion rate by engagement group', metric: `${a[0].name}: ${fmt(a[0].convRate, 'pct')} vs ${a.at(-1)!.name}: ${fmt(a.at(-1)!.convRate, 'pct')}`,
      text: 'Association between engagement group and conversion in this data; direction of cause is unknown.', rec: 'Test whether raising engagement changes conversion before investing heavily.' })
  }
  return out
}
export const exportCsv = (rows: Row[], name = 'filtered_data.csv') => {
  const url = URL.createObjectURL(new Blob([Papa.unparse(rows)], { type: 'text/csv' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}
