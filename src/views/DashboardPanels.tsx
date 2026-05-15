import { useMemo, useState, type ReactNode } from 'react'
import { OverviewDashboard } from '../components/OverviewDashboard'
import { CareerCertificatePanel } from '../components/CareerCertificatePanel'
import { CopyableStackedBar, CopyableYearRankChart } from '../components/CopyableChart'
import type { NavKey } from '../navConfig'
import { LeaveNotificationPanel } from '../components/LeaveNotificationPanel'
import { LaborSurveyLeavePanel, LaborSurveyWorkPanel } from '../components/LaborSurveyPanels'
import { Card, SimpleTable } from '../components/Ui'
import { useData } from '../context/DataContext'
import { fmt } from '../lib/dates'
import { downloadExcelSheets } from '../lib/exportExcel'
import { displayMovementRankCategory, RANK_BAND_ORDER } from '../lib/jobClassification'
import {
  buildLeaveReport,
  buildMaternityReport,
  headcountByGenderEmployment,
  headcountByJobGenderOrdered,
  leaveRowsForName,
  meritTrainingOn,
  monthBoundaryHeadcounts,
  newHiresByMovementRank,
  rankCategoryForLeave,
  resignationsByMovementRank,
  upcomingRetirements,
  wagePeakByYear,
  yearlyHeadcountByRankBandDesc,
} from '../lib/hrEngine'

