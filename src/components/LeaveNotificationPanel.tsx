import { useData } from '../context/DataContext'
import { buildLeaveNotificationRows } from '../lib/hrEngine'
import {
  buildLeaveNotificationExcelBuffer,
  downloadArrayBufferAsXlsx,
  leaveNotificationFilename,
} from '../lib/leaveNotificationExcel'
import { Card, SimpleTable } from './Ui'

export function LeaveNotificationPanel() {
  const { data, baseDate } = useData()
  if (!data) return null

  const rows = buildLeaveNotificationRows(data.leave, baseDate, data.personnel)
  const fileName = leaveNotificationFilename(baseDate)

  const tableRows = rows.map((r, i) => ({
    seq: i + 1,
    name: r.name,
    rank: r.rank || '—',
    start: r.start,
    end: r.end,
    note: r.note,
  }))

  return (
    <Card
      code="4-2"
      title="휴직자현황(통보)"
      actions={
        <button
          type="button"
          className="rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-cyan-700 hover:to-teal-700"
          onClick={async () => {
            const buf = await buildLeaveNotificationExcelBuffer(rows)
            downloadArrayBufferAsXlsx(buf, fileName)
          }}
        >
          엑셀 저장
        </button>
      }
    >
      <div>
        <SimpleTable
          cols={[
            { key: 'seq', label: '연번' },
            { key: 'name', label: '성명' },
            { key: 'rank', label: '직급' },
            { key: 'start', label: '시작일' },
            { key: 'end', label: '종료일' },
            { key: 'note', label: '비고' },
          ]}
          rows={
            tableRows.length
              ? tableRows
              : [{ seq: '—', name: '—', rank: '—', start: '—', end: '—', note: '표시할 휴직 구간 없음' }]
          }
        />
      </div>
    </Card>
  )
}
