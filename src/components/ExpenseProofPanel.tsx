import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card } from './Ui'
import { buildExpenseProofHtml } from '../lib/expenseProofPdfHtml'
import { formatWonLine } from '../lib/koreanWon'
import {
  exportExpenseProofPdf,
  geminiAnalyzeReceiptFolder,
  geminiParseExpenseVoice,
  getGeminiStatus,
  isDesktopApp,
  listProofImages,
  type ProofMediaFile,
  openProofFolderInExplorer,
  parseReceiptFolder,
  readPreparedProofImage,
  saveGeminiApiKey,
} from '../lib/desktopBridge'
import { applyGeminiReceipt, applyGeminiVoice } from '../lib/geminiExpense'

type InputMode = 'voice' | 'type' | null
type OcrFieldKey = 'dateTime' | 'location' | 'amountLine' | 'merchantPhone'

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

type SpeechRecognitionInstance = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((ev: SpeechRecognitionResultEvent) => void) | null
  onerror: ((ev: SpeechRecognitionErrorLike) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionResultEvent = {
  results: { 0?: { 0?: { transcript?: string } } }
}
type SpeechRecognitionErrorLike = { error: string; message?: string }

function useSpeechRecognitionKo() {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listenOnce = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const AnyWin = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionInstance
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance
      }
      const SR = AnyWin.SpeechRecognition ?? AnyWin.webkitSpeechRecognition
      if (!SR) {
        reject(new Error('이 브라우저·환경에서는 음성 인식을 사용할 수 없습니다.'))
        return
      }
      const rec = new SR()
      rec.lang = 'ko-KR'
      rec.interimResults = false
      rec.maxAlternatives = 1
      rec.continuous = false
      setError(null)
      setListening(true)
      let settled = false
      const done = (text: string) => {
        if (settled) return
        settled = true
        setListening(false)
        try {
          rec.stop()
        } catch {
          /* noop */
        }
        resolve(text.trim())
      }
      const fail = (msg: string) => {
        if (settled) return
        settled = true
        setListening(false)
        try {
          rec.stop()
        } catch {
          /* noop */
        }
        reject(new Error(msg))
      }
      rec.onresult = (ev: SpeechRecognitionResultEvent) => {
        done(ev.results[0]?.[0]?.transcript ?? '')
      }
      rec.onerror = (ev: SpeechRecognitionErrorLike) => {
        setError(ev.error)
        fail(ev.message || ev.error || '음성 인식 오류')
      }
      rec.onend = () => {
        setListening(false)
        if (!settled) done('')
      }
      try {
        rec.start()
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e))
      }
    })
  }, [])

  /** Gemini용: 짧은 연속 인식 후 전체 문장 반환 */
  const listenDictation = useCallback((maxMs = 12000): Promise<string> => {
    return new Promise((resolve, reject) => {
      const AnyWin = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionInstance
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance
      }
      const SR = AnyWin.SpeechRecognition ?? AnyWin.webkitSpeechRecognition
      if (!SR) {
        reject(new Error('이 환경에서는 음성 인식을 사용할 수 없습니다.'))
        return
      }
      const rec = new SR()
      rec.lang = 'ko-KR'
      rec.interimResults = true
      rec.maxAlternatives = 1
      rec.continuous = true
      setError(null)
      setListening(true)
      const parts: string[] = []
      let settled = false
      const finish = (ok: boolean, payload: string) => {
        if (settled) return
        settled = true
        setListening(false)
        try {
          rec.stop()
        } catch {
          /* noop */
        }
        clearTimeout(timer)
        if (ok) resolve(payload.trim())
        else reject(new Error(payload || '음성 인식 오류'))
      }
      const timer = setTimeout(() => finish(true, parts.join(' ')), maxMs)
      rec.onresult = (ev: SpeechRecognitionResultEvent) => {
        parts.length = 0
        const list = ev.results as unknown as ArrayLike<{ 0?: { transcript?: string } }>
        for (let i = 0; i < list.length; i++) {
          const t = list[i]?.[0]?.transcript
          if (t) parts.push(t)
        }
      }
      rec.onerror = (ev: SpeechRecognitionErrorLike) => {
        setError(ev.error)
        finish(false, ev.message || ev.error)
      }
      rec.onend = () => {
        if (!settled) finish(true, parts.join(' '))
      }
      try {
        rec.start()
      } catch (e) {
        finish(false, e instanceof Error ? e.message : String(e))
      }
    })
  }, [])

  return { listenOnce, listenDictation, listening, error }
}

