/**
 * 인사기록부(양식) 엑셀에서 경력증명서용 데이터 추출.
 * 시트·셀 위치는 기관별로 다를 수 있어 키워드·헤더 기반으로 탐색합니다.
 */
import * as XLSX from 'xlsx'
import { addDays, startOfDay } from 'date-fns'
import { parseFlexibleDate, fmt, fmtKo } from './dates'
import { classifyRankBand, type RankBand } from './jobClassification'

function cellStr(v: unknown): string {
  return String(v ?? '')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function normTitle(s: string): string {
  return s.replace(/\s+/g, '')
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

/** 임면내용 등에서 "OO팀(…) 근무 명함" 형태 추출 */
const MEONGHAM_DEPT_RE =
  /([가-힣A-Za-z0-9][가-힣A-Za-z0-9·\s]*?(?:팀|부|실|본부|처|과|센터|원|단|국))(?:\s*\([^)]{0,40}\))?\s*근무\s*명함/

function extractDeptFromMeongham(imsa: string): string | null {
  const m = imsa.match(MEONGHAM_DEPT_RE)
  return m ? m[1].replace(/\s+/g, ' ').trim() : null
}

function isPromotionAppointmentNote(imsa: string): boolean {
  const n = normTitle(imsa)
  if (!n) return false
  return /승진임용|승진\s*임용|승\s*진\s*임\s*용/.test(n)
}

function normEmpId(s: string): string {
  return s.replace(/\s+/g, '').trim()
}

function matrixContainsEmpId(matrix: unknown[][], empId: string): boolean {
  const want = normEmpId(empId)
  if (!want) return false
  for (const row of matrix) {
    for (const cell of row) {
      const t = normEmpId(cellStr(cell))
      if (t === want) return true
    }
  }
  return false
}

/** 라벨(성명 등) 우측 인접 셀 값 탐색 — 상단 인적란 */
function scanLabelValue(
  matrix: unknown[][],
  labels: string[],
  maxRow: number,
): string {
  const set = new Set(labels.map(normTitle))
  for (let r = 0; r < Math.min(matrix.length, maxRow); r++) {
    const row = matrix[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const key = normTitle(cellStr(row[c]))
      if (!key) continue
      for (const lab of labels) {
        if (key === normTitle(lab) || key.includes(normTitle(lab))) {
          for (let k = 1; k <= 4 && c + k < row.length; k++) {
            const v = cellStr(row[c + k])
            if (v && !set.has(normTitle(v))) return v
          }
        }
      }
    }
  }
  return ''
}

export type ParsedPromotionRow = { date: Date; rank: string }

export type ParsedWorkLogRow = {
  rawDate: Date | null
  rawEnd: Date | null
  dept: string
  imsa: string
}

export type ParsedDutyRow = {
  title: string
  start: Date | null
  end: Date | null
  dept: string
}

export type CareerRecordParseResult = {
  sheetName: string
  /** 엑셀 상단 성명 */
  name: string
  birthYmd: string
  hireYmd: string
  /** 승진승급 마지막 일자 직급 */
  lastPromotionRank: string
  promotions: ParsedPromotionRow[]
  workLog: ParsedWorkLogRow[]
  duties: ParsedDutyRow[]
  warnings: string[]
}

function findSectionHeaderRow(matrix: unknown[][], titles: string[]): number {
  const norms = titles.map(normTitle)
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r] ?? []
    const joined = normTitle(row.map(cellStr).join(''))
    if (norms.some((n) => joined.includes(n))) return r
    for (const cell of row) {
      const t = normTitle(cellStr(cell))
      if (!t) continue
      if (norms.some((n) => t.includes(n) || n.includes(t))) return r
    }
  }
  return -1
}

function rowJoinedNorm(matrix: unknown[][], r: number): string {
  return normTitle((matrix[r] ?? []).map(cellStr).join(''))
}

