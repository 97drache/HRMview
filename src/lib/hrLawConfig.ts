/** 7-1 최근 변경 조회 — 본법(시행령·시행규칙 자동 포함) */
export const HR_RECENT_LAW_BASE_NAMES = [
  '채용절차의 공정화에 관한 법률',
  '남녀고용평등과 일·가정 양립 지원에 관한 법률',
  '남녀고용평등과 모성보호의 시행에 관한 법률',
  '고용상 연령차별금지 및 고령자 고용촉진에 관한 법률',
  '고용상 연령차별금지 및 고령자고용촉진에 관한 특별법',
  '장애인차별 금지 및 권리구제 등에 관한 법률',
  '장애인차별금지와 권리구제 등에 관한 법률',
  '노동조합 및 노동관계조정법',
  '근로자퇴직급여 보장법',
  '근로자퇴직급여보장법',
  '고용정책 기본법',
  '근로기준법',
] as const

/** @deprecated HR_RECENT_LAW_BASE_NAMES 사용 */
export const HR_RECENT_LAW_FILTER_NAMES = HR_RECENT_LAW_BASE_NAMES

/** 7-3 주요 법령 — 검색·MST 해석용 (표시 순서) */
export const HR_MAJOR_LAW_NAMES = [
  '근로기준법',
  '근로기준법 시행령',
  '근로기준법 시행규칙',
  '남녀고용평등과 모성보호의 시행에 관한 법률',
  '남녀고용평등과 모성보호의 시행에 관한 법률 시행령',
  '고용정책 기본법',
  '근로자퇴직급여 보장법',
  '산업재해보상보험법',
  '국가공무원법',
  '개인정보 보호법',
] as const

export const LAW_SOURCE_LABEL = '국가법령정보센터'

export type LawListItem = {
  name: string
  lawId: string
  mst: string
  efYd: string
  pubYd?: string
  dept?: string
  link?: string
}

export type LawJoChangeItem = {
  regDt: string
  lawName: string
  lawId: string
  joNo: string
  joTitle: string
  reason: string
  link?: string
}

/** 7-3 인사 실무 키워드 — 법령·조문 바로가기 */
export type HrLawTopicPreset = {
  label: string
  lawName: string
  joLabel: string
  /** API 조번호 6자리 (예: 제73조 → 007300, 제74조의2 → 007402) */
  jo: string
}

export type RegCompareRow = {
  topic: string
  gistRegulation: string
  law: string
  difference: string
  compliance: string
}

export const HR_LAW_TOPIC_PRESETS: HrLawTopicPreset[] = [
  { label: '보건휴가', lawName: '근로기준법', joLabel: '제73조', jo: '007300' },
  { label: '임산부 근로보호', lawName: '근로기준법', joLabel: '제74조', jo: '007400' },
  {
    label: '임신기간 중 근로시간 단축',
    lawName: '근로기준법',
    joLabel: '제74조 제7항',
    jo: '007400',
  },
  {
    label: '임신기 근무시간 변경',
    lawName: '근로기준법',
    joLabel: '제74조 제9항',
    jo: '007400',
  },
  { label: '태아검진 시간', lawName: '근로기준법', joLabel: '제74조의2', jo: '007402' },
  { label: '수유시간', lawName: '근로기준법', joLabel: '제75조', jo: '007500' },
  {
    label: '난임치료휴가',
    lawName: '남녀고용평등과 모성보호의 시행에 관한 법률',
    joLabel: '제18조의3',
    jo: '001803',
  },
]
