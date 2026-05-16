export type HeadcountNav = 'home' | 'p-1-1' | 'p-1-2' | 'p-1-3' | 'p-1-4' | 'p-1-5'

export const HEADCOUNT_NAV: { key: HeadcountNav; code: string; label: string }[] = [
  { key: 'home', code: '1-0', label: '한눈에 보기' },
  { key: 'p-1-1', code: '1-1', label: '직종별' },
  { key: 'p-1-2', code: '1-2', label: '남녀·고용' },
  { key: 'p-1-3', code: '1-3', label: '연도·직급' },
  { key: 'p-1-4', code: '1-4', label: '월초·월말' },
  { key: 'p-1-5', code: '1-5', label: '공로연수' },
]

const VALID = new Set<string>(HEADCOUNT_NAV.map((n) => n.key))

export function readNavFromHash(): HeadcountNav {
  const raw = window.location.hash.replace(/^#/, '').trim().toLowerCase()
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
  const raw = window.location.hash.replace(/^#/, '').trim()
  if (!raw || !VALID.has(raw)) {
    writeNavHash('home')
  }
}