/** 표 헤더로 보이는지(근무기록·승진승급 등) */
function rowLooksLikeColumnHeader(row: unknown[]): boolean {
  const h = row.map(cellStr).map(normTitle).join('|')
  if (!h) return false
  const dateHint = /일자|임용|발령|시작|종료|연월일|승진일|승급일|근무기간/.test(h)
  const textHint = /소속|부서|근무부서|직급|직위|임면|내용|사항|비고|변경후|승진후|승급후/.test(h)
  const nonEmptyCols = row.filter((c) => normTitle(cellStr(c))).length
  return nonEmptyCols >= 2 && (dateHint || textHint)
}

function inferDateColumnIndex(matrix: unknown[][], fromRow: number, colCount: number): number {
  let bestC = 0
  let bestScore = -1
  const end = Math.min(matrix.length, fromRow + 30)
  for (let c = 0; c < colCount; c++) {
    let score = 0
    for (let r = fromRow; r < end; r++) {
      if (parseFlexibleDate(matrix[r]?.[c])) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestC = c
    }
  }
  return bestScore > 0 ? bestC : -1
}

function findPromotionTitleRow(matrix: unknown[][]): number {
  const a = findSectionHeaderRow(matrix, ['승진승급', '승진및승급', '승진승급일', '승진및승급일'])
  if (a >= 0) return a
  for (let r = 0; r < matrix.length; r++) {
    const j = rowJoinedNorm(matrix, r)
    if (j.includes('승진') && j.includes('승급')) return r
  }
  return -1
}

function resolvePromotionHeaderRow(matrix: unknown[][], titleRow: number): number {
  for (let d = 0; d <= 4; d++) {
    const r = titleRow + d
    const row = matrix[r]
    if (!row?.length) continue
    if (rowLooksLikeColumnHeader(row)) return r
  }
  return titleRow
}

function parsePromotionSection(matrix: unknown[][]): ParsedPromotionRow[] {
  const titleRow = findPromotionTitleRow(matrix)
  if (titleRow < 0) return []
  const headerRow = resolvePromotionHeaderRow(matrix, titleRow)

  const header = (matrix[headerRow] ?? []).map(cellStr)
  let dateCol = -1
  let rankCol = -1
  for (let c = 0; c < header.length; c++) {
    const h = normTitle(header[c] ?? '')
    if (!h) continue
    if (/일자|승진일|승급일|발령일|임용일|연월일|임용|발령/.test(h) && dateCol < 0) dateCol = c
    if ((/직급|직위|계급|승진후|승급후|변경후|승진직급|승급직급/.test(h)) && rankCol < 0) rankCol = c
  }

  const colWidths = matrix.slice(headerRow, headerRow + 25).map((x) => x?.length ?? 0)
  const colCount = Math.max(header.length, colWidths.length ? Math.max(...colWidths) : 0, 12)
  if (dateCol < 0) dateCol = inferDateColumnIndex(matrix, headerRow + 1, Math.max(colCount, 20))
  if (rankCol < 0) {
    for (let c = 0; c < colCount; c++) {
      if (c === dateCol) continue
      let textScore = 0
      for (let r = headerRow + 1; r < Math.min(matrix.length, headerRow + 25); r++) {
        const t = cellStr(matrix[r]?.[c])
        if (t && !parseFlexibleDate(t) && /[가-힣]/.test(t)) textScore++
      }
      if (textScore >= 2) {
        rankCol = c
        break
      }
    }
  }

  const out: ParsedPromotionRow[] = []
  for (let r = headerRow + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? []
    if (row.every((x) => !cellStr(x))) continue
    const joinedRow = rowJoinedNorm(matrix, r)
    if (/근무기록|보직현황|학력사항|가족사항|상벌|훈련|수상/.test(joinedRow)) break

    const d = dateCol >= 0 ? parseFlexibleDate(row[dateCol]) : null
    const rank = rankCol >= 0 ? cellStr(row[rankCol]) : ''
    if (!d && !rank) continue
    if (d && rank) out.push({ date: startOfDay(d), rank })
    else if (d && !rank) {
      for (let c = 0; c < row.length; c++) {
        if (c === dateCol) continue
        const t = cellStr(row[c])
        if (t && !parseFlexibleDate(t) && /[가-힣a-z]/i.test(t)) {
          out.push({ date: startOfDay(d), rank: t })
          break
        }
      }
    }
  }

  out.sort((a, b) => {
    const dt = a.date.getTime() - b.date.getTime()
    if (dt !== 0) return dt
    return 0
  })
  return out
}

