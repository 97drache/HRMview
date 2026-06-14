import { startOfDay } from 'date-fns'
import { fmtKo } from './dates'
import { certificateSealHtml } from './certificateSeal'
import { makeCareerIssueNo } from './careerRecordExcel'

export type RetirementCertificateModel = {
  issueNo: string
  name: string
  birthYmd: string
  empId: string
  hireYmd: string
  retireYmd: string
  jobType: string
  rankLabel: string
  warnings: string[]
}

export function makeRetirementIssueNo(): string {
  return makeCareerIssueNo()
}

export type RetirementCertificatePrintOpts = {
  officerVerified: boolean
  issueNo: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function retirementCertificateDocumentHtml(
  m: RetirementCertificateModel,
  opts: RetirementCertificatePrintOpts,
): string {
  const todayKo = fmtKo(startOfDay(new Date()))
  const sealBlock = certificateSealHtml(opts.officerVerified)

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/><title>퇴직(예정)증명서</title>
  <style>
    body { font-family: "Malgun Gothic","맑은 고딕",sans-serif; margin: 24px; color:#111; }
    .t10 { font-size: 10pt; line-height: 1.45; }
    .t13 { font-size: 13pt; font-weight: 700; }
    .t8 { font-size: 8pt; color:#333; }
    table.meta td { padding: 2px 8px 2px 0; vertical-align: top; }
  </style></head><body>
  <div class="t10" style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>${sealBlock}</div>
    <div style="text-align:right;">발급번호: ${escapeHtml(opts.issueNo)}</div>
  </div>
  <div class="t13" style="text-align:center;margin:16px 0 12px;">퇴직(예정)증명서</div>
  <table class="meta t10">
    <tr><td>성명</td><td>${escapeHtml(m.name)}</td></tr>
    <tr><td>생년월일</td><td>${escapeHtml(m.birthYmd)}</td></tr>
    <tr><td>사번</td><td>${escapeHtml(m.empId)}</td></tr>
    <tr><td>입사일자</td><td>${escapeHtml(m.hireYmd)}</td></tr>
    <tr><td>퇴직(예정)일</td><td>${escapeHtml(m.retireYmd)}</td></tr>
    <tr><td>직종</td><td>${escapeHtml(m.jobType)}</td></tr>
    <tr><td>직급</td><td>${escapeHtml(m.rankLabel)}</td></tr>
  </table>
  <div class="t10" style="margin-top:20px;text-align:center;">위 사실을 증명합니다.</div>
  <div class="t10" style="text-align:center;margin-top:8px;">${escapeHtml(todayKo)}</div>
  <div class="t10" style="text-align:center;margin-top:12px;font-weight:600;">광주과학기술원 총장</div>
  <p class="t8" style="margin-top:16px;">${opts.officerVerified ? '이 증명은 전자관인으로 인증된 증명입니다.' : '※ 담당자 확인 전 발급 시범(TEST)입니다. 전자관인은 확인 후 발급 시에만 표시됩니다.'}</p>
  <p class="t8">발급자: 광주과학기술원 인사팀 &nbsp; Tel. 062-715-5043 &nbsp; Fax. 062-715-5049</p>
  </body></html>`
}
