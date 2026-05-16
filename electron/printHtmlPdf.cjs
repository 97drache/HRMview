const { BrowserWindow } = require('electron')

/**
 * HTML 파일 → PDF (숨김 창). executeJavaScript 대기 없이 did-finish-load + 짧은 이미지 대기.
 */
async function printHtmlFileToPdf(htmlFilePath, options = {}) {
  const imageWaitMs = options.imageWaitMs ?? 2500
  const timeoutMs = options.timeoutMs ?? 45000
  const preferCSSPageSize = options.preferCSSPageSize ?? false

  const docWin = new BrowserWindow({
    show: false,
    width: 820,
    height: 1160,
    webPreferences: {
      sandbox: false,
      contextIsolation: true,
      webSecurity: false,
    },
  })

  try {
    const wc = docWin.webContents
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('문서 로드 시간 초과')), timeoutMs)
      const fail = (err) => {
        clearTimeout(timer)
        reject(err)
      }
      wc.once('did-fail-load', (_e, code, desc) => fail(new Error(desc || `로드 실패 ${code}`)))
      wc.once('did-finish-load', () => {
        clearTimeout(timer)
        resolve()
      })
      docWin.loadFile(htmlFilePath).catch(fail)
    })
    await new Promise((r) => setTimeout(r, imageWaitMs))
    return await wc.printToPDF({
      printBackground: true,
      marginsType: 0,
      pageSize: 'A4',
      preferCSSPageSize,
    })
  } finally {
    if (!docWin.isDestroyed()) docWin.destroy()
  }
}

module.exports = { printHtmlFileToPdf }
