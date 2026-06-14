export type DataFolderList = {
  dir: string
  entries: { name: string; fullPath: string }[]
}

function bufferLikeToArrayBuffer(data: unknown): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data
  if (ArrayBuffer.isView(data)) {
    const v = data as ArrayBufferView
    const out = new ArrayBuffer(v.byteLength)
    new Uint8Array(out).set(new Uint8Array(v.buffer, v.byteOffset, v.byteLength))
    return out
  }
  throw new Error('지원하지 않는 파일 데이터 형식입니다.')
}

export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && window.hrmDesktop?.isDesktop === true
}

export async function getDataDirPath(): Promise<string | null> {
  const api = window.hrmDesktop
  if (!api?.getDataDir) return null
  return api.getDataDir()
}

export async function listDataFolderExcels(): Promise<DataFolderList | null> {
  const api = window.hrmDesktop
  if (!api?.listDataExcels) return null
  return api.listDataExcels() as Promise<DataFolderList>
}

export async function pickExcelFilePath(): Promise<string | null> {
  const api = window.hrmDesktop
  if (!api?.pickExcel) return null
  return api.pickExcel()
}

export async function readExcelFilePath(filePath: string): Promise<ArrayBuffer> {
  const api = window.hrmDesktop
  if (!api?.readExcelFile) throw new Error('데스크톱에서만 파일 경로로 열 수 있습니다.')
  const raw = await api.readExcelFile(filePath)
  return bufferLikeToArrayBuffer(raw)
}

export async function openDataFolderInExplorer(): Promise<void> {
  const api = window.hrmDesktop
  if (!api?.openDataFolder) return
  await api.openDataFolder()
}

export function onHrdataChanged(cb: (payload?: { mtimeMs?: number }) => void): () => void {
  const api = window.hrmDesktop
  if (!api?.onHrdataChanged) return () => {}
  return api.onHrdataChanged(cb)
}

export function onHeadcountExportRequest(cb: () => void): () => void {
  const api = window.hrmDesktop
  if (!api?.onHeadcountExportRequest) return () => {}
  return api.onHeadcountExportRequest(cb)
}

export async function shouldExportHeadcountToday(): Promise<boolean> {
  const api = window.hrmDesktop
  if (!api?.shouldExportHeadcountToday) return false
  return api.shouldExportHeadcountToday()
}

export async function publishHeadcountSnapshot(jsonStr: string): Promise<{
  ok: boolean
  writtenPaths?: string[]
  gitOk?: boolean
  gitMessage?: string
  deployOk?: boolean
  deployMessage?: string
  repoRoot?: string | null
}> {
  const api = window.hrmDesktop
  if (!api?.publishHeadcountSnapshot) throw new Error('모바일 스냅샷 저장은 데스크톱 앱에서만 가능합니다.')
  return api.publishHeadcountSnapshot(jsonStr)
}

export async function getHeadcountExportStatus(): Promise<{
  lastExportDate: string | null
  lastExportAt: string | null
  shouldExportToday: boolean
  gitMessage?: string | null
} | null> {
  const api = window.hrmDesktop
  if (!api?.getHeadcountExportStatus) return null
  return api.getHeadcountExportStatus()
}

export async function openProofFolderInExplorer(): Promise<void> {
  const api = window.hrmDesktop
  if (!api?.openProofFolder) return
  await api.openProofFolder()
}

export type ProofMediaFile = {
  name: string
  fullPath: string
  sourcePdf?: string
}

export async function listProofImages(dateFolder?: string): Promise<{
  folder: string
  files: ProofMediaFile[]
  pdfCount?: number
  pdfErrors?: { pdf: string; message: string }[]
}> {
  const api = window.hrmDesktop
  if (!api?.listProofImages) throw new Error('증빙폴더 목록은 데스크톱 앱에서만 사용할 수 있습니다.')
  return api.listProofImages(dateFolder ? { dateFolder } : undefined) as Promise<{
    folder: string
    files: ProofMediaFile[]
    pdfCount?: number
    pdfErrors?: { pdf: string; message: string }[]
  }>
}

export async function parseReceiptFolder(dateFolder: string): Promise<{
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
}> {
  const api = window.hrmDesktop
  if (!api?.parseReceiptFolder) {
    throw new Error('영수증 분석은 데스크톱 앱에서만 사용할 수 있습니다.')
  }
  return api.parseReceiptFolder({ dateFolder })
}

