import { CopyableSimpleBar } from './CopyableChart'
import { HcMetricCard } from './headcountWebUi'
import {
  resolvePublicMovementOverview,
  type PublicHeadcountSnapshotV1,
} from '../lib/headcountPublicSnapshot'

const TEAL = '#0d9488'
const ROSE = '#e11d48'

export function PublicMovementOverviewDashboard({ snap }: { snap: PublicHeadcountSnapshotV1 }) {
  const data = resolvePublicMovementOverview(snap)
  if (!data) {
    return (
      <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 ring-1 ring-slate-200">
        입퇴사 집계 데이터가 없습니다.
      </p>
    )
  }

  const { statYear: y, fromYear: from, toYear: to } = data
  const hiresChart = data.hiresByYear.map((p) => ({ year: `${p.year}`, 인원: p.count }))
  const resignsChart = data.resignsByYear.map((p) => ({ year: `${p.year}`, 인원: p.count }))
  const hiresTotal = data.hiresByYear.reduce((sum, p) => sum + p.count, 0)
  const resignsTotal = data.resignsByYear.reduce((sum, p) => sum + p.count, 0)

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 to-cyan-900 px-5 py-6 text-white shadow-md">
        <p className="text-xs font-medium text-teal-100/90">3-0 · 입퇴사현황</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <span className="text-4xl font-semibold tabular-nums">{data.thisYearHires}</span>
          <span className="pb-1 text-sm text-teal-100">{y}년 입사</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <HcMetricCard label={`${y}년 입사`} value={`${data.thisYearHires}명`} />
        <HcMetricCard label={`${y}년 퇴직`} value={`${data.thisYearResigns}명`} />
        <HcMetricCard label="10년 입사 합계" value={`${hiresTotal}명`} />
        <HcMetricCard label="10년 퇴직 합계" value={`${resignsTotal}명`} />
      </div>

      {hiresChart.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">연도별 입사</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {from}~{to}년 · 입사일 기준
          </p>
          <div className="mt-3 h-[240px]">
            <CopyableSimpleBar
              title={`입사 (${from}~${to})`}
              data={hiresChart}
              xKey="year"
              yKey="인원"
              height={220}
              barColor={TEAL}
              showValueLabels
            />
          </div>
        </div>
      ) : null}

      {resignsChart.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">연도별 퇴직</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {from}~{to}년 · 퇴직일 기준
          </p>
          <div className="mt-3 h-[240px]">
            <CopyableSimpleBar
              title={`퇴직 (${from}~${to})`}
              data={resignsChart}
              xKey="year"
              yKey="인원"
              height={220}
              barColor={ROSE}
              showValueLabels
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