function findWorkLogTitleRow(matrix: unknown[][]): number {
  for (let r = 0; r < matrix.length; r++) {
    const j = rowJoinedNorm(matrix, r)
    if (j.includes('근무') && j.includes('기록')) return r
  }
  return findSectionHeaderRow(matrix, ['근무기록', '근무 기록', '근무기록표'])
}

function resolveWorkLogHeaderRow(matrix: unknown[][], titleRow: number): number {
  for (let d = 0; d <= 4; d++) {
    const r = titleRow + d
    const row = matrix[r]
    if (!row?.length) continue
    if (rowLooksLikeColumnHeader(row)) return r
  }
  return titleRow + 1
}

function parseWorkLogSection(matrix: unknown[][]): ParsedWorkLogRow[] {
  const titleRow = findWorkLogTitleRow(matrix)
  if (titleRow < 0) return []
  const headerRow = resolveWorkLogHeaderRow(matrix, titleRow)

  const header = (matrix[headerRow] ?? []).map(cellStr)
  let cDept = -1
  let cImsa = -1
  let cDate = -1
  let cEnd = -1
  for (let c = 0; c < header.length; c++) {
    const h = normTitle(header[c] ?? '')
    if (!h) continue
    if ((/임면내용|임면사항|발령내용|임면|내용|발령|사항/.test(h)) && cImsa < 0) cImsa = c
    else if ((/소속|부서|근무부서|근무지/.test(h)) && cDept < 0) cDept = c
    else if ((/종료일|만료일|해임일|종료/.test(h)) && cEnd < 0) cEnd = c
    else if ((/일자|임용일|발령일|시작일|근무시작|연월일|시작/.test(h)) && cDate < 0) cDate = c
  }

  const colWidthsW = matrix.slice(headerRow, headerRow + 30).map((x) => x?.length ?? 0)
  const colCount = Math.max(header.length, colWidthsW.length ? Math.max(...colWidthsW) : 0, 12)

  if (cDate < 0) cDate = inferDateColumnIndex(matrix, headerRow + 1, Math.max(colCount, 24))
  if (cImsa < 0) {
    let best = -1
    let bestLen = -1
    for (let c = 0; c < colCount; c++) {
      if (c === cDate || c === cEnd) continue
      let len = 0
      for (let r = headerRow + 1; r < Math.min(matrix.length, headerRow + 25); r++) {
        len += cellStr(matrix[r]?.[c]).length
      }
      if (len > bestLen) {
        bestLen = len
        best = c
      }
    }
    cImsa = best >= 0 ? best : colCount - 1
  }
  if (cDept < 0) {
    for (let c = 0; c < colCount; c++) {
      if (c === cImsa || c === cDate || c === cEnd) continue
      const h = normTitle(header[c] ?? '')
      if (!h) continue
      if (/소속|부서|기관|단위|근무/.test(h)) {
        cDept = c
        break
      }
    }
  }
  if (cDept < 0) {
    for (let c = 0; c < colCount; c++) {
      if (c === cImsa || c === cDate || c === cEnd) continue
      let orgHits = 0
      for (let r = headerRow + 1; r < Math.min(matrix.length, headerRow + 25); r++) {
        const t = cellStr(matrix[r]?.[c])
        if (/(팀|부|실|본부|처|과|센터|원|단|국)/.test(t)) orgHits++
      }
      if (orgHits >= 1) {
        cDept = c
        break
      }
    }
  }

  const out: ParsedWorkLogRow[] = []
  for (let r = headerRow + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? []
    if (row.every((x) => !cellStr(x))) {
      if (out.length > 0 && r > headerRow + 5) break
      continue
    }
    const joined = rowJoinedNorm(matrix, r)
    if (/보직현황|학력|가족|상벌|훈련|수상|징계/.test(joined)) break

    const rawDate = cDate >= 0 ? parseFlexibleDate(row[cDate]) : null
    const rawEnd = cEnd >= 0 ? parseFlexibleDate(row[cEnd]) : null
    const dept = cDept >= 0 ? cellStr(row[cDept]) : ''
    const imsa = cImsa >= 0 ? cellStr(row[cImsa]) : ''
    if (!rawDate && !dept && !imsa) continue
    out.push({ rawDate, rawEnd, dept, imsa })
  }
  return out
}

