import { startOfDay } from 'date-fns'
import { useCallback, useState } from 'react'
import { fmt, fmtDots, fmtKo, parseFlexibleDate } from '../lib/dates'
import {
  buildCareerCertificateModel,
  buildCareerCertificateModelFromParsed,
  careerCertificateDocumentHtml,
  makeCareerIssueNo,
  type CareerCertificateModel,
  type CareerCertRow,
} from '../lib/careerRecordExcel'
import { careerParseResultFromGemini, type GeminiCareerRecordPayload } from '../lib/careerGemini'
import { CertificateLetterheadPreview, CertificateSealStampPreview } from '../lib/certificateSeal'
import {
  downloadTextFile,
  exportCareerPdfToFile,
  geminiAnalyzeCareerRecord,
  isDesktopApp,
  openProofFolderInExplorer,
  pickCareerRecordFiles,
  readCareerRecordFile,
} from '../lib/desktopBridge'

const JOB_TYPES = ['행정직', '기술직', '기능직', '관리직', '일반직'] as const

function isPdfPath(p: string): boolean {
  return /\.pdf$/i.test(p)
}

function isXlsxPath(p: string): boolean {
  return /\.xlsx$/i.test(p)
}

export function CareerCertificatePanel() {
  const desktop = isDesktopApp()
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [empId, setEmpId] = useState('')
  const [jobType, setJobType] = useState<(typeof JOB_TYPES)[number]>('기술직')
  const [model, setModel] = useState<CareerCertificateModel | null>(null)
  const [officerChecked, setOfficerChecked] = useState(false)
  const [officialIssueNo, setOfficialIssueNo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onPickFile = useCallback(async () => {
    if (!desktop) {
      window.alert('인사기록부 선택은 데스크톱 앱에서만 사용할 수 있습니다. 증빙폴더에 PDF·엑셀을 넣은 뒤 앱을 실행해 주세요.')
      return
    }
    try {
      const paths = await pickCareerRecordFiles()
      const p = paths[0]
      if (!p) return
      setFilePath(p)
      setFileName(p.split(/[/\\]/).pop() ?? p)
      setModel(null)
      setOfficerChecked(false)
      setOfficialIssueNo(null)
      setStatusMsg(null)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }, [desktop])

  const onIssue = useCallback(async () => {
    if (!filePath) {
      window.alert('인사기록부(PDF 또는 엑셀)를 먼저 선택해 주세요.')
      return
    }
    if (!empId.trim()) {
      window.alert('사번을 입력해 주세요.')
      return
    }
    setBusy(true)
    setStatusMsg(null)
    try {
      if (isXlsxPath(filePath)) {
        const buf = desktop ? await readCareerRecordFile(filePath) : null
        if (!buf) throw new Error('엑셀 파일을 읽을 수 없습니다.')
        setModel(buildCareerCertificateModel(buf, empId.trim(), jobType))
      } else if (isPdfPath(filePath)) {
        if (!desktop) throw new Error('PDF 분석은 데스크톱 앱에서만 가능합니다.')
        const r = await geminiAnalyzeCareerRecord({
          filePath,
          empId: empId.trim(),
          jobType,
        })
        if (!r.ok) {
          setStatusMsg(r.message || 'PDF 분석에 실패했습니다.')
          return
        }
        const parsed = careerParseResultFromGemini(r.record as GeminiCareerRecordPayload)
        setModel(buildCareerCertificateModelFromParsed(parsed, empId.trim(), jobType, true))
      } else {
        window.alert('PDF 또는 .xlsx 인사기록부만 지원합니다.')
        return
      }
      setOfficerChecked(false)
      setOfficialIssueNo(null)
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [desktop, empId, filePath, jobType])

  const onOfficerChange = useCallback((checked: boolean) => {
    setOfficerChecked(checked)
    if (checked) setOfficialIssueNo(makeCareerIssueNo())
    else setOfficialIssueNo(null)
  }, [])

  const displayIssueNo = officerChecked && officialIssueNo ? officialIssueNo : 'TEST'

  const patchModel = useCallback((patch: Partial<CareerCertificateModel>) => {
    setModel((m) => (m ? { ...m, ...patch } : m))
  }, [])

  const patchRow = useCallback((index: number, patch: Partial<CareerCertRow>) => {
    setModel((m) => {
      if (!m) return m
      const rows = m.rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
      return { ...m, rows }
    })
  }, [])

  const saveDocument = useCallback(async () => {
    if (!model) return
    setSaving(true)
    try {
      const issueNo = officerChecked ? (officialIssueNo ?? makeCareerIssueNo()) : 'TEST'
      if (officerChecked && !officialIssueNo) setOfficialIssueNo(issueNo)

      const html = careerCertificateDocumentHtml(model, {
        officerVerified: officerChecked,
        issueNo,
      })

      if (isDesktopApp()) {
        try {
          const r = await exportCareerPdfToFile(html, `경력증명서-${model.empId}.pdf`)
          if (r.canceled) return
          if (r.ok && r.filePath) window.alert(`저장했습니다.\n${r.filePath}`)
        } catch {
          downloadTextFile(`경력증명서-${model.empId}.html`, html, 'text/html;charset=utf-8')
          window.alert('PDF 변환에 실패하여 HTML 파일로 저장했습니다.')
        }
      } else {
        downloadTextFile(`경력증명서-${model.empId}.html`, html, 'text/html;charset=utf-8')
        window.alert('HTML 파일로 저장했습니다.')
      }
    } finally {
      setSaving(false)
    }
  }, [model, officerChecked, officialIssueNo])

  const todayKo = fmtKo(startOfDay(new Date()))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-sky-100/90 bg-slate-50/60 p-4 lg:grid-cols-[minmax(260px,1.2fr)_132px_minmax(360px,1fr)_150px] lg:items-end">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">인사기록부</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onPickFile()}
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              파일 선택
            </button>
            {desktop ? (
              <button
                type="button"
                onClick={() => void openProofFolderInExplorer()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                증빙폴더 열기
              </button>
            ) : null}
          </div>
          <span className="truncate font-mono text-[11px] text-slate-500">{fileName || 'PDF · xlsx'}</span>
        </div>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600">
          사번
          <input
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            className="h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </label>
        <fieldset className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <legend className="px-1 text-xs font-medium text-slate-600">직종</legend>
          <div className="flex min-h-[28px] flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-800">
            {JOB_TYPES.map((j) => (
              <label key={j} className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="career-job-type"
                  checked={jobType === j}
                  onChange={() => setJobType(j)}
                  className="accent-teal-600"
                />
                {j}
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onIssue()}
          className="h-11 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/15 hover:opacity-95 disabled:opacity-50"
        >
          {busy ? '분석 중…' : '경력증명서 생성'}
        </button>
      </div>

      {statusMsg ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{statusMsg}</div>
      ) : null}

      {model ? (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-amber-50/50 px-3 py-2.5 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={officerChecked}
            onChange={(e) => onOfficerChange(e.target.checked)}
            className="accent-teal-600"
          />
          <span className="font-semibold">담당자 확인</span>
        </label>
      ) : null}

      {model ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['name', '성명', model.name],
                ['birthYmd', '생년월일', model.birthYmd],
                ['hireYmd', '입사일자', model.hireYmd],
                ['rankLabel', '직급', model.rankLabel],
              ] as const
            ).map(([key, label, val]) => (
              <label key={key} className="flex flex-col gap-1 text-xs text-slate-600">
                {label}
                <input
                  value={val}
                  onChange={(e) => patchModel({ [key]: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left text-xs text-slate-600">
                  <th className="border border-slate-200 px-2 py-1.5">근무부서</th>
                  <th className="border border-slate-200 px-2 py-1.5">시작</th>
                  <th className="border border-slate-200 px-2 py-1.5">종료</th>
                  <th className="border border-slate-200 px-2 py-1.5">직위</th>
                </tr>
              </thead>
              <tbody>
                {model.rows.map((r, i) => (
                  <tr key={i}>
                    <td className="border border-slate-200 p-1">
                      <input
                        value={r.department}
                        onChange={(e) => patchRow(i, { department: e.target.value })}
                        className="w-full min-w-[120px] rounded border border-slate-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="border border-slate-200 p-1">
                      <input
                        defaultValue={fmt(r.start)}
                        onBlur={(e) => {
                          const d = parseFlexibleDate(e.target.value)
                          if (d) patchRow(i, { start: startOfDay(d) })
                        }}
                        className="w-28 rounded border border-slate-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="border border-slate-200 p-1">
                      <input
                        defaultValue={fmt(r.end)}
                        onBlur={(e) => {
                          const d = parseFlexibleDate(e.target.value)
                          if (d) patchRow(i, { end: startOfDay(d) })
                        }}
                        className="w-28 rounded border border-slate-200 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="border border-slate-200 p-1">
                      <input
                        value={r.positionLabel}
                        onChange={(e) => patchRow(i, { positionLabel: e.target.value })}
                        className="w-24 rounded border border-slate-200 px-2 py-1 text-sm"
                        placeholder="담당·팀장 등"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {model ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveDocument()}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {isDesktopApp() ? 'PDF 저장' : 'HTML 저장'}
          </button>
          {saving ? <span className="text-sm text-slate-500">저장 중…</span> : null}
        </div>
      ) : null}

      {model ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <CertificatePreview m={model} todayKo={todayKo} officerVerified={officerChecked} issueNo={displayIssueNo} />
        </div>
      ) : null}
    </div>
  )
}

function CertificatePreview({
  m,
  todayKo,
  officerVerified,
  issueNo,
}: {
  m: CareerCertificateModel
  todayKo: string
  officerVerified: boolean
  issueNo: string
}) {
  return (
    <div
      className="mx-auto max-w-[640px] text-black"
      style={{ fontFamily: '"Malgun Gothic","맑은 고딕",sans-serif' }}
    >
      <CertificateLetterheadPreview />
      <div className="flex justify-end text-[10pt] leading-snug">
        <div className="text-right">발급번호: {issueNo}</div>
      </div>
      <div className="py-3 text-center text-[13pt] font-bold">경력증명서</div>
      <table className="w-full text-[10pt]" style={{ lineHeight: 1.45 }}>
        <tbody>
          {[
            ['성명', m.name],
            ['생년월일', m.birthYmd],
            ['사번', m.empId],
            ['입사일자', m.hireYmd],
            ['직종', m.jobType],
            ['직급', m.rankLabel],
          ].map(([k, v]) => (
            <tr key={k}>
              <td className="w-24 py-0.5 pr-2 align-top">{k}</td>
              <td className="py-0.5 align-top">{v || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mb-1 mt-3 text-[10pt] font-semibold">경력사항</div>
      <table className="w-full border-collapse border border-neutral-800 text-[10pt]">
        <thead>
          <tr className="bg-neutral-100">
            <th className="border border-neutral-800 px-1 py-1.5">근무부서</th>
            <th className="border border-neutral-800 px-1 py-1.5">근무기간</th>
            <th className="border border-neutral-800 px-1 py-1.5">직위</th>
          </tr>
        </thead>
        <tbody>
          {m.rows.length === 0 ? (
            <tr>
              <td className="border border-neutral-800 px-2 py-3 text-center" colSpan={3}>
                근무기록에서 추출된 행이 없습니다.
              </td>
            </tr>
          ) : (
            m.rows.map((r, i) => (
              <tr key={i}>
                <td className="border border-neutral-800 px-1 py-1">{r.department}</td>
                <td className="border border-neutral-800 px-1 py-1 text-center">
                  {fmtDots(r.start)} ~ {fmtDots(r.end)}
                </td>
                <td className="border border-neutral-800 px-1 py-1 text-center">{r.positionLabel}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="mt-5 text-center text-[10pt]">위 사실을 증명합니다.</div>
      <div className="mt-2 text-center text-[10pt]">{todayKo}</div>
      <div className="mt-3 flex items-end justify-center gap-3">
        <div className="text-center text-[10pt] font-semibold">광주과학기술원 총장</div>
        <CertificateSealStampPreview officerVerified={officerVerified} />
      </div>
      <div className="mt-4 border-t border-slate-300" />
      <p className="mt-2.5 text-[8pt] text-neutral-700">
        {officerVerified
          ? '이 증명은 전자관인으로 인증된 증명입니다.'
          : '※ 담당자 확인 전 발급 시범(TEST)입니다. 전자관인은 확인 후 발급 시에만 표시됩니다.'}
      </p>
      <p className="text-[8pt] text-neutral-700">
        발급자: 광주과학기술원 인사팀 &nbsp; Tel. 062-715-5043 &nbsp; Fax. 062-715-5049
      </p>
    </div>
  )
}
