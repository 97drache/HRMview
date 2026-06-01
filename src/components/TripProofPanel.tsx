import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card } from './Ui'
import { ProofFileList } from './proof/ProofFileList'
import { buildTripProofHtml } from '../lib/tripProofPdfHtml'
import {
  downloadTextFile,
  exportTripProofPdf,
  geminiAnalyzeTripImages,
  isDesktopApp,
  pickProofFiles,
  readPreparedProofImage,
  resolveProofFiles,
  type ProofMediaFile,
} from '../lib/desktopBridge'
import { applyGeminiTrip } from '../lib/geminiExpense'

const DEFAULT_SELF = { dept: '인사팀', rankLabel: '책임급', name: '조용운' }

export function TripProofPanel({ webMode = false }: { webMode?: boolean }) {
  const desktop = isDesktopApp()
  const canRun = desktop || webMode
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [webImageData, setWebImageData] = useState<Map<string, string>>(() => new Map())
  const [dept, setDept] = useState(DEFAULT_SELF.dept)
  const [rankLabel, setRankLabel] = useState(DEFAULT_SELF.rankLabel)
  const [name, setName] = useState(DEFAULT_SELF.name)
  const [destination, setDestination] = useState('')
  const [dateRange, setDateRange] = useState('')

  const [imagePaths, setImagePaths] = useState<ProofMediaFile[]>([])
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set())
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [pickBusy, setPickBusy] = useState(false)
  const [analyzeBusy, setAnalyzeBusy] = useState(false)
  const [pdfMsg, setPdfMsg] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)

  const analyzeGenRef = useRef(0)
  const lastAnalyzedKeyRef = useRef('')

  const selectedFiles = useMemo(
    () => imagePaths.filter((f) => selectedPaths.has(f.fullPath)),
    [imagePaths, selectedPaths],
  )

  const tripSetters = useMemo(
    () => ({ setDept, setRankLabel, setName, setDestination, setDateRange }),
    [],
  )

  const runTripAnalyze = useCallback(
    async (paths: string[], forceOverwrite: boolean) => {
      if (!desktop || paths.length === 0) return
      const gen = ++analyzeGenRef.current
      setAnalyzeBusy(true)
      setStatusMsg(null)
      try {
        const r = await geminiAnalyzeTripImages({ imagePaths: paths })
        if (gen !== analyzeGenRef.current) return
        if (!r.ok) {
          setStatusMsg(r.message || '출장 증빙 분석에 실패했습니다.')
          return
        }
        applyGeminiTrip(r, tripSetters, forceOverwrite, {
          dept,
          rankLabel,
          name,
          destination,
          dateRange,
        })
        if (r.message || r.note) setStatusMsg(r.message || r.note || null)
      } catch (e) {
        if (gen === analyzeGenRef.current) {
          setStatusMsg(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (gen === analyzeGenRef.current) setAnalyzeBusy(false)
      }
    },
    [desktop, tripSetters, dept, rankLabel, name, destination, dateRange],
  )

  const handlePickFiles = useCallback(async () => {
    if (webMode) {
      fileInputRef.current?.click()
      return
    }
    if (!desktop) return
    setPickBusy(true)
    setLoadErr(null)
    try {
      const picked = await pickProofFiles()
      if (picked.length === 0) return
      const resolved = await resolveProofFiles(picked)
      if (resolved.pdfErrors?.length) {
        setStatusMsg(
          `PDF 변환 실패: ${resolved.pdfErrors.map((e) => `${e.pdf} (${e.message})`).join(' · ')}`,
        )
      }
      const merged = new Map(imagePaths.map((f) => [f.fullPath, f]))
      for (const f of resolved.files) merged.set(f.fullPath, f)
      const next = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      setImagePaths(next)
      setSelectedPaths((prev) => {
        const n = new Set(prev)
        for (const f of resolved.files) n.add(f.fullPath)
        return n
      })
      lastAnalyzedKeyRef.current = ''
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e))
    } finally {
      setPickBusy(false)
    }
  }, [desktop, webMode, imagePaths])

  const ingestWebFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList?.length) return
    setPickBusy(true)
    setLoadErr(null)
    try {
      const added: ProofMediaFile[] = []
      const nextData = new Map(webImageData)
      for (const file of Array.from(fileList)) {
        const low = file.name.toLowerCase()
        if (!/\.(png|jpe?g|gif|webp|bmp)$/i.test(low)) {
          if (low.endsWith('.pdf')) setStatusMsg('모바일 웹에서는 PDF 대신 사진을 선택해 주세요.')
          continue
        }
        const id = `web-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result ?? ''))
          r.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'))
          r.readAsDataURL(file)
        })
        nextData.set(id, dataUrl)
        added.push({ name: file.name, fullPath: id })
      }
      if (added.length === 0) return
      setWebImageData(nextData)
      const merged = new Map(imagePaths.map((f) => [f.fullPath, f]))
      for (const f of added) merged.set(f.fullPath, f)
      setImagePaths([...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko')))
      setSelectedPaths((prev) => {
        const n = new Set(prev)
        for (const f of added) n.add(f.fullPath)
        return n
      })
      lastAnalyzedKeyRef.current = ''
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e))
    } finally {
      setPickBusy(false)
    }
  }, [imagePaths, webImageData])

  useEffect(() => {
    if (!canRun || webMode || selectedFiles.length === 0) return
    const paths = selectedFiles.map((f) => f.fullPath).sort()
    const key = paths.join('|')
    if (key === lastAnalyzedKeyRef.current) return
    const timer = setTimeout(() => {
      lastAnalyzedKeyRef.current = key
      void runTripAnalyze(paths, false)
    }, 800)
    return () => clearTimeout(timer)
  }, [canRun, webMode, selectedFiles, runTripAnalyze])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!canRun || selectedFiles.length === 0) {
        setImageDataUrls([])
        return
      }
      if (webMode) {
        const urls = selectedFiles.map((f) => webImageData.get(f.fullPath)).filter(Boolean) as string[]
        if (!cancelled) setImageDataUrls(urls)
        return
      }
      if (!desktop) return
      const urls: string[] = []
      try {
        for (const f of selectedFiles) {
          if (cancelled) return
          urls.push(await readPreparedProofImage(f.fullPath))
        }
        if (!cancelled) setImageDataUrls(urls)
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canRun, desktop, webMode, selectedFiles, webImageData])

  const previewHtml = useMemo(
    () =>
      buildTripProofHtml({
        dept,
        rankLabel,
        name,
        destination,
        dateRange,
        imageSrcs: imageDataUrls,
      }),
    [dept, rankLabel, name, destination, dateRange, imageDataUrls],
  )

  async function handlePdf() {
    if (!dept.trim() || !rankLabel.trim() || !name.trim()) {
      window.alert('소속·직급·성명을 입력해 주세요.')
      return
    }
    if (!destination.trim() || !dateRange.trim()) {
      window.alert('출장지·출장일자를 입력해 주세요.')
      return
    }
    if (selectedFiles.length === 0) {
      window.alert('증빙 파일을 하나 이상 선택해 주세요.')
      return
    }
    const safeName = `출장증빙_${name.replace(/[/\\:*?"<>|]/g, '_')}.pdf`
    if (webMode) {
      const html = buildTripProofHtml({
        dept,
        rankLabel,
        name,
        destination,
        dateRange,
        imageSrcs: imageDataUrls,
      })
      downloadTextFile(safeName.replace(/\.pdf$/i, '.html'), html, 'text/html;charset=utf-8')
      setPdfMsg('HTML 파일을 저장했습니다. 브라우저에서 열어 인쇄→PDF로 저장할 수 있습니다.')
      return
    }
    if (!desktop) {
      window.alert('PDF 저장은 데스크톱 앱에서만 사용할 수 있습니다.')
      return
    }
    setPdfBusy(true)
    setPdfMsg(null)
    try {
      const r = await exportTripProofPdf({
        dept,
        rankLabel,
        name,
        destination,
        dateRange,
        imagePaths: selectedFiles.map((f) => f.fullPath),
        fileName: safeName,
      })
      if (r.canceled) setPdfMsg('저장이 취소되었습니다.')
      else if (r.ok && r.filePath) setPdfMsg(`저장했습니다:\n${r.filePath}`)
      else setPdfMsg('저장에 실패했습니다.')
    } catch (e) {
      setPdfMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setPdfBusy(false)
    }
  }

  if (!canRun) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
        출장 증빙은 <strong>Electron 데스크톱 앱</strong>에서만 동작합니다.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {webMode ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void ingestWebFiles(e.target.files)
            e.target.value = ''
          }}
        />
      ) : null}
      <Card code="6-2" title="출장 증빙">
        <div className="space-y-6">
          <ProofFileList
            files={imagePaths}
            selectedPaths={selectedPaths}
            onToggle={(fullPath) => {
              setSelectedPaths((prev) => {
                const next = new Set(prev)
                if (next.has(fullPath)) next.delete(fullPath)
                else next.add(fullPath)
                return next
              })
              lastAnalyzedKeyRef.current = ''
            }}
            onSelectAll={() => {
              setSelectedPaths(new Set(imagePaths.map((f) => f.fullPath)))
              lastAnalyzedKeyRef.current = ''
            }}
            onClearAll={() => {
              setSelectedPaths(new Set())
              lastAnalyzedKeyRef.current = ''
            }}
            emptyLabel="출장 증빙 이미지·PDF를 선택해 주세요."
            pickLabel={webMode ? '사진·증빙 선택' : '증빙 파일 선택'}
            onPick={() => void handlePickFiles()}
            pickBusy={pickBusy || analyzeBusy}
          />

          {statusMsg ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              {statusMsg}
            </p>
          ) : null}
          {loadErr ? <p className="text-xs text-rose-700">{loadErr}</p> : null}

          <section className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">소속</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={dept}
                onChange={(e) => setDept(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">직급</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={rankLabel}
                onChange={(e) => setRankLabel(e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">성명</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">출장지 (시 단위)</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="예: 부산, 광주"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">출장일자</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                placeholder="예: 2026-01-15 ~ 2026-01-17"
              />
            </label>
          </section>

          {imageDataUrls.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">미리보기</h3>
              <div className="max-h-[480px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
                <iframe
                  title="미리보기"
                  className="h-[420px] w-full border-0"
                  srcDoc={previewHtml}
                  sandbox=""
                />
              </div>
            </section>
          ) : null}

          <button
            type="button"
            disabled={pdfBusy}
            onClick={() => void handlePdf()}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pdfBusy ? 'PDF 생성 중…' : webMode ? 'HTML 저장' : 'PDF 저장'}
          </button>
          {pdfMsg ? (
            <pre className="whitespace-pre-wrap rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-950">
              {pdfMsg}
            </pre>
          ) : null}
        </div>
      </Card>
    </div>
  )
}
