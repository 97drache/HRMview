import { startOfDay } from 'date-fns'
import { parseFlexibleDate } from './dates'
import type {
  CareerRecordParseResult,
  ParsedDutyRow,
  ParsedPromotionRow,
  ParsedWorkLogRow,
} from './careerRecordExcel'

const ORG_PREFIX_RE = /^(?:광주\s*과학\s*기술원|광주과학기술원|지스트|gist)\s*(?:\/|\\|>|:|-)?\s*/i
const ORG_ONLY_RE = /^(?:광주\s*과학\s*기술원|광주과학기술원|지스트|gist)$/i

function normalizeDepartment(raw: string | undefined): string {
  const cleaned = String(raw ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned || ORG_ONLY_RE.test(cleaned)) return ''
  const stripped = cleaned.replace(ORG_PREFIX_RE, '').trim()
  if (!stripped || ORG_ONLY_RE.test(stripped)) return ''
  return stripped
}

export type GeminiCareerRecordPayload = {
  name?: string
  birthYmd?: string
  hireYmd?: string
  lastPromotionRank?: string
  promotions?: { date?: string; rank?: string }[]
  workLog?: {
    startDate?: string
    endDate?: string
    department?: string
    imsa?: string
  }[]
  duties?: { title?: string; startDate?: string; endDate?: string; department?: string }[]
  note?: string
}

function parseDateOrNull(s: string | undefined): Date | null {
  const t = String(s ?? '').trim()
  if (!t) return null
  return parseFlexibleDate(t)
}

export function careerParseResultFromGemini(
  raw: GeminiCareerRecordPayload,
  sheetName = 'Gemini(PDF)',
): CareerRecordParseResult {
  const warnings: string[] = []

  const promotions: ParsedPromotionRow[] = []
  for (const p of raw.promotions ?? []) {
    const d = parseDateOrNull(p.date)
    const rank = String(p.rank ?? '').trim()
    if (d && rank) promotions.push({ date: startOfDay(d), rank })
  }
  promotions.sort((a, b) => a.date.getTime() - b.date.getTime())

  const workLog: ParsedWorkLogRow[] = []
  for (const w of raw.workLog ?? []) {
    const rawDate = parseDateOrNull(w.startDate)
    const rawEnd = parseDateOrNull(w.endDate)
    workLog.push({
      rawDate,
      rawEnd,
      dept: normalizeDepartment(w.department),
      imsa: String(w.imsa ?? '').trim(),
    })
  }

  const duties: ParsedDutyRow[] = []
  for (const d of raw.duties ?? []) {
    duties.push({
      title: String(d.title ?? '').trim(),
      start: parseDateOrNull(d.startDate),
      end: parseDateOrNull(d.endDate),
      dept: normalizeDepartment(d.department),
    })
  }

  const name = String(raw.name ?? '').trim()
  const birthYmd = String(raw.birthYmd ?? '').trim()
  const hireYmd = String(raw.hireYmd ?? '').trim()
  const lastPromotionRank = String(raw.lastPromotionRank ?? '').trim()

  if (!name) warnings.push('PDF에서 성명을 찾지 못했습니다. 직접 입력해 주세요.')
  if (!workLog.length) warnings.push('PDF에서 근무기록을 찾지 못했습니다.')

  return {
    sheetName,
    name,
    birthYmd,
    hireYmd,
    lastPromotionRank,
    promotions,
    workLog,
    duties,
    warnings,
  }
}

export type GeminiLeaveRecordPayload = {
  name?: string
  birthYmd?: string
  empId?: string
  rankLabel?: string
  jobType?: string
  leaveStart?: string
  leaveEnd?: string
  leaveReason?: string
  note?: string
}

export type GeminiRetirementRecordPayload = {
  name?: string
  birthYmd?: string
  empId?: string
  hireYmd?: string
  retireYmd?: string
  rankLabel?: string
  jobType?: string
  note?: string
}
