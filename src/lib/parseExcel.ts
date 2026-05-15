import * as XLSX from 'xlsx'
import type { LeaveRow, ParsedWorkbook, PersonnelRow, TrainingRow } from '../types/hr'
import { parseFlexibleDate } from './dates'

function normKey(s: unknown): string {
  return String(s ?? '')
    .replace(/\u00a0/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function findSheet(wb: XLSX.WorkBook, candidates: string[]): XLSX.WorkSheet | null {
  const names = wb.SheetNames
  for (const c of candidates) {
    const exact = names.find((n) => normKey(n) === normKey(c))
    if (exact) return wb.Sheets[exact]
    const fuzzy = names.find((n) => normKey(n).includes(normKey(c)))
    if (fuzzy) return wb.Sheets[fuzzy]
  }
  return null
}

function sheetToMatrix(ws: XLSX.WorkSheet): unknown[][] {
  const ref = ws['!ref']
  if (!ref) return []
  const range = XLSX.utils.decode_range(ref)
  const rows: unknown[][] = []
  for (let R = range.s.r; R <= range.e.r; R++) {
    const row: unknown[] = []
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = ws[addr]
      row.push(cell?.v ?? '')
    }
    rows.push(row)
  }
  return rows
}

function rowObjects(matrix: unknown[][]): Record<string, unknown>[] {
  if (matrix.length === 0) return []
  const header = matrix[0].map(normKey)
  const out: Record<string, unknown>[] = []
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i]
    const obj: Record<string, unknown> = {}
    let empty = true
    for (let c = 0; c < header.length; c++) {
      const key = header[c]
      if (!key) continue
      const v = row[c]
      if (v !== '' && v != null) empty = false
      obj[key] = v
    }
    if (!empty) out.push(obj)
  }
  return out
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  const map = new Map<string, unknown>()
  for (const k of Object.keys(row)) {
    map.set(normKey(k), row[k])
  }
  for (const key of keys) {
    const v = map.get(normKey(key))
    if (v !== undefined && v !== '' && v != null) return v
  }
  return ''
}

function str(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function parsePersonnel(rows: Record<string, unknown>[]): PersonnelRow[] {
  return rows.map((r) => ({
    empId: str(pick(r, ['사번', '사원번호'])),
    name: str(pick(r, ['이름', '성명'])),
    gender: str(pick(r, ['성별'])),
    hireRank: str(pick(r, ['입사직급'])),
    hireDate: parseFlexibleDate(pick(r, ['입사일'])),
    promoteRank: str(pick(r, ['승진직급'])),
    promoteDate: parseFlexibleDate(pick(r, ['승진일'])),
    currentRank: str(pick(r, ['현직급'])),
    jobType: str(pick(r, ['직종', '직무'])),
    birthDate: parseFlexibleDate(pick(r, ['생년월일', '생일'])),
    retirementPlannedRaw: parseFlexibleDate(pick(r, ['정년예정일자', '정년예정일'])),
    status: str(pick(r, ['재직상태', '상태'])),
    resignDate: parseFlexibleDate(pick(r, ['퇴직일', '사직일'])),
    resignReason: str(pick(r, ['퇴직사유', '사직사유'])),
  }))
}

function parseLeave(rows: Record<string, unknown>[]): LeaveRow[] {
  return rows.map((r) => ({
    empId: str(pick(r, ['사번'])),
    name: str(pick(r, ['이름', '성명'])),
    rank: str(pick(r, ['직급', '현직급'])),
    gender: str(pick(r, ['성별'])),
    leaveKind: str(pick(r, ['휴직종류', '휴직종륭', '휴직유형'])),
    pregnancyShortStart: parseFlexibleDate(pick(r, ['임신기단축시작일'])),
    pregnancyShortEnd: parseFlexibleDate(pick(r, ['임신기단축종료일'])),
    childcareShortStart: parseFlexibleDate(pick(r, ['육아기단축시작일'])),
    childcareShortEnd: parseFlexibleDate(pick(r, ['육아기단축종료일'])),
    maternityStart: parseFlexibleDate(pick(r, ['출산휴가시작일'])),
    maternityEnd: parseFlexibleDate(pick(r, ['출산휴가종료일'])),
    leaveStart: parseFlexibleDate(pick(r, ['휴직시작일'])),
    leaveEnd: parseFlexibleDate(pick(r, ['휴직종료일'])),
    childInfo: str(pick(r, ['대상자녀', '대상자녀정보'])),
  }))
}

function parseTraining(rows: Record<string, unknown>[]): TrainingRow[] {
  return rows.map((r) => ({
    empId: str(pick(r, ['사번'])),
    name: str(pick(r, ['이름', '성명'])),
    rank: str(pick(r, ['직급'])),
    gender: str(pick(r, ['성별'])),
    meritStart: parseFlexibleDate(pick(r, ['공로연수시작일'])),
    meritEnd: parseFlexibleDate(pick(r, ['공로연수종료일'])),
  }))
}

export function parseWorkbookBuffer(buf: ArrayBuffer): ParsedWorkbook {
  // cellDates: false → 날짜 셀은 직렬값(숫자)으로만 받아, 엑셀에 보이는 달력과 동일하게 변환합니다(Date 객체는 타임존으로 하루 어긋나기 쉬움).
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })
  const notes: string[] = []

  const pWs = findSheet(wb, ['인원현황', '인원'])
  let lWs = findSheet(wb, ['휴직현황', '휴직'])
  if (!lWs && wb.SheetNames.length >= 2) {
    const sn = wb.SheetNames[1]
    if (sn && wb.Sheets[sn]) {
      lWs = wb.Sheets[sn]
      notes.push('「휴직현황」 시트를 이름으로 찾지 못해 두 번째 시트를 휴직 데이터로 읽었습니다.')
    }
  }
  const tWs = findSheet(wb, ['연수현황', '연수', '공로연수'])

  if (!pWs) notes.push('「인원현황」 시트를 찾지 못했습니다. 시트 이름을 확인해 주세요.')
  if (!lWs) notes.push('「휴직현황」 시트(또는 두 번째 시트)를 찾지 못했습니다.')
  if (!tWs) notes.push('「연수현황」 시트를 찾지 못했습니다.')

  const personnel = pWs ? parsePersonnel(rowObjects(sheetToMatrix(pWs))) : []
  const leave = lWs ? parseLeave(rowObjects(sheetToMatrix(lWs))) : []
  const training = tWs ? parseTraining(rowObjects(sheetToMatrix(tWs))) : []

  return { personnel, leave, training, sheetNotes: notes }
}
