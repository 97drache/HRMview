export type HeadcountNav =
  | 'home'
  | 'p-1-1'
  | 'p-1-2'
  | 'l-2-0'
  | 'm-3-0'
  | 'proof'
  | 'doc-6-1'
  | 'doc-6-2'
  | 'doc-6-3'

export type ProofSubNavKey = 'doc-6-1' | 'doc-6-2' | 'doc-6-3'

/** 하단·사이드바 6칸 */
export const HEADCOUNT_NAV: { key: HeadcountNav; code: string; label: string }[] = [
  { key: 'home', code: '1-0', label: '한눈에 보기' },
  { key: 'p-1-1', code: '1-1', label: '직종별' },
  { key: 'p-1-2', code: '1-2', label: '남녀·고용' },
  { key: 'l-2-0', code: '2-0', label: '모성보호' },
  { key: 'm-3-0', code: '3-0', label: '입퇴사' },
  { key: 'proof', code: '6', label: '증빙' },
]

export const PROOF_SUB_NAV: { key: ProofSubNavKey; code: string; label: string }[] = [
  { key: 'doc-6-1', code: '6-1', label: '지급신청서' },
  { key: 'doc-6-2', code: '6-2', label: '증빙서붙임' },
  { key: 'doc-6-3', code: '6-3', label: '출장 증빙' },
]

const LEGACY: Record<string, HeadcountNav> = {
  'p-1-3': 'home',
  'p-1-4': 'home',
  'p-1-5': 'proof',
}

const VALID = new Set<string>([
  ...HEADCOUNT_NAV.map((n) => n.key),
  ...PROOF_SUB_NAV.map((n) => n.key),
  ...Object.keys(LEGACY),
])

export function isProofNav(key: HeadcountNav): boolean {
  return key === 'proof' || key === 'doc-6-1' || key === 'doc-6-2' || key === 'doc-6-3'
}

export function bottomNavKey(key: HeadcountNav): HeadcountNav {
  if (isProofNav(key)) return 'proof'
  return key
}

export function readNavFromHash(): HeadcountNav {
  const raw = window.location.hash.replace(/^#/, '').trim().toLowerCase()
  if (raw && LEGACY[raw]) return LEGACY[raw]
  if (raw && VALID.has(raw)) return raw as HeadcountNav
  return 'home'
}

export function writeNavHash(key: HeadcountNav): void {
  const next = `#${key}`
  if (window.location.hash !== next) {
    window.location.hash = key
  }
}

export function ensureHomeHash(): void {
  const raw = window.location.hash.replace(/^#/, '').trim().toLowerCase()
  if (!raw || (!VALID.has(raw) && !LEGACY[raw])) {
    writeNavHash('home')
  }
}

export function navTitle(key: HeadcountNav): string {
  if (key === 'proof') return '서류작성'
  const main = HEADCOUNT_NAV.find((n) => n.key === key)
  if (main) return main.label
  const sub = PROOF_SUB_NAV.find((n) => n.key === key)
  return sub?.label ?? 'HRM'
}

export function defaultProofSubNav(): ProofSubNavKey {
  return 'doc-6-1'
}

export function normalizeProofNav(key: HeadcountNav): ProofSubNavKey {
  if (key === 'doc-6-2' || key === 'doc-6-3') return key
  return 'doc-6-1'
}
