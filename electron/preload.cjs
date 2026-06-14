const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hrmDesktop', {
  isDesktop: true,
  getDataDir: () => ipcRenderer.invoke('hrm:get-data-dir'),
  listDataExcels: () => ipcRenderer.invoke('hrm:list-data-excels'),
  pickExcel: () => ipcRenderer.invoke('hrm:pick-excel'),
  readExcelFile: (filePath) => ipcRenderer.invoke('hrm:read-excel-file', filePath),
  openDataFolder: () => ipcRenderer.invoke('hrm:open-data-folder'),
  getHrdataMtime: () => ipcRenderer.invoke('hrm:get-hrdata-mtime'),
  shouldExportHeadcountToday: () => ipcRenderer.invoke('hrm:should-export-headcount-today'),
  publishHeadcountSnapshot: (jsonStr) => ipcRenderer.invoke('hrm:publish-headcount-snapshot', jsonStr),
  getHeadcountExportStatus: () => ipcRenderer.invoke('hrm:get-headcount-export-status'),
  onHrdataChanged: (cb) => {
    const handler = (_e, payload) => cb(payload)
    ipcRenderer.on('hrm:hrdata-changed', handler)
    return () => ipcRenderer.removeListener('hrm:hrdata-changed', handler)
  },
  onHeadcountExportRequest: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('hrm:request-headcount-export', handler)
    return () => ipcRenderer.removeListener('hrm:request-headcount-export', handler)
  },
  listProofImages: (opts) => ipcRenderer.invoke('hrm:list-proof-images', opts),
  pickProofFiles: () => ipcRenderer.invoke('hrm:pick-proof-files'),
  pickCareerRecordFiles: () => ipcRenderer.invoke('hrm:pick-career-record-files'),
  readCareerRecordFile: (filePath) => ipcRenderer.invoke('hrm:read-career-record-file', filePath),
  resolveProofFiles: (payload) => ipcRenderer.invoke('hrm:resolve-proof-files', payload),
  parseReceiptFolder: (payload) => ipcRenderer.invoke('hrm:parse-receipt-folder', payload),
  readImageDataUrl: (filePath) => ipcRenderer.invoke('hrm:read-image-data-url', filePath),
  readPreparedProofImage: (filePath) => ipcRenderer.invoke('hrm:read-prepared-proof-image', filePath),
  openProofFolder: () => ipcRenderer.invoke('hrm:open-proof-folder'),
  exportTripProofPdf: (payload) => ipcRenderer.invoke('hrm:export-trip-proof-pdf', payload),
  exportExpenseProofPdf: (payload) => ipcRenderer.invoke('hrm:export-expense-proof-pdf', payload),
  exportAttachProofPdf: (payload) => ipcRenderer.invoke('hrm:export-attach-proof-pdf', payload),
  exportCareerPdf: (payload) => ipcRenderer.invoke('hrm:export-career-pdf', payload),
  geminiStatus: () => ipcRenderer.invoke('hrm:gemini-status'),
  geminiSaveKey: (payload) => ipcRenderer.invoke('hrm:gemini-save-key', payload),
  geminiAnalyzeReceipt: (payload) => ipcRenderer.invoke('hrm:gemini-analyze-receipt', payload),
  geminiParseVoice: (payload) => ipcRenderer.invoke('hrm:gemini-parse-voice', payload),
  geminiParseTripVoice: (payload) => ipcRenderer.invoke('hrm:gemini-parse-trip-voice', payload),
  geminiAnalyzeTrip: (payload) => ipcRenderer.invoke('hrm:gemini-analyze-trip', payload),
  geminiAnalyzeCareerRecord: (payload) => ipcRenderer.invoke('hrm:gemini-analyze-career-record', payload),
  geminiAnalyzeLeaveRecord: (payload) => ipcRenderer.invoke('hrm:gemini-analyze-leave-record', payload),
  geminiAnalyzeRetirementRecord: (payload) => ipcRenderer.invoke('hrm:gemini-analyze-retirement-record', payload),
  lawStatus: () => ipcRenderer.invoke('hrm:law-status'),
  lawSearch: (payload) => ipcRenderer.invoke('hrm:law-search', payload),
  lawGetBody: (payload) => ipcRenderer.invoke('hrm:law-body', payload),
  lawRecentChanges: (payload) => ipcRenderer.invoke('hrm:law-recent-changes', payload),
  lawResolveMajor: () => ipcRenderer.invoke('hrm:law-resolve-major'),
  lawOpenExternal: (url) => ipcRenderer.invoke('hrm:law-open-external', url),
  gistRegStatus: () => ipcRenderer.invoke('hrm:gist-reg-status'),
  gistRegOpenFolder: () => ipcRenderer.invoke('hrm:gist-reg-open-folder'),
  lawRegCompare: (payload) => ipcRenderer.invoke('hrm:law-reg-compare', payload),
})
