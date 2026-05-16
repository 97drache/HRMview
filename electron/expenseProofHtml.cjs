const { formatWonLine } = require('./koreanWon.cjs')
const { SHEET_WIDTH_MM, pageBaseCss } = require('./pdfLayout.cjs')

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 1~5번: 번호·항목·콜론·내용 열 정렬 */
function formRowAligned(num, label, valueHtml) {
  return `<tr>
    <td class="num">${num}.</td>
    <td class="label">${escapeHtml(label)}</td>
    <td class="colon">:</td>
    <td class="value">${valueHtml}</td>
  </tr>`
}

/** 6~7번: 긴 항목명, 내용 열은 1~5번과 동일 위치 */
function formRowLong(num, label, valueHtml) {
  return `<tr>
    <td class="num">${num}.</td>
    <td class="label wrap">${escapeHtml(label)}</td>
    <td class="colon">:</td>
    <td class="value">${valueHtml}</td>
  </tr>`
}

function expenseProofStyles(fontFace) {
  return `
  ${fontFace}
  ${pageBaseCss()}
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
    flex-shrink: 0;
    border-bottom: 1px solid #000;
  }
  .head h1 { margin: 0; font-size: 20pt; font-weight: bold; }
  .head .dept {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 10pt;
    font-weight: normal;
  }
  table.form {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10pt;
    flex-shrink: 0;
  }
  table.form td {
    border: none;
    border-top: 1px solid #000;
    padding: 5px 6px;
    vertical-align: top;
    word-break: keep-all;
  }
  table.form tr:first-child td { border-top: none; }
  table.form td.num {
    width: 9mm;
    text-align: right;
    padding-right: 4px;
    white-space: nowrap;
  }
  table.form td.label {
    width: 38mm;
    padding-left: 2mm;
    padding-right: 1mm;
    white-space: nowrap;
    line-height: 1.35;
  }
  table.form td.label.wrap {
    white-space: normal;
  }
  table.form td.colon {
    width: 4mm;
    padding-left: 0;
    padding-right: 2mm;
    text-align: center;
  }
  table.form td.value {
    text-align: left;
    padding-left: 2mm;
    word-break: break-word;
  }
  .evidence-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-top: 1px solid #000;
  }
  .attach-title {
    flex-shrink: 0;
    text-align: center;
    padding: 5px;
    font-size: 10pt;
    border-bottom: 1px solid #000;
  }
  .attach-box {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4mm;
    overflow: hidden;
  }
  .attach-box img {
    display: block;
    max-width: 100%;
    max-height: 50%;
    width: auto;
    height: auto;
    object-fit: contain;
  }
  .bank-block { flex-shrink: 0; border-top: 1px solid #000; }
  .bank-caption {
    text-align: center;
    padding: 5px;
    font-size: 10pt;
    border-bottom: 1px solid #000;
  }
  table.bank {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
  }
  table.bank th,
  table.bank td {
    border: none;
    border-left: 1px solid #000;
    border-top: 1px solid #000;
    padding: 5px 4px;
    text-align: center;
    font-weight: normal;
  }
  table.bank th:first-child,
  table.bank td:first-child { border-left: none; }
  table.bank tr:first-child th { border-top: none; }
  .footer-org {
    flex-shrink: 0;
    padding: 14px 8px 12px;
    text-align: center;
    font-size: 20pt;
    font-weight: bold;
    letter-spacing: 0.55em;
    border-top: 1px solid #000;
  }
`
}

function buildExpenseProofHtml(fields, imageRelPaths, fontRelPath) {
  const dept = escapeHtml(fields.dept || '인사팀')
  const dateTime = escapeHtml(fields.dateTime)
  const location = escapeHtml(fields.location)
  const purpose = escapeHtml(fields.purpose)
  const attendees = escapeHtml(fields.attendees)
  const amountLine = escapeHtml(fields.amountLine)
  const simpleReceiptReason = escapeHtml(fields.simpleReceiptReason || '')
  const merchantPhone = escapeHtml(fields.merchantPhone || '')
  const bankName = escapeHtml(fields.bankName || '우리')
  const accountHolder = escapeHtml(fields.accountHolder || '광주과학기술원')
  const accountNo = escapeHtml(fields.accountNo || '1005-604-643578')
  const bankAmount = escapeHtml(fields.bankAmount || '')

  const fontFace = fontRelPath
    ? `@font-face {
    font-family: 'NanumGothic';
    src: url('${escapeHtml(fontRelPath)}') format('woff2');
    font-weight: 400;
    font-style: normal;
  }`
    : ''

  const imgs = (imageRelPaths || [])
    .map((src, i) => `<img src="${escapeHtml(src)}" alt="증빙 ${i + 1}" />`)
    .join('')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>업무추진비류 집행내역서</title>
<style>${expenseProofStyles(fontFace)}</style>
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
        <tr>
          <th style="width:18%">은행명</th>
          <th style="width:32%">예금주</th>
          <th style="width:32%">계좌번호</th>
          <th style="width:18%">금액</th>
        </tr>
        <tr>
          <td>${bankName}</td>
          <td>${accountHolder}</td>
          <td>${accountNo}</td>
          <td>${bankAmount}</td>
        </tr>
      </table>
    </div>

    <div class="footer-org">광 주 과 학 기 술 원</div>
  </div>
</body>
</html>`
}

function buildExpenseFieldsFromParsed(parsed, purpose, attendees) {
  const amount = parsed.amount || 0
  return {
    dept: '인사팀',
    dateTime: parsed.dateTime || '',
    location: parsed.location || '',
    purpose: purpose || '',
    attendees: attendees || '',
    amountLine: amount > 0 ? formatWonLine(amount) : '',
    bankAmount: amount > 0 ? amount.toLocaleString('ko-KR') : '',
    merchantPhone: parsed.merchantPhone || '',
  }
}

module.exports = {
  buildExpenseProofHtml,
  buildExpenseFieldsFromParsed,
  expenseProofStyles,
  formRowAligned,
  formRowLong,
  SHEET_WIDTH_MM,
}
