import { addMonths, format, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { NavKey } from '../navConfig'
import type { LeaveRow, PersonnelRow } from '../types/hr'
import { fmt } from '../lib/dates'
import {
  buildLeaveReport,
  buildMaternityReport,
  headcountByGenderEmployment,
  headcountByJobGenderOrdered,
  newHiresByMovementRank,
  resignationsByMovementRank,
  upcomingRetirements,
  wagePeakByYear,
  yearlyHeadcountSeries,
} from '../lib/hrEngine'

const AXIS = '#64748b'
const GRID = '#e2e8f0'
const TEAL = '#0d9488'
const SKY = '#38bdf8'

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string | number
  hint?: string
  accent?: 'default' | 'amber' | 'rose'
}) {
  const ring =
    accent === 'amber'
      ? 'ring-amber-500/25'
      : accent === 'rose'
        ? 'ring-rose-500/20'
        : 'ring-teal-500/20'
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ${ring} transition-shadow hover:shadow-md`}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1.5 tabular-nums text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  )
}

export function OverviewDashboard({
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
  const jg = headcountByJobGenderOrdered(personnel, baseDate)
  const total = jg.reduce((a, r) => a + r.total, 0)
  const male = jg.reduce((a, r) => a + r.male, 0)
  const female = jg.reduce((a, r) => a + r.female, 0)

  const ge = headcountByGenderEmployment(personnel, baseDate)
  const sumRow = ge.find((r) => r.label === '계')

  const leaveRows = buildLeaveReport(leave, baseDate, personnel)
  const onLeave = leaveRows.filter((r) => !r.scheduled).length
  const leaveSoon = leaveRows.filter((r) => r.scheduled).length

  const matRows = buildMaternityReport(leave, baseDate, personnel)
  const onMaternity = matRows.filter((r) => !r.scheduled).length
  const matSoon = matRows.filter((r) => r.scheduled).length

  const hires = newHiresByMovementRank(personnel, y)
  const hireCount = hires.reduce(
    (a, c) => a + c.monthGroups.reduce((n, g) => n + g.names.length, 0),
    0,
  )
  const resigns = resignationsByMovementRank(personnel, y)
  const resignCount = resigns.reduce(
    (a, c) => a + c.monthGroups.reduce((n, g) => n + g.entries.length, 0),
    0,
  )

  const wagePeakN = wagePeakByYear(personnel, y).length

  const retireHorizon = addMonths(startOfDay(baseDate), 12)
  const retireSoon = upcomingRetirements(personnel, baseDate).filter(
    (x) => x.retireAt && startOfDay(x.retireAt).getTime() <= retireHorizon.getTime(),
  ).length

  const trendFrom = y - 5
  const trend = yearlyHeadcountSeries(personnel, trendFrom, y)

  const barData = jg.map((r) => ({ name: r.job, 남: r.male, 여: r.female }))

  const quick = [
    { key: 'p-1-1' as NavKey, label: '1-1 직종별' },
    { key: 'p-1-3' as NavKey, label: '1-3 직급·연도' },
    { key: 'l-2-1' as NavKey, label: '2-1 휴직' },
    { key: 'm-3-1' as NavKey, label: '3-1 신입' },
    { key: 'm-3-4' as NavKey, label: '3-4 정년 예정' },
  ]

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-slate-900 text-white shadow-xl">
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="relative">
            <p className="text-sm font-medium text-slate-400">
              기준일{' '}
              <time dateTime={format(baseDate, 'yyyy-MM-dd')}>
                {format(baseDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
              </time>
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div className="tabular-nums text-5xl font-semibold tracking-tight sm:text-6xl">{total}</div>
              <div className="pb-1 text-lg text-slate-300">명 재직</div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
              직종·휴직·입퇴사 핵심 지표를 한 화면에 모았습니다. 아래 카드와 그래프로 흐름을 바로 확인한 뒤, 상세는 왼쪽
              메뉴에서 열 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="남 · 여"
          value={`${male} · ${female}`}
          hint={total > 0 ? `여성 비중 ${Math.round((female / total) * 100)}%` : undefined}
        />
        <Kpi
          label="정규직 · 무기직"
          value={sumRow ? `${sumRow.regular} · ${sumRow.mugi}` : '—'}
          hint="1-2와 동일 기준"
        />
        <Kpi
          label="휴직"
          value={
            onLeave === 0 && leaveSoon === 0
              ? '0'
              : `${onLeave}명` + (leaveSoon > 0 ? ` · 예정 ${leaveSoon}` : '')
          }
          hint="본 휴직·예정 (2-1)"
          accent="amber"
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
        <Kpi label={`${y}년 신입`} value={`${hireCount}명`} />
        <Kpi label={`${y}년 퇴직`} value={`${resignCount}명`} accent={resignCount ? 'rose' : 'default'} />
        <Kpi label={`${y}년 임금피크`} value={`${wagePeakN}명`} hint="연말 기준 재직자" />
        <Kpi label="12개월 내 정년 예정" value={`${retireSoon}명`} hint={`~ ${fmt(retireHorizon)}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">직종별 인원 (남·여)</h3>
          <p className="mt-0.5 text-xs text-slate-500">1-1과 동일 데이터 · 스택 막대</p>
          <div className="mt-3 h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: AXIS, fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={52} />
                <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} width={32} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="남" stackId="a" fill={TEAL} radius={[0, 0, 0, 0]} />
                <Bar dataKey="여" stackId="a" fill={SKY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">연도별 재직 인원</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {trendFrom}년 ~ {y}년 연말 스냅샷
          </p>
          <div className="mt-3 h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="year" tick={{ fill: AXIS, fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} width={36} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="count" name="재직" stroke={TEAL} strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
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
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-right">
        <button
          type="button"
          onClick={() => onNavigate('sitemap')}
          className="text-[10px] text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
        >
          사이트맵
        </button>
      </div>
    </div>
  )
}