export function DashboardPanels({
  active,
  onNavigate,
}: {
  active: NavKey
  onNavigate: (k: NavKey) => void
}) {
  const { data, baseDate } = useData()
  const [yearForMonth, setYearForMonth] = useState(() => baseDate.getFullYear())
  const [yearForMovement, setYearForMovement] = useState(() => baseDate.getFullYear())
  const [searchName, setSearchName] = useState('')

  const notes = data?.sheetNotes ?? []

  const yearRange = useMemo(() => {
    if (!data?.personnel?.length) {
      const y = baseDate.getFullYear()
      return { from: y - 5, to: y }
    }
    const ys = data.personnel
      .map((p) => p.hireDate?.getFullYear())
      .filter((y): y is number => typeof y === 'number')
    const yMin = Math.min(baseDate.getFullYear(), ...ys, baseDate.getFullYear() - 10)
    const yMax = baseDate.getFullYear()
    return { from: Math.min(yMin, yMax - 5), to: yMax }
  }, [data, baseDate])

  if (!data) {
    if (active === 'c-5-1') {
      return (
        <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-10">
          <Card
            code="5-1"
            title="경력증명서"
            desc="대시보드용 HRdata.xlsx와 별도로, 기관 인사기록부 양식(.xlsx)을 업로드해 발급합니다. 추출은 「성명·생년월일·임용일자」「승진승급」「근무기록」「보직현황」등 키워드 기준입니다."
          >
            <CareerCertificatePanel />
          </Card>
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-3xl">
        <Card
          code="0-0"
          title="시작하기"
          desc="데스크톱 앱에서는 data 폴더의 HRdata.xlsx 가 자동으로 열립니다. 파일과 시트 이름을 확인해 주세요."
        >
          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 text-sm text-slate-700">
            <div className="font-semibold text-slate-900">시트 이름 안내</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <span className="font-mono">인원현황</span> (또는 이름에 「인원」 포함)
              </li>
              <li>
                <span className="font-mono">휴직현황</span>
              </li>
              <li>
                <span className="font-mono">연수현황</span> (또는 「연수」)
              </li>
            </ul>
            <div className="mt-3 text-xs text-slate-500">
              퇴직/임금피크 계산을 위해 인원 시트에 <span className="font-mono">퇴직일</span>,{' '}
              <span className="font-mono">퇴직사유</span> 열이 있으면 자동 반영됩니다.
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-10">
      {notes.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div className="font-semibold">엑셀 시트 안내</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {active === 'home' ? (
        <OverviewDashboard
          personnel={data.personnel}
          leave={data.leave}
          baseDate={baseDate}
          onNavigate={onNavigate}
        />
      ) : null}

      {active === 'p-1-1' ? (
        <Card
          code="1-1"
          title="직종별 현황"
          desc="행정직→기술직→기능직→관리직→일반직 순입니다. 정규직: 행정·기술·기능 / 무기직: 관리·일반."
          actions={
            <button
              type="button"
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              onClick={() => {
                const jg = headcountByJobGenderOrdered(data.personnel, baseDate)
                const t = jg.reduce(
                  (a, r) => ({ m: a.m + r.male, f: a.f + r.female, x: a.x + r.total }),
                  { m: 0, f: 0, x: 0 },
                )
                void downloadExcelSheets(`HRM-1-1-직종별-${fmt(baseDate).replace(/-/g, '')}.xlsx`, [
                  {
                    name: '1-1',
                    rows: [
                      ['1-1 직종별 (기준일 ' + fmt(baseDate) + ')'],
                      [],
                      ['직종', '남', '여', '계'],
                      ...jg.map((r) => [r.job, r.male, r.female, r.total]),
                      ['계', t.m, t.f, t.x],
                    ],
                  },
                ])
              }}
            >
              엑셀 저장
            </button>
          }
        >
          {(() => {
            const jg = headcountByJobGenderOrdered(data.personnel, baseDate)
            const t = jg.reduce(
              (a, r) => ({ m: a.m + r.male, f: a.f + r.female, x: a.x + r.total }),
              { m: 0, f: 0, x: 0 },
            )
            return (
              <>
                <SimpleTable
                  cols={[
                    { key: 'job', label: '직종' },
                    { key: 'male', label: '남' },
                    { key: 'female', label: '여' },
                    { key: 'total', label: '계' },
                  ]}
                  rows={[
                    ...jg.map((r) => ({
                      job: r.job,
                      male: r.male,
                      female: r.female,
                      total: r.total,
                    })),
                    { job: '계', male: t.m, female: t.f, total: t.x },
                  ]}
                />
                <CopyableStackedBar
                  title="직종별 인원 (남·여 누적)"
                  data={jg.map((r) => ({ 직종: r.job, 남: r.male, 여: r.female }))}
                  xKey="직종"
                  series={[
                    { key: '남', name: '남', color: '#0d9488' },
                    { key: '여', name: '여', color: '#38bdf8' },
                  ]}
                />
              </>
            )
          })()}
        </Card>
      ) : null}

      {active === 'p-1-2' ? (
        <Card
          code="1-2"
          title="남녀·고용 형태"
          desc="구분(남/여/계)별 정규직·무기직 인원입니다."
          actions={
            <button
              type="button"
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              onClick={() => {
                const ge = headcountByGenderEmployment(data.personnel, baseDate)
                void downloadExcelSheets(`HRM-1-2-남녀고용-${fmt(baseDate).replace(/-/g, '')}.xlsx`, [
                  {
                    name: '1-2',
                    rows: [
                      ['1-2 남녀·고용 (기준일 ' + fmt(baseDate) + ')'],
                      [],
                      ['구분', '정규직', '무기직', '계'],
                      ...ge.map((r) => [r.label, r.regular, r.mugi, r.total]),
                    ],
                  },
                ])
              }}
            >
              엑셀 저장
            </button>
          }
        >
          {(() => {
            const ge = headcountByGenderEmployment(data.personnel, baseDate)
            return (
              <>
                <SimpleTable
                  cols={[
                    { key: 'label', label: '구분' },
                    { key: 'regular', label: '정규직' },
                    { key: 'mugi', label: '무기직' },
                    { key: 'total', label: '계' },
                  ]}
                  rows={ge.map((r) => ({
                    label: r.label,
                    regular: r.regular,
                    mugi: r.mugi,
                    total: r.total,
                  }))}
                />
                <CopyableStackedBar
                  title="구분별 정규직·무기직"
                  data={ge.filter((r) => r.label !== '계').map((r) => ({
                    구분: r.label,
                    정규직: r.regular,
                    무기직: r.mugi,
                  }))}
                  xKey="구분"
                  series={[
                    { key: '정규직', name: '정규직', color: '#0d9488' },
                    { key: '무기직', name: '무기직', color: '#38bdf8' },
                  ]}
                  height={280}
                />
              </>
            )
          })()}
        </Card>
      ) : null}

      {active === 'p-1-3' ? (
        <Card
          code="1-3"
          title="연도별 인원(연말)·직급 구분"
          desc="연도 내림차순. 12/31 재직 기준, 현직급(없으면 승진·입사직급)으로 책임·선임·원·기능·관리·무기·기타를 집계합니다."
          actions={
            <button
              type="button"
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              onClick={() => {
                const yr = yearlyHeadcountByRankBandDesc(data.personnel, yearRange.from, yearRange.to)
                void downloadExcelSheets(`HRM-1-3-연도직급-${fmt(baseDate).replace(/-/g, '')}.xlsx`, [
                  {
                    name: '1-3',
                    rows: [
                      ['1-3 연도별 연말 인원·직급 구분'],
                      [],
                      ['연도', ...RANK_BAND_ORDER, '계'],
                      ...yr.map((r) => [r.year, ...RANK_BAND_ORDER.map((k) => r[k]), r.total]),
                    ],
                  },
                ])
              }}
            >
              엑셀 저장
            </button>
          }
        >
          {(() => {
            const yr = yearlyHeadcountByRankBandDesc(data.personnel, yearRange.from, yearRange.to)
            const cols = [
              { key: 'y', label: '연도' },
              ...RANK_BAND_ORDER.map((k) => ({ key: k, label: k })),
              { key: 'total', label: '계' },
            ]
            const rows = yr.map((r) => {
              const o: Record<string, ReactNode> = { y: r.year, total: r.total }
              for (const k of RANK_BAND_ORDER) o[k] = r[k]
              return o
            })
            const chartData = yr.map((r) => {
              const o: Record<string, string | number> = { year: `${r.year}년` }
              for (const k of RANK_BAND_ORDER) o[k] = r[k]
              return o
            })
            const chartKeys = RANK_BAND_ORDER.map((k) => ({ key: k, label: k }))
            return (
              <>
                <SimpleTable cols={cols} rows={rows} />
                <CopyableYearRankChart
                  title="연도별 직급 구성 (연말)"
                  data={chartData}
                  keys={chartKeys}
                />
              </>
            )
          })()}
        </Card>
      ) : null}

      {active === 'p-1-4' ? (
        <Card
          code="1-4"
          title="월초·월말 인원"
          desc="선택한 연도의 매월 1일·말일 재직 인원입니다."
          actions={
            <button
              type="button"
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              onClick={() => {
                const rows = monthBoundaryHeadcounts(data.personnel, yearForMonth)
                void downloadExcelSheets(`HRM-1-4-월초월말-${yearForMonth}.xlsx`, [
                  {
                    name: '1-4',
                    rows: [
                      ['1-4 월초·월말 인원', yearForMonth + '년'],
                      [],
                      ['월', '월초', '월말'],
                      ...rows.map((r) => [r.month + '월', r.monthStart, r.monthEnd]),
                    ],
                  },
                ])
              }}
            >
              엑셀 저장
            </button>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-stone-700">대상 연도</label>
            <input
              type="number"
              className="w-28 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm"
              value={yearForMonth}
              onChange={(e) => setYearForMonth(Number(e.target.value))}
            />
          </div>
          <SimpleTable
            cols={[
              { key: 'm', label: '월' },
              { key: 'ms', label: '월초' },
              { key: 'me', label: '월말' },
            ]}
            rows={monthBoundaryHeadcounts(data.personnel, yearForMonth).map((r) => ({
              m: `${r.month}월`,
              ms: r.monthStart,
              me: r.monthEnd,
            }))}
          />
        </Card>
      ) : null}

      {active === 'p-1-5' ? (
        <Card
          code="1-5"
          title="공로연수 현황"
          desc="연수현황 시트 기준, 기준일에 공로연수 구간에 포함된 인원입니다."
          actions={
            <button
              type="button"
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              onClick={() => {
                const list = meritTrainingOn(data.training, baseDate)
                void downloadExcelSheets(`HRM-1-5-공로연수-${fmt(baseDate).replace(/-/g, '')}.xlsx`, [
                  {
                    name: '1-5',
                    rows: [
                      ['1-5 공로연수 (기준일 ' + fmt(baseDate) + ')'],
                      [],
                      ['이름', '직급', '시작', '종료'],
                      ...list.map((t) => [t.name, t.rank, fmt(t.meritStart), fmt(t.meritEnd)]),
                    ],
                  },
                ])
              }}
            >
              엑셀 저장
            </button>
          }
        >
          <SimpleTable
            cols={[
              { key: 'name', label: '이름' },
              { key: 'rank', label: '직급' },
              { key: 'start', label: '시작' },
              { key: 'end', label: '종료' },
            ]}
            rows={meritTrainingOn(data.training, baseDate).map((t) => ({
              name: t.name,
              rank: t.rank,
              start: fmt(t.meritStart),
              end: fmt(t.meritEnd),
            }))}
          />
        </Card>
      ) : null}

      {active === 'l-2-1' ? (
        <Card
          code="2-1"
          title="휴직자 현황"
          desc="휴직현황 시트에서 휴직종류·휴직시작일·휴직종료일이 모두 있는 본 휴직만 집계합니다. 출산휴가 등은 2-2에서 확인합니다. 기준일이 휴직 시작 전이면 성명(예정), 이전 구간(출산 등)과 본 휴직 사이 공백에도 예정으로 표시합니다. 육아휴직이면 휴직현황 시트의 대상자녀에서 출생연도를 표시합니다."
          actions={
            <button
              type="button"
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              onClick={() => {
                const rows = buildLeaveReport(data.leave, baseDate, data.personnel)
                void downloadExcelSheets(`HRM-2-1-휴직-${fmt(baseDate).replace(/-/g, '')}.xlsx`, [
                  {
                    name: '2-1',
                    rows: [
                      ['휴직자 현황 (기준일 ' + fmt(baseDate) + ')'],
                      [],
                      ['연번', '성명', '직급', '성별', '시작일', '종료(예정)', '사유', '자녀출생(연)'],
                      ...rows.map((r, i) => [
                        i + 1,
                        r.name,
                        r.rankCategory,
                        r.gender,
                        r.start,
                        r.end,
                        r.reason,
                        r.childBirthYear,
                      ]),
                    ],
                  },
                ])
              }}
            >
              엑셀 저장
            </button>
          }
        >
          <SimpleTable
            cols={[
              { key: 'no', label: '연번', width: '8%' },
              { key: 'name', label: '성명' },
              { key: 'rank', label: '직급' },
              { key: 'gender', label: '성별' },
              { key: 'start', label: '시작일' },
              { key: 'end', label: '종료(예정)' },
              { key: 'reason', label: '사유' },
              { key: 'childYear', label: '자녀출생(연)', width: '10%' },
            ]}
            rows={buildLeaveReport(data.leave, baseDate, data.personnel).map((r, i) => ({
              no: i + 1,
              name: r.name,
              rank: r.rankCategory,
              gender: r.gender,
              start: r.start,
              end: r.end,
              reason: r.reason,
              childYear: r.childBirthYear,
            }))}
          />
        </Card>
      ) : null}

      {active === 'l-2-2' ? (
        <Card
          code="2-2"
          title="출산휴가 현황"
          desc="출산휴가 중인 분은 종료일이 가까운 순입니다. 아래는 예정자(성명(예정))입니다."
          actions={
            <button
              type="button"
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              onClick={() => {
                const rows = buildMaternityReport(data.leave, baseDate, data.personnel)
                void downloadExcelSheets(`HRM-2-2-출산휴가-${fmt(baseDate).replace(/-/g, '')}.xlsx`, [
                  {
                    name: '2-2',
                    rows: [
                      ['출산휴가 현황 (기준일 ' + fmt(baseDate) + ')'],
                      [],
                      ['연번', '성명', '직급', '성별', '시작', '종료'],
                      ...rows.map((r, i) => [i + 1, r.name, r.rankCategory, r.gender, r.start, r.end]),
                    ],
                  },
                ])
              }}
            >
              엑셀 저장
            </button>
          }
        >
          <SimpleTable
            cols={[
              { key: 'no', label: '연번', width: '8%' },
              { key: 'name', label: '성명' },
              { key: 'rank', label: '직급' },
              { key: 'gender', label: '성별' },
              { key: 'start', label: '시작' },
              { key: 'end', label: '종료' },
            ]}
            rows={buildMaternityReport(data.leave, baseDate, data.personnel).map((r, i) => ({
              no: i + 1,
              name: r.name,
              rank: r.rankCategory,
              gender: r.gender,
              start: r.start,
              end: r.end,
            }))}
          />
        </Card>
      ) : null}

      {active === 'l-2-3' ? (
        <Card
          code="2-3"
          title="개인 이력 조회"
          desc="이름을 포함해 검색합니다. 휴직현황 시트의 해당 행을 아래 표에 바로 표시합니다."
          actions={
            <button
              type="button"
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              onClick={() => {
                const found = leaveRowsForName(data.leave, searchName)
                void downloadExcelSheets(`HRM-2-3-검색-${fmt(baseDate).replace(/-/g, '')}.xlsx`, [
                  {
                    name: '2-3',
                    rows: [
                      ['개인 이력 조회: ' + (searchName || '(전체)')],
                      [],
                      ['연번', '성명', '직급', '성별', '휴직종류', '휴직 기간', '출산휴가'],
                      ...found.map((r, i) => [
                        i + 1,
                        r.name,
                        rankCategoryForLeave(r, data.personnel),
                        r.gender,
                        r.leaveKind,
                        `${fmt(r.leaveStart)} ~ ${fmt(r.leaveEnd)}`,
                        `${fmt(r.maternityStart)} ~ ${fmt(r.maternityEnd)}`,
                      ]),
                    ],
                  },
                ])
              }}
            >
              엑셀 저장
            </button>
          }
        >
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <label className="text-xs font-semibold text-stone-600">이름</label>
              <input
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm outline-none ring-emerald-800/20 focus:ring-4"
                placeholder="예: 홍길동"
              />
            </div>
          </div>
          <SimpleTable
            cols={[
              { key: 'no', label: '연번', width: '8%' },
              { key: 'name', label: '성명' },
              { key: 'rank', label: '직급' },
              { key: 'gender', label: '성별' },
              { key: 'kind', label: '휴직종류' },
              { key: 'leave', label: '휴직 기간' },
              { key: 'mat', label: '출산휴가' },
            ]}
            rows={leaveRowsForName(data.leave, searchName).map((r, i) => ({
              no: i + 1,
              name: r.name,
              rank: rankCategoryForLeave(r, data.personnel),
              gender: r.gender,
              kind: r.leaveKind,
              leave: `${fmt(r.leaveStart)} ~ ${fmt(r.leaveEnd)}`,
              mat: `${fmt(r.maternityStart)} ~ ${fmt(r.maternityEnd)}`,
            }))}
          />
        </Card>
      ) : null}

      {active === 'm-3-1' ? (
        <Card
          code="3-1"
          title="연도별 신입자 현황"
          desc="입사일 연도·직급 구분별로, 같은 달 입사자는 한 줄에 모아 표시합니다."
          actions={
            <button
              type="button"
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              onClick={() => {
                const hires = newHiresByMovementRank(data.personnel, yearForMovement)
                const rows: (string | number)[][] = [
                  ['3-1 연도별 신입', yearForMovement + '년'],
                  [],
                  ['직급', '월', '성명'],
                ]
                for (const { category, monthGroups } of hires) {
                  for (const g of monthGroups) {
                    rows.push([category, `${g.month}월`, g.names.join(', ')])
                  }
                }
                void downloadExcelSheets(`HRM-3-1-신입-${yearForMovement}.xlsx`, [{ name: '3-1', rows }])
              }}
            >
              엑셀 저장
            </button>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-stone-700">연도</label>
            <input
              type="number"
              className="w-28 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm"
              value={yearForMovement}
              onChange={(e) => setYearForMovement(Number(e.target.value))}
            />
          </div>
          <div className="space-y-5">
            {(() => {
              const hires = newHiresByMovementRank(data.personnel, yearForMovement)
              if (hires.length === 0) {
                return (
                  <div className="rounded-xl border border-stone-200/80 bg-stone-50/70 p-4 text-sm text-stone-600">
                    해당 연도 신입 데이터가 없습니다. (입사일 열·연도를 확인해 주세요.)
                  </div>
                )
              }
              return hires.map(({ category, monthGroups }) => (
                <div
                  key={category}
                  className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-900/5"
                >
                  <div className="border-b border-teal-900/10 bg-gradient-to-r from-teal-900 to-teal-800 px-4 py-3">
                    <h3 className="text-[15px] font-semibold tracking-tight text-white">{category}</h3>
                  </div>
                  <ul className="divide-y divide-stone-100">
                    {monthGroups.map((g) => (
                      <li key={g.month} className="flex gap-3 px-4 py-3 sm:gap-5">
                        <div className="flex w-12 shrink-0 justify-end sm:w-14">
                          <span className="inline-flex h-7 min-w-[2.75rem] items-center justify-center rounded-lg bg-teal-50 px-2 text-xs font-bold tabular-nums text-teal-900 ring-1 ring-teal-900/10">
                            {g.month}월
                          </span>
                        </div>
                        <p className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed text-stone-800">
                          {g.names.join(', ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            })()}
          </div>
        </Card>
      ) : null}

      {active === 'm-3-2' ? (
        <Card
          code="3-2"
          title="연도별 퇴직자 현황"
          desc="퇴직일 연도·직급 구분별로, 같은 달 퇴직자는 한 줄에 이름(퇴직사유) 형식으로 모읍니다."
          actions={
            <button
              type="button"
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              onClick={() => {
                const resigned = resignationsByMovementRank(data.personnel, yearForMovement)
                const rows: (string | number)[][] = [
                  ['3-2 연도별 퇴직', yearForMovement + '년'],
                  [],
                  ['직급', '월', '성명(퇴직사유)'],
                ]
                for (const { category, monthGroups } of resigned) {
                  for (const g of monthGroups) {
                    const cell = g.entries.map((e) => `${e.name}(${e.reason})`).join(', ')
                    rows.push([category, `${g.month}월`, cell])
                  }
                }
                void downloadExcelSheets(`HRM-3-2-퇴직-${yearForMovement}.xlsx`, [{ name: '3-2', rows }])
              }}
            >
              엑셀 저장
            </button>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-stone-700">연도</label>
            <input
              type="number"
              className="w-28 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm"
              value={yearForMovement}
              onChange={(e) => setYearForMovement(Number(e.target.value))}
            />
          </div>
          <div className="space-y-5">
            {(() => {
              const resigned = resignationsByMovementRank(data.personnel, yearForMovement)
              if (resigned.length === 0) {
                return (
                  <div className="rounded-xl border border-stone-200/80 bg-stone-50/70 p-4 text-sm text-stone-600">
                    해당 연도 퇴직 데이터가 없습니다. (퇴직일·퇴직사유 열을 확인해 주세요.)
                  </div>
                )
              }
              return resigned.map(({ category, monthGroups }) => (
                <div
                  key={category}
                  className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm ring-1 ring-rose-900/5"
                >
                  <div className="border-b border-rose-900/10 bg-gradient-to-r from-rose-900 to-rose-800 px-4 py-3">
                    <h3 className="text-[15px] font-semibold tracking-tight text-white">{category}</h3>
                  </div>
                  <ul className="divide-y divide-stone-100">
                    {monthGroups.map((g) => (
                      <li key={g.month} className="flex gap-3 px-4 py-3 sm:gap-5">
                        <div className="flex w-12 shrink-0 justify-end sm:w-14">
                          <span className="inline-flex h-7 min-w-[2.75rem] items-center justify-center rounded-lg bg-rose-50 px-2 text-xs font-bold tabular-nums text-rose-950 ring-1 ring-rose-900/10">
                            {g.month}월
                          </span>
                        </div>
                        <p className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed text-stone-800">
                          {g.entries.map((e, i) => (
                            <span key={`${category}-${g.month}-${i}-${e.name}`}>
                              {i > 0 ? <span className="text-stone-400">, </span> : null}
                              <span className="font-medium text-stone-900">{e.name}</span>
                              <span className="text-stone-600">({e.reason})</span>
                            </span>
                          ))}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            })()}
          </div>
        </Card>
      ) : null}

      {active === 'm-3-3' ? (
        <Card
          code="3-3"
          title="연도별 임금피크제"
          desc="해당 연도 12월 31일 기준으로 분류합니다. 정년이 6/30·12/31일 때 1단계는 퇴직 2년 전 다음날(7/1 또는 익년 1/1)부터, 2단계는 퇴직 1년 전 다음날(동일 규칙)부터 적용됩니다."
          actions={
            <button
              type="button"
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              onClick={() => {
                const list = wagePeakByYear(data.personnel, yearForMovement)
                void downloadExcelSheets(`HRM-3-3-임금피크-${yearForMovement}.xlsx`, [
                  {
                    name: '3-3',
                    rows: [
                      ['3-3 임금피크', yearForMovement + '년'],
                      [],
                      ['단계', '단계시작', '이름', '직급', '퇴직 예정일'],
                      ...list.map((x) => [
                        x.stage,
                        fmt(x.stageStart),
                        x.person.name,
                        displayMovementRankCategory(
                          x.person.currentRank || x.person.promoteRank || x.person.hireRank || '',
                          x.person.jobType,
                        ),
                        fmt(x.retireAt),
                      ]),
                    ],
                  },
                ])
              }}
            >
              엑셀 저장
            </button>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-stone-700">연도</label>
            <input
              type="number"
              className="w-28 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm"
              value={yearForMovement}
              onChange={(e) => setYearForMovement(Number(e.target.value))}
            />
          </div>
          <SimpleTable
            cols={[
              { key: 'stage', label: '단계' },
              { key: 'since', label: '단계 시작' },
              { key: 'name', label: '이름' },
              { key: 'rank', label: '직급' },
              { key: 'retire', label: '퇴직 예정일' },
            ]}
            rows={wagePeakByYear(data.personnel, yearForMovement).map((x) => ({
              stage: x.stage,
              since: fmt(x.stageStart),
              name: x.person.name,
              rank: displayMovementRankCategory(
                x.person.currentRank || x.person.promoteRank || x.person.hireRank || '',
                x.person.jobType,
              ),
              retire: fmt(x.retireAt),
            }))}
          />
        </Card>
      ) : null}

      {active === 'm-3-4' ? (
        <Card
          code="3-4"
          title="기준일 이후 퇴직 예정자"
          desc="정년예정일자가 있으면 우선 사용하고, 없으면 생년월일+60세 규칙(생일 1~6월이면 6/30, 7~12월이면 12/31)으로 계산합니다."
          actions={
            <button
              type="button"
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
              onClick={() => {
                const list = upcomingRetirements(data.personnel, baseDate)
                void downloadExcelSheets(`HRM-3-4-퇴직예정-${fmt(baseDate).replace(/-/g, '')}.xlsx`, [
                  {
                    name: '3-4',
                    rows: [
                      ['3-4 퇴직 예정 (기준일 ' + fmt(baseDate) + ')'],
                      [],
                      ['연도', '이름', '직급', '퇴직 예정일'],
                      ...list.map((x) => [
                        x.retireAt!.getFullYear(),
                        x.person.name,
                        displayMovementRankCategory(
                          x.person.currentRank || x.person.promoteRank || x.person.hireRank || '',
                          x.person.jobType,
                        ),
                        fmt(x.retireAt),
                      ]),
                    ],
                  },
                ])
              }}
            >
              엑셀 저장
            </button>
          }
        >
          <SimpleTable
            cols={[
              { key: 'y', label: '연도' },
              { key: 'name', label: '이름' },
              { key: 'rank', label: '직급' },
              { key: 'd', label: '퇴직 예정일' },
            ]}
            rows={upcomingRetirements(data.personnel, baseDate).map((x) => ({
              y: x.retireAt!.getFullYear(),
              name: x.person.name,
              rank: displayMovementRankCategory(
                x.person.currentRank || x.person.promoteRank || x.person.hireRank || '',
                x.person.jobType,
              ),
              d: fmt(x.retireAt),
            }))}
          />
        </Card>
      ) : null}

      {active === 'r-4-1-1' ? <LaborSurveyWorkPanel /> : null}
      {active === 'r-4-1-2' ? <LaborSurveyLeavePanel /> : null}
      {active === 'r-4-2' ? <LeaveNotificationPanel /> : null}

      {active === 'c-5-1' ? (
        <Card
          code="5-1"
          title="경력증명서"
          desc="인사기록부 엑셀을 업로드하고 사번·직종을 입력하면 미리보기 및 인쇄용 HTML이 열립니다. (브라우저 인쇄 대화상자에서 PDF로 저장할 수 있습니다.)"
        >
          <CareerCertificatePanel />
        </Card>
      ) : null}
    </div>
  )
}
