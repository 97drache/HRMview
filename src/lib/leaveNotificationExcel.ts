import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import type { LeaveNotificationRow } from './hrEngine'

const HEAD = ['연번', '성명', '직급', '시작일', '종료일', '비고']

/** 열 너비(Excel 문자 단위). 표준 환경에서 약 140px에 가깝게: (px-5)/7 근사 */
const COL_WIDTH = (140 - 5) / 7

/** YY-MMDD 형식 — 사용자 요청에 맞춤 (연도 2자리 + 월일 4자리, 예: 26-0511) */
export function leaveNotificationYyMmdd(base: Date): string {
  const yy = String(base.getFullYear()).slice(-2)
  const mmdd = format(base, 'MMdd')
  return `${yy}-${mmdd}`
}

export function leaveNotificationFilename(base: Date): string {
  return `${leaveNotificationYyMmdd(base)} 휴직자 현황(통보).xlsx`
}

export async function buildLeaveNotificationExcelBuffer(rows: LeaveNotificationRow[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('휴직자현황', { views: [{ showGridLines: true }] })

  const thin: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } }
  const allBorders: Partial<ExcelJS.Borders> = {
    top: thin,
    left: thin,
    bottom: thin,
    right: thin,
  }

  ws.addRow(HEAD)
  const headerRow = ws.getRow(1)
  headerRow.height = 22
  headerRow.eachCell((cell) => {
    cell.font = { name: '맑은 고딕', size: 10, bold: true }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5F5F5' },
    }
    cell.border = allBorders
  })

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const dataRow = ws.addRow([i + 1, r.name, r.rank, r.start, r.end, r.note])
    dataRow.eachCell((cell) => {
      cell.font = { name: '맑은 고딕', size: 10 }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = allBorders
    })
  }

  if (rows.length === 0) {
    const empty = ws.addRow(['', '—', '—', '—', '—', '기준일 기준 표시할 휴직 구간이 없습니다.'])
    empty.eachCell((cell) => {
      cell.font = { name: '맑은 고딕', size: 10 }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = allBorders
    })
  }

  for (let c = 1; c <= 6; c++) {
    ws.getColumn(c).width = COL_WIDTH
  }

  const raw = await wb.xlsx.writeBuffer()
  const u8 =
    raw instanceof ArrayBuffer
      ? new Uint8Array(raw)
      : new Uint8Array((raw as Uint8Array).buffer, (raw as Uint8Array).byteOffset, (raw as Uint8Array).byteLength)
  const copy = new ArrayBuffer(u8.byteLength)
  new Uint8Array(copy).set(u8)
  return copy
}

export function downloadArrayBufferAsXlsx(buf: ArrayBuffer, filename: string): void {
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
