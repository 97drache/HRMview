import ExcelJS from 'exceljs'

export type ExcelSheet = { name: string; rows: (string | number | null | undefined)[][] }

/** 엑셀 다운로드 (폰트 크기 9~10) */
export async function downloadExcelSheets(filename: string, sheets: ExcelSheet[], fontSize: 9 | 10 = 10) {
  const wb = new ExcelJS.Workbook()
  for (const sh of sheets) {
    const safeName = sh.name.replace(/[[\]:*?/\\]/g, '_').slice(0, 31) || 'Sheet1'
    const ws = wb.addWorksheet(safeName)
    for (const row of sh.rows) {
      const r = ws.addRow(row.map((c) => (c === null || c === undefined ? '' : c)))
      r.eachCell((cell) => {
        cell.font = { size: fontSize, name: '맑은 고딕' }
      })
    }
  }
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
