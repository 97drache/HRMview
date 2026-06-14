const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const {
  getDataDirectory,
  ensureDataDirectory,
  getHrdataPath,
  getHrdataMtimeMs,
} = require('./dataDirectory.cjs')
const {
  shouldExportToday,
  publishHeadcountSnapshot,
  getHeadcountExportStatus,
  loadAppEnv,
} = require('./headcountPublish.cjs')
const { buildTripProofHtml } = require('./tripProofHtml.cjs')
const { buildExpenseProofHtml } = require('./expenseProofHtml.cjs')
const { buildAttachProofHtml } = require('./attachProofHtml.cjs')
const { mergeAttachProofPdf } = require('./attachProofMerge.cjs')
const { printHtmlFileToPdf } = require('./printHtmlPdf.cjs')
const { parseReceiptImageFiles } = require('./receiptParse.cjs')
const { collectProofImages, resolvePickedProofFiles } = require('./proofImages.cjs')
const { formatWonLine, formatWonComma } = require('./koreanWon.cjs')
const { prepareReceiptImage } = require('./receiptImagePrepare.cjs')
const {
  getGeminiStatus,
  saveGeminiApiKey,
  analyzeReceiptImages,
  parseExpenseVoiceText,
  parseTripVoiceText,
  analyzeTripImages,
  analyzeCareerRecordPdf,
  analyzeLeaveRecordPdf,
  analyzeRetirementRecordPdf,
} = require('./gemini.cjs')
const {
  getLawStatus,
  searchLaws,
  getLawBody,
  getRecentHrLawChanges,
  resolveMajorLaws,
} = require('./lawOpenApi.cjs')
const { HR_MAJOR_LAW_NAMES, HR_RECENT_LAW_BASE_NAMES } = require('./hrLawConfig.cjs')
const { getRegulationsStatus, ensureRegulationsDirectory } = require('./gistRegulations.cjs')
const { runRegulationLawCompare } = require('./lawRegulationCompare.cjs')

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

  ipcMain.handle('hrm:get-hrdata-mtime', () => getHrdataMtimeMs())

  ipcMain.handle('hrm:should-export-headcount-today', () => shouldExportToday())

  ipcMain.handle('hrm:publish-headcount-snapshot', async (_e, jsonStr) => {
    if (typeof jsonStr !== 'string' || !jsonStr.trim()) {
      throw new Error('스냅샷 JSON이 비어 있습니다.')
    }
    return publishHeadcountSnapshot(jsonStr)
  })

  ipcMain.handle('hrm:get-headcount-export-status', () => getHeadcountExportStatus())

  const getProofFolderPath = () => path.join(app.getPath('desktop'), '증빙폴더')
  const ensureProofFolderPath = () => {
    const dir = getProofFolderPath()
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }
  const assertProofFileReadable = (filePath) => {
    const target = path.resolve(String(filePath))
    let st
    try {
      st = fs.statSync(target)
    } catch {
      throw new Error('파일을 찾을 수 없습니다.')
    }
    if (!st.isFile()) throw new Error('파일이 아닙니다.')
  }

  ipcMain.handle('hrm:pick-proof-files', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
      title: '증빙 파일 선택',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '이미지·PDF', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'pdf'] },
        { name: '모든 파일', extensions: ['*'] },
      ],
    })
    if (canceled || !filePaths?.length) return { paths: [] }
    return { paths: filePaths }
  })

  ipcMain.handle('hrm:pick-career-record-files', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const proofRoot = ensureProofFolderPath()
    const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
      title: '인사기록부 선택 (증빙폴더에 두신 파일)',
      defaultPath: proofRoot,
      properties: ['openFile'],
      filters: [
        { name: '인사기록부', extensions: ['pdf', 'xlsx'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: '엑셀', extensions: ['xlsx'] },
      ],
    })
    if (canceled || !filePaths?.length) return { paths: [] }
    return { paths: filePaths }
  })

  ipcMain.handle('hrm:read-career-record-file', async (_e, filePath) => {
    const p = path.resolve(String(filePath ?? ''))
    assertProofFileReadable(p)
    const buf = await fs.promises.readFile(p)
    return buf
  })

  ipcMain.handle('hrm:resolve-proof-files', async (_e, payload) => {
    const paths = Array.isArray(payload?.paths) ? payload.paths.map(String).filter(Boolean) : []
    const cacheRoot = path.join(app.getPath('userData'), 'proof-pick-cache')
    return resolvePickedProofFiles(paths, cacheRoot)
  })

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
    const explicitPaths = Array.isArray(payload?.imagePaths)
      ? payload.imagePaths.map(String).filter(Boolean)
      : []
    if (explicitPaths.length > 0) {
      try {
        return await analyzeReceiptImages(explicitPaths, geminiUserData())
      } catch (err) {
        return {
          ok: false,
          configured: true,
          message: err instanceof Error ? err.message : String(err),
        }
      }
    }
    const dateFolder = String(payload?.dateFolder ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFolder)) {
      return { ok: false, configured: true, message: '분석할 영수증 파일을 선택해 주세요.' }
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
        amountLine: amount > 0 ? formatWonComma(amount) : '',
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

  ipcMain.handle('hrm:gemini-analyze-career-record', async (_e, payload) => {
    try {
      const filePath = String(payload?.filePath ?? '')
      if (!filePath) return { ok: false, configured: true, message: '파일 경로가 없습니다.' }
      return await analyzeCareerRecordPdf(filePath, geminiUserData(), payload)
    } catch (err) {
      return { ok: false, configured: true, message: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('hrm:gemini-analyze-leave-record', async (_e, payload) => {
    try {
      const filePath = String(payload?.filePath ?? '')
      if (!filePath) return { ok: false, configured: true, message: '파일 경로가 없습니다.' }
      return await analyzeLeaveRecordPdf(filePath, geminiUserData(), payload)
    } catch (err) {
      return { ok: false, configured: true, message: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('hrm:gemini-analyze-retirement-record', async (_e, payload) => {
    try {
      const filePath = String(payload?.filePath ?? '')
      if (!filePath) return { ok: false, configured: true, message: '파일 경로가 없습니다.' }
      return await analyzeRetirementRecordPdf(filePath, geminiUserData(), payload)
    } catch (err) {
      return { ok: false, configured: true, message: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('hrm:gemini-analyze-trip', async (_e, payload) => {
    const explicitPaths = Array.isArray(payload?.imagePaths)
      ? payload.imagePaths.map(String).filter(Boolean)
      : []
    if (explicitPaths.length > 0) {
      try {
        return await analyzeTripImages(explicitPaths, geminiUserData())
      } catch (err) {
        return {
          ok: false,
          configured: true,
          message: err instanceof Error ? err.message : String(err),
        }
      }
    }
    const dateFolder = String(payload?.dateFolder ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFolder)) {
      return { ok: false, configured: true, message: '날짜는 yyyy-MM-dd 형식이어야 합니다.' }
    }
    try {
      const root = ensureProofFolderPath()
      const collected = await collectProofImages(root, dateFolder)
      return await analyzeTripImages(
        collected.files.map((f) => f.fullPath),
        geminiUserData(),
      )
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
        amountLine: amount > 0 ? formatWonComma(amount) : '',
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
    assertProofFileReadable(filePath)
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
      await prepareReceiptImage(p, tmp, { userDataDir: app.getPath('userData') })
      const buf = await fs.promises.readFile(tmp)
      return `data:image/jpeg;base64,${buf.toString('base64')}`
    } finally {
      await fs.promises.unlink(tmp).catch(() => {})
    }
  })

  ipcMain.handle('hrm:read-image-data-url', async (_e, filePath) => {
    assertProofFileReadable(filePath)
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
    let fileName = path.basename(String(payload?.fileName ?? '출장증빙.pdf'))
    if (!/\.pdf$/i.test(fileName)) fileName += '.pdf'

    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined, {
      title: '출장 증빙 PDF 저장',
      defaultPath: fileName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return { ok: false, canceled: true }

    const tmpDir = path.join(app.getPath('temp'), `hrm-trip-${Date.now()}`)
    const assetsDir = path.join(tmpDir, 'assets')
    fs.mkdirSync(assetsDir, { recursive: true })

    const relPaths = []
    for (let i = 0; i < imagePaths.length; i++) {
      assertProofFileReadable(imagePaths[i])
      const src = path.resolve(imagePaths[i])
      const destName = `proof${i}.jpg`
      const destPath = path.join(assetsDir, destName)
      await prepareReceiptImage(src, destPath, { userDataDir: app.getPath('userData') })
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

  /** 증빙서 붙임란 → PDF (1p 양식+영수증, 2p~ 추가 첨부) */
  ipcMain.handle('hrm:export-attach-proof-pdf', async (_e, payload) => {
    const receiptPath = String(payload?.receiptPath ?? '')
    if (!receiptPath) throw new Error('영수증 파일이 필요합니다.')

    const extraPaths = Array.isArray(payload?.extraPaths) ? payload.extraPaths.map(String) : []
    const amount = Number(payload?.amount) || 0
    const bankAmount =
      String(payload?.bankAmount ?? '').trim() ||
      (amount > 0 ? amount.toLocaleString('ko-KR') : '')

    let fileName = path.basename(String(payload?.fileName ?? '증빙서붙임.pdf'))
    if (!/\.pdf$/i.test(fileName)) fileName += '.pdf'

    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined, {
      title: '증빙서 붙임란 PDF 저장',
      defaultPath: fileName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return { ok: false, canceled: true }

    const tmpDir = path.join(app.getPath('temp'), `hrm-attach-${Date.now()}`)
    const assetsDir = path.join(tmpDir, 'assets')
    fs.mkdirSync(assetsDir, { recursive: true })

    const fontSrc = getNanumFontPath()
    let fontRel = ''
    if (fontSrc) {
      const fontDest = path.join(assetsDir, 'NanumGothic.woff2')
      await fs.promises.copyFile(fontSrc, fontDest)
      fontRel = 'assets/NanumGothic.woff2'
    }

    assertProofFileReadable(receiptPath)
    const receiptDest = path.join(assetsDir, 'receipt.jpg')
    const receiptDataUrl = String(payload?.receiptDataUrl ?? '')
    const m = receiptDataUrl.match(/^data:image\/\w+;base64,(.+)$/i)
    if (m) {
      await fs.promises.writeFile(receiptDest, Buffer.from(m[1], 'base64'))
    } else {
      await prepareReceiptImage(path.resolve(receiptPath), receiptDest, {
        userDataDir: app.getPath('userData'),
      })
    }

    const html = buildAttachProofHtml({ bankAmount }, 'assets/receipt.jpg', fontRel)
    const htmlPath = path.join(tmpDir, 'index.html')
    await fs.promises.writeFile(htmlPath, html, 'utf8')

    try {
      const coverPdf = await printHtmlFileToPdf(htmlPath, {
        imageWaitMs: 4000,
        preferCSSPageSize: true,
      })
      const pdfBuf = await mergeAttachProofPdf(coverPdf, extraPaths)
      await fs.promises.writeFile(filePath, pdfBuf)
      return { ok: true, filePath, canceled: false }
    } finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  /** 업무추진비류 집행내역서(지출증빙) → PDF */
  ipcMain.handle('hrm:export-expense-proof-pdf', async (_e, payload) => {
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

    const win = BrowserWindow.getFocusedWindow()
    const { canceled, filePath } = await dialog.showSaveDialog(win ?? undefined, {
      title: '지출증빙 PDF 저장',
      defaultPath: fileName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return { ok: false, canceled: true }

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

    const imageDataUrls = Array.isArray(payload?.imageDataUrls)
      ? payload.imageDataUrls.map(String)
      : []
    const userDataDir = app.getPath('userData')
    const relPaths = []
    for (let i = 0; i < imagePaths.length; i++) {
      assertProofFileReadable(imagePaths[i])
      const destName = `proof${i}.jpg`
      const destPath = path.join(assetsDir, destName)
      const dataUrl = imageDataUrls[i]
      const m = typeof dataUrl === 'string' ? dataUrl.match(/^data:image\/\w+;base64,(.+)$/i) : null
      if (m) {
        await fs.promises.writeFile(destPath, Buffer.from(m[1], 'base64'))
      } else {
        const src = path.resolve(imagePaths[i])
        await prepareReceiptImage(src, destPath, { userDataDir })
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

    const tmpDir = path.join(app.getPath('temp'), `hrm-cert-${Date.now()}`)
    const htmlPath = path.join(tmpDir, 'index.html')
    await fs.promises.mkdir(tmpDir, { recursive: true })
    await fs.promises.writeFile(htmlPath, html, 'utf8')
    try {
      const pdfBuf = await printHtmlFileToPdf(htmlPath, { imageWaitMs: 800, preferCSSPageSize: true })
      await fs.promises.writeFile(filePath, pdfBuf)
      return { ok: true, filePath }
    } finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  })

  const lawUserData = () => app.getPath('userData')

  ipcMain.handle('hrm:law-status', () => getLawStatus(lawUserData()))

  ipcMain.handle('hrm:law-search', async (_e, payload) => {
    try {
      return await searchLaws(lawUserData(), {
        query: String(payload?.query ?? ''),
        page: Number(payload?.page) || 1,
        display: Number(payload?.display) || 20,
      })
    } catch (err) {
      return {
        ok: false,
        configured: Boolean(getLawStatus(lawUserData()).configured),
        message: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle('hrm:law-body', async (_e, payload) => {
    try {
      return await getLawBody(lawUserData(), {
        mst: payload?.mst ? String(payload.mst) : undefined,
        lawId: payload?.lawId ? String(payload.lawId) : undefined,
        jo: payload?.jo ? String(payload.jo) : undefined,
      })
    } catch (err) {
      return {
        ok: false,
        configured: Boolean(getLawStatus(lawUserData()).configured),
        message: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle('hrm:law-recent-changes', async (_e, payload) => {
    try {
      return await getRecentHrLawChanges(lawUserData(), {
        days: Number(payload?.days) || 365,
        lawBases: HR_RECENT_LAW_BASE_NAMES,
        strictFilter: true,
      })
    } catch (err) {
      return {
        ok: false,
        configured: Boolean(getLawStatus(lawUserData()).configured),
        message: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle('hrm:law-resolve-major', async () => {
    try {
      return await resolveMajorLaws(lawUserData(), HR_MAJOR_LAW_NAMES)
    } catch (err) {
      return {
        ok: false,
        configured: Boolean(getLawStatus(lawUserData()).configured),
        message: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle('hrm:law-open-external', async (_e, url) => {
    const u = String(url ?? '').trim()
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      throw new Error('허용되지 않는 URL입니다.')
    }
    await shell.openExternal(u)
  })

  ipcMain.handle('hrm:gist-reg-status', () => getRegulationsStatus())

  ipcMain.handle('hrm:gist-reg-open-folder', async () => {
    const dir = ensureRegulationsDirectory()
    const err = await shell.openPath(dir)
    if (err) throw new Error(err)
    return { ok: true, folder: dir }
  })

  ipcMain.handle('hrm:law-reg-compare', async (_e, payload) => {
    try {
      return await runRegulationLawCompare(lawUserData(), {
        keyword: String(payload?.keyword ?? ''),
      })
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      }
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

let hrdataWatchTarget = null
let headcountScheduleTimer = null

function requestHeadcountExport(win) {
  if (!win || win.isDestroyed()) return
  if (!shouldExportToday()) return
  win.webContents.send('hrm:request-headcount-export')
}

function scheduleHeadcountExport(win) {
  if (headcountScheduleTimer) clearInterval(headcountScheduleTimer)
  const tick = () => requestHeadcountExport(win)
  tick()
  headcountScheduleTimer = setInterval(tick, 60 * 60 * 1000)
}

function watchHrdataFile(win) {
  const file = getHrdataPath()
  if (hrdataWatchTarget === file) return
  if (hrdataWatchTarget) {
    try {
      fs.unwatchFile(hrdataWatchTarget)
    } catch {
      /* ignore */
    }
  }
  hrdataWatchTarget = file
  if (!fs.existsSync(file)) return

  let lastMtime = getHrdataMtimeMs()
  fs.watchFile(file, { interval: 1500 }, (curr, prev) => {
    if (curr.mtimeMs === prev.mtimeMs) return
    if (lastMtime != null && curr.mtimeMs === lastMtime) return
    lastMtime = curr.mtimeMs
    if (!win || win.isDestroyed()) return
    win.webContents.send('hrm:hrdata-changed', { mtimeMs: curr.mtimeMs })
  })
}

function setupHrdataReloadOnFocus(win) {
  let lastMtime = getHrdataMtimeMs()
  const check = () => {
    const m = getHrdataMtimeMs()
    if (m == null || lastMtime == null) {
      lastMtime = m
      return
    }
    if (m !== lastMtime) {
      lastMtime = m
      win.webContents.send('hrm:hrdata-changed', { mtimeMs: m })
    }
  }
  win.on('focus', check)
  win.on('show', check)
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    title: 'HRM 로컬 대시보드',
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
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
  win.webContents.once('did-finish-load', () => {
    watchHrdataFile(win)
    scheduleHeadcountExport(win)
  })
  setupHrdataReloadOnFocus(win)
  void loadRenderer(win).catch(() => {
    if (!win.isDestroyed()) win.show()
  })
}

app.whenReady().then(() => {
  loadAppEnv()
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
