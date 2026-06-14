import { useCallback, useEffect, useState } from 'react'
import {
  getGeminiStatus,
  gistRegOpenFolder,
  gistRegStatus,
  isDesktopApp,
  lawGetBody,
  lawOpenExternal,
  lawRecentChanges,
  lawRegCompare,
  lawResolveMajor,
  lawSearch,
  lawStatus,
} from '../lib/desktopBridge'
import {
  HR_LAW_TOPIC_PRESETS,
  HR_MAJOR_LAW_NAMES,
  LAW_SOURCE_LABEL,
  type HrLawTopicPreset,
  type LawJoChangeItem,
  type LawListItem,
  type RegCompareRow,
} from '../lib/hrLawConfig'
import type { NavKey } from '../navConfig'
import { Card, SimpleTable } from './Ui'

type HrLawPanelProps = {
  active: Extract<NavKey, 'law-7-1' | 'law-7-2' | 'law-7-3' | 'law-7-4'>
}

function complianceBadgeClass(compliance: string): string {
  if (compliance === '준수') return 'bg-emerald-50 text-emerald-900 ring-emerald-200'
  if (compliance === '보완필요') return 'bg-amber-50 text-amber-950 ring-amber-200'
  if (compliance === '미반영') return 'bg-rose-50 text-rose-950 ring-rose-200'
  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

const LAW_PANEL_SHELL = 'flex w-full min-w-0 flex-col gap-5 pb-10'
const LAW_BODY_FRAME =
  'h-[min(720px,72vh)] w-full rounded-lg border border-slate-200 bg-white'

function findLawByName(laws: LawListItem[], lawName: string): LawListItem | undefined {
  const exact = laws.find((l) => l.name === lawName)
  if (exact) return exact
  return laws.find((l) => l.name.includes(lawName) || lawName.includes(l.name))
}

function formatRegDt(ymd: string): string {
  const s = String(ymd).replace(/\D/g, '')
  if (s.length !== 8) return ymd
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function parseJoParam(input: string): string {
  const raw = input.trim()
  if (!raw) return ''
  if (/^\d{6}$/.test(raw)) return raw
  const m = raw.match(/제?\s*(\d+)\s*조(?:의\s*(\d+))?/)
  if (!m) return ''
  const main = String(Number(m[1])).padStart(4, '0')
  const sub = m[2] ? String(Number(m[2])).padStart(2, '0') : '00'
  return main + sub
}

function LawSourceFooter() {
  return (
    <p className="mt-4 text-xs text-slate-500">
      출처: {LAW_SOURCE_LABEL} ·{' '}
      <button
        type="button"
        className="text-blue-700 underline"
        onClick={() => void lawOpenExternal('https://www.law.go.kr')}
      >
        www.law.go.kr
      </button>
    </p>
  )
}

function SetupNotice({ message }: { message?: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
      <p className="font-medium">OPEN API 인증(OC) 설정이 필요합니다.</p>
      <p className="mt-2">
        프로젝트 <code className="rounded bg-white/80 px-1">.env</code>에 발급받은 OC를 넣어 주세요.
      </p>
      <pre className="mt-2 overflow-x-auto rounded bg-white/80 p-2 text-xs">LAW_GO_KR_OC=신청한_OC값</pre>
      <p className="mt-2 text-xs">앱을 완전히 종료한 뒤 다시 실행하세요.</p>
      {message ? <p className="mt-2 text-red-800">{message}</p> : null}
    </div>
  )
}

function RecentChangesPanel() {
  const [days, setDays] = useState(365)
  const [busy, setBusy] = useState(false)
  const [items, setItems] = useState<LawJoChangeItem[]>([])
  const [range, setRange] = useState({ from: '', to: '' })
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy(true)
    setErr(null)
    try {
      const r = await lawRecentChanges({ days })
      if (!r.ok) {
        setErr(r.message || '조회 실패')
        setItems([])
        return
      }
      setItems(r.items || [])
      setRange({ from: r.fromRegDt || '', to: r.toRegDt || '' })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Card
      code="7-1"
      title="최근 근로·인사 법령 변경"
      desc="기본 1년(365일) 이내 개정을 표시합니다. 지정 법령의 본법·시행령·시행규칙 변경을 모두 집계합니다(시행령·규칙 개정이 잦은 항목을 포함)."
      actions={
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? '조회 중…' : '새로고침'}
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-slate-600">조회 기간(일)</span>
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={30}>30</option>
            <option value={60}>60</option>
            <option value={90}>90</option>
            <option value={180}>180</option>
            <option value={365}>365 (1년)</option>
          </select>
        </label>
        {range.from && range.to ? (
          <span className="text-slate-500">
            {formatRegDt(range.from)} ~ {formatRegDt(range.to)}
          </span>
        ) : null}
      </div>
      {err ? <p className="text-sm text-red-700">{err}</p> : null}
      {items.length === 0 && !busy && !err ? (
        <p className="text-sm text-slate-600">해당 기간에 표시할 인사·근로 관련 조문 개정이 없습니다.</p>
      ) : (
        <SimpleTable
          cols={[
            { key: 'regDt', label: '개정일', width: '7rem' },
            { key: 'lawName', label: '법령' },
            { key: 'jo', label: '조문' },
            { key: 'reason', label: '변경사유' },
          ]}
          rows={items.map((it) => ({
            regDt: formatRegDt(it.regDt),
            lawName: it.lawName,
            jo: it.joTitle || it.joNo,
            reason: it.reason || '—',
          }))}
        />
      )}
      <LawSourceFooter />
    </Card>
  )
}

function SearchPanel() {
  const [query, setQuery] = useState('근로')
  const [busy, setBusy] = useState(false)
  const [laws, setLaws] = useState<LawListItem[]>([])
  const [total, setTotal] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<LawListItem | null>(null)
  const [bodyHtml, setBodyHtml] = useState<string | null>(null)
  const [joInput, setJoInput] = useState('')

  async function runSearch() {
    setBusy(true)
    setErr(null)
    setSelected(null)
    setBodyHtml(null)
    try {
      const r = await lawSearch({ query: query.trim(), display: 30 })
      if (!r.ok) {
        setErr(r.message || '검색 실패')
        setLaws([])
        return
      }
      setLaws(r.laws || [])
      setTotal(r.totalCnt || 0)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function openLaw(law: LawListItem, jo?: string) {
    setSelected(law)
    setBusy(true)
    setErr(null)
    try {
      const r = await lawGetBody({
        mst: law.mst || undefined,
        lawId: law.lawId || undefined,
        jo: jo || undefined,
      })
      if (!r.ok || r.format !== 'html' || !r.html) {
        setErr(r.message || '본문을 불러오지 못했습니다.')
        setBodyHtml(null)
        return
      }
      setBodyHtml(r.html)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card code="7-2" title="법령 검색">
      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
          placeholder="법령명·키워드 (예: 근로기준, 퇴직급여)"
        />
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          disabled={busy}
          onClick={() => void runSearch()}
        >
          검색
        </button>
      </div>
      {err ? <p className="mt-3 text-sm text-red-700">{err}</p> : null}
      <p className="mt-2 text-xs text-slate-500">검색 결과 {total}건 (표시 {laws.length}건)</p>
      <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 text-sm">
        {laws.map((law) => (
          <li key={`${law.mst}-${law.lawId}`}>
            <button
              type="button"
              className="w-full rounded px-2 py-1.5 text-left hover:bg-slate-100"
              onClick={() => void openLaw(law)}
            >
              <span className="font-medium">{law.name}</span>
              {law.efYd ? (
                <span className="ml-2 text-xs text-slate-500">시행 {formatRegDt(law.efYd)}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-slate-800">{selected.name}</span>
          <input
            className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="조번호 (예: 23)"
            value={joInput}
            onChange={(e) => setJoInput(e.target.value)}
          />
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
            onClick={() => void openLaw(selected, parseJoParam(joInput))}
          >
            조문 보기
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
            onClick={() => void openLaw(selected)}
          >
            전체 본문
          </button>
        </div>
      ) : null}
      {bodyHtml ? (
        <iframe
          title="법령 본문"
          className={`mt-3 ${LAW_BODY_FRAME}`}
          sandbox="allow-same-origin"
          srcDoc={bodyHtml}
        />
      ) : null}
      <LawSourceFooter />
    </Card>
  )
}

function MajorLawsPanel() {
  const [busy, setBusy] = useState(false)
  const [laws, setLaws] = useState<LawListItem[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [activeLaw, setActiveLaw] = useState<LawListItem | null>(null)
  const [bodyHtml, setBodyHtml] = useState<string | null>(null)
  const [joInput, setJoInput] = useState('')
  const [activeTopic, setActiveTopic] = useState<string | null>(null)

  const loadMajor = useCallback(async () => {
    setBusy(true)
    setErr(null)
    try {
      const r = await lawResolveMajor()
      if (!r.ok) {
        setErr(r.message || '주요 법령 연동 실패')
        return
      }
      setLaws(
        (r.laws || []).map((l) => ({
          name: l.name,
          lawId: l.lawId,
          mst: l.mst,
          efYd: l.efYd,
        })),
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void loadMajor()
  }, [loadMajor])

  async function openLaw(
    law: LawListItem,
    jo?: string,
    topicLabel?: string,
    joDisplay?: string,
  ) {
    if (!law.mst && !law.lawId) {
      setErr('법령 일련번호를 찾지 못했습니다. 새로고침 후 다시 시도하세요.')
      return
    }
    setActiveLaw(law)
    setActiveTopic(topicLabel ?? null)
    if (joDisplay) setJoInput(joDisplay)
    else if (jo) setJoInput('')
    else setJoInput('')
    setBusy(true)
    setErr(null)
    try {
      const r = await lawGetBody({
        mst: law.mst || undefined,
        lawId: law.lawId || undefined,
        jo: jo || undefined,
      })
      if (!r.ok || r.format !== 'html' || !r.html) {
        setErr(r.message || '본문 조회 실패')
        setBodyHtml(null)
        return
      }
      setBodyHtml(r.html)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function openTopicPreset(preset: HrLawTopicPreset) {
    const law = findLawByName(laws, preset.lawName)
    if (!law) {
      setErr(`「${preset.lawName}」 연동이 필요합니다. 목록 갱신 후 다시 시도하세요.`)
      return
    }
    await openLaw(law, preset.jo, preset.label, preset.joLabel)
  }

  return (
    <Card
      code="7-3"
      title="주요 법령·조문"
      actions={
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          disabled={busy}
          onClick={() => void loadMajor()}
        >
          {busy ? '연동 중…' : '목록 갱신'}
        </button>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        인사·근로 업무에 자주 쓰는 법령 {HR_MAJOR_LAW_NAMES.length}건입니다. 아래 키워드 또는 법령
        목록에서 조문을 바로 열 수 있습니다.
      </p>
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">인사 실무 키워드</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {HR_LAW_TOPIC_PRESETS.map((preset) => {
            const selected = activeTopic === preset.label
            return (
              <button
                key={preset.label}
                type="button"
                disabled={busy}
                title={`${preset.lawName} ${preset.joLabel}`}
                className={[
                  'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  selected
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50',
                ].join(' ')}
                onClick={() => void openTopicPreset(preset)}
              >
                <span className="font-medium">{preset.label}</span>
                <span
                  className={[
                    'mt-0.5 block text-xs',
                    selected ? 'text-white/75' : 'text-slate-500',
                  ].join(' ')}
                >
                  {preset.lawName} · {preset.joLabel}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {err ? <p className="mb-2 text-sm text-red-700">{err}</p> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(220px,300px)_1fr]">
        <ul className="max-h-[min(720px,72vh)] space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 text-sm">
          {laws.map((law) => (
            <li key={law.name}>
              <button
                type="button"
                className={`w-full rounded px-2 py-2 text-left ${
                  activeLaw?.name === law.name ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'
                }`}
                onClick={() => {
                  setActiveTopic(null)
                  void openLaw(law)
                }}
              >
                {law.name}
                {!law.mst ? <span className="mt-0.5 block text-xs opacity-70">연동 대기</span> : null}
              </button>
            </li>
          ))}
        </ul>
        <div className="min-w-0">
          {activeLaw ? (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{activeLaw.name}</span>
              {activeTopic ? (
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-900">
                  {activeTopic}
                </span>
              ) : null}
              <input
                className="w-32 rounded border border-slate-300 px-2 py-1"
                placeholder="조 (예: 제50조)"
                value={joInput}
                onChange={(e) => setJoInput(e.target.value)}
              />
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
                onClick={() => void openLaw(activeLaw, parseJoParam(joInput))}
              >
                해당 조문
              </button>
            </div>
          ) : null}
          {bodyHtml ? (
            <iframe
              title="주요 법령 본문"
              className={LAW_BODY_FRAME}
              sandbox="allow-same-origin"
              srcDoc={bodyHtml}
            />
          ) : (
            <p className="text-sm text-slate-500">왼쪽에서 법령을 선택하세요.</p>
          )}
        </div>
      </div>
      <LawSourceFooter />
    </Card>
  )
}

function RegComparePanel() {
  const [keyword, setKeyword] = useState('단축근로')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [rows, setRows] = useState<RegCompareRow[]>([])
  const [summary, setSummary] = useState('')
  const [regFolder, setRegFolder] = useState('')
  const [regFileCount, setRegFileCount] = useState(0)
  const [geminiOk, setGeminiOk] = useState<boolean | null>(null)
  const [lawSources, setLawSources] = useState<string[]>([])

  const loadRegStatus = useCallback(async () => {
    try {
      const s = await gistRegStatus()
      setRegFolder(s.folder)
      setRegFileCount(s.supportedCount)
    } catch {
      /* noop */
    }
  }, [])

  useEffect(() => {
    void loadRegStatus()
    void getGeminiStatus().then((g) => setGeminiOk(Boolean(g?.configured)))
  }, [loadRegStatus])

  async function runCompare() {
    const kw = keyword.trim()
    if (!kw) {
      setErr('키워드를 입력해 주세요.')
      return
    }
    setBusy(true)
    setErr(null)
    setRows([])
    setSummary('')
    try {
      const r = await lawRegCompare({ keyword: kw })
      if (!r.ok) {
        setErr(r.message || '비교 분석 실패')
        return
      }
      setRows(r.rows || [])
      setSummary(r.summary || '')
      setLawSources(r.lawSources || [])
      if (r.folder) setRegFolder(r.folder)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card code="7-4" title="GIST 규정 · 법령 비교">
      <p className="mb-3 text-sm text-slate-600">
        <code className="rounded bg-slate-100 px-1">data/gist-regulations</code> 폴더에 사내 규정(PDF·TXT·MD)을
        넣고, 키워드로 GIST 규정과 관련 법령을 Gemini가 비교합니다.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm">
        <span className="text-slate-700">
          규정 폴더: <span className="font-medium">{regFolder || '—'}</span>
          {regFileCount > 0 ? ` · ${regFileCount}개 파일` : ' · 파일 없음'}
        </span>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
          onClick={() => void gistRegOpenFolder()}
        >
          폴더 열기
        </button>
        {geminiOk === false ? (
          <span className="text-xs text-amber-800">Gemini API 키(.env) 설정 필요</span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void runCompare()}
          placeholder="키워드 (예: 단축근로, 보건휴가, 수유시간)"
        />
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          disabled={busy || geminiOk === false}
          onClick={() => void runCompare()}
        >
          {busy ? '분석 중…' : '비교 분석'}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {['단축근로', '보건휴가', '수유시간', '난임치료휴가'].map((kw) => (
          <button
            key={kw}
            type="button"
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
            onClick={() => setKeyword(kw)}
          >
            {kw}
          </button>
        ))}
      </div>
      {err ? <p className="mt-3 text-sm text-red-700">{err}</p> : null}
      {lawSources.length > 0 ? (
        <p className="mt-3 text-xs text-slate-500">참조 법령: {lawSources.join(', ')}</p>
      ) : null}
      {rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="w-[30%] px-3 py-3 text-left font-semibold text-slate-700">GIST 규정</th>
                <th className="w-[30%] px-3 py-3 text-left font-semibold text-slate-700">법령</th>
                <th className="w-[40%] px-3 py-3 text-left font-semibold text-slate-700">차이점</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-100 align-top odd:bg-white even:bg-slate-50/40">
                  <td className="px-3 py-3 text-left whitespace-pre-wrap text-slate-800">
                    {row.topic ? (
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{row.topic}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${complianceBadgeClass(row.compliance)}`}
                        >
                          {row.compliance}
                        </span>
                      </div>
                    ) : null}
                    {row.gistRegulation}
                  </td>
                  <td className="px-3 py-3 text-left whitespace-pre-wrap text-slate-800">{row.law}</td>
                  <td className="px-3 py-3 text-left whitespace-pre-wrap text-slate-800">{row.difference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {summary ? (
        <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/60 px-4 py-3 text-sm text-teal-950">
          <span className="font-semibold">요약</span>
          <p className="mt-1 whitespace-pre-wrap">{summary}</p>
        </div>
      ) : null}
      <LawSourceFooter />
    </Card>
  )
}

export function HrLawPanel({ active }: HrLawPanelProps) {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [statusErr, setStatusErr] = useState<string | null>(null)

  useEffect(() => {
    if (!isDesktopApp()) {
      setConfigured(false)
      return
    }
    void (async () => {
      try {
        const s = await lawStatus()
        setConfigured(s.configured)
        setStatusErr(null)
      } catch (e) {
        setConfigured(false)
        setStatusErr(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [active])

  if (!isDesktopApp()) {
    return (
      <div className="w-full rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
        인사법령 메뉴는 <strong>Electron 데스크톱 앱</strong>에서만 사용할 수 있습니다.
      </div>
    )
  }

  if (configured === false) {
    return (
      <div className={LAW_PANEL_SHELL}>
        <SetupNotice message={statusErr || undefined} />
      </div>
    )
  }

  if (configured === null) {
    return <div className="w-full py-10 text-center text-sm text-slate-500">연결 확인 중…</div>
  }

  return (
    <div className={LAW_PANEL_SHELL}>
      {active === 'law-7-1' ? <RecentChangesPanel /> : null}
      {active === 'law-7-2' ? <SearchPanel /> : null}
      {active === 'law-7-3' ? <MajorLawsPanel /> : null}
      {active === 'law-7-4' ? <RegComparePanel /> : null}
    </div>
  )
}