function parseDutySection(matrix: unknown[][]): ParsedDutyRow[] {
  const hr = findSectionHeaderRow(matrix, ['보직현황', '보 직 현 황'])
  if (hr < 0) return []
  const header = (matrix[hr] ?? []).map(cellStr)
  let cTitle = -1
  let cStart = -1
  let cEnd = -1
  let cDept = -1
  for (let c = 0; c < header.length; c++) {
    const h = normTitle(header[c] ?? '')
    if (!h) continue
    if ((/보직|직명|직위명|직책/.test(h) || h.includes('보직명')) && cTitle < 0) cTitle = c
    if ((/임용일|발령일|시작일|선임일|위촉일/.test(h)) && cStart < 0) cStart = c
    if ((/해임일|종료일|만료일|면직일/.test(h)) && cEnd < 0) cEnd = c
    if ((/소속|부서/.test(h)) && cDept < 0) cDept = c
  }
  const out: ParsedDutyRow[] = []
  for (let r = hr + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? []
    if (row.every((x) => !cellStr(x))) continue
    const title = cTitle >= 0 ? cellStr(row[cTitle]) : ''
    const start = cStart >= 0 ? parseFlexibleDate(row[cStart]) : null
    const end = cEnd >= 0 ? parseFlexibleDate(row[cEnd]) : null
    const dept = cDept >= 0 ? cellStr(row[cDept]) : ''
    if (!title && !start) continue
    out.push({ title, start, end, dept })
  }
  return out
}

function lastPromotionRankFromList(promotions: ParsedPromotionRow[]): string {
  if (!promotions.length) return ''
  const maxT = Math.max(...promotions.map((p) => p.date.getTime()))
  const sameDay = promotions.filter((p) => p.date.getTime() === maxT)
  return sameDay[sameDay.length - 1]!.rank
}

export function parseCareerRecordSheet(matrix: unknown[][], sheetName: string): CareerRecordParseResult {
  const warnings: string[] = []

  const name = scanLabelValue(matrix, ['성명', '이름'], 45)
  const birthRaw = scanLabelValue(matrix, ['생년월일', '생년 월일'], 45)
  const hireRaw = scanLabelValue(matrix, ['임용일자', '입사일자', '입사일', '최초임용'], 45)

  const birthD = parseFlexibleDate(birthRaw)
  const hireD = parseFlexibleDate(hireRaw)

  const promotions = parsePromotionSection(matrix)
  const lastPromotionRank =
    promotions.length > 0 ? lastPromotionRankFromList(promotions) : scanLabelValue(matrix, ['현직급', '직급'], 50)

  const workLog = parseWorkLogSection(matrix)
  const duties = parseDutySection(matrix)

  if (!name) warnings.push('상단에서 「성명」을 찾지 못했습니다. 양식을 확인해 주세요.')
  if (!birthD) warnings.push('상단에서 「생년월일」을 찾지 못했습니다.')
  if (!hireD) warnings.push('상단에서 「임용일자」·「입사일」을 찾지 못했습니다.')
  if (!lastPromotionRank) warnings.push('「승진승급」 마지막 직급을 찾지 못했습니다.')
  if (workLog.length === 0) warnings.push('「근무기록」 구간을 찾지 못했거나 데이터가 비었습니다.')

  return {
    sheetName,
    name,
    birthYmd: birthD ? fmt(birthD) : birthRaw,
    hireYmd: hireD ? fmt(hireD) : hireRaw,
    lastPromotionRank,
    promotions,
    workLog,
    duties,
    warnings,
  }
}

