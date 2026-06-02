export type AttendeeOption = { key: string; label: string }

export const EXPENSE_ATTENDEE_OPTIONS: AttendeeOption[] = [
  { key: 'jy', label: '조용운' },
  { key: 'ks', label: '김성경' },
  { key: 'ys', label: '윤선미' },
  { key: 'jh', label: '장혜원' },
  { key: 'hs', label: '한상원' },
  { key: 'ju', label: '김주은' },
]

export const ALL_ATTENDEE_KEYS = EXPENSE_ATTENDEE_OPTIONS.map((a) => a.key)

export function formatAttendeesLine(selected: Set<string>): string {
  return EXPENSE_ATTENDEE_OPTIONS.filter((a) => selected.has(a.key))
    .map((a) => a.label)
    .join(', ')
}

/** 체크 선택 + 수기 입력을 PDF용 한 줄로 합칩니다. */
export function combineAttendeesLine(selected: Set<string>, manualExtra: string): string {
  const fromChecks = formatAttendeesLine(selected).trim()
  const extra = String(manualExtra ?? '').trim()
  if (fromChecks && extra) return `${fromChecks}, ${extra}`
  return fromChecks || extra
}
