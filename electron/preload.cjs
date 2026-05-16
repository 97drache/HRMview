const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hrmDesktop', {
  isDesktop: true,
  getDataDir: () => ipcRenderer.invoke('hrm:get-data-dir'),
  listDataExcels: () => ipcRenderer.invoke('hrm:list-data-excels'),
  pickExcel: () => ipcRenderer.invoke('hrm:pick-excel'),
  readExcelFile: (filePath) => ipcRenderer.invoke('hrm:read-excel-file', filePath),
  openDataFolder: () => ipcRenderer.invoke('hrm:open-data-folder'),
  listProofImages: (opts) => ipcRenderer.invoke('hrm:list-proof-images', opts),
  parseReceiptFolder: (payload) => ipcRenderer.invoke('hrm:parse-receipt-folder', payload),
  readImageDataUrl: (filePath) => ipcRenderer.invoke('hrm:read-image-data-url', filePath),
  readPreparedProofImage: (filePath) => ipcRenderer.invoke('hrm:read-prepared-proof-image', filePath),
  openProofFolder: () => ipcRenderer.invoke('hrm:open-proof-folder'),
  exportTripProofPdf: (payload) => ipcRenderer.invoke('hrm:export-trip-proof-pdf', payload),
  exportExpenseProofPdf: (payload) => ipcRenderer.invoke('hrm:export-expense-proof-pdf', payload),
  exportCareerPdf: (payload) => ipcRenderer.invoke('hrm:export-career-pdf', payload),
})
