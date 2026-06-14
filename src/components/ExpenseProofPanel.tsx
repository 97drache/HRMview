import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card } from './Ui'
import { ProofFileList } from './proof/ProofFileList'
import { buildExpenseProofHtml } from '../lib/expenseProofPdfHtml'
import {
  ALL_ATTENDEE_KEYS,
  EXPENSE_ATTENDEE_OPTIONS,
  combineAttendeesLine,
} from '../lib/expenseAttendees'
import { formatWonComma, parseWonAmount } from '../lib/koreanWon'
import {
  exportExpenseProofPdf,
  geminiAnalyzeReceiptImages,
  isDesktopApp,
  pickProofFiles,
  readPreparedProofImage,
  resolveProofFiles,
  type ProofMediaFile,
} from '../lib/desktopBridge'
import { exportProofHtmlAsPdf } from '../lib/webProofExport'
import { applyGeminiReceipt } from '../lib/geminiExpense'

const DEFAULT_PURPOSE = '업무협의'

type OcrFieldKey = 'dateTime' | 'location' | 'amountLine' | 'merchantPhone'

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

function pdfNameFromDateTime(dateTime: string): string {
  const d = dateTime.match(/(\d{4}-\d{2}-\d{2})/)?.[1]
  const stamp = d ?? new Date().toISOString().slice(0, 10)
  return `지출증빙_업무추진비_${stamp}.pdf`
}

