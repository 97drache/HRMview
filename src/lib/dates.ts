import { addDays, addYears, endOfMonth, format, isValid, parse, startOfDay, startOfMonth } from 'date-fns'
import { ko } from 'date-fns/locale/ko'

/**
 * Excel/xlsx가 넣는 Date는 종종 UTC 자정에 가깝게 저장되어, 로컬에서 startOfDay 하면
 * 전날 달력으로 보이는 경우가 있습니다. UTC로 분해한 연·월·일을 로컬 달력 자정으로 맞춥니다.
 */
export function utcCalendarToLocalDate(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** Excel 직렬값 → 해당 ‘달력 날짜’의 로컬 자정 (엑셀 화면과 같은 연·월·일) */
export function fromExcelSerial(serial: number): Date | null {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null
  const whole = Math.floor(serial)
  if (whole < 1) return null
  const epoch = Date.UTC(1899, 11, 30)
  const ms = Math.round(whole * 86400000)
  const u = new Date(epoch + ms)
  if (!isValid(u)) return null
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate())
}

export function parseFlexibleDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (!isValid(value)) return null
    const utcMidnight =
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0
    // xlsx cellDates 등: UTC 자정 → 로컬에서 전날로 보이는 경우 보정
    if (utcMidnight) return utcCalendarToLocalDate(value)
    return startOfDay(value)
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value) && value > 1e12) {
      const d = new Date(value)
      return isValid(d) ? startOfDay(d) : null
    }
    if (Number.isFinite(value) && value >= 1 && value < 10_000_000) {
      const cal = fromExcelSerial(value)
      if (cal) return cal
    }
    const d = new Date(value)
    return isValid(d) ? startOfDay(d) : null
  }
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s || s === '-' || s === '—') return null
    const ymd = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
    if (ymd) {
      const y = Number(ymd[1])
      const mo = Number(ymd[2]) - 1
      const da = Number(ymd[3])
      const d = new Date(y, mo, da)
      return isValid(d) ? startOfDay(d) : null
    }
    const patterns = ['yyyy-MM-dd', 'yyyy.MM.dd', 'yyyy/MM/dd', 'yyyy-M-d', 'yyyy.M.d', 'yyyy/M/d']
    for (const p of patterns) {
      const d = parse(s, p, new Date())
      if (isValid(d)) return startOfDay(d)
    }
    const d2 = new Date(s)
    if (!isValid(d2)) return null
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return utcCalendarToLocalDate(d2)
    return startOfDay(d2)
  }
  return null
}

export function fmt(d: Date | null): string {
  if (!d) return '—'
  return format(d, 'yyyy-MM-dd', { locale: ko })
}

export function fmtDots(d: Date | null): string {
  if (!d) return '—'
  return format(d, 'yyyy.MM.dd.', { locale: ko })
}

export function fmtKo(d: Date | null): string {
  if (!d) return '—'
  return format(d, 'yyyy년 M월 d일', { locale: ko })
}

export function inRangeInclusive(d: Date, start: Date | null, end: Date | null): boolean {
  if (!start) return false
  const ds = startOfDay(d).getTime()
  const ss = startOfDay(start).getTime()
  if (ds < ss) return false
  if (!end) return true
  const ee = startOfDay(end).getTime()
  return ds <= ee
}

export function retirementRuleDate(birth: Date | null, planned: Date | null): Date | null {
  if (planned) return startOfDay(planned)
  if (!birth) return null
  const y = birth.getFullYear() + 60
  const m = birth.getMonth() + 1
  if (m >= 1 && m <= 6) return new Date(y, 5, 30)
  return new Date(y, 11, 31)
}

/**
 * 정년(6/30·12/31) 기준 임금피크 단계 시작일.
 * 퇴직 N년 전 날짜가 6/30이면 그 다음날 7/1, 12/31이면 익년 1/1부터 해당 단계.
 */
export function wagePeakHalfYearStageStart(retireAt: Date, yearsBeforeRetire: 1 | 2): Date {
  const anchor = addYears(retireAt, yearsBeforeRetire === 2 ? -2 : -1)
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
  const d = anchor.getDate()
  if (m === 5 && d === 30) return new Date(y, 6, 1)
  if (m === 11 && d === 31) return new Date(y + 1, 0, 1)
  return addDays(startOfDay(anchor), 1)
}

export function monthStarts(year: number) {
  return Array.from({ length: 12 }, (_, i) => startOfMonth(new Date(year, i, 1)))
}

export function monthEnds(year: number) {
  return Array.from({ length: 12 }, (_, i) => endOfMonth(new Date(year, i, 1)))
}

