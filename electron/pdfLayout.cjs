/** A4 + 20mm 바깥 여백 → 테두리 박스 크기 */
const PAGE_MARGIN_MM = 20
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const SHEET_WIDTH_MM = A4_WIDTH_MM - PAGE_MARGIN_MM * 2
const SHEET_HEIGHT_MM = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2

function pageBaseCss() {
  return `
  @page { margin: ${PAGE_MARGIN_MM}mm; size: A4 portrait; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: ${SHEET_WIDTH_MM}mm;
  }
  body { background: #fff; }
  .sheet {
    width: ${SHEET_WIDTH_MM}mm;
    height: ${SHEET_HEIGHT_MM}mm;
    min-height: ${SHEET_HEIGHT_MM}mm;
    max-width: ${SHEET_WIDTH_MM}mm;
    border: 1px solid #000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
    position: relative;
  }
  .sheet.page-break {
    page-break-after: always;
  }
  .sheet.page-break:last-child {
    page-break-after: auto;
  }
  .page-indicator {
    position: absolute;
    right: 5mm;
    bottom: 3mm;
    font-size: 9pt;
    color: #333;
    z-index: 2;
  }
`
}

module.exports = {
  PAGE_MARGIN_MM,
  SHEET_WIDTH_MM,
  SHEET_HEIGHT_MM,
  pageBaseCss,
}
