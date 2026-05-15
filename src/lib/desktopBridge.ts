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
