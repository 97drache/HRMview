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

/** 라벨 + 숫자만 — 부가 설명 없음 */
function SimpleMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#FAF8F5] px-5 py-5 text-center shadow-[0_6px_20px_rgba(30,57,50,0.07)] ring-1 ring-[#00704A]/10">
      <p className="text-sm font-bold text-[#1E3932]">{label}</p>
      <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-[#00704A] sm:text-[1.6rem]">
        {value}
      </p>
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
  const baseYear = Number(snap.baseDate.slice(0, 4))

  const trend = [...snap.yearlyRank]
    .sort((a, b) => a.year - b.year)
    .slice(-6)
    .map((r) => ({ year: r.year, count: r.total }))

  const yearEnd = snap.yearlyRank.find((r) => r.year === baseYear)
  const prevYear = snap.yearlyRank.find((r) => r.year === baseYear - 1)
  const netYoY =
    yearEnd && prevYear ? yearEnd.total - prevYear.total : null

  const barData = jg.map((r) => ({ name: r.job, 남: r.male, 여: r.female }))

  const metrics: { label: string; value: string }[] = [
    { label: '남녀', value: `${male}, ${female}` },
    {
      label: '정규·무기',
      value: sumRow ? `${sumRow.regular}, ${sumRow.mugi}` : '—',
    },
    { label: '공로연수', value: `${snap.meritTrainingCount}` },
  ]

  if (yearEnd) {
    metrics.push({
      label: `${baseYear} 연말`,
      value: `${yearEnd.total}`,
    })
  }
  if (netYoY != null && netYoY !== 0) {
    metrics.push({
      label: '전년 대비',
      value: netYoY > 0 ? `+${netYoY}` : `${netYoY}`,
    })
  }

  const tooltipStyle = {
    borderRadius: 12,
    border: `1px solid ${SB.grid}`,
    fontSize: 12,
    backgroundColor: SB.creamCard,
    color: SB.brown,
    boxShadow: '0 6px 20px rgba(30,57,50,0.12)',
  }

  return (
    <div className="mx-auto w-full max-w-xl sm:max-w-2xl">
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

      <div className="mt-8 grid grid-cols-1 gap-5 sm:mt-10 sm:grid-cols-2 sm:gap-x-7 sm:gap-y-7">
        {metrics.map((m) => (
          <SimpleMetric key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      <div className="mt-10 space-y-8 sm:mt-12 sm:space-y-10">
        <ChartShell title="직종별 인원" subtitle="남·여">
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

        <ChartShell title="연도별 재직" subtitle="연말">
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
      </div>

      <p className="mt-8 hidden text-center text-xs text-[#6F4E37]/60 sm:mt-10 lg:block">
        상세는 하단 메뉴 1-1 ~ 1-5
      </p>
    </div>
  )
}