export function findSheetMatrixForEmpId(
  buf: ArrayBuffer,
  empId: string,
): { matrix: unknown[][]; sheetName: string; empMatchedInSheet: boolean } {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const names = wb.SheetNames
  const trimmed = normEmpId(empId)
  for (const sn of names) {
    const ws = wb.Sheets[sn]
    if (!ws) continue
    const m = sheetToMatrix(ws)
    if (trimmed && matrixContainsEmpId(m, empId)) return { matrix: m, sheetName: sn, empMatchedInSheet: true }
  }
  const first = names[0]
  if (!first) throw new Error('엑셀에 시트가 없습니다.')
  return {
    matrix: sheetToMatrix(wb.Sheets[first]!),
    sheetName: first,
    empMatchedInSheet: !trimmed,
  }
}

/** 직급 밴드에 따른 직위 열: 담당 vs 보직명 */
function rankBandForPosition(rankStr: string, jobType: string): RankBand {
  return classifyRankBand(rankStr, jobType)
}

function promotionRankAt(promotions: ParsedPromotionRow[], d: Date): string {
  let r = promotions[0]?.rank ?? ''
  for (const p of promotions) {
    if (p.date.getTime() <= d.getTime()) r = p.rank
    else break
  }
  return r
}

function overlaps(a0: Date, a1: Date, b0: Date | null, b1: Date | null): boolean {
  if (!b0) return false
  const bs = startOfDay(b0).getTime()
  const ae = a1.getTime()
  const as = a0.getTime()
  const be = b1 ? startOfDay(b1).getTime() : Number.POSITIVE_INFINITY
  return !(ae < bs || be < as)
}

function pickDutyTitle(
  duties: ParsedDutyRow[],
  dept: string,
  segStart: Date,
  segEnd: Date,
  rankAtStart: string,
  jobType: string,
): string | null {
  const band = rankBandForPosition(rankAtStart, jobType)
  if (band !== '책임급' && band !== '선임급') return null
  const deptNorm = normTitle(dept)
  for (const d of duties) {
    if (!d.title) continue
    const dn = normTitle(d.dept)
    if (dn && deptNorm) {
      if (!deptNorm.includes(dn) && !dn.includes(deptNorm)) continue
    }
    if (overlaps(segStart, segEnd, d.start, d.end)) return d.title
  }
  return null
}

export type CareerCertRow = {
  department: string
  start: Date
  end: Date
  positionLabel: string
}

export type CareerCertificateModel = {
  sheetName: string
  issueNo: string
  name: string
  birthYmd: string
  empId: string
  hireYmd: string
  jobType: string
  rankLabel: string
  rows: CareerCertRow[]
  warnings: string[]
}

function filterWorkLogRows(rows: ParsedWorkLogRow[], strictImsa: boolean): ParsedWorkLogRow[] {
  return rows.filter((w) => {
    if (isPromotionAppointmentNote(w.imsa)) return false
    if (!w.rawDate) return false
    const hasDept = w.dept.trim().length > 0
    const hasImsa = w.imsa.trim().length > 0
    if (strictImsa && !hasImsa) return false
    return hasDept || hasImsa
  })
}

