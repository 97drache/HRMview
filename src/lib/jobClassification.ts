/** 조직 직종 계층: 행정·기술·기능 = 정규직, 관리·일반 = 무기직 */
export const JOB_ORDER = ['행정직', '기술직', '기능직', '관리직', '일반직'] as const
export type JobCategory = (typeof JOB_ORDER)[number] | '기타'

export const REGULAR_JOB_SET = new Set<JobCategory>(['행정직', '기술직', '기능직'])
export const MUGI_JOB_SET = new Set<JobCategory>(['관리직', '일반직'])

/** 연도별 표 중간 열: 직급 구분 */
export const RANK_BAND_ORDER = [
  '책임급',
  '선임급',
  '원급',
  '기능직',
  '관리직',
  '무기직',
  '기타',
] as const
export type RankBand = (typeof RANK_BAND_ORDER)[number]

export function normalizeJobType(raw: string): JobCategory {
  const t = String(raw ?? '')
    .replace(/\u00a0/g, '')
    .trim()
  if (!t) return '기타'
  for (const j of JOB_ORDER) {
    if (t === j || t.includes(j)) return j
  }
  if (/행정/.test(t)) return '행정직'
  if (/기술/.test(t)) return '기술직'
  if (/기능/.test(t)) return '기능직'
  if (/관리/.test(t)) return '관리직'
  if (/일반/.test(t)) return '일반직'
  return '기타'
}

export function jobSortIndex(job: JobCategory): number {
  const i = JOB_ORDER.indexOf(job as (typeof JOB_ORDER)[number])
  if (i >= 0) return i
  return 99
}

export function isRegularJob(job: JobCategory): boolean {
  return REGULAR_JOB_SET.has(job as JobCategory)
}

export function isMaleGender(g: string): boolean {
  const s = String(g ?? '').trim()
  return /^남|^M$/i.test(s) || /^male$/i.test(s)
}

export function isFemaleGender(g: string): boolean {
  const s = String(g ?? '').trim()
  return /^여|^F$/i.test(s) || /^female$/i.test(s)
}

/** 현직급 등 문자열을 직급 구분으로 분류 */
export function classifyRankBand(rankRaw: string, jobType: string): RankBand {
  const r = String(rankRaw ?? '').trim()
  const j = normalizeJobType(jobType)

  if (/책임/.test(r)) return '책임급'
  if (/선임/.test(r)) return '선임급'
  if (/원급/.test(r)) return '원급'
  if (/^원[\s-]*급?$/.test(r.replace(/\s/g, ''))) return '원급'
  if (/무기/.test(r)) return '무기직'
  if (/관리/.test(r)) return '관리직'
  if (/기능/.test(r)) return '기능직'

  if (j === '기능직') return '기능직'
  if (j === '관리직') return '관리직'
  if (j === '일반직') return '무기직'
  return '기타'
}

export function rankBandSortIndex(b: RankBand): number {
  const i = RANK_BAND_ORDER.indexOf(b)
  return i >= 0 ? i : 999
}

/** 신입·퇴직 표 등에서 쓰는 직급 구분(일반직 표기 포함) */
export const DISPLAY_RANK_MOVEMENT_ORDER = [
  '책임급',
  '선임급',
  '원급',
  '기능직',
  '관리직',
  '일반직',
] as const

export type MovementRankLabel = (typeof DISPLAY_RANK_MOVEMENT_ORDER)[number] | '기타'

export function displayMovementRankCategory(rankStr: string, jobType: string): MovementRankLabel {
  const j = normalizeJobType(jobType)
  const b = classifyRankBand(rankStr, jobType)
  if (b === '책임급' || b === '선임급' || b === '원급' || b === '기능직' || b === '관리직') return b
  if (b === '무기직') {
    if (j === '일반직') return '일반직'
    return '관리직'
  }
  if (j === '일반직') return '일반직'
  if (j === '관리직') return '관리직'
  if (j === '기능직') return '기능직'
  if (j === '행정직' || j === '기술직') return '기타'
  return '기타'
}

export function movementRankSortIndex(label: string): number {
  const i = DISPLAY_RANK_MOVEMENT_ORDER.indexOf(
    label as (typeof DISPLAY_RANK_MOVEMENT_ORDER)[number],
  )
  if (i >= 0) return i
  return 999
}
