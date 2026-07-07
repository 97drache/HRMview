export type NavKey =
  | 'sitemap'
  | 'home'
  | 'p-1-1'
  | 'p-1-2'
  | 'p-1-3'
  | 'p-1-4'
  | 'p-1-5'
  | 'l-2-0'
  | 'l-2-1'
  | 'l-2-2'
  | 'l-2-3'
  | 'l-2-4'
  | 'l-2-5'
  | 'm-3-0'
  | 'm-3-1'
  | 'm-3-2'
  | 'm-3-3'
  | 'm-3-4'
  | 'r-4-1-1'
  | 'r-4-1-2'
  | 'r-4-2'
  | 'c-5-1'
  | 'c-5-2'
  | 'c-5-3'
  | 'doc-6-1'
  | 'doc-6-2'
  | 'doc-6-3'
  | 'law-7-1'
  | 'law-7-2'
  | 'law-7-3'
  | 'law-7-4'

export type NavGroupDef = {
  id: string
  /** 대분류 표시 번호 */
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
    title: '2. 모성보호',
    shortTitle: '모성보호',
    subtitle: '휴직 · 출산 · 연도별 단축 · 이력',
    items: [
      { key: 'l-2-0', code: '2-0', label: '한눈에 보기' },
      { key: 'l-2-1', code: '2-1', label: '휴직자 현황' },
      { key: 'l-2-2', code: '2-2', label: '출산휴가 현황' },
      { key: 'l-2-3', code: '2-3', label: '연도별 임신기단축' },
      { key: 'l-2-4', code: '2-4', label: '연도별 육아기단축' },
      { key: 'l-2-5', code: '2-5', label: '개인 이력 조회' },
    ],
  },
  {
    id: 'g3',
    groupNo: 3,
    title: '3. 입퇴사현황',
    shortTitle: '입퇴사',
    subtitle: '입사 · 퇴직 · 임금피크 · 정년',
    items: [
      { key: 'm-3-0', code: '3-0', label: '한눈에 보기' },
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
    subtitle: '경력 · 휴직 · 퇴직(예정)',
    items: [
      { key: 'c-5-1', code: '5-1', label: '경력증명서' },
      { key: 'c-5-2', code: '5-2', label: '휴직증명서' },
      { key: 'c-5-3', code: '5-3', label: '퇴직(예정)증명서' },
    ],
  },
  {
    id: 'g6',
    groupNo: 6,
    title: '6. 서류작성',
    shortTitle: '서류작성',
    subtitle: '지급·증빙서·출장',
    items: [
      { key: 'doc-6-1', code: '6-1', label: '지급신청서 증빙' },
      { key: 'doc-6-2', code: '6-2', label: '증빙서붙임' },
      { key: 'doc-6-3', code: '6-3', label: '출장 증빙' },
    ],
  },
  {
    id: 'g7',
    groupNo: 7,
    title: '7. 인사법령',
    shortTitle: '인사법령',
    subtitle: '근로·인사 법령 검색 · 개정 알림',
    items: [
      { key: 'law-7-1', code: '7-1', label: '최근 법령 변경' },
      { key: 'law-7-2', code: '7-2', label: '법령 검색' },
      { key: 'law-7-3', code: '7-3', label: '주요 법령·조문' },
      { key: 'law-7-4', code: '7-4', label: '규정·법령 비교' },
    ],
  },
]

export function groupIdForNavKey(key: NavKey): string {
  if (key === 'sitemap') return 'sitemap'
  for (const g of NAV_GROUPS) {
    if (g.items.some((it) => it.key === key)) return g.id
  }
  return NAV_GROUPS[0].id
}

export function firstNavKeyInGroup(groupId: string): NavKey {
  const g = NAV_GROUPS.find((x) => x.id === groupId)
  return g?.items[0]?.key ?? NAV_GROUPS[0].items[0].key
}

const SITEMAP_GROUP: NavGroupDef = {
  id: 'sitemap',
  groupNo: 0,
  title: '사이트맵',
  shortTitle: '사이트맵',
  subtitle: '전체 메뉴',
  items: [
    { key: 'home', code: '1-0', label: '한눈에 보기' },
    { key: 'sitemap', code: '전체', label: '사이트맵' },
  ],
}

export function navGroupForKey(key: NavKey): NavGroupDef {
  if (key === 'sitemap') return SITEMAP_GROUP
  for (const g of NAV_GROUPS) {
    if (g.items.some((it) => it.key === key)) return g
  }
  return NAV_GROUPS[0]
}

/** 1~3번 대분류만 HRdata.xlsx 기반 */
export function groupUsesHrData(groupId: string): boolean {
  return groupId === 'g1' || groupId === 'g2' || groupId === 'g3'
}
