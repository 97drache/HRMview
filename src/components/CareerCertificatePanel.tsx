import { startOfDay } from 'date-fns'
import { useCallback, useState } from 'react'
import { fmt, fmtKo } from '../lib/dates'
import {
  buildCareerCertificateModel,
  careerCertificateDocumentHtml,
  makeCareerIssueNo,
  type CareerCertificateModel,
} from '../lib/careerRecordExcel'
import { downloadTextFile, exportCareerPdfToFile, isDesktopApp } from '../lib/desktopBridge'

const JOB_TYPES = ['행정직', '기술직', '기능직', '관리직', '일반직'] as const

export function CareerCertificatePanel() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [buf, setBuf] = useState<ArrayBuffer | null>(null)
  const [empId, setEmpId] = useState('')
  const [jobType, setJobType] = useState<(typeof JOB_TYPES)[number]>('기술직')
  const [model, setModel] = useState<CareerCertificateModel | null>(null)
  const [officerChecked, setOfficerChecked] = useState(false)
  const [officialIssueNo, setOfficialIssueNo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onPickFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFileName(f.name)
    setBuf(await f.arrayBuffer())
    setModel(null)
    setOfficerChecked(false)
    setOfficialIssueNo(null)
  }, [])

  const onIssue = useCallback(() => {
    if (!buf) {
      window.alert('인사기록부 엑셀 파일을 먼저 선택해 주세요.')
      return
    }
    if (!empId.trim()) {
      window.alert('사번을 입력해 주세요.')
      return
    }
    setModel(buildCareerCertificateModel(buf, empId.trim(), jobType))
    setOfficerChecked(false)
    setOfficialIssueNo(null)
  }, [buf, empId, jobType])

  const onOfficerChange = useCallback((checked: boolean) => {
    setOfficerChecked(checked)
    if (checked) setOfficialIssueNo(makeCareerIssueNo())
    else setOfficialIssueNo(null)
  }, [])

  const displayIssueNo = officerChecked && officialIssueNo ? officialIssueNo : 'TEST'

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
          window.alert('PDF 변환에 실패하여 HTML 파일로 저장했습니다. 브라우저에서 열어 PDF로 인쇄할 수 있습니다.')
        }
      } else {
        downloadTextFile(`경력증명서-${model.empId}.html`, html, 'text/html;charset=utf-8')
        window.alert('HTML 파일로 저장했습니다. 브라우저에서 열어 인쇄 → PDF로 저장하세요.')
      }
    } finally {
      setSaving(false)
    }
  }, [model, officerChecked, officialIssueNo])

  const todayKo = fmtKo(startOfDay(new Date()))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-sky-100/90 bg-slate-50/60 p-4">
        <label className="flex min-w-[200px] flex-col gap-1 text-xs font-medium text-slate-600">
          인사기록부 (.xlsx)
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-teal-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
            onChange={onPickFile}
          />
          {fileName ? <span className="font-mono text-[11px] text-slate-500">{fileName}</span> : null}
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          사번
          <input
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            className="w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500/30"
            placeholder="예: 12345"
          />
        </label>
        <fieldset className="min-w-0 flex-1 basis-[280px] rounded-lg border border-slate-200 bg-white px-3 py-2">
          <legend className="px-1 text-xs font-medium text-slate-600">직종</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-slate-800">
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
          onClick={onIssue}
          className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/15 hover:opacity-95"
        >
          경력증명서 생성
        </button>
      </div>

      {model ? (
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-amber-50/50 px-3 py-2.5 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={officerChecked}
            onChange={(e) => onOfficerChange(e.target.checked)}
            className="mt-0.5 accent-teal-600"
          />
          <span>
            <span className="font-semibold">담당자 확인</span> — 발급 내용을 확인했습니다. 체크 시 발급번호가 부여되고 관인이 표시됩니다.{' '}
            <span className="text-slate-600">(체크 해제 시 발급번호는 TEST, 관인 없음)</span>
          </span>
        </label>
      ) : null}

      {model ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveDocument()}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {isDesktopApp() ? 'PDF 저장 (팝업 없음)' : 'HTML 저장'}
          </button>
          {saving ? <span className="text-sm text-slate-500">저장 중…</span> : null}
        </div>
      ) : null}

      {model?.warnings.length ? (
        <ul className="list-inside list-disc rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          {model.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}

      {model ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-3 text-xs text-slate-500">
            미리보기 · 제목 13pt · 본문 10pt · 하단 8pt · 발급번호 {displayIssueNo}
          </p>
          <CertificatePreview m={model} todayKo={todayKo} officerVerified={officerChecked} issueNo={displayIssueNo} />
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          엑셀 인사기록부를 선택한 뒤 사번·직종을 지정하고 「경력증명서 생성」을 누르세요. 데스크톱 앱에서는 「PDF 저장」으로 바로 파일을 고릅니다(새 창 없음).
        </p>
      )}
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
      <div className="flex justify-between text-[10pt] leading-snug">
        <div>
          {officerVerified ? (
            <div
              className="flex h-[54px] w-[54px] items-center justify-center border-[2.5px] border-red-700 text-[15pt] font-bold text-red-700"
              style={{ transform: 'rotate(-10deg)' }}
            >
              印
            </div>
          ) : (
            <div className="flex h-[54px] w-[54px] items-center justify-center border border-dashed border-slate-300 text-center text-[9pt] text-slate-400">
              관인
              <br />
              없음
            </div>
          )}
          <div className="mt-0.5 text-[8pt] text-slate-600">위치</div>
        </div>
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
            <th className="border border-neutral-800 px-1 py-1.5" colSpan={3}>
              근무기간
            </th>
            <th className="border border-neutral-800 px-1 py-1.5">직위</th>
          </tr>
        </thead>
        <tbody>
          {m.rows.length === 0 ? (
            <tr>
              <td className="border border-neutral-800 px-2 py-3 text-center" colSpan={5}>
                근무기록에서 추출된 행이 없습니다.
              </td>
            </tr>
          ) : (
            m.rows.map((r, i) => (
              <tr key={i}>
                <td className="border border-neutral-800 px-1 py-1">{r.department}</td>
                <td className="border border-neutral-800 px-1 py-1 text-center">{fmt(r.start)}</td>
                <td className="border border-neutral-800 px-1 py-1 text-center">~</td>
                <td className="border border-neutral-800 px-1 py-1 text-center">{fmt(r.end)}</td>
                <td className="border border-neutral-800 px-1 py-1 text-center">{r.positionLabel}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="mt-5 text-center text-[10pt]">위 사실을 증명합니다.</div>
      <div className="mt-2 text-center text-[10pt]">{todayKo}</div>
      <div className="mt-3 text-center text-[10pt] font-semibold">광주과학기술원 총장</div>
      <p className="mt-4 text-[8pt] text-neutral-700">
        {officerVerified
          ? '이 증명은 전자관인으로 인증된 증명입니다.'
          : '※ 담당자 확인 전 발급 시범(TEST)입니다. 전자관인 문구는 확인 후 발급 시에만 표시됩니다.'}
      </p>
      <p className="text-[8pt] text-neutral-700">
        발급자: 광주과학기술원 인사팀 &nbsp; Tel. 062-715-5043 &nbsp; Fax. 062-715-5049
      </p>
    </div>
  )
}
