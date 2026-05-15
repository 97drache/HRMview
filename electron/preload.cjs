const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hrmDesktop', {
  isDesktop: true,
  getDataDir: () => ipcRenderer.invoke('hrm:get-data-dir'),
  listDataExcels: () => ipcRenderer.invoke('hrm:list-data-excels'),
  pickExcel: () => ipcRenderer.invoke('hrm:pick-excel'),
  readExcelFile: (filePath) => ipcRenderer.invoke('hrm:read-excel-file', filePath),
  openDataFolder: () => ipcRenderer.invoke('hrm:open-data-folder'),
  exportCareerPdf: (payload) => ipcRenderer.invoke('hrm:export-career-pdf', payload),
})
