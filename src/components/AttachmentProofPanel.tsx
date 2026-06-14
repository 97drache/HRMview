import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card } from './Ui'
import { ProofFileList } from './proof/ProofFileList'
import { buildAttachProofFullHtml } from '../lib/attachProofPdfHtml'
import { formatWonComma, parseWonAmount } from '../lib/koreanWon'
import {
  exportAttachProofPdf,
  geminiAnalyzeReceiptImages,
  isDesktopApp,
  pickProofFiles,
  readPreparedProofImage,
  resolveProofFiles,
  type ProofMediaFile,
} from '../lib/desktopBridge'
import { exportProofHtmlAsPdf } from '../lib/webProofExport'
import { applyGeminiReceipt } from '../lib/geminiExpense'

function pdfNameFromAmount(amount: number): string {
  const stamp = new Date().toISOString().slice(0, 10)
  return amount > 0 ? `증빙서붙임_${stamp}.pdf` : `증빙서붙임_${stamp}.pdf`
}

export function AttachmentProofPanel({ webMode = false }: { webMode?: boolean }) {
  const desktop = isDesktopApp()
  const canRun = desktop || webMode
  const receiptInputRef = useRef<HTMLInputElement>(null)
  const [webReceiptData, setWebReceiptData] = useState<Map<string, string>>(() => new Map())
  const [receiptFiles, setReceiptFiles] = useState<ProofMediaFile[]>([])
  const [receiptSelected, setReceiptSelected] = useState<Set<string>>(() => new Set())
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [extraFiles, setExtraFiles] = useState<ProofMediaFile[]>([])

  const [amount, setAmount] = useState(0)
  const [amountLine, setAmountLine] = useState('')
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [pickBusy, setPickBusy] = useState(false)
  const [analyzeBusy, setAnalyzeBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfMsg, setPdfMsg] = useState<string | null>(null)

  const analyzeGenRef = useRef(0)

  const receiptPick = useMemo(
    () => receiptFiles.filter((f) => receiptSelected.has(f.fullPath)),
    [receiptFiles, receiptSelected],
  )

  const primaryReceipt = receiptPick[0] ?? null

  const receiptSetters = useMemo(
    () => ({
      setDateTime: () => {},
      setLocation: () => {},
      setAmount,
      setAmountLine,
      setMerchantPhone: () => {},
    }),
    [],
  )

  const runReceiptAnalyze = useCallback(
    async (paths: string[]) => {
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
        applyGeminiReceipt(r, receiptSetters, true, new Set())
        if (r.message) setStatusMsg(r.message)
        if (primaryReceipt) {
          try {
            setReceiptPreview(await readPreparedProofImage(primaryReceipt.fullPath))
          } catch {
            /* preview skip */
          }
        }
      } catch (e) {
        if (gen === analyzeGenRef.current) {
          setStatusMsg(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (gen === analyzeGenRef.current) setAnalyzeBusy(false)
      }
    },
    [desktop, primaryReceipt, receiptSetters],
  )

  const ingestWebReceipt = useCallback(async (fileList: FileList | null) => {
    if (!fileList?.length) return
    setPickBusy(true)
    setStatusMsg(null)
    try {
      const file = Array.from(fileList).find((f) => /\.(png|jpe?g|gif|webp|bmp)$/i.test(f.name))
      if (!file) {
        setStatusMsg('모바일 웹에서는 사진(JPG·PNG)을 선택해 주세요.')
        return
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result ?? ''))
        r.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'))
        r.readAsDataURL(file)
      })
      const id = `web-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      setWebReceiptData(new Map([[id, dataUrl]]))
      setReceiptFiles([{ name: file.name, fullPath: id }])
      setReceiptSelected(new Set([id]))
      setReceiptPreview(dataUrl)
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setPickBusy(false)
    }
  }, [])

  const handlePickReceipt = useCallback(async () => {
    if (webMode) {
      receiptInputRef.current?.click()
      return
    }
    if (!desktop) return
    setPickBusy(true)
    try {
      const picked = await pickProofFiles()
      if (picked.length === 0) return
      const resolved = await resolveProofFiles(picked)
      if (resolved.pdfErrors?.length) {
        setStatusMsg(
          `PDF 변환 실패: ${resolved.pdfErrors.map((e) => `${e.pdf} (${e.message})`).join(' · ')}`,
        )
      }
      setReceiptFiles(resolved.files)
      setReceiptSelected(new Set(resolved.files.map((f) => f.fullPath)))
      void runReceiptAnalyze(resolved.files.map((f) => f.fullPath))
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setPickBusy(false)
    }
  }, [desktop, webMode, runReceiptAnalyze])

  const handlePickExtra = useCallback(async () => {
    if (webMode) {
      setStatusMsg('추가 첨부(2페이지~)는 데스크톱 HRM 앱에서만 지원합니다.')
      return
    }
    if (!desktop) return
    setPickBusy(true)
    try {
      const picked = await pickProofFiles()
      if (picked.length === 0) return
      const merged = new Map(extraFiles.map((f) => [f.fullPath, f]))
      for (const p of picked) {
        const abs = p
        const name = abs.split(/[/\\]/).pop() || abs
        merged.set(abs, { name, fullPath: abs })
      }
      setExtraFiles([...merged.values()])
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setPickBusy(false)
    }
  }, [desktop, webMode, extraFiles])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!primaryReceipt) {
        setReceiptPreview(null)
        return
      }
      if (webMode) {
        const url = webReceiptData.get(primaryReceipt.fullPath)
        if (!cancelled) setReceiptPreview(url ?? null)
        return
      }
      try {
        const url = await readPreparedProofImage(primaryReceipt.fullPath)
        if (!cancelled) setReceiptPreview(url)
      } catch {
        if (!cancelled) setReceiptPreview(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [primaryReceipt?.fullPath, webMode, webReceiptData])

  const previewHtml = useMemo(() => {
    if (!receiptPreview) return ''
    return buildAttachProofFullHtml({
      amount,
      bankAmount: amount > 0 ? amount.toLocaleString('ko-KR') : '',
      receiptSrc: receiptPreview,
      extraPageSrcs: [],
    })
  }, [receiptPreview, amount])

  function resolveFinalAmount(): number {
    if (amount > 0) return amount
    return parseWonAmount(amountLine)
  }

  async function handlePdf() {
    const finalAmount = resolveFinalAmount()
    if (!primaryReceipt || !receiptPreview) {
      window.alert('영수증 파일을 선택해 주세요.')
      return
    }
    if (finalAmount <= 0) {
      window.alert('영수증 금액을 확인해 주세요.')
      return
    }

    if (webMode) {
      const html = buildAttachProofFullHtml({
        amount: finalAmount,
        bankAmount: finalAmount.toLocaleString('ko-KR'),
        receiptSrc: receiptPreview,
        extraPageSrcs: [],
      })
      setPdfMsg(exportProofHtmlAsPdf(html, pdfNameFromAmount(finalAmount)))
      return
    }

    setPdfBusy(true)
    setPdfMsg(null)
    try {
      const r = await exportAttachProofPdf({
        receiptPath: primaryReceipt.fullPath,
        receiptDataUrl: receiptPreview || undefined,
        extraPaths: extraFiles.map((f) => f.fullPath),
        amount: finalAmount,
        bankAmount: finalAmount.toLocaleString('ko-KR'),
        fileName: pdfNameFromAmount(finalAmount),
      })
      if (r.canceled) return
      if (!r.ok) {
        setPdfMsg(r.message || 'PDF 저장에 실패했습니다.')
        return
      }
      setPdfMsg(r.filePath ? `저장됨: ${r.filePath}` : 'PDF가 저장되었습니다.')
    } catch (e) {
      setPdfMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setPdfBusy(false)
    }
  }

  if (!canRun) {
    return (
      <Card code="6-2" title="증빙서붙임">
        <p className="text-sm text-slate-600">증빙서 붙임란 PDF는 데스크톱 HRM 앱에서만 생성할 수 있습니다.</p>
      </Card>
    )
  }

  return (
    <Card
      code="6-2"
      title="증빙서붙임"
      actions={
        <button
          type="button"
          disabled={pdfBusy || !primaryReceipt}
          onClick={() => void handlePdf()}
          className="rounded-lg bg-teal-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pdfBusy ? 'PDF 생성 중…' : 'PDF 저장'}
        </button>
      }
    >
      {webMode ? (
        <input
          ref={receiptInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void ingestWebReceipt(e.target.files)
            e.target.value = ''
          }}
        />
      ) : null}
      <p className="mb-4 text-sm text-slate-600">
        1페이지: 증빙서 붙임란 양식에 영수증(적당한 크기·크롭)과 금액
        {webMode ? ' · 모바일에서는 1페이지만 PDF로 저장할 수 있습니다.' : ' · 2페이지부터: 추가 파일을 서식 없이 PDF 페이지로 그대로 이어 붙입니다.'}
      </p>

      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">영수증 (1페이지)</h3>
          <ProofFileList
            files={receiptFiles}
            selectedPaths={receiptSelected}
            onToggle={(p) => {
              setReceiptSelected((prev) => {
                const n = new Set(prev)
                if (n.has(p)) n.delete(p)
                else n.add(p)
                return n
              })
            }}
            onSelectAll={() => setReceiptSelected(new Set(receiptFiles.map((f) => f.fullPath)))}
            onClearAll={() => setReceiptSelected(new Set())}
            emptyLabel="영수증 이미지·PDF를 선택하세요."
            pickLabel={webMode ? '사진·영수증 선택' : '영수증 선택'}
            onPick={() => void handlePickReceipt()}
            pickBusy={pickBusy}
          />
          {analyzeBusy ? <p className="mt-2 text-xs text-slate-500">영수증 분석 중…</p> : null}
        </section>

        {!webMode ? (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">추가 첨부 (2페이지~)</h3>
            <div className="mb-2">
              <button
                type="button"
                disabled={pickBusy}
                onClick={() => void handlePickExtra()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                {pickBusy ? '불러오는 중…' : '추가 파일 선택'}
              </button>
              <span className="ml-2 text-xs text-slate-500">이미지·PDF · 선택 순서대로 붙입니다</span>
            </div>
            {extraFiles.length === 0 ? (
              <p className="text-sm text-slate-500">추가 첨부 없음 (선택 사항)</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {extraFiles.map((f, i) => (
                  <li
                    key={f.fullPath}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="mr-2 font-mono text-[10px] text-slate-400">{i + 1}.</span>
                      {f.name}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-red-700 hover:underline"
                      onClick={() => setExtraFiles((prev) => prev.filter((x) => x.fullPath !== f.fullPath))}
                    >
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">금액 (하단 표시)</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={amountLine || (amount > 0 ? formatWonComma(amount) : '')}
              onChange={(e) => {
                setAmountLine(e.target.value)
                const p = parseWonAmount(e.target.value)
                setAmount(p > 0 ? p : 0)
              }}
              placeholder={webMode ? '금액을 입력해 주세요' : '영수증 분석 후 자동 입력'}
            />
          </label>
        </section>
      </div>

      {statusMsg ? <p className="mt-3 text-sm text-amber-900">{statusMsg}</p> : null}
      {pdfMsg ? <p className="mt-2 text-sm text-teal-900">{pdfMsg}</p> : null}

      {previewHtml && receiptPreview ? (
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">1페이지 미리보기</p>
          <iframe
            title="증빙서 붙임란 미리보기"
            className="h-[min(720px,75vh)] w-full rounded-lg border border-slate-200 bg-white"
            sandbox="allow-same-origin"
            srcDoc={previewHtml}
          />
        </div>
      ) : null}
    </Card>
  )
}
