import { CopyableSimpleBar } from './CopyableChart'
import { HcMetricCard } from './headcountWebUi'
import {
  resolvePublicMaternityOverview,
  type PublicHeadcountSnapshotV1,
} from '../lib/headcountPublicSnapshot'

const ROSE = '#e11d48'
const AMBER = '#d97706'

function fmtWithScheduled(current: number, scheduled: number): string {
  if (current === 0 && scheduled === 0) return '0'
  if (scheduled > 0) return `${current} · 예정 ${scheduled}`
  return `${current}`
}

export function PublicMaternityOverviewDashboard({ snap }: { snap: PublicHeadcountSnapshotV1 }) {
  const data = resolvePublicMaternityOverview(snap)
  if (!data) {
    return (
      <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 ring-1 ring-slate-200">
        모성보호 집계 데이터가 없습니다.
      </p>
    )
  }

  const { statYear: y, fromYear: from, toYear: to } = data
  const startsChart = data.startsByYear.map((p) => ({ year: `${p.year}`, 인원: p.count }))
  const presentChart = data.presentByYear.map((p) => ({ year: `${p.year}`, 인원: p.count }))

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-rose-900 to-amber-900 px-5 py-6 text-white shadow-md">
        <p className="text-xs font-medium text-rose-100/90">2-0 · 모성보호</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <span className="text-4xl font-semibold tabular-nums">{data.onChildcare}</span>
          <span className="pb-1 text-sm text-rose-100">명 육아휴직 중</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <HcMetricCard label="육아휴직" value={fmtWithScheduled(data.onChildcare, data.childcareScheduled)} />
        <HcMetricCard label="출산휴가" value={fmtWithScheduled(data.onMaternity, data.maternityScheduled)} />
        <HcMetricCard label="전체 휴직" value={`${data.onLeave}`} />
        <HcMetricCard
          label={`${y}년 육아휴직`}
          value={`개시 ${data.thisYearStarts} · 해당 ${data.thisYearPresent}`}
        />
      </div>

      {startsChart.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">연도별 육아휴직 개시</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {from}~{to}년 · 해당 연도 개시 인원
          </p>
          <div className="mt-3 h-[240px]">
            <CopyableSimpleBar
              title={`육아휴직 개시 (${from}~${to})`}
              data={startsChart}
              xKey="year"
              yKey="인원"
              height={220}
              barColor={ROSE}
              showValueLabels
            />
          </div>
        </div>
      ) : null}

      {presentChart.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">연도별 육아휴직 해당</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {from}~{to}년 · 1일이라도 해당하는 인원
          </p>
          <div className="mt-3 h-[240px]">
            <CopyableSimpleBar
              title={`육아휴직 해당 (${from}~${to})`}
              data={presentChart}
              xKey="year"
              yKey="인원"
              height={220}
              barColor={AMBER}
              showValueLabels
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
