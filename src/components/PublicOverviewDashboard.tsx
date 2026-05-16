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
import { SB } from '../lib/headcountWebTheme'
import type { PublicHeadcountSnapshotV1 } from '../lib/headcountPublicSnapshot'

export type PublicHeadcountNav = 'home' | 'p-1-1' | 'p-1-2' | 'p-1-3' | 'p-1-4' | 'p-1-5'

function StatCard({
  label,
  value,
  sub,
  accent = 'green',
}: {
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'gold' | 'brown'
}) {
  const accentBar =
    accent === 'gold'
      ? 'from-[#CBA258] to-[#E8C872]'
      : accent === 'brown'
        ? 'from-[#6F4E37] to-[#3D2817]'
        : 'from-[#00704A] to-[#1E8E5E]'
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#FAF8F5] px-5 py-6 text-center shadow-[0_8px_24px_rgba(30,57,50,0.08)] ring-1 ring-[#00704A]/10">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accentBar}`} />
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#6F4E37]/80">{label}</p>
      <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-[#1E3932] sm:text-[1.65rem]">
        {value}
      </p>
      {sub ? <p className="mt-2 text-xs leading-relaxed text-[#6F4E37]/70">{sub}</p> : null}
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
    <section className="overflow-hidden rounded-3xl bg-[#FAF8F5] shadow-[0_8px_28px_rgba(30,57,50,0.08)] ring-1 ring-[#00704A]/10">
      <div className="border-b border-[#E0D9CF]/80 bg-gradient-to-r from-[#F2F0EB] to-[#FAF8F5] px-5 py-4 text-center">
        <h3 className="text-sm font-bold text-[#1E3932]">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-[#6F4E37]/75">{subtitle}</p> : null}
      </div>
      <div className="h-[252px] w-full bg-white/40 p-3 sm:h-[300px] sm:p-5">{children}</div>
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

  const tooltipStyle = {
    borderRadius: 12,
    border: `1px solid ${SB.grid}`,
    fontSize: 12,
    backgroundColor: SB.creamCard,
    color: SB.brown,
    boxShadow: '0 6px 20px rgba(30,57,50,0.12)',
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-8 sm:max-w-2xl sm:space-y-10">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#1E3932] via-[#006241] to-[#00704A] px-6 py-8 shadow-[0_12px_40px_rgba(30,57,50,0.35)] sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#D4E9E2]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-[#CBA258]/15 blur-3xl" />
        <div className="relative text-center">
          <p className="text-xs font-medium tracking-wide text-[#D4E9E2]/95">
            {format(baseDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })} 기준
          </p>
          <div className="mt-5 flex items-end justify-center gap-2">
            <span className="text-6xl font-bold tabular-nums leading-none tracking-tight text-white sm:text-7xl">
              {total}
            </span>
            <span className="pb-2 text-lg font-medium text-[#D4E9E2]">명 재직</span>
          </div>
          <div className="mx-auto mt-7 max-w-xs">
            <div className="flex justify-between text-xs font-medium text-[#D4E9E2]/90">
              <span>남 {male}</span>
              <span>여 {female} ({femalePct}%)</span>
            </div>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#D4E9E2] to-[#CBA258]"
                style={{ width: `${femalePct}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-5 sm:gap-6">
        <StatCard
          label="정규 · 무기"
          value={sumRow ? `${sumRow.regular} · ${sumRow.mugi}` : '—'}
          sub="고용 형태"
          accent="brown"
        />
        <StatCard
          label="공로연수"
          value={`${snap.meritTrainingCount}명`}
          sub="기준일 구간"
          accent="gold"
        />
        <StatCard
          label="연말 인원"
          value={trend.length ? `${trend[trend.length - 1]!.count}명` : '—'}
          sub={trend.length ? `${trend[trend.length - 1]!.year}년` : undefined}
          accent="green"
        />
        <StatCard
          label="직종 수"
          value={`${jg.length}개`}
          sub="행정·기술·기능 등"
          accent="brown"
        />
      </div>

      <ChartShell title="직종별 인원" subtitle="남·여 스택">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 8, right: 8, left: -8, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={SB.grid} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: SB.axis, fontSize: 10 }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={56}
            />
            <YAxis allowDecimals={false} tick={{ fill: SB.axis, fontSize: 10 }} width={28} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8, color: SB.brown }} />
            <Bar dataKey="남" stackId="a" fill={SB.green} />
            <Bar dataKey="여" stackId="a" fill={SB.mintSoft} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="연도별 재직" subtitle="연말 스냅샷">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 8, right: 8, left: -4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={SB.grid} />
            <XAxis dataKey="year" tick={{ fill: SB.axis, fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fill: SB.axis, fontSize: 10 }} width={32} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type="monotone"
              dataKey="count"
              name="재직"
              stroke={SB.green}
              strokeWidth={2.5}
              dot={{ r: 4, fill: SB.gold, stroke: SB.greenHouse, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>

      <p className="hidden text-center text-xs text-[#6F4E37]/60 lg:block">
        상세 표·차트는 왼쪽 메뉴에서 1-1 ~ 1-5를 선택하세요.
      </p>
    </div>
  )
}
