/**
 * data/HRdata.xlsx 가 있으면 집계 스냅샷을 생성해 headcount-web/public/headcount-snapshot.json 에 기록합니다.
 * 없으면 빈 스냅샷(배포용 플레이스홀더)을 씁니다.
 *
 * 기준일: 환경변수 HRM_SNAPSHOT_BASE_DATE=yyyy-MM-dd (없으면 오늘)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startOfDay } from 'date-fns'
import { parseFlexibleDate } from '../src/lib/dates.ts'
import { buildHeadcountPublicSnapshot, emptyPublicHeadcountSnapshot } from '../src/lib/headcountPublicSnapshot.ts'
import { parseWorkbookBuffer } from '../src/lib/parseExcel.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const xlsxPath = join(root, 'data', 'HRdata.xlsx')
const outPath = join(root, 'headcount-web', 'public', 'headcount-snapshot.json')

function parseBaseDate(): Date {
  const raw = process.env.HRM_SNAPSHOT_BASE_DATE?.trim()
  if (!raw) return startOfDay(new Date())
  const d = parseFlexibleDate(raw)
  return d ? startOfDay(d) : startOfDay(new Date())
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const u = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  if (u instanceof ArrayBuffer) return u
  const copy = new ArrayBuffer(buf.byteLength)
  new Uint8Array(copy).set(new Uint8Array(u, buf.byteOffset, buf.byteLength))
  return copy
}

function main() {
  const baseDate = parseBaseDate()
  mkdirSync(dirname(outPath), { recursive: true })

  if (!existsSync(xlsxPath)) {
    const snap = emptyPublicHeadcountSnapshot(baseDate, [
      'data/HRdata.xlsx 가 없어 빈 스냅샷을 생성했습니다. 로컬에서 엑셀을 두고 다시 빌드하면 집계가 채워집니다.',
    ])
    writeFileSync(outPath, JSON.stringify(snap, null, 2), 'utf8')
    console.log('[headcount-public] wrote placeholder (no HRdata.xlsx):', outPath)
    return
  }

  const buf = readFileSync(xlsxPath)
  const wb = parseWorkbookBuffer(toArrayBuffer(buf))
  const snap = buildHeadcountPublicSnapshot(
    wb.personnel,
    wb.training,
    baseDate,
    wb.sheetNotes,
    false,
    wb.leave,
  )
  writeFileSync(outPath, JSON.stringify(snap, null, 2), 'utf8')
  console.log('[headcount-public] wrote snapshot from', xlsxPath, '→', outPath)
}

main()
