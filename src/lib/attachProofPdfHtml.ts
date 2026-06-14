import { escapeHtml } from './tripProofPdfHtml'
import { formatWonComma } from './koreanWon'
import { pdfPageBaseCss } from './pdfLayout'

const ATTACH_STYLES = `
  ${pdfPageBaseCss()}
  body {
    font-family: 'NanumGothic', 'Nanum Gothic', '나눔고딕', 'Malgun Gothic', sans-serif;
    font-size: 10pt;
    color: #000;
    line-height: 1.45;
  }
  .attach-label-row {
    flex-shrink: 0;
    display: flex;
    border-bottom: 1px solid #000;
    min-height: 9mm;
  }
  .attach-label-row .label-cell {
    width: 32mm;
    border-right: 1px solid #000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 6px;
    font-size: 10pt;
    white-space: nowrap;
  }
  .attach-label-row .spacer { flex: 1; }
  .attach-main {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4mm;
    overflow: hidden;
    background: #fff;
  }
  .attach-main img {
    display: block;
    max-width: 72mm;
    max-height: 92mm;
    width: auto;
    height: auto;
    object-fit: contain;
    object-position: center center;
  }
  .bank-block { flex-shrink: 0; border-top: 1px solid #000; }
  .bank-caption {
    text-align: left;
    padding: 4px 6px;
    font-size: 10pt;
    border-bottom: 1px solid #000;
  }
  table.bank {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    table-layout: fixed;
  }
  table.bank th,
  table.bank td {
    border: none;
    border-left: 1px solid #000;
    border-top: 1px solid #000;
    padding: 5px 4px;
    text-align: center;
    font-weight: normal;
    word-break: keep-all;
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

function buildCoverSheet(params: {
  amount?: number
  bankAmount?: string
  receiptSrc: string
}): string {
  const bankAmount = escapeHtml(
    params.bankAmount ||
      (params.amount && params.amount > 0 ? params.amount.toLocaleString('ko-KR') : ''),
  )
  const amountHint =
    params.amount && params.amount > 0 ? formatWonComma(params.amount) : ''

  return `
  <div class="sheet page-break">
    <div class="attach-label-row">
      <div class="label-cell">증빙서 붙임란</div>
      <div class="spacer"></div>
    </div>
    <div class="attach-main">
      <img src="${params.receiptSrc}" alt="영수증" />
    </div>
    <div class="bank-block">
      <div class="bank-caption">&lt;입금계좌&gt;</div>
      <table class="bank">
        <tr><th>은행명</th><th>예금주</th><th>계좌번호</th><th>금액</th></tr>
        <tr>
          <td>우리</td>
          <td>광주과학기술원</td>
          <td>법인카드</td>
          <td>${bankAmount || amountHint}</td>
        </tr>
      </table>
    </div>
    <div class="footer-org">광 주 과 학 기 술 원</div>
  </div>`
}

/** 미리보기: 1페이지 양식만 */
export function buildAttachProofFullHtml(params: {
  amount?: number
  bankAmount?: string
  receiptSrc: string
  extraPageSrcs?: string[]
}): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>증빙서 붙임란</title>
<style>${ATTACH_STYLES}</style>
</head>
<body>
  ${buildCoverSheet(params)}
</body>
</html>`
}
