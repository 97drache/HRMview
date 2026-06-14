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
      getHrdataMtime: () => Promise<number | null>
      shouldExportHeadcountToday: () => Promise<boolean>
      publishHeadcountSnapshot: (jsonStr: string) => Promise<{
        ok: boolean
        writtenPaths?: string[]
        gitOk?: boolean
        gitMessage?: string
        deployOk?: boolean
        deployMessage?: string
        repoRoot?: string | null
      }>
      getHeadcountExportStatus: () => Promise<{
        lastExportDate: string | null
        lastExportAt: string | null
        shouldExportToday: boolean
        gitMessage?: string | null
      }>
      onHrdataChanged: (cb: (payload?: { mtimeMs?: number }) => void) => () => void
      onHeadcountExportRequest: (cb: () => void) => () => void
      listProofImages: (opts?: {
        dateFolder?: string
      }) => Promise<{
        folder: string
        files: { name: string; fullPath: string; sourcePdf?: string }[]
        pdfCount?: number
        pdfErrors?: { pdf: string; message: string }[]
      }>
      pickProofFiles: () => Promise<{ paths: string[] }>
      pickCareerRecordFiles: () => Promise<{ paths: string[] }>
      readCareerRecordFile: (filePath: string) => Promise<ArrayBuffer | Uint8Array | Buffer>
      resolveProofFiles: (payload: { paths: string[] }) => Promise<{
        files: { name: string; fullPath: string; sourcePdf?: string }[]
        pdfErrors?: { pdf: string; message: string }[]
      }>
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
        dateTime: string
        location: string
        purpose: string
        attendees: string
        amountLine: string
        bankAmount: string
        imagePaths: string[]
        imageDataUrls?: string[]
        fileName: string
        simpleReceiptReason?: string
        merchantPhone?: string
      }) => Promise<{ ok: boolean; canceled?: boolean; filePath?: string }>
      exportAttachProofPdf: (payload: {
        receiptPath: string
        receiptDataUrl?: string
        extraPaths: string[]
        amount?: number
        bankAmount?: string
        fileName: string
      }) => Promise<{ ok: boolean; canceled?: boolean; filePath?: string; message?: string }>
      exportTripProofPdf: (payload: {
        dept: string
        rankLabel: string
        name: string
        destination: string
        dateRange: string
        imagePaths: string[]
        fileName: string
      }) => Promise<{ ok: boolean; canceled?: boolean; filePath?: string }>
      exportCareerPdf: (payload: {
        html: string
        defaultFileName?: string
      }) => Promise<{ ok: boolean; canceled?: boolean; filePath?: string }>
      geminiStatus: () => Promise<{
        configured: boolean
        model: string
        source: string | null
        maxReceiptImages: number
      }>
      geminiSaveKey: (payload: { apiKey: string }) => Promise<{
        ok: boolean
        configured?: boolean
        message?: string
      }>
      geminiAnalyzeReceipt: (payload: {
        dateFolder?: string
        imagePaths?: string[]
      }) => Promise<{
        ok: boolean
        configured?: boolean
        message?: string
        dateTime?: string
        location?: string
        merchantName?: string
        businessNo?: string
        amount?: number
        amountLine?: string
        merchantPhone?: string
      }>
      geminiParseVoice: (payload: { text: string }) => Promise<{
        ok: boolean
        configured?: boolean
        message?: string
        purpose?: string
        attendees?: string
        dateTime?: string
        location?: string
        amount?: number
        amountLine?: string
        note?: string
      }>
      geminiAnalyzeTrip: (payload: {
        dateFolder?: string
        imagePaths?: string[]
      }) => Promise<{
        ok: boolean
        configured?: boolean
        message?: string
        dept?: string
        rankLabel?: string
        name?: string
        destination?: string
        dateRange?: string
        note?: string
      }>
      geminiParseTripVoice: (payload: { text: string }) => Promise<{
        ok: boolean
        configured?: boolean
        message?: string
        dept?: string
        rankLabel?: string
        name?: string
        destination?: string
        dateRange?: string
        note?: string
      }>
      geminiAnalyzeCareerRecord: (payload: {
        filePath: string
        empId?: string
        jobType?: string
      }) => Promise<{
        ok: boolean
        configured?: boolean
        message?: string
        record?: Record<string, unknown>
      }>
      geminiAnalyzeLeaveRecord: (payload: {
        filePath: string
        empId?: string
      }) => Promise<{
        ok: boolean
        configured?: boolean
        message?: string
        record?: Record<string, unknown>
      }>
      geminiAnalyzeRetirementRecord: (payload: {
        filePath: string
        empId?: string
      }) => Promise<{
        ok: boolean
        configured?: boolean
        message?: string
        record?: Record<string, unknown>
      }>
      lawStatus: () => Promise<{
        configured: boolean
        source: string | null
        responseType: string
        sourceLabel: string
      }>
      lawSearch: (payload: {
        query: string
        page?: number
        display?: number
      }) => Promise<{
        ok: boolean
        configured?: boolean
        message?: string
        totalCnt?: number
        laws?: {
          name: string
          lawId: string
          mst: string
          efYd: string
          pubYd?: string
          dept?: string
          link?: string
        }[]
      }>
      lawGetBody: (payload: {
        mst?: string
        lawId?: string
        jo?: string
      }) => Promise<{
        ok: boolean
        configured?: boolean
        message?: string
        format?: 'html' | 'json'
        html?: string
        data?: unknown
      }>
      lawRecentChanges: (payload?: { days?: number }) => Promise<{
        ok: boolean
        configured?: boolean
        message?: string
        items?: {
          regDt: string
          lawName: string
          lawId: string
          joNo: string
          joTitle: string
          reason: string
          link?: string
        }[]
        fromRegDt?: string
        toRegDt?: string
      }>
      lawResolveMajor: () => Promise<{
        ok: boolean
        configured?: boolean
        message?: string
        laws?: {
          name: string
          lawId: string
          mst: string
          efYd: string
          error?: string
        }[]
      }>
      lawOpenExternal: (url: string) => Promise<void>
      gistRegStatus: () => Promise<{
        folder: string
        fileCount: number
        supportedCount: number
        files: string[]
      }>
      gistRegOpenFolder: () => Promise<{ ok: boolean; folder: string }>
      lawRegCompare: (payload: { keyword: string }) => Promise<{
        ok: boolean
        configured?: boolean
        message?: string
        rows?: {
          topic: string
          gistRegulation: string
          law: string
          difference: string
          compliance: string
        }[]
        summary?: string
        folder?: string
        gistHits?: { fileName: string; snippet: string }[]
        lawSources?: string[]
      }>
    }
  }
}
