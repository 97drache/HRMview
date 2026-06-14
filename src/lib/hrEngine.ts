import { endOfYear, startOfDay } from 'date-fns'
import type { LeaveRow, PersonnelRow, TrainingRow } from '../types/hr'
import {
  fmt,
  inRangeInclusive,
  monthEnds,
  monthStarts,
  parseFlexibleDate,
  retirementRuleDate,
  wagePeakHalfYearStageStart,
} from './dates'
import {
  classifyRankBand,
  displayMovementRankCategory,
  isFemaleGender,
  isMaleGender,
  isRegularJob,
  jobSortIndex,
  movementRankSortIndex,
  normalizeJobType,
  RANK_BAND_ORDER,
  type JobCategory,
  type RankBand,
} from './jobClassification'

const TERMINATED = /퇴직|사직|해고|명예퇴직|퇴사|계약종료/

function isTerminatedStatus(status: string): boolean {
  return TERMINATED.test(status)
}

/** 기준일 현재 재직(휴직 포함)으로 간주되는 인원 */
export function isOnPayrollOn(p: PersonnelRow, base: Date): boolean {
  if (!p.hireDate) return false
  if (startOfDay(p.hireDate).getTime() > startOfDay(base).getTime()) return false
  if (p.resignDate && startOfDay(p.resignDate).getTime() < startOfDay(base).getTime()) {
    return false
  }
  if (isTerminatedStatus(p.status) && !p.resignDate) return false
  return true
}

