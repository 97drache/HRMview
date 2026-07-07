import { format } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import type { NavKey } from '../navConfig'
import type { LeaveRow, PersonnelRow } from '../types/hr'
import { CopyableSimpleBar } from './CopyableChart'
import {
  buildLeaveReport,
  buildMaternityReport,
  childcareLeavePresentByYear,
  childcareLeaveStartsByYear,
  recentYearRange,
} from '../lib/hrEngine'

const ROSE = '#e11d48'
const AMBER = '#d97706'

function Kpi({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-rose-100 bg-white p-4 shadow-sm ring-1 ring-rose-500/15 transition-shadow hover:shadow-md">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1.5 tabular-nums text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  )
}

export function MaternityOverviewDashboard({
  personnel,
  leave,
  baseDate,
  onNavigate,
}: {
  personnel: PersonnelRow[]
  leave: LeaveRow[]
  baseDate: Date
  onNavigate: (k: NavKey) => void
}) {
  const y = baseDate.getFullYear()
  const { from, to } = recentYearRange(y, 10)

  const leaveRows = buildLeaveReport(leave, baseDate, personnel)
  const onChildcare = leaveRows.filter((r) => !r.scheduled && /육아/.test(r.reason)).length
  const childcareSoon = leaveRows.filter((r) => r.scheduled && /육아/.test(r.reason)).length

  const matRows = buildMaternityReport(leave, baseDate, personnel)
  const onMaternity = matRows.filter((r) => !r.scheduled).length
  const matSoon = matRows.filter((r) => r.scheduled).length
  const onLeave = leaveRows.filter((r) => !r.scheduled).length

  const startsSeries = childcareLeaveStartsByYear(leave, from, to)
  const presentSeries = childcareLeavePresentByYear(leave, from, to)
  const thisYearStarts = startsSeries.find((p) => p.year === y)?.count ?? 0
  const thisYearPresent = presentSeries.find((p) => p.year === y)?.count ?? 0

  const startsChart = startsSeries.map((p) => ({ year: `${p.year}`, 인원: p.count }))
  const presentChart = presentSeries.map((p) => ({ year: `${p.year}`, 인원: p.count }))

  const quick = [
    { key: 'l-2-1' as NavKey, label: '2-1 휴직' },
    { key: 'l-2-2' as NavKey, label: '2-2 출산휴가' },
    { key: 'l-2-3' as NavKey, label: '2-3 임신기단축' },
    { key: 'l-2-4' as NavKey, label: '2-4 육아기단축' },
    { key: 'l-2-5' as NavKey, label: '2-5 개인 이력' },
  ]

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-rose-950 via-rose-900 to-amber-950 text-white shadow-xl">
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-rose-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="relative">
            <p className="text-sm font-medium text-rose-200/90">
              모성보호 · 기준일{' '}
              <time dateTime={format(baseDate, 'yyyy-MM-dd')}>
                {format(baseDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
              </time>
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div className="tabular-nums text-5xl font-semibold tracking-tight sm:text-6xl">{onChildcare}</div>
              <div className="pb-1 text-lg text-rose-100">명 육아휴직 중</div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-rose-100/85">
              휴직·출산·단축 현황과 최근 10년 육아휴직 추이를 한 화면에서 확인합니다. 아래 그래프는 본 휴직(휴직종류·시작·종료
              필수) 중 육아휴직만 집계합니다.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="육아휴직"
          value={
            onChildcare === 0 && childcareSoon === 0
              ? '0'
              : `${onChildcare}명` + (childcareSoon > 0 ? ` · 예정 ${childcareSoon}` : '')
          }
          hint="2-1 기준 · 본 휴직"
        />
        <Kpi
          label="출산휴가"
          value={
            onMaternity === 0 && matSoon === 0
              ? '0'
              : `${onMaternity}명` + (matSoon > 0 ? ` · 예정 ${matSoon}` : '')
          }
          hint="2-2 기준"
        />
        <Kpi label="전체 휴직" value={`${onLeave}명`} hint="본 휴직 (2-1)" />
        <Kpi label={`${y}년 육아휴직`} value={`개시 ${thisYearStarts} · 해당 ${thisYearPresent}`} hint="아래 그래프와 동일" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">연도별 육아휴직 개시 인원</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {from}년 ~ {to}년 · 해당 연도에 육아휴직을 <strong>개시</strong>한 인원(사번·성명 기준 중복 제외)
          </p>
          <CopyableSimpleBar
            title={`육아휴직 개시 (${from}~${to})`}
            data={startsChart}
            xKey="year"
            yKey="인원"
            height={280}
            barColor={ROSE}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">연도별 육아휴직 해당 인원</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {from}년 ~ {to}년 · 해당 연도에 <strong>1일이라도</strong> 육아휴직인 인원(중복 제외)
          </p>
          <CopyableSimpleBar
            title={`육아휴직 해당 (${from}~${to})`}
            data={presentChart}
            xKey="year"
            yKey="인원"
            height={280}
            barColor={AMBER}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">바로 가기</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q.key}
              type="button"
              onClick={() => onNavigate(q.key)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50/50"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        막대 색: 개시{' '}
        <span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ background: ROSE }} /> · 해당{' '}
        <span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ background: AMBER }} />
      </p>
    </div>
  )
}
