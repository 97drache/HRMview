import { useRef, useState, type RefObject } from 'react'
import { Card, SimpleTable } from './Ui'
import {
  buildLeaveAuditExport,
  buildWorkAuditExport,
  downloadXlsxBuffer,
  LABOR_SURVEY_SHEET_NAMES,
  mergeAuditSheetsIntoWorkbook,
  type LaborSurveyLeaveResult,
  type LaborSurveyWorkResult,
} from '../lib/laborSurveyAnalyzer'

function FileTrigger({
  inputRef,
  label,
  hint,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  label: string
  hint: string
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-cyan-700 hover:to-teal-700"
      >
        {label}
      </button>
      <p className="text-xs leading-relaxed text-slate-500">{hint}</p>
    </div>
  )
}

export function LaborSurveyWorkPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<LaborSurveyWorkResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<{ name: string; buf: ArrayBuffer } | null>(null)

  return (
    <Card
      code="4-1-1"
      title="노동력1-휴일근로"
      desc="근무 기록 엑셀 첫 시트 기준. 진행상태가 「급여반영」「인정시간확인」인 행만 집계합니다. 공휴일은 대한민국 법정 공휴일(date-holidays KR)을 사용합니다. 분석 후 「산출 근거 시트를 넣어 저장」으로 원본에 근거 시트를 덧붙인 파일을 받을 수 있습니다."
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          setError(null)
          try {
            const buf = await f.arrayBuffer()
            const copy = buf.slice(0)
            const { summary } = buildWorkAuditExport(copy)
            setResult(summary)
            setSource({ name: f.name, buf: copy })
          } catch (err) {
            setResult(null)
            setSource(null)
            setError(err instanceof Error ? err.message : String(err))
          }
        }}
      />
      <FileTrigger
        inputRef={inputRef}
        label="근무기록 엑셀 선택"
        hint="열: 진행상태, 근무신청시작, 근무요일, 인정시간(표준형), 성별 — Python hr_analyzer_v3_female.py 와 동일 규칙입니다."
      />

      {source && result ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              const { auditAoa } = buildWorkAuditExport(source.buf)
              const out = mergeAuditSheetsIntoWorkbook(source.buf, [
                { name: LABOR_SURVEY_SHEET_NAMES.work, aoa: auditAoa },
              ])
              const base = source.name.replace(/\.(xlsx|xls)$/i, '')
              downloadXlsxBuffer(out, `${base}_근거포함.xlsx`)
            }}
            className="rounded-xl border border-cyan-200 bg-white px-4 py-2 text-sm font-semibold text-cyan-900 shadow-sm hover:bg-cyan-50"
          >
            산출 근거 시트를 넣어 저장 (.xlsx)
          </button>
          <p className="mt-1.5 text-[11px] text-slate-500">
            원본 시트는 그대로 두고 시트 「{LABOR_SURVEY_SHEET_NAMES.work}」에 행별 포함·제외 근거를 적습니다. 이미 같은 이름의 시트가 있으면 덮어씁니다.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4">
          <SimpleTable
            cols={[
              { key: 'k', label: '구분' },
              { key: 'ot', label: '초과근무시간(시간)' },
              { key: 'hd', label: '휴일근무 건수' },
            ]}
            rows={[
              {
                k: '전체',
                ot: result.totalOt.toFixed(2),
                hd: result.totalHolidayDays,
              },
              {
                k: '여성',
                ot: result.femaleOt.toFixed(2),
                hd: result.femaleHolidayDays,
              },
            ]}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">엑셀을 선택하면 전체·여성 집계가 표에 표시됩니다.</p>
      )}
    </Card>
  )
}

export function LaborSurveyLeavePanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<LaborSurveyLeaveResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<{ name: string; buf: ArrayBuffer } | null>(null)

  return (
    <Card
      code="4-1-2"
      title="노동력2-출근안한일수"
      desc="연차 기록 엑셀 첫 시트 기준. 연차사용일은 「N일 N시간 N분」 또는 숫자(시간) 형식을 해석합니다. 분석 후 「산출 근거 시트를 넣어 저장」으로 원본에 근거 시트를 덧붙일 수 있습니다."
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          setError(null)
          try {
            const buf = await f.arrayBuffer()
            const copy = buf.slice(0)
            const { summary } = buildLeaveAuditExport(copy)
            setResult(summary)
            setSource({ name: f.name, buf: copy })
          } catch (err) {
            setResult(null)
            setSource(null)
            setError(err instanceof Error ? err.message : String(err))
          }
        }}
      />
      <FileTrigger
        inputRef={inputRef}
        label="연차기록 엑셀 선택"
        hint="열: 연차사용일, 성별 — 출근하지 않은 일수 = 연차시간 합÷8, 8H 기준 일수 = 그 값÷8 (원본 스크립트와 동일)."
      />

      {source && result ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              const { auditAoa } = buildLeaveAuditExport(source.buf)
              const out = mergeAuditSheetsIntoWorkbook(source.buf, [
                { name: LABOR_SURVEY_SHEET_NAMES.leave, aoa: auditAoa },
              ])
              const base = source.name.replace(/\.(xlsx|xls)$/i, '')
              downloadXlsxBuffer(out, `${base}_근거포함.xlsx`)
            }}
            className="rounded-xl border border-cyan-200 bg-white px-4 py-2 text-sm font-semibold text-cyan-900 shadow-sm hover:bg-cyan-50"
          >
            산출 근거 시트를 넣어 저장 (.xlsx)
          </button>
          <p className="mt-1.5 text-[11px] text-slate-500">
            시트 「{LABOR_SURVEY_SHEET_NAMES.leave}」에 행별 환산 시간·전체/여성 합산 포함 여부를 적습니다. 동일 이름 시트가 있으면 덮어씁니다.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4">
          <SimpleTable
            cols={[
              { key: 'k', label: '구분' },
              { key: 'nw', label: '출근하지 않은 일수' },
              { key: 'h8', label: '8H 시간 기준 일수' },
            ]}
            rows={[
              {
                k: '전체',
                nw: result.totalNotWorkDays.toFixed(4),
                h8: result.totalEightHDays.toFixed(4),
              },
              {
                k: '여성',
                nw: result.femaleNotWorkDays.toFixed(4),
                h8: result.femaleEightHDays.toFixed(4),
              },
            ]}
          />
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">엑셀을 선택하면 전체·여성 집계가 표에 표시됩니다.</p>
      )}
    </Card>
  )
}
