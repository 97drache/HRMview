import { startOfDay } from 'date-fns'
import type { LeaveRow, PersonnelRow, TrainingRow } from '../types/hr'
import { fmt } from './dates'
import {
  buildLeaveReport,
  buildMaternityReport,
  headcountByGenderEmployment,
  headcountByJobGenderOrdered,
  meritTrainingOn,
  monthBoundaryHeadcounts,
  newHiresByMovementRank,
  resignationsByMovementRank,
  wagePeakByYear,
  yearlyHeadcountByRankBandDesc,
} from './hrEngine'

export type MonthBoundaryRow = { month: number; monthStart: number; monthEnd: number }

/** 1-0 한눈에 보기 KPI (인원 수만, 성명 없음) */
export type PublicOverviewKpi = {
  statYear: number
  male: number
  female: number
  regular: number
  mugi: number
  meritTraining: number
  onLeave: number
  leaveScheduled: number
  onMaternity: number
  maternityScheduled: number
  hiresYtd: number
  resignsYtd: number
  wagePeakYtd: number
}

/** Vercel 등 공개 배포용: 집계·차트만 (이름·사번 없음). 1-5는 인원 수만. */
export type PublicHeadcountSnapshotV1 = {
  version: 1
  generatedAt: string
  baseDate: string
  sheetNotes: string[]
  /** true면 HRdata 없이 생성된 기본 스냅샷 */
  empty?: boolean
  /** 1-0 카드용 집계 (v1 스냅샷에 없으면 jobGender 등에서 보완) */
  overviewKpi?: PublicOverviewKpi
  jobGender: ReturnType<typeof headcountByJobGenderOrdered>
  genderEmployment: ReturnType<typeof headcountByGenderEmployment>
  yearRange: { from: number; to: number }
  yearlyRank: ReturnType<typeof yearlyHeadcountByRankBandDesc>
  /** 연도 문자열 키 → 1-4 월초·월말 */
  monthBoundaryByYear: Record<string, MonthBoundaryRow[]>
  /** 1-5: 기준일에 공로연수 구간 인원 수(성명 미포함) */
  meritTrainingCount: number
}

function computeYearRange(personnel: PersonnelRow[], base: Date): { from: number; to: number } {
  const y = base.getFullYear()
  if (!personnel.length) return { from: y - 5, to: y }
  const ys = personnel
    .map((p) => p.hireDate?.getFullYear())
    .filter((n): n is number => typeof n === 'number')
  const yMin = Math.min(y, ...ys, y - 10)
  const yMax = y
  return { from: Math.min(yMin, yMax - 5), to: yMax }
}

export function computePublicOverviewKpi(
  personnel: PersonnelRow[],
  leave: LeaveRow[],
  training: TrainingRow[],
  baseDate: Date,
): PublicOverviewKpi {
  const base = startOfDay(baseDate)
  const y = base.getFullYear()
  const jg = headcountByJobGenderOrdered(personnel, base)
  const male = jg.reduce((a, r) => a + r.male, 0)
  const female = jg.reduce((a, r) => a + r.female, 0)
  const sumRow = headcountByGenderEmployment(personnel, base).find((r) => r.label === '계')

  const leaveRows = buildLeaveReport(leave, base, personnel)
  const onLeave = leaveRows.filter((r) => !r.scheduled).length
  const leaveScheduled = leaveRows.filter((r) => r.scheduled).length

  const matRows = buildMaternityReport(leave, base, personnel)
  const onMaternity = matRows.filter((r) => !r.scheduled).length
  const maternityScheduled = matRows.filter((r) => r.scheduled).length

  const hires = newHiresByMovementRank(personnel, y)
  const hiresYtd = hires.reduce((a, c) => a + c.monthGroups.reduce((n, g) => n + g.names.length, 0), 0)
  const resigns = resignationsByMovementRank(personnel, y)
  const resignsYtd = resigns.reduce(
    (a, c) => a + c.monthGroups.reduce((n, g) => n + g.entries.length, 0),
    0,
  )

  return {
    statYear: y,
    male,
    female,
    regular: sumRow?.regular ?? 0,
    mugi: sumRow?.mugi ?? 0,
    meritTraining: meritTrainingOn(training, base).length,
    onLeave,
    leaveScheduled,
    onMaternity,
    maternityScheduled,
    hiresYtd,
    resignsYtd,
    wagePeakYtd: wagePeakByYear(personnel, y).length,
  }
}

/** 구 스냅샷 호환 */
export function resolvePublicOverviewKpi(snap: PublicHeadcountSnapshotV1): PublicOverviewKpi {
  if (snap.overviewKpi) return snap.overviewKpi
  const jg = snap.jobGender
  const male = jg.reduce((a, r) => a + r.male, 0)
  const female = jg.reduce((a, r) => a + r.female, 0)
  const sumRow = snap.genderEmployment.find((r) => r.label === '계')
  const y = Number(snap.baseDate.slice(0, 4)) || new Date().getFullYear()
  return {
    statYear: y,
    male,
    female,
    regular: sumRow?.regular ?? 0,
    mugi: sumRow?.mugi ?? 0,
    meritTraining: snap.meritTrainingCount,
    onLeave: 0,
    leaveScheduled: 0,
    onMaternity: 0,
    maternityScheduled: 0,
    hiresYtd: 0,
    resignsYtd: 0,
    wagePeakYtd: 0,
  }
}

/** 월경계 JSON 용량 상한: 최근 N개 연도만 포함 */
const MAX_MONTH_BOUNDARY_YEARS = 24

export function buildHeadcountPublicSnapshot(
  personnel: PersonnelRow[],
  training: TrainingRow[],
  baseDate: Date,
  sheetNotes: string[] = [],
  empty?: boolean,
  leave: LeaveRow[] = [],
): PublicHeadcountSnapshotV1 {
  const base = startOfDay(baseDate)
  const yearRange = computeYearRange(personnel, base)
  let mbFrom = yearRange.from
  const mbTo = yearRange.to
  if (mbTo - mbFrom + 1 > MAX_MONTH_BOUNDARY_YEARS) {
    mbFrom = mbTo - (MAX_MONTH_BOUNDARY_YEARS - 1)
  }
  const monthBoundaryByYear: Record<string, MonthBoundaryRow[]> = {}
  for (let y = mbFrom; y <= mbTo; y++) {
    monthBoundaryByYear[String(y)] = monthBoundaryHeadcounts(personnel, y)
  }

  const overviewKpi = computePublicOverviewKpi(personnel, leave, training, base)

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseDate: fmt(base),
    sheetNotes,
    empty,
    overviewKpi,
    jobGender: headcountByJobGenderOrdered(personnel, base),
    genderEmployment: headcountByGenderEmployment(personnel, base),
    yearRange,
    yearlyRank: yearlyHeadcountByRankBandDesc(personnel, yearRange.from, yearRange.to),
    monthBoundaryByYear,
    meritTrainingCount: overviewKpi.meritTraining,
  }
}

export function emptyPublicHeadcountSnapshot(baseDate: Date, notes: string[]): PublicHeadcountSnapshotV1 {
  return buildHeadcountPublicSnapshot([], [], baseDate, notes, true, [])
}