export function ExpenseProofPanel({ webMode = false }: { webMode?: boolean }) {
  const desktop = isDesktopApp()
  const canRun = desktop || webMode
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [webImageData, setWebImageData] = useState<Map<string, string>>(() => new Map())
  const [dateTime, setDateTime] = useState('')
  const [location, setLocation] = useState('')
  const [purpose, setPurpose] = useState(DEFAULT_PURPOSE)
  const [amount, setAmount] = useState(0)
  const [amountLine, setAmountLine] = useState('')
  const [merchantPhone, setMerchantPhone] = useState('')
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(
    () => new Set(ALL_ATTENDEE_KEYS),
  )
  const [attendeesManual, setAttendeesManual] = useState('')

  const [imagePaths, setImagePaths] = useState<ProofMediaFile[]>([])
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set())
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([])
  const [imageLoadErr, setImageLoadErr] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [pickBusy, setPickBusy] = useState(false)
  const [analyzeBusy, setAnalyzeBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfMsg, setPdfMsg] = useState<string | null>(null)

  const analyzeGenRef = useRef(0)
  const lastAnalyzedKeyRef = useRef('')
  const userEditedRef = useRef<Set<OcrFieldKey>>(new Set())

  const attendeesLine = useMemo(
    () => combineAttendeesLine(selectedAttendees, attendeesManual),
    [selectedAttendees, attendeesManual],
  )

  const selectedFiles = useMemo(
    () => imagePaths.filter((f) => selectedPaths.has(f.fullPath)),
    [imagePaths, selectedPaths],
  )

  const markEdited = useCallback((key: OcrFieldKey) => {
    userEditedRef.current.add(key)
  }, [])

  const receiptSetters = useMemo(
    () => ({
      setDateTime,
      setLocation,
      setAmount,
      setAmountLine,
      setMerchantPhone,
    }),
    [],
  )

  const runReceiptAnalyze = useCallback(
    async (paths: string[], forceOverwrite: boolean) => {
      if (!desktop || paths.length === 0) return
      const gen = ++analyzeGenRef.current
      setAnalyzeBusy(true)
      setStatusMsg(null)
      try {
        const r = await geminiAnalyzeReceiptImages(paths)
        if (gen !== analyzeGenRef.current) return
        if (!r.ok) {
          setStatusMsg(r.message || '영수증 분석에 실패했습니다.')
          return
        }
        applyGeminiReceipt(r, receiptSetters, forceOverwrite, userEditedRef.current)
        setPurpose((p) => (p.trim() ? p : DEFAULT_PURPOSE))
        if (r.message) setStatusMsg(r.message)
        const urls: string[] = []
        for (const p of paths) {
          try {
            urls.push(await readPreparedProofImage(p))
          } catch {
            /* preview refresh skip */
          }
        }
        if (urls.length > 0) setImageDataUrls(urls)
      } catch (e) {
        if (gen === analyzeGenRef.current) {
          setStatusMsg(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (gen === analyzeGenRef.current) setAnalyzeBusy(false)
      }
    },
    [desktop, receiptSetters],
  )

  const handlePickFiles = useCallback(async () => {
    if (webMode) {
      fileInputRef.current?.click()
      return
    }
    if (!desktop) return
    setPickBusy(true)
    setImageLoadErr(null)
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
      setImageLoadErr(e instanceof Error ? e.message : String(e))
    } finally {
      setPickBusy(false)
    }
  }, [desktop, webMode, imagePaths])

  const ingestWebFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList?.length) return
    setPickBusy(true)
    setImageLoadErr(null)
    try {
      const added: ProofMediaFile[] = []
      const nextData = new Map(webImageData)
      for (const file of Array.from(fileList)) {
        const low = file.name.toLowerCase()
        if (!/\.(png|jpe?g|gif|webp|bmp|pdf)$/i.test(low)) continue
        if (low.endsWith('.pdf')) {
          setStatusMsg('모바일 웹에서는 PDF 대신 사진(JPG·PNG)을 선택해 주세요.')
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
      const next = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      setImagePaths(next)
      setSelectedPaths((prev) => {
        const n = new Set(prev)
        for (const f of added) n.add(f.fullPath)
        return n
      })
    } catch (e) {
      setImageLoadErr(e instanceof Error ? e.message : String(e))
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
      void runReceiptAnalyze(paths, false)
    }, 800)
    return () => clearTimeout(timer)
  }, [canRun, webMode, selectedFiles, runReceiptAnalyze])

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
        if (!cancelled) setImageLoadErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canRun, desktop, webMode, selectedFiles, webImageData])

  const previewSource = useDebounced(
    {
      dateTime,
      location,
      purpose,
      attendees: attendeesLine,
      amountLine,
      amount,
      merchantPhone,
    },
    600,
  )

  const previewHtml = useMemo(
    () => buildExpenseProofHtml({ ...previewSource, imageSrcs: imageDataUrls }),
    [previewSource, imageDataUrls],
  )

  function toggleAttendee(key: string) {
    setSelectedAttendees((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAllAttendees() {
    setSelectedAttendees(new Set(ALL_ATTENDEE_KEYS))
  }

  function handleAmountLineChange(value: string) {
    markEdited('amountLine')
    setAmountLine(value)
    const parsed = parseWonAmount(value)
    setAmount(parsed > 0 ? parsed : 0)
  }

  function resolveFinalAmount(): number {
    if (amount > 0) return amount
    return parseWonAmount(amountLine)
  }

  async function handlePdf() {
    const finalAmount = resolveFinalAmount()
    if (!dateTime.trim()) {
      window.alert('일시를 입력해 주세요.')
      return
    }
    if (!location.trim()) {
      window.alert('장소(상호)를 입력해 주세요.')
      return
    }
    if (!purpose.trim()) {
      window.alert('목적을 입력해 주세요.')
      return
    }
    if (!attendeesLine.trim()) {
      window.alert('참석자를 선택하거나 수기로 입력해 주세요.')
      return
    }
    if (finalAmount <= 0) {
      window.alert('사용금액(승인금액)을 입력해 주세요.')
      return
    }
    if (selectedFiles.length === 0) {
      window.alert('영수증 파일을 선택해 주세요.')
      return
    }
    if (webMode) {
      const line = amountLine.trim() || formatWonComma(finalAmount)
      const html = buildExpenseProofHtml({
        dateTime: dateTime.trim(),
        location: location.trim(),
        purpose: purpose.trim(),
        attendees: attendeesLine,
        amountLine: line,
        amount: finalAmount,
        merchantPhone: merchantPhone.trim(),
        imageSrcs: imageDataUrls,
      })
      setPdfMsg(exportProofHtmlAsPdf(html, pdfNameFromDateTime(dateTime)))
      return
    }
    if (!desktop) {
      window.alert('PDF 저장은 데스크톱 앱에서만 사용할 수 있습니다.')
      return
    }
    setPdfBusy(true)
    setPdfMsg(null)
    try {
      const line = amountLine.trim() || formatWonComma(finalAmount)
      const r = await exportExpenseProofPdf({
        dateTime: dateTime.trim(),
        location: location.trim(),
        purpose: purpose.trim(),
        attendees: attendeesLine,
        amountLine: line,
        bankAmount: finalAmount.toLocaleString('ko-KR'),
        merchantPhone: merchantPhone.trim(),
        imagePaths: selectedFiles.map((f) => f.fullPath),
        imageDataUrls:
          imageDataUrls.length === selectedFiles.length ? imageDataUrls : undefined,
        fileName: pdfNameFromDateTime(dateTime),
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
        지출증빙·영수증 연동은 <strong>Electron 데스크톱 앱</strong>에서만 동작합니다.
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
      <Card code="6-1" title="지급신청서 증빙 (업무추진비류 집행내역서)">
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
            emptyLabel="영수증 이미지·PDF를 선택해 주세요."
            pickLabel={webMode ? '사진·영수증 선택' : '영수증 파일 선택'}
            onPick={() => void handlePickFiles()}
            pickBusy={pickBusy || analyzeBusy}
          />

          {statusMsg ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              {statusMsg}
            </p>
          ) : null}
          {imageLoadErr ? <p className="text-xs text-rose-700">{imageLoadErr}</p> : null}

          <section className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">부서 (고정)</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                value="인사팀"
                readOnly
                tabIndex={-1}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">1. 일시</span>
              <input
                type="text"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={dateTime}
                onChange={(e) => {
                  markEdited('dateTime')
                  setDateTime(e.target.value)
                }}
                placeholder="2026-05-04 12:33:48"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">2. 장소 (상호·사업자번호)</span>
              <input
                type="text"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={location}
                onChange={(e) => {
                  markEdited('location')
                  setLocation(e.target.value)
                }}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">3. 목적</span>
              <input
                type="text"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </label>
            <div className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">4. 참석자</span>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllAttendees}
                  className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-900"
                >
                  전부 선택
                </button>
                {EXPENSE_ATTENDEE_OPTIONS.map((a) => {
                  const on = selectedAttendees.has(a.key)
                  return (
                    <label
                      key={a.key}
                      className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-medium ${
                        on
                          ? 'border-violet-600 bg-violet-700 text-white'
                          : 'border-slate-200 bg-white text-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() => toggleAttendee(a.key)}
                      />
                      {a.label}
                    </label>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-slate-600">PDF 반영: {attendeesLine || '—'}</p>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-slate-700">추가·수기 입력 (선택)</span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={2}
                  value={attendeesManual}
                  onChange={(e) => setAttendeesManual(e.target.value)}
                  placeholder="이름만 입력하거나, 이름(사번) 형식으로 추가할 수 있습니다."
                />
              </label>
            </div>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">5. 사용금액 (승인금액)</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={amountLine}
                onChange={(e) => handleAmountLineChange(e.target.value)}
                placeholder="129,600원"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">7. 사용처 전화번호</span>
              <input
                type="text"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={merchantPhone}
                onChange={(e) => {
                  markEdited('merchantPhone')
                  setMerchantPhone(e.target.value)
                }}
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
            {pdfBusy ? 'PDF 생성 중…' : 'PDF 저장'}
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