export async function exportExpenseProofPdf(payload: {
  dateTime: string
  location: string
  purpose: string
  attendees: string
  amountLine: string
  bankAmount: string
  imagePaths: string[]
  /** 6-1 미리보기와 동일한 Gemini 크롭 이미지(data URL) — PDF에 그대로 사용 */
  imageDataUrls?: string[]
  fileName: string
  simpleReceiptReason?: string
  merchantPhone?: string
}): Promise<{ ok: boolean; canceled?: boolean; filePath?: string }> {
  const api = window.hrmDesktop
  if (!api?.exportExpenseProofPdf) {
    throw new Error('지출증빙 PDF 저장은 데스크톱 앱에서만 사용할 수 있습니다.')
  }
  return api.exportExpenseProofPdf(payload)
}

export async function exportAttachProofPdf(payload: {
  receiptPath: string
  receiptDataUrl?: string
  extraPaths: string[]
  amount?: number
  bankAmount?: string
  fileName: string
}): Promise<{ ok: boolean; canceled?: boolean; filePath?: string; message?: string }> {
  const api = window.hrmDesktop
  if (!api?.exportAttachProofPdf) {
    throw new Error('증빙서 붙임란 PDF는 데스크톱 앱에서만 사용할 수 있습니다.')
  }
  return api.exportAttachProofPdf(payload)
}

export async function readImageAsDataUrl(filePath: string): Promise<string> {
  const api = window.hrmDesktop
  if (!api?.readImageDataUrl) throw new Error('이미지 읽기는 데스크톱 앱에서만 사용할 수 있습니다.')
  return api.readImageDataUrl(filePath) as Promise<string>
}

/** 영수증 trim·크기 조정 후 미리보기 (6-1) */
export async function getGeminiStatus(): Promise<{
  configured: boolean
  model: string
  source: string | null
  maxReceiptImages: number
} | null> {
  const api = window.hrmDesktop
  if (!api?.geminiStatus) return null
  return api.geminiStatus() as Promise<{
    configured: boolean
    model: string
    source: string | null
    maxReceiptImages: number
  }>
}

export async function saveGeminiApiKey(apiKey: string): Promise<{ ok: boolean; configured?: boolean; message?: string }> {
  const api = window.hrmDesktop
  if (!api?.geminiSaveKey) throw new Error('Gemini 설정은 데스크톱 앱에서만 가능합니다.')
  return api.geminiSaveKey({ apiKey }) as Promise<{ ok: boolean; configured?: boolean; message?: string }>
}

export async function pickProofFiles(): Promise<string[]> {
  const api = window.hrmDesktop
  if (!api?.pickProofFiles) throw new Error('파일 선택은 데스크톱 앱에서만 사용할 수 있습니다.')
  const r = (await api.pickProofFiles()) as { paths?: string[] }
  return r.paths ?? []
}

export async function pickCareerRecordFiles(): Promise<string[]> {
  const api = window.hrmDesktop
  if (!api?.pickCareerRecordFiles) throw new Error('인사기록부 선택은 데스크톱 앱에서만 사용할 수 있습니다.')
  const r = (await api.pickCareerRecordFiles()) as { paths?: string[] }
  return r.paths ?? []
}

export async function readCareerRecordFile(filePath: string): Promise<ArrayBuffer> {
  const api = window.hrmDesktop
  if (!api?.readCareerRecordFile) throw new Error('파일 읽기는 데스크톱 앱에서만 사용할 수 있습니다.')
  const raw = await api.readCareerRecordFile(filePath)
  return bufferLikeToArrayBuffer(raw)
}

export async function geminiAnalyzeCareerRecord(payload: {
  filePath: string
  empId: string
  jobType: string
}): Promise<{
  ok: boolean
  configured?: boolean
  message?: string
  record?: Record<string, unknown>
}> {
  const api = window.hrmDesktop
  if (!api?.geminiAnalyzeCareerRecord) {
    throw new Error('경력 분석(Gemini)은 데스크톱 앱에서만 사용할 수 있습니다.')
  }
  return api.geminiAnalyzeCareerRecord(payload) as Promise<{
    ok: boolean
    configured?: boolean
    message?: string
    record?: Record<string, unknown>
  }>
}

export async function geminiAnalyzeLeaveRecord(payload: {
  filePath: string
  empId: string
}): Promise<{
  ok: boolean
  configured?: boolean
  message?: string
  record?: Record<string, unknown>
}> {
  const api = window.hrmDesktop
  if (!api?.geminiAnalyzeLeaveRecord) {
    throw new Error('휴직 분석(Gemini)은 데스크톱 앱에서만 사용할 수 있습니다.')
  }
  return api.geminiAnalyzeLeaveRecord(payload) as Promise<{
    ok: boolean
    configured?: boolean
    message?: string
    record?: Record<string, unknown>
  }>
}

