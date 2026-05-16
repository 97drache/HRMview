const { pageBaseCss, SHEET_WIDTH_MM } = require('./pdfLayout.cjs')

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tripProofStyles() {
  return `
  ${pageBaseCss()}
  body {
    font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
    color: #000;
  }
  table.trip {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 11pt;
    flex-shrink: 0;
  }
  table.trip td {
    border: 1px solid #000;
    padding: 6px 4px;
    text-align: center;
    vertical-align: middle;
    word-break: keep-all;
    line-height: 1.35;
  }
  table.trip td.label {
    background: #f2f2f2;
    font-weight: normal;
  }
  table.trip td.title {
    font-size: 15pt;
    font-weight: bold;
    background: #fff;
    padding: 10px 4px;
  }
  .evidence-box {
    flex: 1;
    min-height: 0;
    border: 1px solid #000;
    border-top: none;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6mm;
    overflow: hidden;
  }
  .evidence-box img {
    max-width: 100%;
    max-height: 50%;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
  }
`
}

function buildTripProofPage(fields, imageRelPath, pageIndex, pageTotal) {
  const dept = escapeHtml(fields.dept)
  const rankLabel = escapeHtml(fields.rankLabel)
  const name = escapeHtml(fields.name)
  const destination = escapeHtml(fields.destination)
  const dateRange = escapeHtml(fields.dateRange)

  const imgHtml = imageRelPath
    ? `<img src="${escapeHtml(imageRelPath)}" alt="증빙 ${pageIndex}" />`
    : ''

  const pageNo =
    pageTotal > 1
      ? `<div class="page-indicator">${pageIndex} / ${pageTotal}</div>`
      : ''

  const breakClass = pageTotal > 1 && pageIndex < pageTotal ? ' page-break' : ''

  return `
  <div class="sheet${breakClass}">
    ${pageNo}
    <table class="trip">
      <tr>
        <td class="title" colspan="6">출장증빙</td>
      </tr>
      <tr>
        <td class="label" style="width:12%">소속</td>
        <td style="width:18%">${dept}</td>
        <td class="label" style="width:12%">직급</td>
        <td style="width:18%">${rankLabel}</td>
        <td class="label" style="width:12%">성명</td>
        <td style="width:28%">${name}</td>
      </tr>
      <tr>
        <td class="label">출장지</td>
        <td>${destination}</td>
        <td class="label" colspan="2">출장일자</td>
        <td colspan="2">${dateRange}</td>
      </tr>
    </table>
    <div class="evidence-box">${imgHtml}</div>
  </div>`
}

/**
 * @param {object} fields
 * @param {string[]} imageRelPaths - 페이지당 이미지 1개 (없으면 빈 증빙란 1페이지)
 */
function buildTripProofHtml(fields, imageRelPaths) {
  const paths = Array.isArray(imageRelPaths) ? imageRelPaths.filter(Boolean) : []
  const pages = paths.length > 0 ? paths : [null]
  const total = pages.length

  const body = pages
    .map((rel, i) => buildTripProofPage(fields, rel, i + 1, total))
    .join('\n')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>출장증빙</title>
<style>${tripProofStyles()}</style>
</head>
<body>
${body}
</body>
</html>`
}

module.exports = { buildTripProofHtml, SHEET_WIDTH_MM }