export function headcountByJob(personnel: PersonnelRow[], base: Date) {
  const map = new Map<string, number>()
  for (const p of personnel) {
    if (!isOnPayrollOn(p, base)) continue
    const k = p.jobType || '미지정'
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

export type JobGenderCount = {
  job: JobCategory
  male: number
  female: number
  total: number
}

/** 1-1: 직종 계층 순, 직종별 남·여·계 */
export function headcountByJobGenderOrdered(personnel: PersonnelRow[], base: Date): JobGenderCount[] {
  const map = new Map<JobCategory, { male: number; female: number }>()
  for (const p of personnel) {
    if (!isOnPayrollOn(p, base)) continue
    const job = normalizeJobType(p.jobType)
    if (!map.has(job)) map.set(job, { male: 0, female: 0 })
    const b = map.get(job)!
    if (isMaleGender(p.gender)) b.male += 1
    else if (isFemaleGender(p.gender)) b.female += 1
    else b.male += 1
  }
  const rows: JobGenderCount[] = [...map.entries()].map(([job, v]) => ({
    job,
    male: v.male,
    female: v.female,
    total: v.male + v.female,
  }))
  rows.sort((a, b) => jobSortIndex(a.job) - jobSortIndex(b.job))
  return rows
}

export type GenderEmploymentRow = { label: string; regular: number; mugi: number; total: number }

/** 1-2: 남/여/계 × 정규직·무기직 */
export function headcountByGenderEmployment(personnel: PersonnelRow[], base: Date): GenderEmploymentRow[] {
  type Acc = { regular: number; mugi: number }
  const male: Acc = { regular: 0, mugi: 0 }
  const female: Acc = { regular: 0, mugi: 0 }
  const other: Acc = { regular: 0, mugi: 0 }

  for (const p of personnel) {
    if (!isOnPayrollOn(p, base)) continue
    const job = normalizeJobType(p.jobType)
    const reg = isRegularJob(job)
    const bucket = isMaleGender(p.gender) ? male : isFemaleGender(p.gender) ? female : other
    if (reg) bucket.regular += 1
    else bucket.mugi += 1
  }

  const sum = (a: Acc) => a.regular + a.mugi
  return [
    { label: '남', ...male, total: sum(male) },
    { label: '여', ...female, total: sum(female) },
    {
      label: '계',
      regular: male.regular + female.regular + other.regular,
      mugi: male.mugi + female.mugi + other.mugi,
      total: sum(male) + sum(female) + sum(other),
    },
  ]
}

export type YearRankBandRow = { year: number } & Record<RankBand, number> & { total: number }

/** 1-3: 연도 내림차순, 연말 재직 직급 구분별 인원 */
export function yearlyHeadcountByRankBandDesc(
  personnel: PersonnelRow[],
  fromYear: number,
  toYear: number,
): YearRankBandRow[] {
  const rows: YearRankBandRow[] = []
  for (let y = toYear; y >= fromYear; y--) {
    const d = endOfYear(new Date(y, 0, 1))
    const list = personnel.filter((p) => isOnPayrollOn(p, d))
    const counts = Object.fromEntries(RANK_BAND_ORDER.map((k) => [k, 0])) as Record<RankBand, number>
    for (const p of list) {
      const rankStr = p.currentRank || p.promoteRank || p.hireRank || ''
      const band = classifyRankBand(rankStr, p.jobType)
      counts[band] += 1
    }
    rows.push({
      year: y,
      ...counts,
      total: list.length,
    })
  }
  return rows
}

export function headcountByGender(personnel: PersonnelRow[], base: Date) {
  const map = new Map<string, number>()
  for (const p of personnel) {
    if (!isOnPayrollOn(p, base)) continue
    const k = p.gender || '미지정'
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

export function yearlyHeadcountEnd(personnel: PersonnelRow[], yearEnd: Date) {
  const y = yearEnd.getFullYear()
  const d = endOfYear(new Date(y, 0, 1))
  return personnel.filter((p) => isOnPayrollOn(p, d)).length
}

export function yearlyHeadcountSeries(personnel: PersonnelRow[], fromYear: number, toYear: number) {
  const rows: { year: number; count: number }[] = []
  for (let y = fromYear; y <= toYear; y++) {
    rows.push({ year: y, count: yearlyHeadcountEnd(personnel, new Date(y, 0, 1)) })
  }
  return rows
}

export function monthBoundaryHeadcounts(personnel: PersonnelRow[], year: number) {
  const starts = monthStarts(year)
  const ends = monthEnds(year)
  return starts.map((s, i) => ({
    month: i + 1,
    monthStart: personnel.filter((p) => isOnPayrollOn(p, s)).length,
    monthEnd: personnel.filter((p) => isOnPayrollOn(p, ends[i])).length,
  }))
}

export type ActiveLeaveInfo = {
  row: LeaveRow
  reason: string
  start: Date | null
  end: Date | null
}

/** 휴직현황 시트: 휴직종류·휴직시작·휴직종료가 모두 있어야 본 휴직 구간으로 인정 */
export function hasValidMainLeave(row: LeaveRow): boolean {
  return Boolean(String(row.leaveKind ?? '').trim()) && Boolean(row.leaveStart) && Boolean(row.leaveEnd)
}

/** 2-1·통보용: 본 휴직(휴직종류+기간)만 기준일에 활성인 구간 */
function collectValidMainLeaveActives(row: LeaveRow, base: Date): ActiveLeaveInfo[] {
  if (!hasValidMainLeave(row)) return []
  if (!inRangeInclusive(base, row.leaveStart, row.leaveEnd)) return []
  const kind = String(row.leaveKind).trim()
  return [{ row, reason: `휴직(${kind})`, start: row.leaveStart, end: row.leaveEnd }]
}

function collectActiveLeaveSegments(row: LeaveRow, base: Date): ActiveLeaveInfo[] {
  const out: ActiveLeaveInfo[] = []
  const push = (label: string, start: Date | null, end: Date | null) => {
    if (inRangeInclusive(base, start, end)) {
      out.push({ row, reason: label, start, end })
    }
  }
  push('임신기 단축', row.pregnancyShortStart, row.pregnancyShortEnd)
  push('육아기 단축', row.childcareShortStart, row.childcareShortEnd)
  push('출산휴가', row.maternityStart, row.maternityEnd)
  const mainLabel = row.leaveKind ? `휴직(${row.leaveKind})` : '휴직'
  push(mainLabel, row.leaveStart, row.leaveEnd)
  return out
}

/** 출산·단축·본휴직 등 전 구간 (2-3 등 다른 화면용) */
export function activeLeavesOn(leave: LeaveRow[], base: Date): ActiveLeaveInfo[] {
  const all: ActiveLeaveInfo[] = []
  for (const row of leave) {
    all.push(...collectActiveLeaveSegments(row, base))
  }
  return all
}

export type ScheduledMainLeaveSlot = {
  row: LeaveRow
  nextStart: Date
  nextEnd: Date | null
  reason: string
}

/**
 * 본 휴직이 아직 시작 전(기준일 < 휴직시작)이거나,
 * 이전 구간(임신/육아/출산) 종료 후 본 휴직 시작 전 공백에 기준일이 있는 경우 → 예정 행
 */
export function scheduledMainLeaveSlots(leave: LeaveRow[], base: Date): ScheduledMainLeaveSlot[] {
  const slots: ScheduledMainLeaveSlot[] = []
  const seen = new Set<string>()
  const slotKey = (r: LeaveRow, ns: Date) =>
    `${r.empId || ''}|${r.name.trim()}|${startOfDay(ns).getTime()}`

  const bt = startOfDay(base).getTime()

  const tryGap = (
    row: LeaveRow,
    prevLabel: string,
    prevEnd: Date | null,
    nextStart: Date | null,
    nextEnd: Date | null,
    nextReasonTail: string,
    requireMainLeave: boolean,
  ) => {
    if (!prevEnd || !nextStart) return
    if (requireMainLeave && !hasValidMainLeave(row)) return
    const pe = startOfDay(prevEnd).getTime()
    const ns = startOfDay(nextStart).getTime()
    if (ns <= pe) return
    if (bt <= pe) return
    if (bt >= ns) return
    const k = slotKey(row, nextStart)
    if (seen.has(k)) return
    seen.add(k)
    slots.push({
      row,
      nextStart: startOfDay(nextStart),
      nextEnd: nextEnd ? startOfDay(nextEnd) : null,
      reason: `${prevLabel}→${nextReasonTail}`,
    })
  }

  for (const row of leave) {
    tryGap(
      row,
      '임신기 단축',
      row.pregnancyShortEnd,
      row.childcareShortStart,
      row.childcareShortEnd,
      '육아기 단축',
      false,
    )
    const kind = String(row.leaveKind ?? '').trim()
    const tail = kind ? `휴직(${kind})` : '휴직'
    tryGap(row, '육아기 단축', row.childcareShortEnd, row.leaveStart, row.leaveEnd, tail, true)
    tryGap(row, '출산휴가', row.maternityEnd, row.leaveStart, row.leaveEnd, tail, true)
  }

  for (const row of leave) {
    if (!hasValidMainLeave(row) || !row.leaveStart) continue
    const ls = startOfDay(row.leaveStart).getTime()
    if (bt >= ls) continue
    if (row.leaveEnd && bt > startOfDay(row.leaveEnd).getTime()) continue
    const k = slotKey(row, row.leaveStart)
    if (seen.has(k)) continue
    seen.add(k)
    const kind = String(row.leaveKind).trim()
    slots.push({
      row,
      nextStart: startOfDay(row.leaveStart),
      nextEnd: row.leaveEnd ? startOfDay(row.leaveEnd) : null,
      reason: `휴직(${kind}) 예정`,
    })
  }

  return slots
}

export function activeMainLeavesOn(leave: LeaveRow[], base: Date): ActiveLeaveInfo[] {
  const all: ActiveLeaveInfo[] = []
  for (const row of leave) {
    all.push(...collectValidMainLeaveActives(row, base))
  }
  return all
}

export function maternityCurrentAndUpcoming(leave: LeaveRow[], base: Date) {
  const current = leave.filter((r) => inRangeInclusive(base, r.maternityStart, r.maternityEnd))
  const upcoming = leave.filter((r) => {
    if (!r.maternityStart) return false
    return startOfDay(r.maternityStart).getTime() > startOfDay(base).getTime()
  })
  return { current, upcoming }
}

export function newHiresByYear(personnel: PersonnelRow[], year: number) {
  const list = personnel.filter(
    (p) => p.hireDate && p.hireDate.getFullYear() === year,
  )
  const byJob = new Map<string, PersonnelRow[]>()
  for (const p of list) {
    const k = p.jobType || '미지정'
    if (!byJob.has(k)) byJob.set(k, [])
    byJob.get(k)!.push(p)
  }
  return [...byJob.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko'))
}

export function resignationsByYear(personnel: PersonnelRow[], year: number) {
  const list = personnel.filter(
    (p) => p.resignDate && p.resignDate.getFullYear() === year,
  )
  const byJob = new Map<string, PersonnelRow[]>()
  for (const p of list) {
    const k = p.jobType || '미지정'
    if (!byJob.has(k)) byJob.set(k, [])
    byJob.get(k)!.push(p)
  }
  return [...byJob.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko'))
}

/** 3-1: 직급 구분별로 입사월 묶음 (월 오름차순 → 성명순) */
export type NewHireMonthGroup = { month: number; names: string[] }
export type NewHiresMovementBlock = { category: string; monthGroups: NewHireMonthGroup[] }

export function newHiresByMovementRank(personnel: PersonnelRow[], year: number): NewHiresMovementBlock[] {
  const list = personnel.filter((p) => p.hireDate && p.hireDate.getFullYear() === year)
  const byCat = new Map<string, PersonnelRow[]>()
  for (const p of list) {
    const rankStr = p.currentRank || p.promoteRank || p.hireRank || ''
    const cat = displayMovementRankCategory(rankStr, p.jobType)
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat)!.push(p)
  }
  const cats = [...byCat.keys()].sort((a, b) => movementRankSortIndex(a) - movementRankSortIndex(b))
  return cats.map((category) => {
    const people = byCat.get(category)!
    people.sort((a, b) => {
      const ma = a.hireDate!.getMonth()
      const mb = b.hireDate!.getMonth()
      if (ma !== mb) return ma - mb
      return a.name.localeCompare(b.name, 'ko')
    })
    const monthGroups: NewHireMonthGroup[] = []
    for (const p of people) {
      const month = p.hireDate!.getMonth() + 1
      const prev = monthGroups[monthGroups.length - 1]
      if (prev && prev.month === month) prev.names.push(p.name)
      else monthGroups.push({ month, names: [p.name] })
    }
    return { category, monthGroups }
  })
}

/** 3-2: 직급 구분별로 퇴직월 묶음 (월 오름차순 → 성명순) */
export type ResignMonthEntry = { name: string; reason: string }
export type ResignMonthGroup = { month: number; entries: ResignMonthEntry[] }
export type ResignationsMovementBlock = { category: string; monthGroups: ResignMonthGroup[] }

export function resignationsByMovementRank(
  personnel: PersonnelRow[],
  year: number,
): ResignationsMovementBlock[] {
  const list = personnel.filter((p) => p.resignDate && p.resignDate.getFullYear() === year)
  const byCat = new Map<string, PersonnelRow[]>()
  for (const p of list) {
    const rankStr = p.currentRank || p.promoteRank || p.hireRank || ''
    const cat = displayMovementRankCategory(rankStr, p.jobType)
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat)!.push(p)
  }
  const cats = [...byCat.keys()].sort((a, b) => movementRankSortIndex(a) - movementRankSortIndex(b))
  return cats.map((category) => {
    const people = byCat.get(category)!
    people.sort((a, b) => {
      const ma = a.resignDate!.getMonth()
      const mb = b.resignDate!.getMonth()
      if (ma !== mb) return ma - mb
      return a.name.localeCompare(b.name, 'ko')
    })
    const monthGroups: ResignMonthGroup[] = []
    for (const p of people) {
      const month = p.resignDate!.getMonth() + 1
      const reason = (p.resignReason || '—').trim() || '—'
      const prev = monthGroups[monthGroups.length - 1]
      const entry: ResignMonthEntry = { name: p.name, reason }
      if (prev && prev.month === month) prev.entries.push(entry)
      else monthGroups.push({ month, entries: [entry] })
    }
    return { category, monthGroups }
  })
}

export type WagePeakStage = '1단계' | '2단계'

export function wagePeakByYear(personnel: PersonnelRow[], year: number) {
  const dec31 = endOfYear(new Date(year, 0, 1))
  const rows: { person: PersonnelRow; retireAt: Date; stage: WagePeakStage; stageStart: Date }[] = []
  for (const p of personnel) {
    if (!isOnPayrollOn(p, dec31)) continue
    const retireAt = retirementRuleDate(p.birthDate, p.retirementPlannedRaw)
    if (!retireAt) continue
    const stage2Start = wagePeakHalfYearStageStart(retireAt, 1)
    const stage1Start = wagePeakHalfYearStageStart(retireAt, 2)
    const t = startOfDay(dec31).getTime()
    const rt = startOfDay(retireAt).getTime()
    if (t > rt) continue
    let stage: WagePeakStage | null = null
    let stageStart: Date | null = null
    if (t >= startOfDay(stage2Start).getTime() && t <= rt) {
      stage = '2단계'
      stageStart = startOfDay(stage2Start)
    } else if (t >= startOfDay(stage1Start).getTime() && t < startOfDay(stage2Start).getTime()) {
      stage = '1단계'
      stageStart = startOfDay(stage1Start)
    }
    if (stage && stageStart) rows.push({ person: p, retireAt, stage, stageStart })
  }
  return rows.sort((a, b) => a.retireAt.getTime() - b.retireAt.getTime())
}

export function upcomingRetirements(personnel: PersonnelRow[], base: Date) {
  return personnel
    .filter((p) => isOnPayrollOn(p, base))
    .map((p) => ({
      person: p,
      retireAt: retirementRuleDate(p.birthDate, p.retirementPlannedRaw),
    }))
    .filter((x) => x.retireAt && startOfDay(x.retireAt).getTime() >= startOfDay(base).getTime())
    .sort((a, b) => (a.retireAt!.getTime() - b.retireAt!.getTime()))
}

export function meritTrainingOn(training: TrainingRow[], base: Date) {
  return training.filter((t) => inRangeInclusive(base, t.meritStart, t.meritEnd))
}

export function leaveRowsForName(leave: LeaveRow[], nameQuery: string) {
  const q = nameQuery.trim().replace(/\s+/g, '')
  if (!q) return []
  return leave.filter((r) => r.name.replace(/\s+/g, '').includes(q))
}

export function rankCategoryForLeave(row: LeaveRow, personnel: PersonnelRow[]): string {
  const byId = row.empId ? personnel.find((p) => p.empId === row.empId) : undefined
  const p = byId ?? personnel.find((x) => x.name.trim() === row.name.trim())
  const rankStr = p?.currentRank || p?.promoteRank || p?.hireRank || row.rank || ''
  const job = p?.jobType || ''
  return displayMovementRankCategory(rankStr, job)
}

function endSortKey(d: Date | null): number {
  if (!d) return 8.64e15
  return startOfDay(d).getTime()
}

/** 휴직현황 시트 「대상자녀」 등에서 출생 연도만 추출 (없으면 '') */
export function childBirthYearFromLeaveChildInfo(raw: string): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const d = parseFlexibleDate(s)
  if (d) return String(d.getFullYear())
  const m = s.match(/\b(19\d{2}|20\d{2})\b/)
  if (m?.[1]) return m[1]
  const m2 = s.match(/(19\d{2}|20\d{2})/)
  return m2?.[1] ?? ''
}

/** 임신기·육아기 단축 구간: 시작·종료일이 모두 있어야 인정 */
export function hasValidPregnancyShort(row: LeaveRow): boolean {
  return Boolean(row.pregnancyShortStart) && Boolean(row.pregnancyShortEnd)
}

export function hasValidChildcareShort(row: LeaveRow): boolean {
  return Boolean(row.childcareShortStart) && Boolean(row.childcareShortEnd)
}

/** 본 휴직 사유가 육아휴직(류)인지 — 휴직종류·사유 문자열 기준 */
function isChildcareLeaveReason(row: LeaveRow, reason: string): boolean {
  const k = String(row.leaveKind ?? '').replace(/\s+/g, '')
  const r = reason.replace(/\s+/g, '')
  if (/육아휴직|육아기휴직|육아휴가/.test(k)) return true
  if (/육아휴직|육아기휴직|육아휴가/.test(r)) return true
  if (/휴직\([^)]*육아/.test(reason)) return true
  return false
}

export type LeaveReportRow = {
  name: string
  rankCategory: string
  gender: string
  start: string
  end: string
  reason: string
  /** 육아휴직 등일 때 대상자녀 출생연도, 그 외 '' */
  childBirthYear: string
  scheduled: boolean
}

/** 2-1: 본 휴직(휴직종류·시작·종료 필수)만 현재 휴직. 예정은 휴직 시작 전 또는 이전 구간과 본휴직 사이 공백 */
export function buildLeaveReport(leave: LeaveRow[], base: Date, personnel: PersonnelRow[]): LeaveReportRow[] {
  const active = activeMainLeavesOn(leave, base)
  const sorted = [...active].sort((a, b) => endSortKey(a.end) - endSortKey(b.end))
  const rows: LeaveReportRow[] = sorted.map((x) => ({
    name: x.row.name,
    rankCategory: rankCategoryForLeave(x.row, personnel),
    gender: x.row.gender,
    start: fmt(x.start),
    end: fmt(x.end),
    reason: x.reason,
    childBirthYear: isChildcareLeaveReason(x.row, x.reason)
      ? childBirthYearFromLeaveChildInfo(x.row.childInfo)
      : '',
    scheduled: false,
  }))
  const sched = scheduledMainLeaveSlots(leave, base)
  sched.sort((a, b) => a.nextStart.getTime() - b.nextStart.getTime())
  for (const s of sched) {
    rows.push({
      name: `${s.row.name}(예정)`,
      rankCategory: rankCategoryForLeave(s.row, personnel),
      gender: s.row.gender,
      start: fmt(s.nextStart),
      end: fmt(s.nextEnd),
      reason: s.reason,
      childBirthYear: isChildcareLeaveReason(s.row, s.reason)
        ? childBirthYearFromLeaveChildInfo(s.row.childInfo)
        : '',
      scheduled: true,
    })
  }
  return rows
}

/** 4-2 휴직자현황(통보): 2-1과 동일 목록 + 직급 열 (연번은보내기 시 부여) */
export type LeaveNotificationRow = {
  name: string
  rank: string
  start: string
  end: string
  note: string
}

export function buildLeaveNotificationRows(leave: LeaveRow[], base: Date, personnel: PersonnelRow[]): LeaveNotificationRow[] {
  const active = activeMainLeavesOn(leave, base)
  const sorted = [...active].sort((a, b) => endSortKey(a.end) - endSortKey(b.end))
  const rows: LeaveNotificationRow[] = sorted.map((x) => ({
    name: x.row.name,
    rank: rankCategoryForLeave(x.row, personnel),
    start: fmt(x.start),
    end: fmt(x.end),
    note: '',
  }))
  const sched = scheduledMainLeaveSlots(leave, base)
  sched.sort((a, b) => a.nextStart.getTime() - b.nextStart.getTime())
  for (const s of sched) {
    rows.push({
      name: `${s.row.name}(예정)`,
      rank: rankCategoryForLeave(s.row, personnel),
      start: fmt(s.nextStart),
      end: fmt(s.nextEnd),
      note: '',
    })
  }
  return rows
}

export type MaternityReportRow = {
  name: string
  rankCategory: string
  gender: string
  start: string
  end: string
  scheduled: boolean
}

type PeriodBounds = { start: Date | null; end: Date | null }

function periodCurrentAndUpcoming(
  leave: LeaveRow[],
  base: Date,
  isValid: (row: LeaveRow) => boolean,
  bounds: (row: LeaveRow) => PeriodBounds,
) {
  const current = leave.filter((r) => {
    if (!isValid(r)) return false
    const { start, end } = bounds(r)
    return inRangeInclusive(base, start, end)
  })
  const upcoming = leave.filter((r) => {
    if (!isValid(r)) return false
    const { start } = bounds(r)
    if (!start) return false
    return startOfDay(start).getTime() > startOfDay(base).getTime()
  })
  return { current, upcoming }
}

function buildPeriodReport(
  leave: LeaveRow[],
  base: Date,
  personnel: PersonnelRow[],
  isValid: (row: LeaveRow) => boolean,
  bounds: (row: LeaveRow) => PeriodBounds,
  reasonLabel: string,
): LeaveReportRow[] {
  const { current, upcoming } = periodCurrentAndUpcoming(leave, base, isValid, bounds)
  const sortedCur = [...current].sort((a, b) => endSortKey(bounds(a).end) - endSortKey(bounds(b).end))
  const rows: LeaveReportRow[] = sortedCur.map((r) => {
    const { start, end } = bounds(r)
    return {
      name: r.name,
      rankCategory: rankCategoryForLeave(r, personnel),
      gender: r.gender,
      start: fmt(start),
      end: fmt(end),
      reason: reasonLabel,
      childBirthYear: '',
      scheduled: false,
    }
  })
  const sortedUp = [...upcoming].sort(
    (a, b) => endSortKey(bounds(a).start) - endSortKey(bounds(b).start),
  )
  for (const r of sortedUp) {
    const { start, end } = bounds(r)
    rows.push({
      name: `${r.name}(예정)`,
      rankCategory: rankCategoryForLeave(r, personnel),
      gender: r.gender,
      start: fmt(start),
      end: fmt(end),
      reason: `${reasonLabel} 예정`,
      childBirthYear: '',
      scheduled: true,
    })
  }
  return rows
}

/** 2-2: 출산휴가 종료 가까운 순, 하단 예정 성명(예정) */
export function buildMaternityReport(leave: LeaveRow[], base: Date, personnel: PersonnelRow[]): MaternityReportRow[] {
  const { current, upcoming } = maternityCurrentAndUpcoming(leave, base)
  const sortedCur = [...current].sort((a, b) => endSortKey(a.maternityEnd) - endSortKey(b.maternityEnd))
  const rows: MaternityReportRow[] = sortedCur.map((r) => ({
    name: r.name,
    rankCategory: rankCategoryForLeave(r, personnel),
    gender: r.gender,
    start: fmt(r.maternityStart),
    end: fmt(r.maternityEnd),
    scheduled: false,
  }))
  const sortedUp = [...upcoming].sort(
    (a, b) => endSortKey(a.maternityStart) - endSortKey(b.maternityStart),
  )
  for (const r of sortedUp) {
    rows.push({
      name: `${r.name}(예정)`,
      rankCategory: rankCategoryForLeave(r, personnel),
      gender: r.gender,
      start: fmt(r.maternityStart),
      end: fmt(r.maternityEnd),
      scheduled: true,
    })
  }
  return rows
}

/** 2-3·2-4: 단축 구간이 해당 연도와 겹치는지 */
export function periodOverlapsYear(start: Date | null, end: Date | null, year: number): boolean {
  if (!start || !end) return false
  const y0 = startOfDay(new Date(year, 0, 1)).getTime()
  const y1 = startOfDay(new Date(year, 11, 31)).getTime()
  const ps = startOfDay(start).getTime()
  const pe = startOfDay(end).getTime()
  return ps <= y1 && pe >= y0
}

function monthInYearForPeriod(start: Date, year: number): number {
  if (start.getFullYear() === year) return start.getMonth() + 1
  return 1
}

export type ShortWorkYearEntry = { name: string; start: string; end: string }
export type ShortWorkYearMonthGroup = { month: number; entries: ShortWorkYearEntry[] }
export type ShortWorkYearBlock = { category: string; monthGroups: ShortWorkYearMonthGroup[] }

/** 2-3·2-4: 연도별 — 직급 구분·시작월(해당 연도)별 묶음 (3-1과 동일 패턴) */
function buildShortWorkByYear(
  leave: LeaveRow[],
  year: number,
  personnel: PersonnelRow[],
  isValid: (row: LeaveRow) => boolean,
  bounds: (row: LeaveRow) => PeriodBounds,
): ShortWorkYearBlock[] {
  const matched = leave.filter(
    (r) => isValid(r) && periodOverlapsYear(bounds(r).start, bounds(r).end, year),
  )
  const byCat = new Map<string, LeaveRow[]>()
  for (const r of matched) {
    const cat = rankCategoryForLeave(r, personnel)
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat)!.push(r)
  }
  const cats = [...byCat.keys()].sort((a, b) => movementRankSortIndex(a) - movementRankSortIndex(b))
  return cats.map((category) => {
    const people = byCat.get(category)!
    people.sort((a, b) => {
      const sa = bounds(a).start!
      const sb = bounds(b).start!
      const ma = monthInYearForPeriod(sa, year)
      const mb = monthInYearForPeriod(sb, year)
      if (ma !== mb) return ma - mb
      return sa.getTime() - sb.getTime() || a.name.localeCompare(b.name, 'ko')
    })
    const monthGroups: ShortWorkYearMonthGroup[] = []
    for (const r of people) {
      const { start, end } = bounds(r)
      if (!start || !end) continue
      const month = monthInYearForPeriod(start, year)
      const entry: ShortWorkYearEntry = {
        name: r.name,
        start: fmt(start),
        end: fmt(end),
      }
      const prev = monthGroups[monthGroups.length - 1]
      if (prev && prev.month === month) prev.entries.push(entry)
      else monthGroups.push({ month, entries: [entry] })
    }
    return { category, monthGroups }
  })
}

/** 2-3: 연도별 임신기단축 */
export function buildPregnancyShortByYear(
  leave: LeaveRow[],
  year: number,
  personnel: PersonnelRow[],
): ShortWorkYearBlock[] {
  return buildShortWorkByYear(
    leave,
    year,
    personnel,
    hasValidPregnancyShort,
    (r) => ({ start: r.pregnancyShortStart, end: r.pregnancyShortEnd }),
  )
}

/** 2-4: 연도별 육아기단축 */
export function buildChildcareShortByYear(
  leave: LeaveRow[],
  year: number,
  personnel: PersonnelRow[],
): ShortWorkYearBlock[] {
  return buildShortWorkByYear(
    leave,
    year,
    personnel,
    hasValidChildcareShort,
    (r) => ({ start: r.childcareShortStart, end: r.childcareShortEnd }),
  )
}

/** @deprecated 기준일 스냅샷 — 2-3·2-4는 연도별 조회 사용 */
export function buildPregnancyShortReport(
  leave: LeaveRow[],
  base: Date,
  personnel: PersonnelRow[],
): LeaveReportRow[] {
  return buildPeriodReport(
    leave,
    base,
    personnel,
    hasValidPregnancyShort,
    (r) => ({ start: r.pregnancyShortStart, end: r.pregnancyShortEnd }),
    '임신기단축',
  )
}

/** @deprecated 기준일 스냅샷 — 2-4는 연도별 조회 사용 */
export function buildChildcareShortReport(
  leave: LeaveRow[],
  base: Date,
  personnel: PersonnelRow[],
): LeaveReportRow[] {
  return buildPeriodReport(
    leave,
    base,
    personnel,
    hasValidChildcareShort,
    (r) => ({ start: r.childcareShortStart, end: r.childcareShortEnd }),
    '육아기단축',
  )
}

export type PersonalLeaveHistoryRow = {
  name: string
  rankCategory: string
  gender: string
  kind: string
  start: string
  end: string
}

/** 2-5: 검색한 사람의 휴직·모성보호 구간을 시작일 순으로 나열 */
export function buildPersonalLeaveHistory(
  leave: LeaveRow[],
  nameQuery: string,
  personnel: PersonnelRow[],
): PersonalLeaveHistoryRow[] {
  const q = nameQuery.trim().replace(/\s+/g, '')
  if (!q) return []
  const matched = leave.filter((r) => r.name.replace(/\s+/g, '').includes(q))
  const entries: { sortKey: number; row: PersonalLeaveHistoryRow }[] = []

  const push = (
    r: LeaveRow,
    rankCategory: string,
    kind: string,
    start: Date | null,
    end: Date | null,
  ) => {
    if (!start || !end) return
    entries.push({
      sortKey: startOfDay(start).getTime(),
      row: {
        name: r.name,
        rankCategory,
        gender: r.gender,
        kind,
        start: fmt(start),
        end: fmt(end),
      },
    })
  }

  for (const r of matched) {
    const rankCategory = rankCategoryForLeave(r, personnel)
    push(r, rankCategory, '출산휴가', r.maternityStart, r.maternityEnd)
    push(r, rankCategory, '임신기단축', r.pregnancyShortStart, r.pregnancyShortEnd)
    push(r, rankCategory, '육아기단축', r.childcareShortStart, r.childcareShortEnd)
    if (hasValidMainLeave(r)) {
      const kind = String(r.leaveKind ?? '').trim() || '휴직'
      push(r, rankCategory, kind, r.leaveStart, r.leaveEnd)
    }
  }

  entries.sort((a, b) => a.sortKey - b.sortKey || a.row.kind.localeCompare(b.row.kind, 'ko'))
  return entries.map((e) => e.row)
}