export async function geminiAnalyzeRetirementRecord(payload: {
  filePath: string
  empId: string
}): Promise<{
  ok: boolean
  configured?: boolean
  message?: string
  record?: Record<string, unknown>
}> {
  const api = window.hrmDesktop
  if (!api?.geminiAnalyzeRetirementRecord) {
    throw new Error('퇴직 분석(Gemini)은 데스크톱 앱에서만 사용할 수 있습니다.')
  }
  return api.geminiAnalyzeRetirementRecord(payload) as Promise<{
    ok: boolean
    configured?: boolean
    message?: string
    record?: Record<string, unknown>
  }>
}

export async function resolveProofFiles(paths: string[]): Promise<{
  files: ProofMediaFile[]
  pdfErrors?: { pdf: string; message: string }[]
}> {
  const api = window.hrmDesktop
  if (!api?.resolveProofFiles) throw new Error('증빙 파일 처리는 데스크톱 앱에서만 사용할 수 있습니다.')
  return api.resolveProofFiles({ paths }) as Promise<{
    files: ProofMediaFile[]
    pdfErrors?: { pdf: string; message: string }[]
  }>
}

export async function geminiAnalyzeReceiptImages(imagePaths: string[]): Promise<{
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
}> {
  const api = window.hrmDesktop
  if (!api?.geminiAnalyzeReceipt) {
    throw new Error('Gemini 영수증 분석은 데스크톱 앱에서만 사용할 수 있습니다.')
  }
  return api.geminiAnalyzeReceipt({ imagePaths }) as Promise<{
    ok: boolean
    configured?: boolean
    message?: string
    dateTime?: string
    location?: string
    amount?: number
    amountLine?: string
    merchantPhone?: string
  }>
}

export async function geminiAnalyzeReceiptFolder(dateFolder: string): Promise<{
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
}> {
  const api = window.hrmDesktop
  if (!api?.geminiAnalyzeReceipt) {
    throw new Error('Gemini 영수증 분석은 데스크톱 앱에서만 사용할 수 있습니다.')
  }
  return api.geminiAnalyzeReceipt({ dateFolder }) as Promise<{
    ok: boolean
    configured?: boolean
    message?: string
    dateTime?: string
    location?: string
    amount?: number
    amountLine?: string
    merchantPhone?: string
  }>
}

