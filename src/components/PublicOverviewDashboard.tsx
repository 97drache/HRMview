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

export type PublicHeadcountNav = 'home' | 'p-1-1' | 'p-1-2' | 'p-1-3' | 'p-1-4' | 'p-1-5'

function StatCard({
  label,
  value,
  sub,
  accent = 'teal',
}: {
  label: string
  value: string
  sub?: string
  accent?: 'teal' | 'violet' | 'slate'
}) {
  const accentBar =
    accent === 'violet'
      ? 'from-violet-500 to-indigo-500'
      : accent === 'slate'
        ? 'from-slate-500 to-slate-600'
        : 'from-teal-500 to-cyan-500'
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white px-5 py-5 text-center shadow-md ring-1 ring-slate-900/[0.06]">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentBar}`} />
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-[1.65rem]">
        {value}
      </p>
      {sub ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{sub}</p> : null}
    </div>
  )
}

function ChartShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-900/[0.06]">
      <div className="border-b border-slate-100 px-5 py-4 text-center">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="h-[252px] w-full p-3 sm:h-[300px] sm:p-5">{children}</div>
    </section>
  )
}

export function PublicOverviewDashboard({
  snap,
}: {
  snap: PublicHeadcountSnapshotV1
  onNavigate?: (k: Exclude<PublicHeadcountNav, 'home'>) => void
}) {
  const jg = snap.jobGender
  const total = jg.reduce((a, r) => a + r.total, 0)
  const male = jg.reduce((a, r) => a + r.male, 0)
  const female = jg.reduce((a, r) => a + r.female, 0)
  const sumRow = snap.genderEmployment.find((r) => r.label === '계')
  const femalePct = total > 0 ? Math.round((female / total) * 100) : 0

  const baseDate = parseISO(snap.baseDate)

  const trend = [...snap.yearlyRank]
    .sort((a, b) => a.year - b.year)
    .slice(-6)
    .map((r) => ({ year: r.year, count: r.total }))

  const barData = jg.map((r) => ({ name: r.job, 남: r.male, 여: r.female }))

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 sm:max-w-2xl sm:space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 px-6 py-8 text-center shadow-xl sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-teal-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-0 h-32 w-32 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-medium tracking-wide text-teal-200/95">
            {format(baseDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })} 기준
          </p>
          <div className="mt-5 flex flex-col items-center gap-1">
            <span
              className="text-7xl font-extrabold tabular-nums leading-none tracking-tight text-teal-300 drop-shadow-[0_2px_24px_rgba(45,212,191,0.45)] sm:text-8xl"
              style={{ textShadow: '0 0 40px rgba(94, 234, 212, 0.35)' }}
            >
              {total}
            </span>
            <span className="text-base font-semibold text-cyan-100/90">명 재직</span>
          </div>
          <div className="mx-auto mt-7 max-w-xs">
            <div className="flex justify-between text-xs font-medium text-slate-200">
              <span>남 {male}</span>
              <span>여 {female} ({femalePct}%)</span>
            </div>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-400 to-sky-300"
                style={{ width: `${femalePct}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 sm:gap-5">
        <StatCard
          label="정규 · 무기"
          value={sumRow ? `${sumRow.regular} · ${sumRow.mugi}` : '—'}
          sub="고용 형태"
          accent="slate"
        />
        <StatCard
          label="공로연수"
          value={`${snap.meritTrainingCount}명`}
          sub="기준일 구간"
          accent="violet"
        />
        <StatCard
          label="연말 인원"
          value={trend.length ? `${trend[trend.length - 1]!.count}명` : '—'}
          sub={trend.length ? `${trend[trend.length - 1]!.year}년` : undefined}
          accent="teal"
        />
        <StatCard
          label="직종 수"
          value={`${jg.length}개`}
          sub="행정·기술·기능 등"
          accent="slate"
        />
      </div>

      <ChartShell title="직종별 인원" subtitle="남·여 스택">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 8, right: 8, left: -8, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: AXIS, fontSize: 10 }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={56}
            />
            <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 10 }} width={28} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                fontSize: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="남" stackId="a" fill={TEAL} />
            <Bar dataKey="여" stackId="a" fill={SKY} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="연도별 재직" subtitle="연말 스냅샷">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 8, right: 8, left: -4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="year" tick={{ fill: AXIS, fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 10 }} width={32} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                fontSize: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            />
            <Line type="monotone" dataKey="count" name="재직" stroke={TEAL} strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>

      <p className="hidden text-center text-xs text-slate-500 lg:block">
        상세 표·차트는 왼쪽 메뉴에서 1-1 ~ 1-5를 선택하세요.
      </p>
    </div>
  )
}
