import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CopyableStackedBar, CopyableYearRankChart } from '../../src/components/CopyableChart'
import { PublicOverviewDashboard } from '../../src/components/PublicOverviewDashboard'
import { Card, SimpleTable } from '../../src/components/Ui'
import type { PublicHeadcountSnapshotV1 } from '../../src/lib/headcountPublicSnapshot'
import { RANK_BAND_ORDER } from '../../src/lib/jobClassification'
import {
  ensureHomeHash,
  HEADCOUNT_NAV,
  readNavFromHash,
  writeNavHash,
  type HeadcountNav,
} from './nav'

function isSnapshot(v: unknown): v is PublicHeadcountSnapshotV1 {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return o.version === 1 && typeof o.baseDate === 'string'
}

export function App() {
  const [active, setActive] = useState<HeadcountNav>(() => readNavFromHash())
  const [snap, setSnap] = useState<PublicHeadcountSnapshotV1 | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [yearForMonth, setYearForMonth] = useState<number | null>(null)

  const selectNav = useCallback((key: HeadcountNav) => {
    setActive(key)
    writeNavHash(key)
  }, [])

  useEffect(() => {
    ensureHomeHash()
    const onHash = () => setActive(readNavFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}headcount-snapshot.json`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`스냅샷을 불러오지 못했습니다 (${res.status})`)
        const data: unknown = await res.json()
        if (cancelled) return
        if (!isSnapshot(data)) throw new Error('스냅샷 형식이 올바르지 않습니다.')
        setSnap(data)
        const y = Number(data.baseDate.slice(0, 4))
        setYearForMonth(Number.isFinite(y) ? y : new Date().getFullYear())
        setErr(null)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const monthRows = useMemo(() => {
    if (!snap || yearForMonth == null) return []
    const rows = snap.monthBoundaryByYear[String(yearForMonth)]
    return rows ?? []
  }, [snap, yearForMonth])

  const yearOptions = useMemo(() => {
    if (!snap) return []
    return Object.keys(snap.monthBoundaryByYear)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
  }, [snap])

  if (err) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-rose-50/90 px-6 py-5 text-center text-rose-950 shadow-sm">
          <p className="text-sm font-semibold">불러오기 실패</p>
          <p className="mt-2 text-sm text-rose-900/90">{err}</p>
        </div>
      </div>
    )
  }

  if (!snap || yearForMonth == null) {
    return (
      <div className="flex min-h-full items-center justify-center p-8 text-sm text-slate-500">
        스냅샷을 불러오는 중…
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="rounded-2xl border border-slate-200/80 bg-white/90 px-5 py-4 shadow-sm ring-1 ring-slate-900/5 backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700/90">HRM · 공개 집계</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">1. 인원현황</h1>
          </div>
          <dl className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-right text-xs text-slate-600">
            <div>
              <dt className="inline text-slate-500">기준일 </dt>
              <dd className="inline font-mono font-semibold text-slate-900">{snap.baseDate}</dd>
            </div>
            <div className="mt-1">
              <dt className="inline text-slate-500">생성 </dt>
              <dd className="inline font-mono text-[11px] text-slate-700">
                {snap.generatedAt.slice(0, 19).replace('T', ' ')}
              </dd>
            </div>
          </dl>
        </div>
        {snap.empty ? (
          <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs text-sky-950">
            스냅샷 데이터가 비어 있습니다. 로컬에서 <span className="font-mono">npm run export:headcount-public</span> 후
            배포하세요.
          </p>
        ) : null}
      </header>

      <div className="flex min-h-0 w-full flex-1 flex-col gap-4 lg:flex-row">
        <nav className="flex w-full shrink-0 flex-wrap gap-2 lg:w-52 lg:flex-col lg:flex-nowrap">
          {HEADCOUNT_NAV.map((it) => {
            const on = active === it.key
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => selectNav(it.key)}
                className={[
                  'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors',
                  on
                    ? it.key === 'home'
                      ? 'border-slate-800 bg-slate-900 text-white shadow-md'
                      : 'border-teal-600 bg-teal-700 text-white shadow-md shadow-teal-900/15'
                    : 'border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-7 w-8 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold',
                    on ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600',
                  ].join(' ')}
                >
                  {it.code}
                </span>
                {it.label}
              </button>
            )
          })}
        </nav>

        <main className="flex min-w-0 w-full flex-1 flex-col items-center space-y-4">
          <div className="w-full max-w-6xl">
            {active === 'home' ? (
              <PublicOverviewDashboard snap={snap} onNavigate={selectNav} />
            ) : (
              renderPanel(active, snap, yearForMonth, setYearForMonth, yearOptions, monthRows)
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function PanelBlock({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 [&>*]:w-full">{children}</div>
  )
}

function ChartBlock({ children }: { children: ReactNode }) {
  return <div className="mx-auto mt-4 w-full max-w-4xl">{children}</div>
}

function renderPanel(
  active: Exclude<HeadcountNav, 'home'>,
  snap: PublicHeadcountSnapshotV1,
  yearForMonth: number,
  setYearForMonth: (y: number) => void,
  yearOptions: number[],
  monthRows: { month: number; monthStart: number; monthEnd: number }[],
): ReactNode {
  if (active === 'p-1-1') {
    const jg = snap.jobGender
    const t = jg.reduce((a, r) => ({ m: a.m + r.male, f: a.f + r.female, x: a.x + r.total }), { m: 0, f: 0, x: 0 })
    return (
      <PanelBlock>
        <Card code="1-1" title="직종별 현황">
          <SimpleTable
            layout="centered"
            cols={[
              { key: 'job', label: '직종' },
              { key: 'male', label: '남' },
              { key: 'female', label: '여' },
              { key: 'total', label: '계' },
            ]}
            rows={[
              ...jg.map((r) => ({
                job: r.job,
                male: r.male,
                female: r.female,
                total: r.total,
              })),
              { job: '계', male: t.m, female: t.f, total: t.x },
            ]}
          />
          <ChartBlock>
            <CopyableStackedBar
              title="직종별 인원 (남·여 누적)"
              data={jg.map((r) => ({ 직종: r.job, 남: r.male, 여: r.female }))}
              xKey="직종"
              series={[
                { key: '남', name: '남', color: '#0d9488' },
                { key: '여', name: '여', color: '#38bdf8' },
              ]}
            />
          </ChartBlock>
        </Card>
      </PanelBlock>
    )
  }

  if (active === 'p-1-2') {
    const ge = snap.genderEmployment
    return (
      <PanelBlock>
        <Card code="1-2" title="남녀·고용 형태">
          <SimpleTable
            layout="centered"
            cols={[
              { key: 'label', label: '구분' },
              { key: 'regular', label: '정규직' },
              { key: 'mugi', label: '무기직' },
              { key: 'total', label: '계' },
            ]}
            rows={ge.map((r) => ({
              label: r.label,
              regular: r.regular,
              mugi: r.mugi,
              total: r.total,
            }))}
          />
          <ChartBlock>
            <CopyableStackedBar
              title="구분별 정규직·무기직"
              data={ge.filter((r) => r.label !== '계').map((r) => ({
                구분: r.label,
                정규직: r.regular,
                무기직: r.mugi,
              }))}
              xKey="구분"
              series={[
                { key: '정규직', name: '정규직', color: '#0d9488' },
                { key: '무기직', name: '무기직', color: '#38bdf8' },
              ]}
              height={280}
            />
          </ChartBlock>
        </Card>
      </PanelBlock>
    )
  }

  if (active === 'p-1-3') {
    const yr = snap.yearlyRank
    const cols = [
      { key: 'y', label: '연도', width: '10%' },
      ...RANK_BAND_ORDER.map((k) => ({ key: k, label: k })),
      { key: 'total', label: '계', width: '8%' },
    ]
    const rows = yr.map((r) => {
      const o: Record<string, ReactNode> = { y: r.year, total: r.total }
      for (const k of RANK_BAND_ORDER) o[k] = r[k]
      return o
    })
    const chartData = yr.map((r) => {
      const o: Record<string, string | number> = { year: `${r.year}년` }
      for (const k of RANK_BAND_ORDER) o[k] = r[k]
      return o
    })
    const chartKeys = RANK_BAND_ORDER.map((k) => ({ key: k, label: k }))
    return (
      <PanelBlock>
        <Card code="1-3" title="연도별 인원(연말)·직급 구분">
          <SimpleTable layout="centered" cols={cols} rows={rows} />
          <ChartBlock>
            <CopyableYearRankChart title="연도별 직급 구성 (연말)" data={chartData} keys={chartKeys} />
          </ChartBlock>
        </Card>
      </PanelBlock>
    )
  }

  if (active === 'p-1-4') {
    return (
      <PanelBlock>
        <Card code="1-4" title="월초·월말 인원">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-slate-700">대상 연도</label>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
              value={yearForMonth}
              onChange={(e) => setYearForMonth(Number(e.target.value))}
            >
              {(yearOptions.length ? yearOptions : [yearForMonth]).map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </div>
          <SimpleTable
            layout="centered"
            cols={[
              { key: 'm', label: '월' },
              { key: 'ms', label: '월초' },
              { key: 'me', label: '월말' },
            ]}
            rows={monthRows.map((r) => ({
              m: `${r.month}월`,
              ms: r.monthStart,
              me: r.monthEnd,
            }))}
          />
        </Card>
      </PanelBlock>
    )
  }

  return (
    <PanelBlock>
      <Card code="1-5" title="공로연수 현황">
        <div className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 to-indigo-50/80 px-6 py-12 text-center">
          <p className="text-sm font-medium text-violet-950/90">기준일 기준 공로연수 구간 인원</p>
          <p className="text-5xl font-bold tabular-nums tracking-tight text-violet-900">{snap.meritTrainingCount}</p>
          <p className="text-xs text-violet-800/80">명 (성명 목록은 로컬 HRM에서만 확인)</p>
        </div>
      </Card>
    </PanelBlock>
  )
}
