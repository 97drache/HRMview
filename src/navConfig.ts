export type NavKey =
  | 'home'
  | 'p-1-1'
  | 'p-1-2'
  | 'p-1-3'
  | 'p-1-4'
  | 'p-1-5'
  | 'l-2-1'
  | 'l-2-2'
  | 'l-2-3'
  | 'm-3-1'
  | 'm-3-2'
  | 'm-3-3'
  | 'm-3-4'
  | 'r-4-1-1'
  | 'r-4-1-2'
  | 'r-4-2'
  | 'c-5-1'

export type NavGroupDef = {
  id: string
  /** 대분류 표시 번호 (1~5) */
  groupNo: number
  title: string
  shortTitle: string
  subtitle: string
  items: { key: NavKey; code: string; label: string }[]
}

export const NAV_GROUPS: NavGroupDef[] = [
  {
    id: 'g1',
    groupNo: 1,
    title: '1. 인원현황',
    shortTitle: '인원현황',
    subtitle: '기준일 스냅샷 · 시계열',
    items: [
      { key: 'home', code: '1-0', label: '한눈에 보기' },
      { key: 'p-1-1', code: '1-1', label: '직종별 (남·여)' },
      { key: 'p-1-2', code: '1-2', label: '남녀·정규/무기' },
      { key: 'p-1-3', code: '1-3', label: '연도별·직급 구분' },
      { key: 'p-1-4', code: '1-4', label: '월초·월말 인원' },
      { key: 'p-1-5', code: '1-5', label: '공로연수 현황' },
    ],
  },
  {
    id: 'g2',
    groupNo: 2,
    title: '2. 휴직현황',
    shortTitle: '휴직현황',
    subtitle: '휴직 · 출산 · 예정',
    items: [
      { key: 'l-2-1', code: '2-1', label: '휴직자 현황' },
      { key: 'l-2-2', code: '2-2', label: '출산휴가 현황' },
      { key: 'l-2-3', code: '2-3', label: '개인 이력 조회' },
    ],
  },
  {
    id: 'g3',
    groupNo: 3,
    title: '3. 입퇴사현황',
    shortTitle: '입퇴사',
    subtitle: '입사 · 퇴직 · 임금피크 · 정년',
    items: [
      { key: 'm-3-1', code: '3-1', label: '연도별 신입' },
      { key: 'm-3-2', code: '3-2', label: '연도별 퇴직' },
      { key: 'm-3-3', code: '3-3', label: '연도별 임금피크' },
      { key: 'm-3-4', code: '3-4', label: '퇴직 예정자' },
    ],
  },
  {
    id: 'g4',
    groupNo: 4,
    title: '4. 요구자료',
    shortTitle: '요구자료',
    subtitle: '사업체 노동력조사 등',
    items: [
      { key: 'r-4-1-1', code: '4-1-1', label: '노동력1-휴일근로' },
      { key: 'r-4-1-2', code: '4-1-2', label: '노동력2-출근안한일수' },
      { key: 'r-4-2', code: '4-2', label: '휴직자현황(통보)' },
    ],
  },
  {
    id: 'g5',
    groupNo: 5,
    title: '5. 증명서 발급',
    shortTitle: '증명서',
    subtitle: '경력증명서',
    items: [{ key: 'c-5-1', code: '5-1', label: '경력증명서' }],
  },
]

export function groupIdForNavKey(key: NavKey): string {
  for (const g of NAV_GROUPS) {
    if (g.items.some((it) => it.key === key)) return g.id
  }
  return NAV_GROUPS[0].id
}

export function firstNavKeyInGroup(groupId: string): NavKey {
  const g = NAV_GROUPS.find((x) => x.id === groupId)
  return g?.items[0]?.key ?? NAV_GROUPS[0].items[0].key
}

export function navGroupForKey(key: NavKey): NavGroupDef {
  for (const g of NAV_GROUPS) {
    if (g.items.some((it) => it.key === key)) return g
  }
  return NAV_GROUPS[0]
}
