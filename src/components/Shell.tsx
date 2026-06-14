import { format } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { useId, useState, type ReactNode } from 'react'
import { useData } from '../context/DataContext'
import { openDataFolderInExplorer } from '../lib/desktopBridge'
import { publishMobileHeadcountSnapshot } from '../lib/headcountDailyExport'
import {
  NAV_GROUPS,
  groupIdForNavKey,
  groupUsesHrData,
  navGroupForKey,
  type NavKey,
} from '../navConfig'

export type { NavKey } from '../navConfig'

export function Shell({
  active,
  onNav,
  onSelectCategory,
  children,
}: {
  active: NavKey
  onNav: (k: NavKey) => void
  onSelectCategory: (groupId: string) => void
  children: ReactNode
}) {
  const {
    baseDate,
    setBaseDate,
    dataLoading,
    dataLoadError,
    fileName,
    dataDirectory,
    dataLoadedAt,
    reloadDataFromFolder,
    data,
  } = useData()
  const [mobileMsg, setMobileMsg] = useState<string | null>(null)
  const [mobileBusy, setMobileBusy] = useState(false)
  const dateId = useId()
  const isDesktop = typeof window !== 'undefined' && window.hrmDesktop?.isDesktop === true
  const activeGroupId = groupIdForNavKey(active)
  const currentGroup = navGroupForKey(active)
  const showHrDataBar = isDesktop && groupUsesHrData(activeGroupId)

  return (
    <div className="flex h-full min-h-0 text-slate-800">
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white">
        <div className="border-b border-slate-100 px-4 py-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
            LOCAL · PRIVATE
          </div>
          <div className="mt-2 text-base font-semibold tracking-tight text-slate-900">시계열 대시보드</div>
          <div className="mt-3 text-[11px] font-medium text-slate-700">{currentGroup.title}</div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          <div className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            세부 화면
          </div>
          {currentGroup.items.map((it) => {
            const selected = active === it.key
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => onNav(it.key)}
                className={[
                  'group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors duration-150',
                  selected
                    ? 'border-slate-200 bg-slate-50 text-slate-900'
                    : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-8 w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-mono font-semibold tabular-nums',
                    selected
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700',
                  ].join(' ')}
                >
                  {it.code}
                </span>
                <span className="min-w-0 flex-1 leading-snug font-medium">{it.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-slate-200/90 bg-white px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 border-l-[3px] border-teal-500 pl-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-2xl font-semibold tracking-tight text-slate-900">HRM</span>
                <span className="text-sm font-medium text-slate-500">Human Resource Manager</span>
              </div>
            </div>

            <div className="min-w-0 sm:text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">기준일</div>
              <div className="mt-2 flex flex-wrap items-center gap-3 sm:justify-end">
                <label htmlFor={dateId} className="sr-only">
                  기준일 선택
                </label>
                <input
                  id={dateId}
                  type="date"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition-shadow focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20"
                  value={format(baseDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return
                    setBaseDate(new Date(v + 'T12:00:00'))
                  }}
                />
                <div className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">
                    {format(baseDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">대분류</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {NAV_GROUPS.map((g) => {
                const isActive = g.id === activeGroupId
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onSelectCategory(g.id)}
                    className={[
                      'group inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors duration-150',
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded font-mono text-[10px] font-semibold tabular-nums',
                        isActive ? 'text-white/80' : 'text-slate-500 group-hover:text-slate-700',
                      ].join(' ')}
                      aria-hidden
                    >
                      {g.groupNo}
                    </span>
                    <span className="min-w-0 font-medium leading-snug">{g.shortTitle}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </header>

        {showHrDataBar && dataLoadError && !dataLoading ? (
          <div className="mx-6 mt-4 rounded-xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-950">
            {dataLoadError}
            {dataDirectory ? (
              <div className="mt-2 text-xs text-rose-800/90">
                data 폴더: {dataDirectory}
                <button
                  type="button"
                  className="ml-2 underline hover:no-underline"
                  onClick={() => void openDataFolderInExplorer()}
                >
                  폴더 열기
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {showHrDataBar && !dataLoadError ? (
          <div className="mx-6 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-600">
            <span>
              {fileName ?? 'HRdata.xlsx'}
              {dataLoadedAt
                ? ` · ${format(dataLoadedAt, 'M/d HH:mm', { locale: ko })} 불러옴`
                : dataLoading
                  ? ' · 불러오는 중…'
                  : ''}
            </span>
            {dataDirectory ? (
              <button
                type="button"
                className="truncate text-left text-slate-500 underline decoration-slate-300 hover:text-slate-800"
                title={dataDirectory}
                onClick={() => void openDataFolderInExplorer()}
              >
                {dataDirectory}
              </button>
            ) : null}
            <button
              type="button"
              disabled={dataLoading}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              onClick={() => void reloadDataFromFolder()}
            >
              {dataLoading ? '새로고침…' : '엑셀 새로고침'}
            </button>
            {data?.personnel?.length ? (
              <button
                type="button"
                disabled={mobileBusy || dataLoading}
                className="rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-900 hover:bg-teal-100 disabled:opacity-50"
                onClick={() => {
                  setMobileBusy(true)
                  setMobileMsg(null)
                  void publishMobileHeadcountSnapshot(data, baseDate)
                    .then((msg) => setMobileMsg(msg))
                    .catch((e) =>
                      setMobileMsg(e instanceof Error ? e.message : '모바일 스냅샷 저장 실패'),
                    )
                    .finally(() => setMobileBusy(false))
                }}
              >
                {mobileBusy ? '모바일 반영…' : '모바일 반영'}
              </button>
            ) : null}
          </div>
        ) : null}

        {showHrDataBar && mobileMsg ? (
          <div className="mx-6 mt-2 rounded-lg border border-teal-200/80 bg-teal-50/90 px-4 py-2 text-xs text-teal-950">
            {mobileMsg}
          </div>
        ) : null}

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  )
}
