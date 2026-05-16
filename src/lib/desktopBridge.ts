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

export async function openProofFolderInExplorer(): Promise<void> {
  const api = window.hrmDesktop
  if (!api?.openProofFolder) return
  await api.openProofFolder()
}

export async function listProofImages(dateFolder?: string): Promise<{
  folder: string
  files: { name: string; fullPath: string }[]
}> {
  const api = window.hrmDesktop
  if (!api?.listProofImages) throw new Error('증빙폴더 목록은 데스크톱 앱에서만 사용할 수 있습니다.')
  return api.listProofImages(dateFolder ? { dateFolder } : undefined) as Promise<{
    folder: string
    files: { name: string; fullPath: string }[]
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
}): Promise<{ ok: boolean; canceled?: boolean; filePath?: string }> {
  const api = window.hrmDesktop
  if (!api?.exportExpenseProofPdf) {
    throw new Error('지출증빙 PDF 저장은 데스크톱 앱에서만 사용할 수 있습니다.')
  }
  return api.exportExpenseProofPdf(payload)
}

export async function readImageAsDataUrl(filePath: string): Promise<string> {
  const api = window.hrmDesktop
  if (!api?.readImageDataUrl) throw new Error('이미지 읽기는 데스크톱 앱에서만 사용할 수 있습니다.')
  return api.readImageDataUrl(filePath) as Promise<string>
}

/** 영수증 trim·크기 조정 후 미리보기 (6-1) */
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
  dateFolder: string
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
