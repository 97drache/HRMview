import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from './Ui'
import { buildTripProofHtml } from '../lib/tripProofPdfHtml'
import {
  exportTripProofPdf,
  geminiParseTripVoice,
  getGeminiStatus,
  isDesktopApp,
  listProofImages,
  openProofFolderInExplorer,
  readPreparedProofImage,
} from '../lib/desktopBridge'
import { applyGeminiTripVoice } from '../lib/geminiExpense'

const DEFAULT_SELF = { dept: '인사팀', rankLabel: '책임급', name: '조용운' }

type InputMode = 'voice' | 'type' | null
type SelfChoice = 'self' | 'other' | null

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
        rec.stop()
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
        const t = ev.results[0]?.[0]?.transcript ?? ''
        done(t)
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

export function TripProofPanel() {
  const desktop = isDesktopApp()
  const [selfChoice, setSelfChoice] = useState<SelfChoice>(null)
  const [inputMode, setInputMode] = useState<InputMode>(null)
  const [dept, setDept] = useState('')
  const [rankLabel, setRankLabel] = useState('')
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [dateRange, setDateRange] = useState('')
  /** PDF 저장 폴더명 (출장 시작일 등 yyyy-MM-dd) */
  const [folderDate, setFolderDate] = useState(() => {
    const d = new Date()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
  })

  const [imagePaths, setImagePaths] = useState<{ name: string; fullPath: string; sourcePdf?: string }[]>([])
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set())
  const [imageDataUrls, setImageDataUrls] = useState<string[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [pdfMsg, setPdfMsg] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [geminiConfigured, setGeminiConfigured] = useState(false)
  const [geminiBusy, setGeminiBusy] = useState(false)
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)

  const speech = useSpeechRecognitionKo()

  useEffect(() => {
    if (!desktop) return
    void getGeminiStatus().then((s) => {
      if (s) setGeminiConfigured(s.configured)
    })
  }, [desktop])

  const refreshImages = useCallback(async () => {
    if (!desktop) return
    setLoadErr(null)
    try {
      const list = await listProofImages(
        /^\d{4}-\d{2}-\d{2}$/.test(folderDate) ? folderDate : undefined,
      )
      setImagePaths(list.files)
      setSelectedPaths(new Set(list.files.map((f) => f.fullPath)))
      if (list.pdfErrors?.length) {
        setLoadErr(
          `PDF 변환 실패: ${list.pdfErrors.map((e) => `${e.pdf} (${e.message})`).join(' · ')}`,
        )
      } else if (list.pdfCount && list.pdfCount > 0) {
        setLoadErr(null)
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e))
      setImagePaths([])
      setSelectedPaths(new Set())
    }
  }, [desktop, folderDate])

  const selectedFiles = useMemo(
    () => imagePaths.filter((f) => selectedPaths.has(f.fullPath)),
    [imagePaths, selectedPaths],
  )

  const toggleImageSelection = useCallback((fullPath: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(fullPath)) next.delete(fullPath)
      else next.add(fullPath)
      return next
    })
  }, [])

  useEffect(() => {
    void refreshImages()
  }, [refreshImages])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!desktop || selectedFiles.length === 0) {
        setImageDataUrls([])
        return
      }
      const urls: string[] = []
      try {
        for (const f of selectedFiles) {
          if (cancelled) return
          const u = await readPreparedProofImage(f.fullPath)
          urls.push(u)
        }
        if (!cancelled) setImageDataUrls(urls)
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [desktop, selectedFiles])

  useEffect(() => {
    if (selfChoice === 'self') {
      setDept(DEFAULT_SELF.dept)
      setRankLabel(DEFAULT_SELF.rankLabel)
      setName(DEFAULT_SELF.name)
    } else if (selfChoice === 'other') {
      setDept('')
      setRankLabel('')
      setName('')
    }
  }, [selfChoice])

  const readyForForm = selfChoice !== null && inputMode !== null

  const runVoiceSequence = useCallback(async () => {
    if (inputMode !== 'voice') return
    if (geminiConfigured) {
      setGeminiBusy(true)
      setVoiceNotice(null)
      try {
        window.alert(
          '출장지와 기간을 한 번에 말씀해 주세요.\n(예: 부산 본청, 3월 15일부터 17일까지)',
        )
        const text = await speech.listenDictation(14000)
        if (!text.trim()) {
          setVoiceNotice('음성이 인식되지 않았습니다.')
          return
        }
        const r = await geminiParseTripVoice(text)
        if (!r.ok) {
          setVoiceNotice(r.message || 'Gemini 처리에 실패했습니다.')
          return
        }
        applyGeminiTripVoice(r, { setDestination, setDateRange })
        setVoiceNotice(r.message || '출장지·일자를 채웠습니다. 확인 후 수정해 주세요.')
      } catch (e) {
        setVoiceNotice(e instanceof Error ? e.message : String(e))
      } finally {
        setGeminiBusy(false)
      }
      return
    }
    try {
      window.alert('출장지를 말씀해 주세요. (Gemini 미설정 — 단계별 음성)')
      const d = await speech.listenOnce()
      if (d) setDestination(d)
      window.alert('출장 일자를 말씀해 주세요.')
      const dr = await speech.listenOnce()
      if (dr) setDateRange(dr)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e))
    }
  }, [inputMode, speech, geminiConfigured])

  const previewHtml = useMemo(() => {
    return buildTripProofHtml({
      dept,
      rankLabel,
      name,
      destination,
      dateRange,
      imageSrcs: imageDataUrls,
    })
  }, [dept, rankLabel, name, destination, dateRange, imageDataUrls])

  async function handlePdf() {
    if (!desktop) {
      window.alert('PDF 저장은 데스크톱 앱에서만 사용할 수 있습니다.')
      return
    }
    if (!dept.trim() || !rankLabel.trim() || !name.trim()) {
      window.alert('소속·직급·성명을 입력해 주세요.')
      return
    }
    if (!destination.trim() || !dateRange.trim()) {
      window.alert('출장지·출장일자를 입력해 주세요.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(folderDate)) {
      window.alert('폴더용 날짜는 yyyy-MM-dd 형식이어야 합니다.')
      return
    }
    if (selectedFiles.length === 0) {
      window.alert('PDF에 넣을 증빙 이미지를 하나 이상 선택해 주세요.')
      return
    }
    const safeName = `출장증빙_${name.replace(/[/\\:*?"<>|]/g, '_')}.pdf`
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
        dateFolder: folderDate,
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

  if (!desktop) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
        출장 증빙·바탕화면 증빙폴더 연동은 <strong>Electron 데스크톱 앱</strong>에서만 동작합니다.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card code="6-2" title="출장 증빙">
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">1. 본인 출장 여부</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelfChoice('self')
                  setInputMode(null)
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  selfChoice === 'self'
                    ? 'border-teal-600 bg-teal-700 text-white'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                본인 (조용운 · 인사팀 · 책임급)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelfChoice('other')
                  setInputMode(null)
                }}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  selfChoice === 'other'
                    ? 'border-teal-600 bg-teal-700 text-white'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                다른 분 (소속·직급·성명 직접 입력)
              </button>
            </div>
          </section>

          {selfChoice !== null ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">2. 입력 방식</h3>
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
                  음성으로 출장지·일자 입력
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
            </section>
          ) : null}

          {inputMode === 'voice' && selfChoice !== null ? (
            <section className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3">
              <p className="text-xs text-violet-900">
                {geminiConfigured
                  ? 'Gemini가 한 번에 말한 출장지·기간을 정리합니다. (API 키는 6-1과 동일)'
                  : 'Gemini API 키를 6-1 화면에서 설정하면 음성 정리가 더 편합니다.'}
              </p>
              <button
                type="button"
                disabled={speech.listening || geminiBusy}
                onClick={() => void runVoiceSequence()}
                className="mt-3 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-800 disabled:opacity-50"
              >
                {speech.listening || geminiBusy
                  ? '듣는 중…'
                  : geminiConfigured
                    ? '출장지·일자 한 번에 말하기 (Gemini)'
                    : '출장지 · 일자 음성 입력 시작'}
              </button>
              {speech.error ? <p className="mt-2 text-xs text-rose-700">{speech.error}</p> : null}
              {voiceNotice ? <p className="mt-2 text-xs text-violet-950">{voiceNotice}</p> : null}
            </section>
          ) : null}

          {readyForForm ? (
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
                <span className="font-medium text-slate-700">출장지</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder={inputMode === 'voice' ? '음성 인식 결과를 수정할 수 있습니다' : ''}
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
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-slate-700">PDF 저장 폴더 날짜 (바탕화면/증빙폴더/이 날짜/)</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={folderDate}
                  onChange={(e) => setFolderDate(e.target.value)}
                />
              </label>
            </section>
          ) : null}

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">증빙 이미지·PDF (증빙폴더)</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void refreshImages()}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                >
                  목록 새로고침
                </button>
                <button
                  type="button"
                  onClick={() => void openProofFolderInExplorer()}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                >
                  폴더 열기
                </button>
              </div>
            </div>
            {loadErr ? <p className="text-xs text-rose-700">{loadErr}</p> : null}
            {imagePaths.length === 0 ? (
              <p className="text-sm text-slate-500">
                이미지·PDF가 없습니다. 증빙폴더에 사진 또는 PDF를 넣은 뒤 새로고침 하세요.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPaths(new Set(imagePaths.map((f) => f.fullPath)))}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                  >
                    전체 선택
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaths(new Set())}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                  >
                    전체 해제
                  </button>
                  <span className="self-center text-xs text-slate-600">
                    선택 {selectedFiles.length} / {imagePaths.length}장
                  </span>
                </div>
                <ul className="mt-2 space-y-1">
                  {imagePaths.map((f) => {
                    const checked = selectedPaths.has(f.fullPath)
                    return (
                      <li key={f.fullPath}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleImageSelection(f.fullPath)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-mono text-[11px] text-slate-800">{f.name}</span>
                            {f.sourcePdf ? (
                              <span className="mt-0.5 block text-[10px] text-slate-500">
                                PDF: {f.sourcePdf}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </section>

          {readyForForm && imageDataUrls.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">미리보기</h3>
              <div className="max-h-[480px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
                <iframe
                  title="미리보기"
                  className="h-[420px] w-full border-0"
                  srcDoc={previewHtml}
                  sandbox="allow-same-origin"
                />
              </div>
            </section>
          ) : null}

          {readyForForm ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pdfBusy}
                onClick={() => void handlePdf()}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
              >
                {pdfBusy ? 'PDF 저장 중…' : 'PDF 저장 (증빙폴더/날짜 폴더)'}
              </button>
            </div>
          ) : null}
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
