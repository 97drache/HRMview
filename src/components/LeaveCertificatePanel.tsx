import { startOfDay } from 'date-fns'
import { useCallback, useState } from 'react'
import { fmtKo } from '../lib/dates'
import { CertificateSealPreview } from '../lib/certificateSeal'
import {
  type GeminiLeaveRecordPayload,
} from '../lib/careerGemini'
import {
  leaveCertificateDocumentHtml,
  makeLeaveIssueNo,
  type LeaveCertificateModel,
} from '../lib/leaveCertificate'
import { parseCareerRecordFromBuffer, buildCareerCertificateModelFromParsed } from '../lib/careerRecordExcel'
import {
  downloadTextFile,
  exportCareerPdfToFile,
  geminiAnalyzeLeaveRecord,
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

export function LeaveCertificatePanel() {
  const desktop = isDesktopApp()
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [empId, setEmpId] = useState('')
  const [jobType, setJobType] = useState<(typeof JOB_TYPES)[number]>('기술직')
  const [model, setModel] = useState<LeaveCertificateModel | null>(null)
  const [officerChecked, setOfficerChecked] = useState(false)
  const [officialIssueNo, setOfficialIssueNo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onPickFile = useCallback(async () => {
    if (!desktop) {
      window.alert('데스크톱 앱에서 증빙폴더의 인사기록부를 선택해 주세요.')
      return
    }
    const paths = await pickCareerRecordFiles()
    const p = paths[0]
    if (!p) return
    setFilePath(p)
    setFileName(p.split(/[/\\]/).pop() ?? p)
    setModel(null)
    setOfficerChecked(false)
    setOfficialIssueNo(null)
    setStatusMsg(null)
  }, [desktop])

  const onIssue = useCallback(async () => {
    if (!filePath || !empId.trim()) {
      window.alert('파일과 사번을 입력해 주세요.')
      return
    }
    setBusy(true)
    setStatusMsg(null)
    try {
      if (isPdfPath(filePath)) {
        const r = await geminiAnalyzeLeaveRecord({ filePath, empId: empId.trim() })
        if (!r.ok) {
          setStatusMsg(r.message || '분석 실패')
          return
        }
        const rec = r.record as GeminiLeaveRecordPayload
        setModel({
          issueNo: makeLeaveIssueNo(),
          name: String(rec.name ?? '').trim(),
          birthYmd: String(rec.birthYmd ?? '').trim(),
          empId: String(rec.empId ?? empId).trim() || empId.trim(),
          jobType: String(rec.jobType ?? jobType).trim() || jobType,
          rankLabel: String(rec.rankLabel ?? '').trim(),
          leaveStart: String(rec.leaveStart ?? '').trim(),
          leaveEnd: String(rec.leaveEnd ?? '').trim(),
          leaveReason: String(rec.leaveReason ?? '').trim(),
          warnings: rec.note ? [String(rec.note)] : [],
        })
        if (r.message) setStatusMsg(r.message)
      } else if (isXlsxPath(filePath)) {
        const buf = await readCareerRecordFile(filePath)
        const { parsed, empMatchedInSheet } = parseCareerRecordFromBuffer(buf, empId.trim())
        const base = buildCareerCertificateModelFromParsed(parsed, empId.trim(), jobType, empMatchedInSheet)
        setModel({
          issueNo: makeLeaveIssueNo(),
          name: base.name,
          birthYmd: base.birthYmd,
          empId: base.empId,
          jobType: base.jobType,
          rankLabel: base.rankLabel,
          leaveStart: '',
          leaveEnd: '',
          leaveReason: '',
          warnings: [
            ...base.warnings,
            '엑셀에서는 휴직 기간·사유를 직접 입력해 주세요. PDF는 Gemini로 자동 추출합니다.',
          ],
        })
      } else {
        window.alert('PDF 또는 xlsx만 지원합니다.')
        return
      }
      setOfficerChecked(false)
      setOfficialIssueNo(null)
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [empId, filePath, jobType])

  const onOfficerChange = useCallback((checked: boolean) => {
    setOfficerChecked(checked)
    if (checked) setOfficialIssueNo(makeLeaveIssueNo())
    else setOfficialIssueNo(null)
  }, [])

  const displayIssueNo = officerChecked && officialIssueNo ? officialIssueNo : 'TEST'

  const saveDocument = useCallback(async () => {
    if (!model) return
    setSaving(true)
    try {
      const issueNo = officerChecked ? (officialIssueNo ?? makeLeaveIssueNo()) : 'TEST'
      if (officerChecked && !officialIssueNo) setOfficialIssueNo(issueNo)
      const html = leaveCertificateDocumentHtml(model, { officerVerified: officerChecked, issueNo })
      if (isDesktopApp()) {
        const r = await exportCareerPdfToFile(html, `휴직증명서-${model.empId}.pdf`)
        if (r.canceled) return
        if (r.ok && r.filePath) window.alert(`저장했습니다.\n${r.filePath}`)
      } else {
        downloadTextFile(`휴직증명서-${model.empId}.html`, html, 'text/html;charset=utf-8')
      }
    } finally {
      setSaving(false)
    }
  }, [model, officerChecked, officialIssueNo])

  const todayKo = fmtKo(startOfDay(new Date()))

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">
        증빙폴더의 인사기록부(PDF·엑셀)로 휴직증명서를 작성합니다. PDF는 Gemini가 휴직 기간·사유를 추출합니다.
      </p>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-sky-100/90 bg-slate-50/60 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">인사기록부</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onPickFile()}
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white"
            >
              파일 선택
            </button>
            {desktop ? (
              <button
                type="button"
                onClick={() => void openProofFolderInExplorer()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                증빙폴더 열기
              </button>
            ) : null}
          </div>
          {fileName ? <span className="font-mono text-[11px] text-slate-500">{fileName}</span> : null}
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          사번
          <input
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            className="w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </label>
        <fieldset className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <legend className="px-1 text-xs font-medium text-slate-600">직종</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            {JOB_TYPES.map((j) => (
              <label key={j} className="inline-flex items-center gap-1">
                <input type="radio" checked={jobType === j} onChange={() => setJobType(j)} className="accent-teal-600" />
                {j}
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onIssue()}
          className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? '분석 중…' : '휴직증명서 생성'}
        </button>
      </div>

      {statusMsg ? <p className="text-sm text-amber-800">{statusMsg}</p> : null}

      {model ? (
        <>
          <label className="flex items-start gap-2 rounded-lg border bg-amber-50/50 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={officerChecked}
              onChange={(e) => onOfficerChange(e.target.checked)}
              className="mt-0.5 accent-teal-600"
            />
            <span>
              <span className="font-semibold">담당자 확인</span> — 확인 후 전자관인 표시 (미확인 시 TEST 워터마크)
            </span>
          </label>
          <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
            {(
              [
                ['name', '성명'],
                ['birthYmd', '생년월일'],
                ['rankLabel', '직급'],
                ['leaveStart', '휴직 시작'],
                ['leaveEnd', '휴직 종료'],
                ['leaveReason', '휴직 사유'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex flex-col gap-1 text-xs text-slate-600">
                {label}
                <input
                  value={model[k]}
                  onChange={(e) => setModel({ ...model, [k]: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveDocument()}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            PDF 저장
          </button>
          <div className="overflow-x-auto rounded-xl border bg-white p-6">
            <LeavePreview m={model} todayKo={todayKo} officerVerified={officerChecked} issueNo={displayIssueNo} />
          </div>
        </>
      ) : null}

      {model?.warnings.length ? (
        <ul className="list-disc px-4 text-sm text-amber-900">
          {model.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function LeavePreview({
  m,
  todayKo,
  officerVerified,
  issueNo,
}: {
  m: LeaveCertificateModel
  todayKo: string
  officerVerified: boolean
  issueNo: string
}) {
  const period =
    m.leaveStart && m.leaveEnd ? `${m.leaveStart} ~ ${m.leaveEnd}` : m.leaveStart || m.leaveEnd || '—'
  return (
    <div className="mx-auto max-w-[640px] text-black" style={{ fontFamily: '"Malgun Gothic",sans-serif' }}>
      <div className="flex justify-between text-[10pt]">
        <CertificateSealPreview officerVerified={officerVerified} />
        <div>발급번호: {issueNo}</div>
      </div>
      <div className="py-3 text-center text-[13pt] font-bold">휴직증명서</div>
      <table className="text-[10pt]">
        <tbody>
          {[
            ['성명', m.name],
            ['생년월일', m.birthYmd],
            ['사번', m.empId],
            ['직종', m.jobType],
            ['직급', m.rankLabel],
            ['휴직기간', period],
            ['휴직사유', m.leaveReason || '—'],
          ].map(([k, v]) => (
            <tr key={k}>
              <td className="w-24 py-0.5">{k}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-5 text-center text-[10pt]">위 사실을 증명합니다.</div>
      <div className="mt-2 text-center text-[10pt]">{todayKo}</div>
      <div className="mt-3 text-center font-semibold text-[10pt]">광주과학기술원 총장</div>
    </div>
  )
}
