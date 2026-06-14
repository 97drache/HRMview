import { escapeHtml } from './tripProofPdfHtml'
import { formatWonComma } from './koreanWon'
import { pdfPageBaseCss } from './pdfLayout'

export type ExpenseProofFields = {
  dept?: string
  dateTime: string
  location: string
  purpose: string
  attendees: string
  amountLine?: string
  amount?: number
  simpleReceiptReason?: string
  merchantPhone?: string
  bankName?: string
  accountHolder?: string
  accountNo?: string
  bankAmount?: string
}

const EXPENSE_STYLES = `
  ${pdfPageBaseCss()}
  body {
    font-family: 'NanumGothic', 'Nanum Gothic', '나눔고딕', sans-serif;
    font-size: 10pt;
    color: #000;
    line-height: 1.45;
  }
  .head {
    position: relative;
    text-align: center;
    padding: 10px 10px 8px;
    border-bottom: 1px solid #000;
  }
  .head h1 { margin: 0; font-size: 20pt; font-weight: bold; }
  .head .dept {
    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
    font-size: 10pt;
  }
  table.form { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10pt; }
  table.form td {
    border: none;
    border-top: 1px solid #000;
    padding: 5px 6px;
    vertical-align: top;
    word-break: keep-all;
  }
  table.form tr:first-child td { border-top: none; }
  table.form td.num { width: 9mm; text-align: right; padding-right: 4px; }
  table.form td.label { width: 38mm; padding-left: 2mm; white-space: nowrap; line-height: 1.35; }
  table.form td.label.wrap { white-space: normal; }
  table.form td.colon { width: 4mm; text-align: center; padding-right: 2mm; }
  table.form td.value { text-align: left; padding-left: 2mm; word-break: break-word; }
  .evidence-wrap {
    flex: 1; min-height: 0; display: flex; flex-direction: column;
    border-top: 1px solid #000;
  }
  .attach-title {
    flex-shrink: 0; text-align: center; padding: 5px; border-bottom: 1px solid #000;
  }
  .attach-box {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2mm;
    padding: 3mm;
    overflow: hidden;
    background: #fff;
  }
  .attach-item {
    flex: 1 1 0;
    min-height: 0;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .attach-box img {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    object-position: center center;
    margin: auto;
  }
  .bank-block { border-top: 1px solid #000; }
  .bank-caption { text-align: center; padding: 5px; border-bottom: 1px solid #000; }
  table.bank { width: 100%; border-collapse: collapse; font-size: 10pt; }
  table.bank th, table.bank td {
    border: none; border-left: 1px solid #000; border-top: 1px solid #000;
    padding: 5px 4px; text-align: center; font-weight: normal;
  }
  table.bank th:first-child, table.bank td:first-child { border-left: none; }
  table.bank tr:first-child th { border-top: none; }
  .footer-org {
    padding: 14px 8px 12px; text-align: center; font-size: 20pt;
    font-weight: bold; letter-spacing: 0.55em; border-top: 1px solid #000;
  }
`

function formRowAligned(num: number, label: string, value: string): string {
  return `<tr>
    <td class="num">${num}.</td>
    <td class="label">${escapeHtml(label)}</td>
    <td class="colon">:</td>
    <td class="value">${value}</td>
  </tr>`
}

function formRowLong(num: number, label: string, value: string): string {
  return `<tr>
    <td class="num">${num}.</td>
    <td class="label wrap">${escapeHtml(label)}</td>
    <td class="colon">:</td>
    <td class="value">${value}</td>
  </tr>`
}

export function buildExpenseProofHtml(params: ExpenseProofFields & { imageSrcs: string[] }): string {
  const dept = escapeHtml(params.dept || '인사팀')
  const dateTime = escapeHtml(params.dateTime)
  const location = escapeHtml(params.location)
  const purpose = escapeHtml(params.purpose)
  const attendees = escapeHtml(params.attendees)
  const amountLine = escapeHtml(
    params.amountLine || (params.amount && params.amount > 0 ? formatWonComma(params.amount) : ''),
  )
  const simpleReceiptReason = escapeHtml(params.simpleReceiptReason || '')
  const merchantPhone = escapeHtml(params.merchantPhone || '')
  const bankName = escapeHtml(params.bankName || '우리')
  const accountHolder = escapeHtml(params.accountHolder || '광주과학기술원')
  const accountNo = escapeHtml(params.accountNo || '1005-604-643578')
  const bankAmount = escapeHtml(
    params.bankAmount ||
      (params.amount && params.amount > 0 ? params.amount.toLocaleString('ko-KR') : ''),
  )

  const imgs = (params.imageSrcs || [])
    .map((src, i) => `<div class="attach-item"><img src="${src}" alt="증빙 ${i + 1}" /></div>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>업무추진비류 집행내역서</title>
<style>${EXPENSE_STYLES}</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <h1>업무추진비류 집행내역서</h1>
      <div class="dept">부 서 : ${dept}</div>
    </div>
    <table class="form">
      ${formRowAligned(1, '일시', dateTime)}
      ${formRowAligned(2, '장소', location)}
      ${formRowAligned(3, '목적', purpose)}
      ${formRowAligned(4, '참석자', attendees)}
      ${formRowAligned(5, '사용금액', amountLine)}
      ${formRowLong(6, '간이영수증증빙사유', simpleReceiptReason)}
      ${formRowLong(7, '사용처(업소)전화번호', merchantPhone)}
    </table>
    <div class="evidence-wrap">
      <div class="attach-title">증빙서 첨부란</div>
      <div class="attach-box">${imgs}</div>
    </div>
    <div class="bank-block">
      <div class="bank-caption">&lt;입금계좌&gt;</div>
      <table class="bank">
        <tr><th>은행명</th><th>예금주</th><th>계좌번호</th><th>금액</th></tr>
        <tr><td>${bankName}</td><td>${accountHolder}</td><td>${accountNo}</td><td>${bankAmount}</td></tr>
      </table>
    </div>
    <div class="footer-org">광 주 과 학 기 술 원</div>
  </div>
</body>
</html>`
}
