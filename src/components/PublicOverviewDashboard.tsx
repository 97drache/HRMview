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
import { resolvePublicOverviewKpi, type PublicHeadcountSnapshotV1 } from '../lib/headcountPublicSnapshot'
import { HcBlock, HC, HcHero, HcMetricCard, HcPage } from './headcountWebUi'

export type PublicHeadcountNav = 'home' | 'p-1-1' | 'p-1-2' | 'p-1-3' | 'p-1-4' | 'p-1-5'

function fmtWithScheduled(current: number, scheduled: number): string {
  if (current === 0 && scheduled === 0) return '0'
  if (scheduled > 0) return `${current}, 예정 ${scheduled}`
  return `${current}`
}

export function PublicOverviewDashboard({
  snap,
}: {
  snap: PublicHeadcountSnapshotV1
  onNavigate?: (k: Exclude<PublicHeadcountNav, 'home'>) => void
}) {
  const kpi = resolvePublicOverviewKpi(snap)
  const total = kpi.male + kpi.female
  const y = kpi.statYear

  const trend = [...snap.yearlyRank]
    .sort((a, b) => a.year - b.year)
    .slice(-6)
    .map((r) => ({ year: r.year, count: r.total }))

  const barData = snap.jobGender.map((r) => ({ name: r.job, 남: r.male, 여: r.female }))

  const metrics: { label: string; value: string }[] = [
    { label: '남녀', value: `${kpi.male}, ${kpi.female}` },
    { label: '정규·무기', value: `${kpi.regular}, ${kpi.mugi}` },
    { label: '공로연수', value: `${kpi.meritTraining}` },
    { label: '휴직', value: fmtWithScheduled(kpi.onLeave, kpi.leaveScheduled) },
    { label: '출산휴가', value: fmtWithScheduled(kpi.onMaternity, kpi.maternityScheduled) },
    { label: `${y}년 신입`, value: `${kpi.hiresYtd}` },
    { label: `${y}년 퇴직`, value: `${kpi.resignsYtd}` },
    { label: `${y}년 임금피크`, value: `${kpi.wagePeakYtd}` },
  ]

  const tooltipStyle = {
    borderRadius: 12,
    border: `1px solid ${HC.grid}`,
    fontSize: 12,
    backgroundColor: '#fff',
    color: HC.value,
  }

  return (
    <HcPage>
      <HcHero total={total} />

      <div className="grid grid-cols-2 gap-4">
        {metrics.map((m) => (
          <HcMetricCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      <HcBlock title="직종별 인원">
        <div className="h-[252px] w-full sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 8, right: 8, left: -8, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ccc" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: HC.label, fontSize: 10 }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={56}
              />
              <YAxis allowDecimals={false} tick={{ fill: HC.label, fontSize: 10 }} width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="남" stackId="a" fill={HC.green} />
              <Bar dataKey="여" stackId="a" fill={HC.mintSoft} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </HcBlock>

      <HcBlock title="연도별 재직">
        <div className="h-[220px] w-full sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 8, left: -4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
              <XAxis dataKey="year" tick={{ fill: HC.label, fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fill: HC.label, fontSize: 10 }} width={32} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="count"
                name="재직"
                stroke={HC.green}
                strokeWidth={2.5}
                dot={{ r: 4, fill: HC.hero, stroke: HC.green, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </HcBlock>
    </HcPage>
  )
}
