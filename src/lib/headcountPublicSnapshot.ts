import { startOfDay } from 'date-fns'
import type { PersonnelRow, TrainingRow } from '../types/hr'
import { fmt } from './dates'
import {
  headcountByGenderEmployment,
  headcountByJobGenderOrdered,
  meritTrainingOn,
  monthBoundaryHeadcounts,
  yearlyHeadcountByRankBandDesc,
} from './hrEngine'

export type MonthBoundaryRow = { month: number; monthStart: number; monthEnd: number }

/** Vercel 등 공개 배포용: 집계·차트만 (이름·사번 없음). 1-5는 인원 수만. */
export type PublicHeadcountSnapshotV1 = {
  version: 1
  generatedAt: string
  baseDate: string
  sheetNotes: string[]
  /** true면 HRdata 없이 생성된 기본 스냅샷 */
  empty?: boolean
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

/** 월경계 JSON 용량 상한: 최근 N개 연도만 포함 */
const MAX_MONTH_BOUNDARY_YEARS = 24

export function buildHeadcountPublicSnapshot(
  personnel: PersonnelRow[],
  training: TrainingRow[],
  baseDate: Date,
  sheetNotes: string[] = [],
  empty?: boolean,
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

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseDate: fmt(base),
    sheetNotes,
    empty,
    jobGender: headcountByJobGenderOrdered(personnel, base),
    genderEmployment: headcountByGenderEmployment(personnel, base),
    yearRange,
    yearlyRank: yearlyHeadcountByRankBandDesc(personnel, yearRange.from, yearRange.to),
    monthBoundaryByYear,
    meritTrainingCount: meritTrainingOn(training, base).length,
  }
}

export function emptyPublicHeadcountSnapshot(baseDate: Date, notes: string[]): PublicHeadcountSnapshotV1 {
  return buildHeadcountPublicSnapshot([], [], baseDate, notes, true)
}