function buildCareerRows(
  parsed: CareerRecordParseResult,
  jobType: string,
): CareerCertRow[] {
  let filtered = filterWorkLogRows(parsed.workLog, true)
  if (filtered.length === 0) filtered = filterWorkLogRows(parsed.workLog, false)

  type Seg = { start: Date; end: Date; dept: string }
  const segs: Seg[] = []

  for (let i = 0; i < filtered.length; i++) {
    const w = filtered[i]!
    if (!w.rawDate) continue
    const start = startOfDay(w.rawDate)
    let end: Date
    if (w.rawEnd) end = startOfDay(w.rawEnd)
    else {
      const next = filtered.slice(i + 1).find((x) => x.rawDate)
      end = next?.rawDate ? addDays(startOfDay(next.rawDate), -1) : startOfDay(new Date())
    }
    if (end.getTime() < start.getTime()) end = start

    const fromMeong = extractDeptFromMeongham(w.imsa)
    const dept = (fromMeong ?? w.dept).replace(/\s+/g, ' ').trim()
    if (!dept) continue
    segs.push({ start, end, dept })
  }

  segs.sort((a, b) => a.start.getTime() - b.start.getTime())

  const merged: Seg[] = []
  for (const s of segs) {
    const prev = merged[merged.length - 1]
    if (prev && prev.dept === s.dept && addDays(prev.end, 1).getTime() >= s.start.getTime()) {
      if (s.end.getTime() > prev.end.getTime()) prev.end = s.end
    } else {
      merged.push({ ...s })
    }
  }

  const withPos: CareerCertRow[] = merged.map((s) => {
    const rankStr = promotionRankAt(parsed.promotions, s.start)
    const duty = pickDutyTitle(parsed.duties, s.dept, s.start, s.end, rankStr, jobType)
    const band = rankBandForPosition(rankStr, jobType)
    let positionLabel = '담당'
    if (band === '책임급' || band === '선임급') {
      positionLabel = duty ?? '담당'
    }
    return {
      department: s.dept,
      start: s.start,
      end: s.end,
      positionLabel,
    }
  })

  withPos.sort((a, b) => b.start.getTime() - a.start.getTime())
  return withPos
}

