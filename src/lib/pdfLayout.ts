/** A4 + 20mm 바깥 여백 → 테두리 박스 (미리보기·PDF HTML 공통) */
export const PDF_PAGE_MARGIN_MM = 20
export const PDF_SHEET_WIDTH_MM = 210 - PDF_PAGE_MARGIN_MM * 2
export const PDF_SHEET_HEIGHT_MM = 297 - PDF_PAGE_MARGIN_MM * 2

export function pdfPageBaseCss(): string {
  return `
  @page { margin: ${PDF_PAGE_MARGIN_MM}mm; size: A4 portrait; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: ${PDF_SHEET_WIDTH_MM}mm;
  }
  body { background: #fff; }
  .sheet {
    width: ${PDF_SHEET_WIDTH_MM}mm;
    height: ${PDF_SHEET_HEIGHT_MM}mm;
    min-height: ${PDF_SHEET_HEIGHT_MM}mm;
    max-width: ${PDF_SHEET_WIDTH_MM}mm;
    border: 1px solid #000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
    position: relative;
  }
  .sheet.page-break { page-break-after: always; }
  .sheet.page-break:last-child { page-break-after: auto; }
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
