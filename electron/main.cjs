const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

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