export function makeCareerIssueNo(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`
}

export function buildCareerCertificateModel(
  buf: ArrayBuffer,
  empId: string,
  jobType: string,
): CareerCertificateModel {
  const { matrix, sheetName, empMatchedInSheet } = findSheetMatrixForEmpId(buf, empId)
  const parsed = parseCareerRecordSheet(matrix, sheetName)
  const rows = buildCareerRows(parsed, jobType)
  const issueNo = makeCareerIssueNo()

  const warnings = [...parsed.warnings]
  if (!empMatchedInSheet && normEmpId(empId)) {
    warnings.unshift(
      `입력한 사번「${empId}」이(가) 엑셀에서 검색되지 않아 첫 시트「${sheetName}」을(를) 사용했습니다. (인당 1시트 양식이면 무시해도 됩니다.)`,
    )
  }

  return {
    sheetName,
    issueNo,
    name: parsed.name,
    birthYmd: parsed.birthYmd,
    empId: normEmpId(empId),
    hireYmd: parsed.hireYmd,
    jobType,
    rankLabel: parsed.lastPromotionRank,
    rows,
    warnings,
  }
}

export type CareerCertificatePrintOpts = {
  officerVerified: boolean
  /** 발급번호 표기(미검증 시 TEST) */
  issueNo: string
}

export function careerCertificateDocumentHtml(m: CareerCertificateModel, opts: CareerCertificatePrintOpts): string {
  const todayKo = fmtKo(startOfDay(new Date()))
  const rowHtml = m.rows
    .map(
      (r) => `
    <tr>
      <td style="padding:4px 6px;border:1px solid #333;">${escapeHtml(r.department)}</td>
      <td style="padding:4px 6px;border:1px solid #333;text-align:center;">${escapeHtml(fmt(r.start))}</td>
      <td style="padding:4px 6px;border:1px solid #333;text-align:center;">~</td>
      <td style="padding:4px 6px;border:1px solid #333;text-align:center;">${escapeHtml(fmt(r.end))}</td>
      <td style="padding:4px 6px;border:1px solid #333;text-align:center;">${escapeHtml(r.positionLabel)}</td>
    </tr>`,
    )
    .join('')

  const sealBlock = opts.officerVerified
    ? `<div title="관인" style="width:54px;height:54px;border:2.5px solid #b91c1c;border-radius:3px;display:flex;align-items:center;justify-content:center;color:#b91c1c;font-weight:bold;font-size:15pt;letter-spacing:-1px;transform:rotate(-10deg);user-select:none;">印</div><div class="t8" style="margin-top:2px;">위치</div>`
    : `<div style="width:54px;height:54px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:9pt;">관인<br/>없음</div><div class="t8" style="margin-top:2px;color:#bbb;">위치</div>`

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/><title>경력증명서</title>
  <style>
    body { font-family: "Malgun Gothic","맑은 고딕",sans-serif; margin: 24px; color:#111; }
    .t10 { font-size: 10pt; line-height: 1.45; }
    .t13 { font-size: 13pt; font-weight: 700; }
    .t8 { font-size: 8pt; color:#333; }
    table.meta td { padding: 2px 8px 2px 0; vertical-align: top; }
    table.grid { border-collapse: collapse; width: 100%; margin-top: 10px; }
    table.grid th { font-size: 10pt; border:1px solid #333; padding:6px; background:#f6f6f6; }
  </style></head><body>
  <div class="t10" style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>${sealBlock}</div>
    <div style="text-align:right;">발급번호: ${escapeHtml(opts.issueNo)}</div>
  </div>
  <div class="t13" style="text-align:center;margin:16px 0 12px;">경력증명서</div>
  <table class="meta t10">
    <tr><td>성명</td><td>${escapeHtml(m.name)}</td></tr>
    <tr><td>생년월일</td><td>${escapeHtml(m.birthYmd)}</td></tr>
    <tr><td>사번</td><td>${escapeHtml(m.empId)}</td></tr>
    <tr><td>입사일자</td><td>${escapeHtml(m.hireYmd)}</td></tr>
    <tr><td>직종</td><td>${escapeHtml(m.jobType)}</td></tr>
    <tr><td>직급</td><td>${escapeHtml(m.rankLabel)}</td></tr>
  </table>
  <div class="t10" style="margin-top:12px;font-weight:600;">경력사항</div>
  <table class="grid">
    <thead><tr>
      <th>근무부서</th><th colspan="3">근무기간</th><th>직위</th>
    </tr></thead>
    <tbody>${rowHtml || `<tr><td colspan="5" style="padding:8px;border:1px solid #333;text-align:center;">근무기록에서 추출된 행이 없습니다.</td></tr>`}</tbody>
  </table>
  <div class="t10" style="margin-top:20px;text-align:center;">위 사실을 증명합니다.</div>
  <div class="t10" style="text-align:center;margin-top:8px;">${escapeHtml(todayKo)}</div>
  <div class="t10" style="text-align:center;margin-top:12px;font-weight:600;">광주과학기술원 총장</div>
  <p class="t8" style="margin-top:16px;">${opts.officerVerified ? '이 증명은 전자관인으로 인증된 증명입니다.' : '※ 담당자 확인 전 발급 시범(TEST)입니다. 전자관인 문구는 확인 후 발급 시에만 표시됩니다.'}</p>
  <p class="t8">발급자: 광주과학기술원 인사팀 &nbsp; Tel. 062-715-5043 &nbsp; Fax. 062-715-5049</p>
  </body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
