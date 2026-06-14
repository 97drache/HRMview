import { downloadTextFile } from './desktopBridge'

/** 모바일 웹: HTML 저장 후 인쇄 대화상자로 PDF 저장 유도 */
export function exportProofHtmlAsPdf(html: string, pdfFileName: string): string {
  const htmlName = pdfFileName.replace(/\.pdf$/i, '.html')
  downloadTextFile(htmlName, html, 'text/html;charset=utf-8')

  try {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0'
    document.body.appendChild(iframe)
    const win = iframe.contentWindow
    const doc = win?.document
    if (doc) {
      doc.open()
      doc.write(html)
      doc.close()
      win?.focus()
      setTimeout(() => {
        win?.print()
        setTimeout(() => iframe.remove(), 30_000)
      }, 400)
    }
  } catch {
    /* 인쇄 미지원 환경은 HTML 저장만 */
  }

  return 'HTML을 저장했습니다. 인쇄 화면에서 「PDF로 저장」을 선택할 수 있습니다.'
}
