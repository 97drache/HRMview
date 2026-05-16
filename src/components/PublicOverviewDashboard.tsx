import { format, parseISO } from 'date-fns'
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
import type { PublicHeadcountSnapshotV1 } from '../lib/headcountPublicSnapshot'

const AXIS = '#64748b'
const GRID = '#e2e8f0'
const TEAL = '#0d9488'
const SKY = '#38bdf8'

export type PublicHeadcountNav = 'p-1-1' | 'p-1-2' | 'p-1-3' | 'p-1-4' | 'p-1-5'

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string | number
  hint?: string
  accent?: 'default' | 'violet'
}) {
  const ring = accent === 'violet' ? 'ring-violet-500/20' : 'ring-teal-500/20'
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

export function PublicOverviewDashboard({
  snap,
  onNavigate,
}: {
  snap: PublicHeadcountSnapshotV1
  onNavigate: (k: PublicHeadcountNav) => void
}) {
  const jg = snap.jobGender
  const total = jg.reduce((a, r) => a + r.total, 0)
  const male = jg.reduce((a, r) => a + r.male, 0)
  const female = jg.reduce((a, r) => a + r.female, 0)
  const sumRow = snap.genderEmployment.find((r) => r.label === '계')

  const baseDate = parseISO(snap.baseDate)

  const trend = [...snap.yearlyRank]
    .sort((a, b) => a.year - b.year)
    .slice(-6)
    .map((r) => ({ year: r.year, count: r.total }))

  const barData = jg.map((r) => ({ name: r.job, 남: r.male, 여: r.female }))

  const quick: { key: PublicHeadcountNav; label: string }[] = [
    { key: 'p-1-1', label: '1-1 직종별' },
    { key: 'p-1-2', label: '1-2 남녀·고용' },
    { key: 'p-1-3', label: '1-3 연도·직급' },
    { key: 'p-1-4', label: '1-4 월초·월말' },
    { key: 'p-1-5', label: '1-5 공로연수' },
  ]

  return (
    <div className="w-full space-y-6">
      <section className="overflow-hidden rounded-2xl bg-slate-900 text-white shadow-xl">
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="relative">
            <p className="text-sm font-medium text-slate-400">
              기준일{' '}
              <time dateTime={snap.baseDate}>
                {format(baseDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
              </time>
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div className="tabular-nums text-5xl font-semibold tracking-tight sm:text-6xl">{total}</div>
              <div className="pb-1 text-lg text-slate-300">명 재직</div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
              인원현황 핵심 숫자와 추이를 한 화면에 모았습니다. 상세 표·차트는 아래 바로가기 또는 왼쪽 메뉴에서
              확인할 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          label="공로연수"
          value={`${snap.meritTrainingCount}명`}
          hint="기준일 구간 (1-5)"
          accent="violet"
        />
        <Kpi
          label="연말 추이"
          value={trend.length ? `${trend[trend.length - 1]!.count}명` : '—'}
          hint={trend.length ? `${trend[trend.length - 1]!.year}년 연말` : undefined}
        />
      </div>

      <div className="grid w-full gap-5 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">직종별 인원 (남·여)</h3>
          <p className="mt-0.5 text-xs text-slate-500">1-1과 동일 · 스택 막대</p>
          <div className="mt-3 h-[min(280px,42vw)] min-h-[220px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: AXIS, fontSize: 11 }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={52}
                />
                <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} width={36} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="남" stackId="a" fill={TEAL} />
                <Bar dataKey="여" stackId="a" fill={SKY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">연도별 재직 인원</h3>
          <p className="mt-0.5 text-xs text-slate-500">연말 스냅샷 (1-3 합계)</p>
          <div className="mt-3 h-[min(280px,42vw)] min-h-[220px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="year" tick={{ fill: AXIS, fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} width={40} />
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

      <div className="w-full rounded-xl border border-slate-200 bg-slate-50/80 p-4">
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
    </div>
  )
}