/** Gemini API는 Electron main에서만 호출됩니다. 키는 Vercel·브라우저 번들에 포함되지 않습니다. */
export async function geminiParseExpenseVoice(text: string): Promise<{
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
}> {
  const api = window.hrmDesktop
  if (!api?.geminiParseVoice) {
    throw new Error('Gemini 음성 정리는 데스크톱 앱에서만 사용할 수 있습니다.')
  }
  return api.geminiParseVoice({ text }) as Promise<{
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
}

export async function geminiAnalyzeTripFolder(dateFolder: string): Promise<{
  ok: boolean
  configured?: boolean
  message?: string
  dept?: string
  rankLabel?: string
  name?: string
  destination?: string
  dateRange?: string
  note?: string
}> {
  return geminiAnalyzeTripImages({ dateFolder })
}

export async function geminiAnalyzeTripImages(payload: {
  dateFolder?: string
  imagePaths?: string[]
}): Promise<{
  ok: boolean
  configured?: boolean
  message?: string
  dept?: string
  rankLabel?: string
  name?: string
  destination?: string
  dateRange?: string
  note?: string
}> {
  const api = window.hrmDesktop
  if (!api?.geminiAnalyzeTrip) {
    throw new Error('출장 증빙 분석은 데스크톱 앱에서만 사용할 수 있습니다.')
  }
  return api.geminiAnalyzeTrip(payload) as Promise<{
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
}

export async function geminiParseTripVoice(text: string): Promise<{
  ok: boolean
  configured?: boolean
  message?: string
  dept?: string
  rankLabel?: string
  name?: string
  destination?: string
  dateRange?: string
  note?: string
}> {
  const api = window.hrmDesktop
  if (!api?.geminiParseTripVoice) {
    throw new Error('출장 음성 정리는 데스크톱 앱에서만 사용할 수 있습니다.')
  }
  return api.geminiParseTripVoice({ text }) as Promise<{
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
}

export async function readPreparedProofImage(filePath: string): Promise<string> {
  const api = window.hrmDesktop
  if (!api?.readPreparedProofImage) {
    return readImageAsDataUrl(filePath)
  }
  return api.readPreparedProofImage(filePath) as Promise<string>
}

export async function exportTripProofPdf(payload: {
  dept: string
  rankLabel: string
  name: string
  destination: string
  dateRange: string
  imagePaths: string[]
  fileName: string
}): Promise<{ ok: boolean; canceled?: boolean; filePath?: string }> {
  const api = window.hrmDesktop
  if (!api?.exportTripProofPdf) {
    throw new Error('출장 증빙 PDF 저장은 데스크톱 앱에서만 사용할 수 있습니다.')
  }
  return api.exportTripProofPdf(payload) as Promise<{ ok: boolean; canceled?: boolean; filePath?: string }>
}

export async function exportCareerPdfToFile(
  html: string,
  defaultFileName: string,
): Promise<{ ok: boolean; canceled?: boolean; filePath?: string }> {
  const api = window.hrmDesktop
  if (!api?.exportCareerPdf) {
    throw new Error('PDF 저장은 데스크톱 앱에서만 사용할 수 있습니다.')
  }
  return api.exportCareerPdf({ html, defaultFileName }) as Promise<{
    ok: boolean
    canceled?: boolean
    filePath?: string
  }>
}

export async function lawStatus(): Promise<{
  configured: boolean
  source: string | null
  responseType: string
  sourceLabel: string
}> {
  const api = window.hrmDesktop
  if (!api?.lawStatus) {
    return { configured: false, source: null, responseType: 'JSON', sourceLabel: '국가법령정보센터' }
  }
  return api.lawStatus() as Promise<{
    configured: boolean
    source: string | null
    responseType: string
    sourceLabel: string
  }>
}

export async function lawSearch(payload: {
  query: string
  page?: number
  display?: number
}): Promise<{
  ok: boolean
  configured?: boolean
  message?: string
  totalCnt?: number
  laws?: import('./hrLawConfig').LawListItem[]
}> {
  const api = window.hrmDesktop
  if (!api?.lawSearch) throw new Error('법령 검색은 데스크톱 앱에서만 사용할 수 있습니다.')
  return api.lawSearch(payload)
}

export async function lawGetBody(payload: {
  mst?: string
  lawId?: string
  jo?: string
}): Promise<{
  ok: boolean
  configured?: boolean
  message?: string
  format?: 'html' | 'json'
  html?: string
  data?: unknown
}> {
  const api = window.hrmDesktop
  if (!api?.lawGetBody) throw new Error('법령 본문은 데스크톱 앱에서만 조회할 수 있습니다.')
  return api.lawGetBody(payload)
}

export async function lawRecentChanges(payload?: {
  days?: number
}): Promise<{
  ok: boolean
  configured?: boolean
  message?: string
  items?: import('./hrLawConfig').LawJoChangeItem[]
  fromRegDt?: string
  toRegDt?: string
}> {
  const api = window.hrmDesktop
  if (!api?.lawRecentChanges) throw new Error('법령 변경 조회는 데스크톱 앱에서만 사용할 수 있습니다.')
  return api.lawRecentChanges(payload)
}

export async function lawResolveMajor(): Promise<{
  ok: boolean
  configured?: boolean
  message?: string
  laws?: import('./hrLawConfig').LawListItem[]
}> {
  const api = window.hrmDesktop
  if (!api?.lawResolveMajor) throw new Error('주요 법령 연동은 데스크톱 앱에서만 사용할 수 있습니다.')
  return api.lawResolveMajor()
}

export async function lawOpenExternal(url: string): Promise<void> {
  const api = window.hrmDesktop
  if (!api?.lawOpenExternal) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  await api.lawOpenExternal(url)
}

export async function gistRegStatus(): Promise<{
  folder: string
  fileCount: number
  supportedCount: number
  files: string[]
}> {
  const api = window.hrmDesktop
  if (!api?.gistRegStatus) {
    return { folder: '', fileCount: 0, supportedCount: 0, files: [] }
  }
  return api.gistRegStatus()
}

export async function gistRegOpenFolder(): Promise<{ ok: boolean; folder: string }> {
  const api = window.hrmDesktop
  if (!api?.gistRegOpenFolder) throw new Error('규정 폴더는 데스크톱 앱에서만 열 수 있습니다.')
  return api.gistRegOpenFolder()
}

export async function lawRegCompare(payload: { keyword: string }): Promise<{
  ok: boolean
  configured?: boolean
  message?: string
  rows?: import('./hrLawConfig').RegCompareRow[]
  summary?: string
  folder?: string
  gistHits?: { fileName: string; snippet: string }[]
  lawSources?: string[]
}> {
  const api = window.hrmDesktop
  if (!api?.lawRegCompare) throw new Error('규정·법령 비교는 데스크톱 앱에서만 사용할 수 있습니다.')
  return api.lawRegCompare(payload)
}

/** 브라우저·일반 환경: HTML 파일로 바로 저장 (팝업 불필요) */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
