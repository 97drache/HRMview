export type HeadcountNav =
  | 'home'
  | 'p-1-1'
  | 'p-1-2'
  | 'p-1-3'
  | 'p-1-4'
  | 'proof'
  | 'doc-6-1'
  | 'doc-6-2'

/** 하단·사이드바 6칸 (1-5 대신 증빙) */
export const HEADCOUNT_NAV: { key: HeadcountNav; code: string; label: string }[] = [
  { key: 'home', code: '1-0', label: '한눈에 보기' },
  { key: 'p-1-1', code: '1-1', label: '직종별' },
  { key: 'p-1-2', code: '1-2', label: '남녀·고용' },
  { key: 'p-1-3', code: '1-3', label: '연도·직급' },
  { key: 'p-1-4', code: '1-4', label: '월초·월말' },
  { key: 'proof', code: '증빙', label: '증빙' },
]

export const PROOF_SUB_NAV: { key: 'doc-6-1' | 'doc-6-2'; code: string; label: string }[] = [
  { key: 'doc-6-1', code: '6-1', label: '지급신청서 증빙' },
  { key: 'doc-6-2', code: '6-2', label: '출장 증빙' },
]

const VALID = new Set<string>([
  ...HEADCOUNT_NAV.map((n) => n.key),
  ...PROOF_SUB_NAV.map((n) => n.key),
  'p-1-5', // 구 링크 → 증빙
])

export function isProofNav(key: HeadcountNav): boolean {
  return key === 'proof' || key === 'doc-6-1' || key === 'doc-6-2'
}

export function bottomNavKey(key: HeadcountNav): HeadcountNav {
  if (isProofNav(key)) return 'proof'
  return key
}

export function readNavFromHash(): HeadcountNav {
  const raw = window.location.hash.replace(/^#/, '').trim().toLowerCase()
  if (raw === 'p-1-5') return 'proof'
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
  if (!raw || (!VALID.has(raw) && raw !== 'p-1-5')) {
    writeNavHash('home')
  }
}

export function navTitle(key: HeadcountNav): string {
  if (key === 'proof') return '증빙'
  const main = HEADCOUNT_NAV.find((n) => n.key === key)
  if (main) return main.label
  const sub = PROOF_SUB_NAV.find((n) => n.key === key)
  return sub?.label ?? 'HRM'
}
