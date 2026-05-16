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
      listProofImages: (opts?: {
        dateFolder?: string
      }) => Promise<{ folder: string; files: { name: string; fullPath: string }[] }>
      parseReceiptFolder: (payload: { dateFolder: string }) => Promise<{
        folder: string
        dateTime: string
        location: string
        merchantName: string
        businessNo: string
        amount: number
        amountLine: string
        bankAmount: string
        merchantPhone: string
        imageCount: number
        ocrOk: boolean
        ocrMessage: string
      }>
      readImageDataUrl: (filePath: string) => Promise<string>
      readPreparedProofImage: (filePath: string) => Promise<string>
      openProofFolder: () => Promise<void>
      exportExpenseProofPdf: (payload: {
        dateFolder: string
        dateTime: string
        location: string
        purpose: string
        attendees: string
        amountLine: string
        bankAmount: string
        imagePaths: string[]
        fileName: string
        simpleReceiptReason?: string
        merchantPhone?: string
      }) => Promise<{ ok: boolean; canceled?: boolean; filePath?: string }>
      exportTripProofPdf: (payload: {
        dept: string
        rankLabel: string
        name: string
        destination: string
        dateRange: string
        imagePaths: string[]
        dateFolder: string
        fileName: string
      }) => Promise<{ ok: boolean; canceled?: boolean; filePath?: string }>
      exportCareerPdf: (payload: {
        html: string
        defaultFileName?: string
      }) => Promise<{ ok: boolean; canceled?: boolean; filePath?: string }>
    }
  }
}
