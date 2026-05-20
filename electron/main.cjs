const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const { buildTripProofHtml } = require('./tripProofHtml.cjs')
const { buildExpenseProofHtml } = require('./expenseProofHtml.cjs')
const { printHtmlFileToPdf } = require('./printHtmlPdf.cjs')
const { parseReceiptImageFiles } = require('./receiptParse.cjs')
const { collectProofImages } = require('./proofImages.cjs')
const { formatWonLine } = require('./koreanWon.cjs')
const { prepareReceiptImage } = require('./receiptImagePrepare.cjs')
const {
  getGeminiStatus,
  saveGeminiApiKey,
  analyzeReceiptImages,
  parseExpenseVoiceText,
  parseTripVoiceText,
} = require('./gemini.cjs')

function getDataDirectory() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'data')
  }
  return path.join(__dirname, '..', 'data')
}

function ensureDataDirectory() {
  const dir = getDataDirectory()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** 로컬 전용: 외부 웹 콘텐츠 로드 차단 */
function lockNavigation(win) {
  win.webContents.on('will-navigate', (e, url) => {
    const allowed =
      url.startsWith('file://') ||
      url.startsWith('http://127.0.0.1:') ||
      url.startsWith('http://localhost:')
    if (!allowed) e.preventDefault()
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-attach-webview', (e) => e.preventDefault())
}

function getNanumFontPath() {
  const candidates = [
    path.join(__dirname, 'fonts', 'NanumGothic.woff2'),
    path.join(__dirname, '..', 'node_modules', '@fontsource', 'nanum-gothic', 'files', 'nanum-gothic-korean-400-normal.woff2'),
    path.join(__dirname, '..', 'node_modules', '@fontsource', 'nanum-gothic', 'files', 'nanum-gothic-latin-400-normal.woff2'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

function registerIpc() {
  ipcMain.handle('hrm:get-data-dir', () => getDataDirectory())

  ipcMain.handle('hrm:list-data-excels', () => {
    const dir = getDataDirectory()
    let names = []
    try {
      names = fs.readdirSync(dir)
    } catch {
      return { dir, entries: [] }
    }
    const entries = names
      .filter((n) => /\.xlsx$/i.test(n) || /\.xls$/i.test(n))
      .sort((a, b) => a.localeCompare(b, 'ko'))
      .map((name) => ({ name, fullPath: path.join(dir, name) }))
    return { dir, entries }
  })

  ipcMain.handle('hrm:pick-excel', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const dataDir = getDataDirectory()
    const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
      title: '엑셀 파일 선택',
      defaultPath: fs.existsSync(dataDir) ? dataDir : undefined,
      properties: ['openFile'],
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
    })
    if (canceled || !filePaths[0]) return null
    return filePaths[0]
  })

  ipcMain.handle('hrm:read-excel-file', async (_e, filePath) => {
    const p = path.resolve(String(filePath))
    const low = p.toLowerCase()
    if (!low.endsWith('.xlsx') && !low.endsWith('.xls')) {
      throw new Error('xlsx/xls 파일만 열 수 있습니다.')
    }
    let st
    try {
      st = await fs.promises.stat(p)
    } catch {
      throw new Error('파일을 찾을 수 없습니다.')
    }
    if (!st.isFile()) throw new Error('파일이 아닙니다.')
    if (st.size > 80 * 1024 * 1024) throw new Error('파일이 너무 큽니다(80MB 제한).')
    return await fs.promises.readFile(p)
  })

  ipcMain.handle('hrm:open-data-folder', async () => {
    const dir = ensureDataDirectory()
    await shell.openPath(dir)
  })

  const getProofFolderPath = () => path.join(app.getPath('desktop'), '증빙폴더')
  const ensureProofFolderPath = () => {
    const dir = getProofFolderPath()
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }
  const assertProofImageInsideFolder = (filePath) => {
    const base = path.resolve(ensureProofFolderPath())
    const target = path.resolve(String(filePath))
    const rel = path.relative(base, target)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('증빙폴더 안의 파일만 읽을 수 있습니다.')
    }
  }

  ipcMain.handle('hrm:list-proof-images', async (_e, opts) => {
    const dateFolder = opts?.dateFolder ? String(opts.dateFolder) : ''
    const root = ensureProofFolderPath()
    if (dateFolder) {
      fs.mkdirSync(path.join(root, dateFolder), { recursive: true })
    }
    return collectProofImages(root, dateFolder || undefined)
  })

  const geminiUserData = () => app.getPath('userData')

  ipcMain.handle('hrm:gemini-status', () => getGeminiStatus(geminiUserData()))

  ipcMain.handle('hrm:gemini-save-key', async (_e, payload) => {
    try {
      return saveGeminiApiKey(geminiUserData(), payload?.apiKey)
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('hrm:gemini-analyze-receipt', async (_e, payload) => {
    const dateFolder = String(payload?.dateFolder ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFolder)) {
      return { ok: false, configured: true, message: '날짜는 yyyy-MM-dd 형식이어야 합니다.' }
    }
    try {
      const root = ensureProofFolderPath()
      const collected = await collectProofImages(root, dateFolder)
      const paths = collected.files.map((f) => f.fullPath)
      const result = await analyzeReceiptImages(paths, geminiUserData())
      if (!result.ok) return result
      const amount = result.amount || 0
      return {
        ...result,
        amountLine: amount > 0 ? formatWonLine(amount) : '',
        bankAmount: amount > 0 ? amount.toLocaleString('ko-KR') : '',
        folder: collected.folder,
        imageCount: collected.files.length,
      }
    } catch (err) {
      return {
        ok: false,
        configured: true,
        message: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle('hrm:gemini-parse-voice', async (_e, payload) => {
    try {
      return await parseExpenseVoiceText(payload?.text, geminiUserData())
    } catch (err) {
      return {
        ok: false,
        configured: true,
        message: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle('hrm:gemini-parse-trip-voice', async (_e, payload) => {
    try {
      return await parseTripVoiceText(payload?.text, geminiUserData())
    } catch (err) {
      return {
        ok: false,
        configured: true,
        message: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle('hrm:parse-receipt-folder', async (_e, payload) => {
    const dateFolder = String(payload?.dateFolder ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFolder)) {
      return {
        folder: ensureProofFolderPath(),
        dateTime: '',
        location: '',
        merchantName: '',
        businessNo: '',
        amount: 0,
        amountLine: '',
        bankAmount: '',
        imageCount: 0,
        ocrOk: false,
        ocrMessage: '날짜는 yyyy-MM-dd 형식이어야 합니다.',
      }
    }
    try {
      const root = ensureProofFolderPath()
      fs.mkdirSync(path.join(root, dateFolder), { recursive: true })
      const collected = await collectProofImages(root, dateFolder)
      const parsed = await parseReceiptImageFiles(collected.files.map((f) => f.fullPath))
      const amount = parsed.amount || 0
      return {
        folder: collected.folder,
        dateTime: parsed.dateTime || '',
        location: parsed.location || '',
        merchantName: parsed.merchantName || '',
        businessNo: parsed.businessNo || '',
        amount,
        amountLine: amount > 0 ? formatWonLine(amount) : '',
        bankAmount: amount > 0 ? amount.toLocaleString('ko-KR') : '',
        merchantPhone: parsed.merchantPhone || '',
        imageCount: parsed.files?.length ?? 0,
        ocrOk: Boolean(parsed.ocrOk),
        ocrMessage: parsed.ocrMessage || '',
      }
    } catch (err) {
      return {
        folder: path.join(ensureProofFolderPath(), dateFolder),
        dateTime: '',
        location: '',
        merchantName: '',
        businessNo: '',
        amount: 0,
        amountLine: '',
        bankAmount: '',
        merchantPhone: '',
        imageCount: 0,
        ocrOk: false,
        ocrMessage: err instanceof Error ? err.message : String(err),
      }
    }
  })

  /** 영수증 trim·리사이즈 후 data URL (6-1 미리보기) */
  ipcMain.handle('hrm:read-prepared-proof-image', async (_e, filePath) => {
    assertProofImageInsideFolder(filePath)
    const p = path.resolve(String(filePath))
    let st
    try {
      st = await fs.promises.stat(p)
    } catch {
      throw new Error('파일을 찾을 수 없습니다.')
    }
    if (!st.isFile()) throw new Error('파일이 아닙니다.')
    const tmp = path.join(app.getPath('temp'), `hrm-prep-view-${Date.now()}.jpg`)
    try {
      await prepareReceiptImage(p, tmp)
      const buf = await fs.promises.readFile(tmp)
      return `data:image/jpeg;base64,${buf.toString('base64')}`
    } catch (err) {
      const buf = await fs.promises.readFile(p)
      const ext = path.extname(p).toLowerCase()
      let mime = 'image/png'
      if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg'
      else if (ext === '.gif') mime = 'image/gif'
      else if (ext === '.webp') mime = 'image/webp'
      return `data:${mime};base64,${buf.toString('base64')}`
    } finally {
      await fs.promises.unlink(tmp).catch(() => {})
    }
  })

  ipcMain.handle('hrm:read-image-data-url', async (_e, filePath) => {
    assertProofImageInsideFolder(filePath)
    const p = path.resolve(String(filePath))
    let st
    try {
      st = await fs.promises.stat(p)
    } catch {
      throw new Error('파일을 찾을 수 없습니다.')
    }
    if (!st.isFile()) throw new Error('파일이 아닙니다.')
    if (st.size > 30 * 1024 * 1024) throw new Error('이미지가 너무 큽니다(30MB 제한).')
    const buf = await fs.promises.readFile(p)
    const ext = path.extname(p).toLowerCase()
    let mime = 'image/png'
    if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg'
    else if (ext === '.gif') mime = 'image/gif'
    else if (ext === '.webp') mime = 'image/webp'
    return `data:${mime};base64,${buf.toString('base64')}`
  })

  ipcMain.handle('hrm:open-proof-folder', async () => {
    const dir = ensureProofFolderPath()
    await shell.openPath(dir)
  })

  /** 출장증빙 → PDF (바탕화면/증빙폴더/날짜/). 이미지는 증빙폴더 파일을 임시 복사해 참조(대용량 base64 HTML 방지) */
  ipcMain.handle('hrm:export-trip-proof-pdf', async (_e, payload) => {
    const fields = {
      dept: String(payload?.dept ?? ''),
      rankLabel: String(payload?.rankLabel ?? ''),
      name: String(payload?.name ?? ''),
      destination: String(payload?.destination ?? ''),
      dateRange: String(payload?.dateRange ?? ''),
    }
    const imagePaths = Array.isArray(payload?.imagePaths) ? payload.imagePaths.map(String) : []
    const dateFolder = String(payload?.dateFolder ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFolder)) {
      throw new Error('폴더 날짜는 yyyy-MM-dd 형식이어야 합니다.')
    }
    let fileName = path.basename(String(payload?.fileName ?? '출장증빙.pdf'))
    if (!/\.pdf$/i.test(fileName)) fileName += '.pdf'

    const root = ensureProofFolderPath()
    const targetDir = path.join(root, dateFolder)
    fs.mkdirSync(targetDir, { recursive: true })
    const filePath = path.join(targetDir, fileName)

    const tmpDir = path.join(app.getPath('temp'), `hrm-trip-${Date.now()}`)
    const assetsDir = path.join(tmpDir, 'assets')
    fs.mkdirSync(assetsDir, { recursive: true })

    const relPaths = []
    for (let i = 0; i < imagePaths.length; i++) {
      assertProofImageInsideFolder(imagePaths[i])
      const src = path.resolve(imagePaths[i])
      const destName = `proof${i}.jpg`
      const destPath = path.join(assetsDir, destName)
      try {
        await prepareReceiptImage(src, destPath)
      } catch {
        await fs.promises.copyFile(src, destPath)
      }
      relPaths.push(`assets/${destName}`)
    }

    const html = buildTripProofHtml(fields, relPaths)
    const htmlPath = path.join(tmpDir, 'index.html')
    await fs.promises.writeFile(htmlPath, html, 'utf8')

    try {
      const pdfBuf = await printHtmlFileToPdf(htmlPath, {
        imageWaitMs: 3500,
        preferCSSPageSize: true,
      })
      await fs.promises.writeFile(filePath, pdfBuf)
      return { ok: true, filePath, canceled: false }
    } finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  /** 업무추진비류 집행내역서(지출증빙) → PDF */
  ipcMain.handle('hrm:export-expense-proof-pdf', async (_e, payload) => {
    const dateFolder = String(payload?.dateFolder ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFolder)) {
      throw new Error('폴더 날짜는 yyyy-MM-dd 형식이어야 합니다.')
    }
    const fields = {
      dept: '인사팀',
      dateTime: String(payload?.dateTime ?? ''),
      location: String(payload?.location ?? ''),
      purpose: String(payload?.purpose ?? ''),
      attendees: String(payload?.attendees ?? ''),
      amountLine: String(payload?.amountLine ?? ''),
      simpleReceiptReason: String(payload?.simpleReceiptReason ?? ''),
      merchantPhone: String(payload?.merchantPhone ?? ''),
      bankName: String(payload?.bankName ?? '우리'),
      accountHolder: String(payload?.accountHolder ?? '광주과학기술원'),
      accountNo: String(payload?.accountNo ?? '1005-604-643578'),
      bankAmount: String(payload?.bankAmount ?? ''),
    }
    const imagePaths = Array.isArray(payload?.imagePaths) ? payload.imagePaths.map(String) : []
    let fileName = path.basename(String(payload?.fileName ?? '지출증빙_업무추진비.pdf'))
    if (!/\.pdf$/i.test(fileName)) fileName += '.pdf'

    const targetDir = path.join(ensureProofFolderPath(), dateFolder)
    fs.mkdirSync(targetDir, { recursive: true })
    const filePath = path.join(targetDir, fileName)

    const tmpDir = path.join(app.getPath('temp'), `hrm-expense-${Date.now()}`)
    const assetsDir = path.join(tmpDir, 'assets')
    fs.mkdirSync(assetsDir, { recursive: true })

    const fontSrc = getNanumFontPath()
    let fontRel = ''
    if (fontSrc) {
      const fontDest = path.join(assetsDir, 'NanumGothic.woff2')
      await fs.promises.copyFile(fontSrc, fontDest)
      fontRel = 'assets/NanumGothic.woff2'
    }

    const relPaths = []
    for (let i = 0; i < imagePaths.length; i++) {
      assertProofImageInsideFolder(imagePaths[i])
      const src = path.resolve(imagePaths[i])
      const destName = `proof${i}.jpg`
      const destPath = path.join(assetsDir, destName)
      try {
        await prepareReceiptImage(src, destPath)
      } catch {
        await fs.promises.copyFile(src, destPath)
      }
      relPaths.push(`assets/${destName}`)
    }

    const html = buildExpenseProofHtml(fields, relPaths, fontRel)
    const htmlPath = path.join(tmpDir, 'index.html')
    await fs.promises.writeFile(htmlPath, html, 'utf8')

    try {
      const pdfBuf = await printHtmlFileToPdf(htmlPath, { imageWaitMs: 3500, preferCSSPageSize: true })
      await fs.promises.writeFile(filePath, pdfBuf)
      return { ok: true, filePath, canceled: false }
    } finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  /** 경력증명서 HTML → PDF (팝업 없이 저장 대화상자만 사용) */
  ipcMain.handle('hrm:export-career-pdf', async (_e, payload) => {
    const html = String(payload?.html ?? '')
    const defaultName = String(payload?.defaultFileName ?? '경력증명서.pdf')
    if (!html) throw new Error('HTML 내용이 비었습니다.')
    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined, {
      title: 'PDF로 저장',
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return { ok: false, canceled: true }

    const tmp = path.join(app.getPath('temp'), `hrm-cert-${Date.now()}.html`)
    await fs.promises.writeFile(tmp, html, 'utf8')
    const docWin = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
      },
    })
    try {
      await docWin.loadFile(tmp)
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('문서 로드 시간 초과')), 30000)
        docWin.webContents.once('did-fail-load', (_ev, code, desc) => {
          clearTimeout(t)
          reject(new Error(desc || `로드 실패 ${code}`))
        })
        docWin.webContents.once('did-finish-load', () => {
          clearTimeout(t)
          resolve(undefined)
        })
      })
      const pdfBuf = await docWin.webContents.printToPDF({
        printBackground: true,
        marginsType: 0,
        pageSize: 'A4',
      })
      await fs.promises.writeFile(filePath, pdfBuf)
      return { ok: true, filePath }
    } finally {
      if (docWin && !docWin.isDestroyed()) docWin.destroy()
      await fs.promises.unlink(tmp).catch(() => {})
    }
  })
}

async function loadRenderer(win) {
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    await win.loadURL(devUrl)
    return
  }
  const indexHtml = path.join(__dirname, '..', 'dist', 'index.html')
  try {
    await win.loadFile(indexHtml)
  } catch (firstErr) {
    try {
      await win.loadURL(pathToFileURL(indexHtml).href)
    } catch {
      dialog.showErrorBox(
        'HRM — 화면을 불러오지 못했습니다',
        `${String(firstErr?.message || firstErr)}\n\n파일: ${indexHtml}\n\n` +
          '• 소스에서 실행: npm run start:built\n' +
          '• 개발 모드: npm run dev:desktop',
      )
    }
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    title: 'HRM 로컬 대시보드',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  lockNavigation(win)

  if (process.env.DEBUG_HRM === '1') {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    if (code === -3) return
    dialog.showErrorBox('페이지 로드 실패', `${desc}\n코드: ${code}\n${url}`)
  })

  win.once('ready-to-show', () => win.show())
  void loadRenderer(win).catch(() => {
    if (!win.isDestroyed()) win.show()
  })
}

app.whenReady().then(() => {
  ensureDataDirectory()
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
