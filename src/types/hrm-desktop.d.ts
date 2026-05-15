export {}

declare global {
  interface Window {
    hrmDesktop?: {
      isDesktop: boolean
      getDataDir: () => Promise<string>
      listDataExcels: () => Promise<{ dir: string; entries: { name: string; fullPath: string }[] }>
      pickExcel: () => Promise<string | null>
      readExcelFile: (filePath: string) => Promise<ArrayBuffer | Uint8Array | Buffer>
      openDataFolder: () => Promise<void>
      exportCareerPdf: (payload: {
        html: string
        defaultFileName?: string
      }) => Promise<{ ok: boolean; canceled?: boolean; filePath?: string }>
    }
  }
}
