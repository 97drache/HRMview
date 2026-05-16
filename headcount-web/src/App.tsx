import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CopyableStackedBar, CopyableYearRankChart } from '../../src/components/CopyableChart'
import { PublicOverviewDashboard } from '../../src/components/PublicOverviewDashboard'
import { SimpleTable } from '../../src/components/Ui'
import type { PublicHeadcountSnapshotV1 } from '../../src/lib/headcountPublicSnapshot'
import { RANK_BAND_ORDER } from '../../src/lib/jobClassification'
import { SB } from '../../src/lib/headcountWebTheme'
import { BottomNav } from './components/BottomNav'
import { ChartPanel } from './components/ChartPanel'
import { HeadcountCard } from './components/HeadcountCard'
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

const ACTIVE_LABEL = Object.fromEntries(HEADCOUNT_NAV.map((n) => [n.key, n.label])) as Record<
  HeadcountNav,
  string
>

export function App() {
  const [active, setActive] = useState<HeadcountNav>(() => readNavFromHash())
  const [snap, setSnap] = useState<PublicHeadcountSnapshotV1 | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [yearForMonth, setYearForMonth] = useState<number | null>(null)

  const selectNav = useCallback((key: HeadcountNav) => {
    setActive(key)
    writeNavHash(key)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
    return snap.monthBoundaryByYear[String(yearForMonth)] ?? []
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
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-md rounded-2xl bg-white px-6 py-5 text-center shadow-lg ring-1 ring-rose-200">
          <p className="text-sm font-semibold text-rose-800">불러오기 실패</p>
          <p className="mt-2 text-sm text-rose-700">{err}</p>
        </div>
      </div>
    )
  }

  if (!snap || yearForMonth == null) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-[#6F4E37]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00704A] border-t-transparent" />
        <span className="ml-3">불러오는 중…</span>
      </div>
    )
  }

  return (
    <div className="min-h-dvh w-full pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8">
      <header className="sticky top-0 z-30 border-b border-[#E0D9CF] bg-[#FAF8F5]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00704A]">HRM</p>
            <h1 className="truncate text-base font-bold text-[#1E3932] sm:text-lg">
              {active === 'home' ? '한눈에 보기' : ACTIVE_LABEL[active]}
            </h1>
          </div>
          <time className="shrink-0 rounded-full bg-[#F2F0EB] px-3 py-1 font-mono text-[11px] font-semibold text-[#3D2817] ring-1 ring-[#00704A]/15">
            {snap.baseDate}
          </time>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-6 px-3 pt-5 sm:px-5 lg:px-6">
        <nav className="hidden w-44 shrink-0 lg:block">
          <div className="sticky top-[4.5rem] space-y-1.5 rounded-3xl bg-[#FAF8F5] p-2.5 shadow-[0_8px_24px_rgba(30,57,50,0.08)] ring-1 ring-[#00704A]/10">
            {HEADCOUNT_NAV.map((it) => {
              const on = active === it.key
              return (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => selectNav(it.key)}
                  className={[
                    'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                    on ? 'bg-[#00704A] text-white shadow-sm' : 'text-[#6F4E37] hover:bg-[#F2F0EB]',
                  ].join(' ')}
                >
                  <span className="font-mono text-[11px] font-bold opacity-80">{it.code}</span>
                  <span className="truncate">{it.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <main
          className={[
            'min-w-0 flex-1 pb-4',
            active === 'home' ? 'flex justify-center' : 'flex flex-col items-center',
          ].join(' ')}
        >
          {snap.empty ? (
            <p className="mb-4 w-full max-w-2xl rounded-2xl bg-[#FFF8E7] px-4 py-3 text-center text-sm text-[#3D2817] ring-1 ring-[#CBA258]/40">
              스냅샷이 비어 있습니다. 로컬에서 export 후 다시 배포해 주세요.
            </p>
          ) : null}
          {active === 'home' ? (
            <PublicOverviewDashboard snap={snap} />
          ) : (
            renderPanel(active, snap, yearForMonth, setYearForMonth, yearOptions, monthRows)
          )}
        </main>
      </div>

      <BottomNav active={active} onSelect={selectNav} />
    </div>
  )
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
      <HeadcountCard code="1-1" title="직종별 현황">
        <SimpleTable
          layout="centered"
          cols={[
            { key: 'job', label: '직종' },
            { key: 'male', label: '남' },
            { key: 'female', label: '여' },
            { key: 'total', label: '계' },
          ]}
          rows={[
            ...jg.map((r) => ({ job: r.job, male: r.male, female: r.female, total: r.total })),
            { job: '계', male: t.m, female: t.f, total: t.x },
          ]}
        />
        <ChartPanel title="직종별 인원" subtitle="남·여 누적">
          <CopyableStackedBar
            title=""
            data={jg.map((r) => ({ 직종: r.job, 남: r.male, 여: r.female }))}
            xKey="직종"
            series={[
              { key: '남', name: '남', color: SB.green },
              { key: '여', name: '여', color: SB.mintSoft },
            ]}
            height={240}
          />
        </ChartPanel>
      </HeadcountCard>
    )
  }

  if (active === 'p-1-2') {
    const ge = snap.genderEmployment
    return (
      <HeadcountCard code="1-2" title="남녀·고용 형태">
        <SimpleTable
          layout="centered"
          cols={[
            { key: 'label', label: '구분' },
            { key: 'regular', label: '정규' },
            { key: 'mugi', label: '무기' },
            { key: 'total', label: '계' },
          ]}
          rows={ge.map((r) => ({
            label: r.label,
            regular: r.regular,
            mugi: r.mugi,
            total: r.total,
          }))}
        />
        <ChartPanel title="고용 형태" subtitle="정규·무기직">
          <CopyableStackedBar
            title=""
            data={ge.filter((r) => r.label !== '계').map((r) => ({
              구분: r.label,
              정규직: r.regular,
              무기직: r.mugi,
            }))}
            xKey="구분"
            series={[
              { key: '정규직', name: '정규', color: SB.green },
              { key: '무기직', name: '무기', color: SB.gold },
            ]}
            height={240}
          />
        </ChartPanel>
      </HeadcountCard>
    )
  }

  if (active === 'p-1-3') {
    const yr = snap.yearlyRank
    const cols = [
      { key: 'y', label: '연도' },
      ...RANK_BAND_ORDER.map((k) => ({ key: k, label: k })),
      { key: 'total', label: '계' },
    ]
    const rows = yr.map((r) => {
      const o: Record<string, ReactNode> = { y: r.year, total: r.total }
      for (const k of RANK_BAND_ORDER) o[k] = r[k]
      return o
    })
    const chartData = yr.map((r) => {
      const o: Record<string, string | number> = { year: `${r.year}` }
      for (const k of RANK_BAND_ORDER) o[k] = r[k]
      return o
    })
    const chartKeys = RANK_BAND_ORDER.map((k) => ({ key: k, label: k }))
    return (
      <HeadcountCard code="1-3" title="연도·직급">
        <SimpleTable layout="centered" cols={cols} rows={rows} />
        <ChartPanel title="연도별 직급" subtitle="연말 기준" heightClass="h-[280px] sm:h-[320px]">
          <CopyableYearRankChart title="" data={chartData} keys={chartKeys} height={260} />
        </ChartPanel>
      </HeadcountCard>
    )
  }

  if (active === 'p-1-4') {
    return (
      <HeadcountCard code="1-4" title="월초·월말">
        <label className="flex items-center justify-center gap-2 text-sm font-medium text-[#3D2817]">
          연도
          <select
            className="rounded-xl border-0 bg-[#F2F0EB] px-3 py-2 text-sm font-semibold text-[#1E3932] ring-1 ring-[#00704A]/20"
            value={yearForMonth}
            onChange={(e) => setYearForMonth(Number(e.target.value))}
          >
            {(yearOptions.length ? yearOptions : [yearForMonth]).map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </label>
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
      </HeadcountCard>
    )
  }

  return (
    <HeadcountCard code="1-5" title="공로연수">
      <div className="flex flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-[#1E3932] via-[#006241] to-[#00704A] px-6 py-14 text-center text-white shadow-[0_12px_32px_rgba(30,57,50,0.25)]">
        <p className="text-sm font-medium text-[#D4E9E2]">기준일 구간 인원</p>
        <p className="mt-3 text-6xl font-bold tabular-nums text-white">{snap.meritTrainingCount}</p>
        <p className="mt-2 text-sm text-[#D4E9E2]">명</p>
      </div>
    </HeadcountCard>
  )
}