function applyOcrFields(
  r: {
    dateTime: string
    location: string
    merchantName: string
    businessNo: string
    amount: number
    amountLine: string
    merchantPhone: string
  },
  setters: {
    setDateTime: (v: string) => void
    setLocation: (v: string) => void
    setAmount: (v: number) => void
    setAmountLine: (v: string) => void
    setMerchantPhone: (v: string) => void
  },
  userEdited: Set<OcrFieldKey>,
  forceOverwrite: boolean,
) {
  const mayFill = (key: OcrFieldKey) => forceOverwrite || !userEdited.has(key)

  const loc =
    r.location ||
    (r.merchantName && r.businessNo
      ? `${r.merchantName} (${r.businessNo})`
      : r.merchantName || r.businessNo)

  if (mayFill('dateTime') && r.dateTime) setters.setDateTime(r.dateTime)
  if (mayFill('location') && loc) setters.setLocation(loc)
  if (mayFill('amountLine') && r.amount > 0) {
    const line = r.amountLine || formatWonLine(r.amount)
    setters.setAmount(r.amount)
    setters.setAmountLine(line)
  }
  if (mayFill('merchantPhone') && r.merchantPhone) {
    setters.setMerchantPhone(r.merchantPhone)
  }
}

export function ExpenseProofPanel() {
  const desktop = isDesktopApp()
  const [inputMode, setInputMode] = useState<InputMode>(null)
  const [folderDate, setFolderDate] = useState(() => {
    const d = new Date()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
  })

  const [dateTime, setDateTime] = useState('')
  const [location, setLocation] = useState('')
  const [purpose, setPurpose] = useState('')
  const [attendees, setAttendees] = useState('')
  const [amount, setAmount] = useState(0)
  const [amountLine, setAmountLine] = useState('')
  const [merchantPhone, setMerchantPhone] = useState('')

  const [imagePaths, setImagePaths] = useState<ProofMediaFile[]>([])
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([])
  const [imageLoadErr, setImageLoadErr] = useState<string | null>(null)
  const [ocrNotice, setOcrNotice] = useState<string | null>(null)
  const [imageBusy, setImageBusy] = useState(false)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfMsg, setPdfMsg] = useState<string | null>(null)
  const [geminiConfigured, setGeminiConfigured] = useState(false)
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash')
  const [geminiBusy, setGeminiBusy] = useState(false)
  const [geminiKeyDraft, setGeminiKeyDraft] = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)

  const ocrGenRef = useRef(0)
  const userEditedRef = useRef<Set<OcrFieldKey>>(new Set())
  const lastFolderRef = useRef(folderDate)

  const speech = useSpeechRecognitionKo()

  useEffect(() => {
    if (!desktop) return
    void getGeminiStatus().then((s) => {
      if (!s) return
      setGeminiConfigured(s.configured)
      setGeminiModel(s.model)
    })
  }, [desktop])

  const markEdited = useCallback((key: OcrFieldKey) => {
    userEditedRef.current.add(key)
  }, [])

  const loadImagesOnly = useCallback(async () => {
    if (!desktop || !/^\d{4}-\d{2}-\d{2}$/.test(folderDate)) return []
    setImageBusy(true)
    setImageLoadErr(null)
    try {
      const list = await listProofImages(folderDate)
      setImagePaths(list.files)
      if (list.pdfErrors?.length) {
        setOcrNotice(
          `PDF 변환 실패: ${list.pdfErrors.map((e) => `${e.pdf} (${e.message})`).join(' · ')}`,
        )
      } else if (list.pdfCount && list.pdfCount > 0) {
        setOcrNotice(
          `PDF ${list.pdfCount}개에서 영수증 이미지를 추출했습니다. (${list.files.length}장)`,
        )
      }
      return list.files
    } catch (e) {
      setImageLoadErr(e instanceof Error ? e.message : String(e))
      setImagePaths([])
      return []
    } finally {
      setImageBusy(false)
    }
  }, [desktop, folderDate])

  const runOcr = useCallback(
    async (forceOverwrite: boolean) => {
      if (!desktop || !/^\d{4}-\d{2}-\d{2}$/.test(folderDate)) return
      const gen = ++ocrGenRef.current
      setOcrBusy(true)
      try {
        const r = await parseReceiptFolder(folderDate)
        if (gen !== ocrGenRef.current) return

        applyOcrFields(
          r,
          { setDateTime, setLocation, setAmount, setAmountLine, setMerchantPhone },
          userEditedRef.current,
          forceOverwrite,
        )

        if (!r.ocrOk && r.ocrMessage) {
          setOcrNotice(r.ocrMessage)
        } else if (r.ocrMessage) {
          setOcrNotice(r.ocrMessage)
        } else if (!r.dateTime && !r.location && r.amount <= 0) {
          setOcrNotice(
            'OCR로 읽을 항목을 찾지 못했습니다. 승인금액·상호·사업자번호·일시를 직접 입력해 주세요.',
          )
        } else {
          setOcrNotice(null)
        }
      } catch (e) {
        if (gen === ocrGenRef.current) {
          setOcrNotice(
            `OCR 처리 중 오류가 났습니다. 직접 입력해 주세요. (${e instanceof Error ? e.message : String(e)})`,
          )
        }
      } finally {
        if (gen === ocrGenRef.current) setOcrBusy(false)
      }
    },
    [desktop, folderDate],
  )

  const runGeminiReceipt = useCallback(
    async (forceOverwrite: boolean) => {
      if (!desktop || !/^\d{4}-\d{2}-\d{2}$/.test(folderDate)) return
      if (!geminiConfigured) {
        setOcrNotice('Gemini API 키를 설정해 주세요. (아래 안내 또는 프로젝트 .env)')
        return
      }
      setGeminiBusy(true)
      try {
        const r = await geminiAnalyzeReceiptFolder(folderDate)
        if (!r.ok) {
          setOcrNotice(r.message || 'Gemini 영수증 분석에 실패했습니다.')
          return
        }
        applyGeminiReceipt(
          r,
          { setDateTime, setLocation, setAmount, setAmountLine, setMerchantPhone },
          forceOverwrite,
          userEditedRef.current,
        )
        setOcrNotice(r.message || 'Gemini로 영수증을 분석했습니다. 내용을 확인해 주세요.')
      } catch (e) {
        setOcrNotice(e instanceof Error ? e.message : String(e))
      } finally {
        setGeminiBusy(false)
      }
    },
    [desktop, folderDate, geminiConfigured],
  )

  const runReceiptAnalyze = useCallback(
    async (forceOverwrite: boolean, preferGemini: boolean) => {
      if (preferGemini && geminiConfigured) {
        await runGeminiReceipt(forceOverwrite)
        return
      }
      if (preferGemini && !geminiConfigured) {
        setOcrNotice('Gemini API 키가 없어 OCR로 분석합니다. 키 설정 시 영수증 인식이 더 정확합니다.')
      }
      await runOcr(forceOverwrite)
    },
    [geminiConfigured, runGeminiReceipt, runOcr],
  )

  /** 날짜 변경 시: 이미지/PDF 로드 후 Gemini(설정 시) 또는 OCR 자동 분석 */
  useEffect(() => {
    if (!desktop) return
    if (lastFolderRef.current !== folderDate) {
      lastFolderRef.current = folderDate
      userEditedRef.current = new Set()
    }
    let cancelled = false
    void (async () => {
      const files = await loadImagesOnly()
      if (cancelled || files.length === 0) return
      const status = await getGeminiStatus()
      const useGemini = Boolean(status?.configured)
      if (!cancelled) setGeminiConfigured(useGemini)
      await runReceiptAnalyze(false, useGemini)
    })()
    return () => {
      cancelled = true
      ocrGenRef.current++
    }
  }, [desktop, folderDate, loadImagesOnly, runReceiptAnalyze])

  const reloadImagesAndAnalyze = useCallback(async () => {
    userEditedRef.current = new Set()
    const files = await loadImagesOnly()
    if (files.length > 0) {
      const status = await getGeminiStatus()
      const useGemini = Boolean(status?.configured)
      setGeminiConfigured(useGemini)
      await runReceiptAnalyze(true, useGemini)
    } else {
      setOcrNotice(null)
    }
  }, [loadImagesOnly, runReceiptAnalyze])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!desktop || imagePaths.length === 0) {
        setImageDataUrls([])
        return
      }
      const urls: string[] = []
      try {
        for (const f of imagePaths) {
          if (cancelled) return
          urls.push(await readPreparedProofImage(f.fullPath))
        }
        if (!cancelled) setImageDataUrls(urls)
      } catch (e) {
        if (!cancelled) {
          setImageLoadErr(e instanceof Error ? e.message : String(e))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [desktop, imagePaths])

  const previewSource = useDebounced(
    { dateTime, location, purpose, attendees, amountLine, amount, merchantPhone },
    600,
  )

  const previewHtml = useMemo(
    () =>
      buildExpenseProofHtml({
        ...previewSource,
        imageSrcs: imageDataUrls,
      }),
    [previewSource, imageDataUrls],
  )

  const runVoiceSequence = useCallback(async () => {
    if (inputMode !== 'voice') return
    try {
      window.alert('목적을 말씀해 주세요.')
      const p = await speech.listenOnce()
      if (p) setPurpose(p)
      window.alert('참석자를 말씀해 주세요. (예: 조용운(60031), 김성경(23015) …)')
      const a = await speech.listenOnce()
      if (a) setAttendees(a)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }, [inputMode, speech])

  const runGeminiVoice = useCallback(async () => {
    if (!geminiConfigured) {
      window.alert('Gemini API 키를 먼저 설정해 주세요.')
      return
    }
    setGeminiBusy(true)
    try {
      window.alert(
        '목적·참석자·금액 등을 한 번에 말씀해 주세요. (약 12초간 인식 후 자동 종료)\n예: 업무협의 식대, 참석자 조용운 60031, 금액 12만 9천6백원',
      )
      const text = await speech.listenDictation(12000)
      if (!text.trim()) {
        window.alert('인식된 내용이 없습니다.')
        return
      }
      const r = await geminiParseExpenseVoice(text)
      if (!r.ok) {
        window.alert(r.message || 'Gemini 음성 정리에 실패했습니다.')
        return
      }
      applyGeminiVoice(r, {
        setPurpose,
        setAttendees,
        setDateTime,
        setLocation,
        setAmount,
        setAmountLine,
      })
      if (r.note) setOcrNotice(r.note)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    } finally {
      setGeminiBusy(false)
    }
  }, [geminiConfigured, speech])

  async function handleSaveGeminiKey() {
    try {
      const r = await saveGeminiApiKey(geminiKeyDraft.trim())
      if (r.ok) {
        setGeminiConfigured(Boolean(r.configured))
        setGeminiKeyDraft('')
        setShowGeminiKey(false)
        setOcrNotice(r.configured ? 'Gemini API 키를 저장했습니다.' : 'Gemini API 키를 삭제했습니다.')
      } else if (r.message) {
        setOcrNotice(r.message)
      }
    } catch (e) {
      setOcrNotice(e instanceof Error ? e.message : String(e))
    }
  }

  function handleAmountLineChange(value: string) {
    markEdited('amountLine')
    setAmountLine(value)
    const won = value.match(/₩\s*([\d,]+)/)
    if (won) {
      setAmount(Number(won[1].replace(/,/g, '')))
      return
    }
    const digits = value.replace(/[^\d]/g, '')
    if (digits.length >= 1) setAmount(Number(digits))
    else setAmount(0)
  }

  function resolveFinalAmount(): number {
    if (amount > 0) return amount
    const fromLine = Number(amountLine.replace(/[^\d]/g, ''))
    return Number.isFinite(fromLine) ? fromLine : 0
  }

  async function handlePdf() {
    if (!desktop) {
      window.alert('PDF 저장은 데스크톱 앱에서만 사용할 수 있습니다.')
      return
    }
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
    if (!attendees.trim()) {
      window.alert('참석자를 입력해 주세요.')
      return
    }
    if (finalAmount <= 0) {
      window.alert('사용금액(승인금액)을 입력해 주세요. 예: 129600')
      return
    }
    if (imagePaths.length === 0) {
      window.alert('영수증 이미지가 없습니다. 증빙폴더에 넣은 뒤 다시 불러오기를 눌러 주세요.')
      return
    }
    setPdfBusy(true)
    setPdfMsg(null)
    try {
      const line = amountLine.trim() || formatWonLine(finalAmount)
      const r = await exportExpenseProofPdf({
        dateFolder: folderDate,
        dateTime: dateTime.trim(),
        location: location.trim(),
        purpose: purpose.trim(),
        attendees: attendees.trim(),
        amountLine: line,
        bankAmount: finalAmount.toLocaleString('ko-KR'),
        merchantPhone: merchantPhone.trim(),
        imagePaths: imagePaths.map((f) => f.fullPath),
        fileName: `지출증빙_업무추진비_${folderDate}.pdf`,
      })
      if (r.ok && r.filePath) setPdfMsg(`저장했습니다:\n${r.filePath}`)
      else setPdfMsg('저장에 실패했습니다.')
    } catch (e) {
      setPdfMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setPdfBusy(false)
    }
  }

  if (!desktop) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
        지출증빙·영수증 연동은 <strong>Electron 데스크톱 앱</strong>에서만 동작합니다.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card
        code="6-1"
        title="지급신청서 증빙 (업무추진비류 집행내역서)"
      >
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">영수증 날짜</span>
              <input
                type="date"
                className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={folderDate}
                onChange={(e) => setFolderDate(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="button"
                disabled={imageBusy}
                onClick={() => void reloadImagesAndAnalyze()}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
              >
                {imageBusy ? '불러오는 중…' : '이미지/PDF 다시 불러오기·분석'}
              </button>
              <button
                type="button"
                disabled={ocrBusy || imagePaths.length === 0}
                onClick={() => void runOcr(true)}
                className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-900 disabled:opacity-50"
              >
                {ocrBusy ? 'OCR 분석 중…' : 'OCR만 다시 실행 (입력 덮어씀)'}
              </button>
              <button
                type="button"
                disabled={geminiBusy || imagePaths.length === 0 || !geminiConfigured}
                onClick={() => void runGeminiReceipt(true)}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-50"
                title={geminiConfigured ? `모델: ${geminiModel}` : 'API 키 필요'}
              >
                {geminiBusy ? 'Gemini 분석 중…' : 'Gemini 영수증 분석'}
              </button>
              <button
                type="button"
                onClick={() => void openProofFolderInExplorer()}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
              >
                증빙폴더 열기
              </button>
            </div>
            <p className="text-xs text-slate-500 sm:col-span-2">
              증빙폴더에 이미지(png, jpg) 또는 PDF를 넣으세요. 불러오면{' '}
              {geminiConfigured
                ? `Gemini(${geminiModel})가 영수증 항목을 자동 채웁니다.`
                : 'OCR로 분석합니다. Gemini API 키를 설정하면 인식이 훨씬 정확합니다.'}
            </p>
            {!geminiConfigured || showGeminiKey ? (
              <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
                <label className="block min-w-[200px] flex-1 text-sm">
                  <span className="font-medium text-slate-700">Gemini API 키</span>
                  <input
                    type="password"
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={geminiKeyDraft}
                    onChange={(e) => setGeminiKeyDraft(e.target.value)}
                    placeholder="AIza…"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleSaveGeminiKey()}
                  className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white"
                >
                  키 저장
                </button>
                {geminiConfigured ? (
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(false)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  >
                    닫기
                  </button>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowGeminiKey(true)}
                className="text-left text-xs text-emerald-800 underline sm:col-span-2"
              >
                API 키 변경
              </button>
            )}
          </section>

          {ocrNotice ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              {ocrNotice}
            </p>
          ) : null}
          {imageLoadErr ? <p className="text-xs text-rose-700">{imageLoadErr}</p> : null}

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">입력 방식 (목적·참석자)</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setInputMode('voice')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  inputMode === 'voice'
                    ? 'border-violet-600 bg-violet-700 text-white'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                음성 입력
              </button>
              <button
                type="button"
                onClick={() => setInputMode('type')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  inputMode === 'type'
                    ? 'border-violet-600 bg-violet-700 text-white'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                직접 타이핑
              </button>
            </div>
            {inputMode === 'voice' ? (
              <div className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={speech.listening || geminiBusy}
                    onClick={() => void runVoiceSequence()}
                    className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {speech.listening ? '듣는 중…' : '목적 · 참석자 (단계별)'}
                  </button>
                  <button
                    type="button"
                    disabled={speech.listening || geminiBusy || !geminiConfigured}
                    onClick={() => void runGeminiVoice()}
                    className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {geminiBusy ? 'Gemini 처리 중…' : '한 번에 말하기 (Gemini)'}
                  </button>
                </div>
                <p className="text-xs text-violet-900/80">
                  단계별은 브라우저 음성 인식만 사용합니다. Gemini는 말한 내용을 목적·참석자·금액 등으로
                  정리합니다.
                </p>
              </div>
            ) : null}
          </section>

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
                placeholder="어코닉첨단점 (123-45-67890)"
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
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">4. 참석자</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={2}
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                placeholder="조용운(60031), 김성경(23015), …"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">5. 사용금액 (승인금액)</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={amountLine}
                onChange={(e) => handleAmountLineChange(e.target.value)}
                placeholder="129600 또는 일십이만 구천육백 원정(₩129,600)"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">7. 사용처 전화번호 (영수증 OCR)</span>
              <input
                type="text"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={merchantPhone}
                onChange={(e) => {
                  markEdited('merchantPhone')
                  setMerchantPhone(e.target.value)
                }}
                placeholder="062-123-4567 (인식 실패 시 비워 두세요)"
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
