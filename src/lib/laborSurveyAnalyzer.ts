/**
 * 사업체 노동력조사 등 보조 지표 — hr_analyzer_v3_female.py 로직 포팅
 * (시간외·휴일 근무, 연차사용 — 전체/여성 + 산출 근거 시트)
 */
import * as XLSX from 'xlsx'
import Holidays from 'date-holidays'
import { format, startOfDay } from 'date-fns'
import { parseFlexibleDate } from './dates'

function normKey(s: unknown): string {
  return String(s ?? '')
    .replace(/\u00a0/g, '')
    .replace(/\s+/g, '')
    .trim()
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

function matrixRowToObject(headerNorm: string[], row: unknown[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (let c = 0; c < headerNorm.length; c++) {
    const key = headerNorm[c]
    if (!key) continue
    obj[key] = row[c] ?? ''
  }
  return obj
}

function isRowObjectEmpty(obj: Record<string, unknown>): boolean {
  return Object.values(obj).every((v) => v === '' || v == null)
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

/** Python parse_korean_time 과 동일 규칙 */
export function parseKoreanTime(text: unknown): number {
  if (text == null || text === '') return 0
  const raw = str(text).replace(/\s+/g, '')
  if (!raw) return 0
  let totalHours = 0
  const dayM = raw.match(/(\d+)일/)
  const hourM = raw.match(/(\d+)시간/)
  const minM = raw.match(/(\d+)분/)
  if (dayM) totalHours += Number(dayM[1]) * 8
  if (hourM) totalHours += Number(hourM[1])
  if (minM) totalHours += Number(minM[1]) / 60
  if (!dayM && !hourM && !minM) {
    const numM = raw.match(/[-+]?\d*\.?\d+/)
    if (numM) return Number(numM[0])
    return 0
  }
  return totalHours
}

function readFirstSheetMatrix(buf: ArrayBuffer): { matrix: unknown[][]; sheetName: string } {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const name = wb.SheetNames[0]
  if (!name) throw new Error('엑셀에 시트가 없습니다.')
  return { matrix: sheetToMatrix(wb.Sheets[name]), sheetName: name }
}

const WORK_STATUS_OK = new Set(['급여반영', '인정시간확인'])

function isFemaleRow(row: Record<string, unknown>): boolean {
  return str(pick(row, ['성별'])).includes('여')
}

function buildKrHolidayYmdSet(years: Iterable<number>): Set<string> {
  const hd = new Holidays('KR')
  const out = new Set<string>()
  for (const y of years) {
    const list = hd.getHolidays(y)
    for (const h of list) {
      out.add(h.date.slice(0, 10))
    }
  }
  return out
}

function krHolidayName(ymd: string, year: number): string {
  const hd = new Holidays('KR')
  for (const h of hd.getHolidays(year)) {
    if (h.date.slice(0, 10) === ymd) return h.name
  }
  return ''
}

function calculateWorkMetrics(
  rows: Record<string, unknown>[],
  holidayYmd: Set<string>,
): { ot: number; hd: number } {
  let ot = 0
  let hd = 0
  for (const row of rows) {
    const timeVal = pick(row, ['인정시간(표준형)', '인정시간'])
    ot += parseKoreanTime(timeVal)
    const dayLabel = str(pick(row, ['근무요일']))
    const start = parseFlexibleDate(pick(row, ['근무신청시작']))
    let isHolidayWork = false
    if (dayLabel === '토' || dayLabel === '일') isHolidayWork = true
    else if (start) {
      const ymd = format(startOfDay(start), 'yyyy-MM-dd')
      if (holidayYmd.has(ymd)) isHolidayWork = true
    }
    if (isHolidayWork) hd += 1
  }
  return { ot, hd }
}

export type LaborSurveyWorkResult = {
  totalOt: number
  totalHolidayDays: number
  femaleOt: number
  femaleHolidayDays: number
}

const SHEET_WORK_AUDIT = '산출근거_4-1-1'
const SHEET_LEAVE_AUDIT = '산출근거_4-1-2'

export function buildWorkAuditExport(buf: ArrayBuffer): {
  summary: LaborSurveyWorkResult
  auditAoa: (string | number)[][]
} {
  const { matrix } = readFirstSheetMatrix(buf)
  if (matrix.length < 2) throw new Error('데이터 행이 없습니다.')

  const headerNorm = matrix[0].map(normKey)
  const validObjs: Record<string, unknown>[] = []
  for (let R = 1; R < matrix.length; R++) {
    const obj = matrixRowToObject(headerNorm, matrix[R])
    if (isRowObjectEmpty(obj)) continue
    if (WORK_STATUS_OK.has(str(pick(obj, ['진행상태'])))) validObjs.push(obj)
  }
  if (validObjs.length === 0) {
    throw new Error(
      '유효한 근무 행이 없습니다. 진행상태 열에 「급여반영」 또는 「인정시간확인」인 행이 필요합니다.',
    )
  }

  const years = new Set<number>()
  for (const row of validObjs) {
    const d = parseFlexibleDate(pick(row, ['근무신청시작']))
    if (d) years.add(d.getFullYear())
  }
  if (years.size === 0) {
    throw new Error('근무신청시작 날짜를 해석할 수 없습니다. 날짜 형식을 확인해 주세요.')
  }
  const holidayYmd = buildKrHolidayYmdSet(years)
  const femaleObjs = validObjs.filter(isFemaleRow)
  const total = calculateWorkMetrics(validObjs, holidayYmd)
  const female = calculateWorkMetrics(femaleObjs, holidayYmd)
  const summary: LaborSurveyWorkResult = {
    totalOt: total.ot,
    totalHolidayDays: total.hd,
    femaleOt: female.ot,
    femaleHolidayDays: female.hd,
  }

  const detailRows: (string | number)[][] = []
  for (let R = 1; R < matrix.length; R++) {
    const excelRow = R + 1
    const obj = matrixRowToObject(headerNorm, matrix[R])
    if (isRowObjectEmpty(obj)) {
      detailRows.push([
        excelRow,
        '',
        '아니오',
        '빈 행(표에서 값이 없음) — 집계·근거 대상 아님',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ])
      continue
    }

    const status = str(pick(obj, ['진행상태']))
    const timeVal = pick(obj, ['인정시간(표준형)', '인정시간'])
    const parsedOt = parseKoreanTime(timeVal)
    const dayLabel = str(pick(obj, ['근무요일']))
    const startRaw = pick(obj, ['근무신청시작'])
    const start = parseFlexibleDate(startRaw)
    const gender = str(pick(obj, ['성별']))
    const femaleQ = gender.includes('여')

    if (!WORK_STATUS_OK.has(status)) {
      detailRows.push([
        excelRow,
        status || '(비어있음)',
        '아니오',
        `제외: 진행상태가 「급여반영」「인정시간확인」이 아님(현재: ${status || '비어있음'})`,
        str(timeVal),
        round2(parsedOt),
        '-',
        '-',
        dayLabel,
        str(startRaw),
        femaleQ ? '예' : '아니오',
      ])
      continue
    }

    let holMark: string | number = '아니오'
    let holReason = '평일 근무로 판단(토·일 아님, 공휴일 아님)'
    if (dayLabel === '토' || dayLabel === '일') {
      holMark = '예'
      holReason = `휴일근무 1건: 근무요일이 「${dayLabel}」`
    } else if (start) {
      const ymd = format(startOfDay(start), 'yyyy-MM-dd')
      if (holidayYmd.has(ymd)) {
        holMark = '예'
        const hn = krHolidayName(ymd, start.getFullYear())
        holReason = hn
          ? `휴일근무 1건: 근무신청시작 ${ymd} 은 법정공휴일(${hn})`
          : `휴일근무 1건: 근무신청시작 ${ymd} 은 법정공휴일`
      }
    }

    detailRows.push([
      excelRow,
      status,
      '예',
      '포함: 집계 대상. 인정시간은 환산(시간)하여 합산, 휴일근무는 토·일 또는 법정공휴일 신청일 1건으로 산정',
      str(timeVal),
      round2(parsedOt),
      holMark,
      holReason,
      dayLabel,
      str(startRaw),
      femaleQ ? '예' : '아니오',
    ])
  }

  const yearList = [...years].sort((a, b) => a - b).join(', ')
  const auditAoa: (string | number)[][] = [
    ['노동력1-휴일근로 — 산출 근거'],
    ['생성일시(ISO)', new Date().toISOString()],
    ['분석 대상 시트', '첫 번째 시트(원본과 동일)'],
    ['전체 초과근무 합계(시간)', round2(summary.totalOt)],
    ['전체 휴일근무 건수', summary.totalHolidayDays],
    ['여성 초과근무 합계(시간)', round2(summary.femaleOt)],
    ['여성 휴일근무 건수', summary.femaleHolidayDays],
    ['공휴일 기준', `대한민국 법정공휴일(date-holidays KR), 적용 연도: ${yearList}`],
    [],
    [
      '엑셀행',
      '진행상태',
      '집계포함',
      '포함·제외 근거',
      '인정시간(원본)',
      '환산시간(h)',
      '휴일근무해당',
      '휴일근무 판단',
      '근무요일',
      '근무신청시작',
      '여성집계대상',
    ],
    ...detailRows,
  ]

  return { summary, auditAoa }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 근무 기록 엑셀 — 첫 시트, 열: 진행상태, 근무신청시작, 근무요일, 인정시간(표준형), 성별 */
export function analyzeLaborSurveyWork(buf: ArrayBuffer): LaborSurveyWorkResult {
  return buildWorkAuditExport(buf).summary
}

export type LaborSurveyLeaveResult = {
  totalNotWorkDays: number
  totalEightHDays: number
  femaleNotWorkDays: number
  femaleEightHDays: number
}

function leaveStats(rows: Record<string, unknown>[]): { notWork: number; eightH: number } {
  const hours = rows.reduce((a, r) => a + parseKoreanTime(pick(r, ['연차사용일'])), 0)
  const notWork = hours / 8
  const eightH = notWork / 8
  return { notWork, eightH }
}

export function buildLeaveAuditExport(buf: ArrayBuffer): {
  summary: LaborSurveyLeaveResult
  auditAoa: (string | number)[][]
} {
  const { matrix } = readFirstSheetMatrix(buf)
  if (matrix.length < 2) throw new Error('데이터 행이 없습니다.')

  const headerNorm = matrix[0].map(normKey)
  const dataObjs: Record<string, unknown>[] = []
  for (let R = 1; R < matrix.length; R++) {
    const obj = matrixRowToObject(headerNorm, matrix[R])
    if (!isRowObjectEmpty(obj)) dataObjs.push(obj)
  }
  if (dataObjs.length === 0) throw new Error('데이터 행이 없습니다.')

  const femaleRows = dataObjs.filter(isFemaleRow)
  const t = leaveStats(dataObjs)
  const f = leaveStats(femaleRows)
  const summary: LaborSurveyLeaveResult = {
    totalNotWorkDays: t.notWork,
    totalEightHDays: t.eightH,
    femaleNotWorkDays: f.notWork,
    femaleEightHDays: f.eightH,
  }

  const detailRows: (string | number)[][] = []
  for (let R = 1; R < matrix.length; R++) {
    const excelRow = R + 1
    const obj = matrixRowToObject(headerNorm, matrix[R])
    if (isRowObjectEmpty(obj)) {
      detailRows.push([
        excelRow,
        '',
        '아니오',
        '아니오',
        0,
        '빈 행 — 전체·여성 합계에 포함되지 않음(원본 스크립트와 동일하게 빈 행 제외)',
        '-',
      ])
      continue
    }

    const lvRaw = pick(obj, ['연차사용일'])
    const h = parseKoreanTime(lvRaw)
    const femaleQ = isFemaleRow(obj)
    const totalInc = '예'
    const femInc = femaleQ ? '예' : '아니오'
    const totalReason =
      '포함: 비어 있지 않은 행의 연차사용일을 시간으로 환산해 전체 합계(÷8=일, ÷8=8H기준일)에 반영'
    const femReason = femaleQ
      ? '포함: 성별에 「여」가 포함되어 여성 부분 합계에 반영'
      : '제외: 여성 집계에는 성별에 「여」가 포함된 행만 포함'

    detailRows.push([excelRow, str(lvRaw), totalInc, femInc, round2(h), totalReason, femReason])
  }

  const auditAoa: (string | number)[][] = [
    ['노동력2-출근안한일수 — 산출 근거'],
    ['생성일시(ISO)', new Date().toISOString()],
    ['분석 대상 시트', '첫 번째 시트(원본과 동일)'],
    ['전체 출근하지 않은 일수(연차시간÷8)', round4(summary.totalNotWorkDays)],
    ['전체 8H 시간 기준 일수(위 값÷8)', round4(summary.totalEightHDays)],
    ['여성 출근하지 않은 일수', round4(summary.femaleNotWorkDays)],
    ['여성 8H 시간 기준 일수', round4(summary.femaleEightHDays)],
    [],
    ['엑셀행', '연차사용일(원본)', '전체합산포함', '여성합산포함', '환산시간(h)', '전체 포함·제외 근거', '여성 포함·제외 근거'],
    ...detailRows,
  ]

  return { summary, auditAoa }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/** 연차 기록 엑셀 — 첫 시트, 열: 연차사용일, 성별 */
export function analyzeLaborSurveyLeave(buf: ArrayBuffer): LaborSurveyLeaveResult {
  return buildLeaveAuditExport(buf).summary
}

/** 원본 워크북에 근거 시트 추가(동일 이름 시트가 있으면 교체). */
export function mergeAuditSheetsIntoWorkbook(
  originalBuf: ArrayBuffer,
  audits: { name: string; aoa: (string | number)[][] }[],
): ArrayBuffer {
  const wb = XLSX.read(originalBuf, { type: 'array', cellDates: true })
  for (const { name, aoa } of audits) {
    const safeName = name.slice(0, 31)
    if (wb.Sheets[safeName]) {
      delete wb.Sheets[safeName]
      wb.SheetNames = wb.SheetNames.filter((n) => n !== safeName)
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, safeName)
  }
  const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array | ArrayBuffer
  if (wbout instanceof ArrayBuffer) return wbout
  const u8 = new Uint8Array(wbout)
  const copy = new ArrayBuffer(u8.byteLength)
  new Uint8Array(copy).set(u8)
  return copy
}

export function downloadXlsxBuffer(buf: ArrayBuffer, filename: string): void {
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export const LABOR_SURVEY_SHEET_NAMES = {
  work: SHEET_WORK_AUDIT,
  leave: SHEET_LEAVE_AUDIT,
} as const
