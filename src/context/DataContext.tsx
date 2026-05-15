import { startOfDay } from 'date-fns'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ParsedWorkbook } from '../types/hr'
import { getDataDirPath, isDesktopApp, listDataFolderExcels, readExcelFilePath } from '../lib/desktopBridge'
import { parseWorkbookBuffer } from '../lib/parseExcel'

const HRDATA_NAME = /^hrdata\.xlsx$/i

type Ctx = {
  baseDate: Date
  setBaseDate: (d: Date) => void
  data: ParsedWorkbook | null
  fileName: string | null
  filePath: string | null
  /** 데스크톱 자동 로드 시 사용하는 data 폴더(개발: 프로젝트/data, 설치본: resources/data) */
  dataDirectory: string | null
  dataLoading: boolean
  dataLoadError: string | null
  loadFile: (file: File) => Promise<void>
  loadFromPath: (fullPath: string) => Promise<void>
  clearData: () => void
}

const DataContext = createContext<Ctx | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [baseDate, setBaseDate] = useState(() => startOfDay(new Date()))
  const [data, setData] = useState<ParsedWorkbook | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [dataDirectory, setDataDirectory] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(() => isDesktopApp())
  const [dataLoadError, setDataLoadError] = useState<string | null>(null)

  const loadFile = useCallback(async (file: File) => {
    const buf = await file.arrayBuffer()
    const parsed = parseWorkbookBuffer(buf)
    setData(parsed)
    setFileName(file.name)
    setFilePath(null)
  }, [])

  const loadFromPath = useCallback(async (fullPath: string) => {
    const buf = await readExcelFilePath(fullPath)
    const parsed = parseWorkbookBuffer(buf)
    setData(parsed)
    const base = fullPath.replace(/^.*[/\\]/, '')
    setFileName(base)
    setFilePath(fullPath)
    setDataLoadError(null)
  }, [])

  const clearData = useCallback(() => {
    setData(null)
    setFileName(null)
    setFilePath(null)
  }, [])

  useEffect(() => {
    if (!isDesktopApp()) return
    void getDataDirPath().then((p) => {
      if (p) setDataDirectory(p)
    })
  }, [])

  useEffect(() => {
    if (!isDesktopApp()) return
    let cancelled = false
    void (async () => {
      try {
        const list = await listDataFolderExcels()
        if (cancelled) return
        setDataLoadError(null)
        if (!list) {
          setDataLoadError('data 폴더 정보를 읽을 수 없습니다.')
          setDataLoading(false)
          return
        }
        const hit = list.entries.find((e) => HRDATA_NAME.test(e.name))
        if (!hit) {
          setDataLoadError('data 폴더에 HRdata.xlsx 파일이 없습니다.')
          setDataLoading(false)
          return
        }
        await loadFromPath(hit.fullPath)
        if (!cancelled) setDataLoading(false)
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setDataLoadError(`HRdata.xlsx 를 열 수 없습니다: ${msg}`)
        setDataLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadFromPath])

  const value = useMemo(
    () => ({
      baseDate,
      setBaseDate: (d: Date) => setBaseDate(startOfDay(d)),
      data,
      fileName,
      filePath,
      dataDirectory,
      dataLoading,
      dataLoadError,
      loadFile,
      loadFromPath,
      clearData,
    }),
    [baseDate, data, fileName, filePath, dataDirectory, dataLoading, dataLoadError, loadFile, loadFromPath, clearData],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

/* eslint-disable react-refresh/only-export-components -- 훅을 컨텍스트 파일에 둡니다 */
export function useData() {
  const v = useContext(DataContext)
  if (!v) throw new Error('useData must be used within DataProvider')
  return v
}
