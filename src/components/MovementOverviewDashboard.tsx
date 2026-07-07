import { format } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { useMemo, useState } from 'react'
import type { NavKey } from '../navConfig'
import type { PersonnelRow } from '../types/hr'
import { CopyableSimpleBar } from './CopyableChart'
import { Modal, SimpleTable } from './Ui'
import {
  hiresCountByYear,
  hiresDetailsByYear,
  recentYearRange,
  resignationsCountByYear,
  resignationsDetailsByYear,
} from '../lib/hrEngine'

const TEAL = '#0d9488'
const ROSE = '#e11d48'

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
    <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm ring-1 ring-teal-500/15 transition-shadow hover:shadow-md">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1.5 tabular-nums text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  )
}

export function MovementOverviewDashboard({
  personnel,
  baseDate,
  onNavigate,
}: {
  personnel: PersonnelRow[]
  baseDate: Date
  onNavigate: (k: NavKey) => void
}) {
  const y = baseDate.getFullYear()
  const { from, to } = recentYearRange(y, 10)
  const [detailModal, setDetailModal] = useState<{
    mode: 'hire' | 'resign'
    year: number
  } | null>(null)

  const hiresSeries = hiresCountByYear(personnel, from, to)
  const resignsSeries = resignationsCountByYear(personnel, from, to)
  const thisYearHires = hiresSeries.find((p) => p.year === y)?.count ?? 0
  const thisYearResigns = resignsSeries.find((p) => p.year === y)?.count ?? 0

  const hiresChart = hiresSeries.map((p) => ({ year: `${p.year}`, 인원: p.count }))
  const resignsChart = resignsSeries.map((p) => ({ year: `${p.year}`, 인원: p.count }))

  const detailRows = useMemo(() => {
    if (!detailModal) return []
    return detailModal.mode === 'hire'
      ? hiresDetailsByYear(personnel, detailModal.year)
      : resignationsDetailsByYear(personnel, detailModal.year)
  }, [detailModal, personnel])

  const quick = [
    { key: 'm-3-1' as NavKey, label: '3-1 신입' },
    { key: 'm-3-2' as NavKey, label: '3-2 퇴직' },
    { key: 'm-3-3' as NavKey, label: '3-3 임금피크' },
    { key: 'm-3-4' as NavKey, label: '3-4 퇴직 예정' },
  ]

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-950 text-white shadow-xl">
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="relative">
            <p className="text-sm font-medium text-teal-100/90">
              <span className="font-mono text-xs tracking-wide text-teal-100/80">3-0</span>
              <span className="mx-2">·</span>
              입퇴사현황 · 기준일{' '}
              <time dateTime={format(baseDate, 'yyyy-MM-dd')}>
                {format(baseDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
              </time>
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div className="tabular-nums text-5xl font-semibold tracking-tight sm:text-6xl">{thisYearHires}</div>
              <div className="pb-1 text-lg text-teal-100">{y}년 입사</div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-teal-100/85">
              최근 10년 입사·퇴직 추이를 한 화면에서 확인합니다. 막대 위 숫자를 바로 읽을 수 있고, 막대를 클릭하면 해당 연도의
              대상자 목록과 날짜 정보를 팝업으로 볼 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={`${y}년 입사`} value={`${thisYearHires}명`} hint="입사일 기준" />
        <Kpi label={`${y}년 퇴직`} value={`${thisYearResigns}명`} hint="퇴직일 기준" />
        <Kpi
          label="최근 10년 입사"
          value={`${hiresSeries.reduce((sum, p) => sum + p.count, 0)}명`}
          hint={`${from}~${to}`}
        />
        <Kpi
          label="최근 10년 퇴직"
          value={`${resignsSeries.reduce((sum, p) => sum + p.count, 0)}명`}
          hint={`${from}~${to}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">연도별 입사 인원</h3>
          <p className="mt-0.5 text-xs text-slate-500">{from}년 ~ {to}년 · 입사일 기준</p>
          <CopyableSimpleBar
            title={`입사 (${from}~${to})`}
            data={hiresChart}
            xKey="year"
            yKey="인원"
            height={280}
            barColor={TEAL}
            showValueLabels
            onBarClick={(row) => setDetailModal({ mode: 'hire', year: Number(row.year) })}
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">연도별 퇴직 인원</h3>
          <p className="mt-0.5 text-xs text-slate-500">{from}년 ~ {to}년 · 퇴직일 기준</p>
          <CopyableSimpleBar
            title={`퇴직 (${from}~${to})`}
            data={resignsChart}
            xKey="year"
            yKey="인원"
            height={280}
            barColor={ROSE}
            showValueLabels
            onBarClick={(row) => setDetailModal({ mode: 'resign', year: Number(row.year) })}
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
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:border-teal-200 hover:bg-teal-50/50"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      <Modal
        open={Boolean(detailModal)}
        title={
          detailModal
            ? `${detailModal.year}년 ${detailModal.mode === 'hire' ? '입사' : '퇴직'} 인원`
            : ''
        }
        onClose={() => setDetailModal(null)}
      >
        <p className="mb-3 text-sm text-slate-600">
          {detailModal?.mode === 'hire' ? '해당 연도 입사자 목록입니다.' : '해당 연도 퇴직자 목록입니다.'}
        </p>
        <SimpleTable
          cols={[
            { key: 'name', label: '성명' },
            { key: 'rankCategory', label: '직급' },
            { key: 'gender', label: '성별' },
            { key: 'date', label: detailModal?.mode === 'hire' ? '입사일' : '퇴직일' },
            { key: 'note', label: detailModal?.mode === 'hire' ? '구분' : '퇴직사유' },
          ]}
          rows={detailRows}
        />
      </Modal>
    </div>
  )
}
