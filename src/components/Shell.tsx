import { format } from 'date-fns'
import { ko } from 'date-fns/locale/ko'
import { useId, type ReactNode } from 'react'
import { useData } from '../context/DataContext'
import { NAV_GROUPS, groupIdForNavKey, navGroupForKey, type NavKey } from '../navConfig'

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
  const { baseDate, setBaseDate, fileName, filePath, dataDirectory, dataLoading, dataLoadError } = useData()
  const dateId = useId()
  const isDesktop = typeof window !== 'undefined' && window.hrmDesktop?.isDesktop === true
  const activeGroupId = groupIdForNavKey(active)
  const currentGroup = navGroupForKey(active)

  return (
    <div className="flex h-full min-h-0 text-slate-800">
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200/80 bg-white">
        <div className="border-b border-slate-100 px-4 py-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
            LOCAL · PRIVATE
          </div>
          <div className="mt-2 text-base font-semibold tracking-tight text-slate-900">시계열 대시보드</div>
          <div className="mt-3 text-[11px] font-medium text-slate-700">{currentGroup.title}</div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{currentGroup.subtitle}</p>
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

        <div className="mt-auto border-t border-slate-100 p-4">
          <p className="text-[11px] leading-relaxed text-slate-500">
            메뉴 코드(예: <span className="font-mono font-medium text-slate-700">2-1</span>)를 요청서에 적으면 수정이
            빨라집니다.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-slate-200/90 bg-white px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 border-l-[3px] border-teal-500 pl-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-2xl font-semibold tracking-tight text-slate-900">HRM</span>
                <span className="text-sm font-medium text-slate-500">Human Resource Manager</span>
              </div>
              <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-500">
                이 PC에서만 사용하는 로컬 인사 시계열 도구입니다.
              </p>
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

        {!isDesktop ? (
          <div className="mx-6 mt-4 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            브라우저 미리보기입니다. HRdata.xlsx 자동 로드는{' '}
            <strong className="font-semibold">Electron 데스크톱</strong>에서만 동작합니다.{' '}
            <code className="rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-xs text-slate-800">
              npm run dev:desktop
            </code>
          </div>
        ) : null}

        {isDesktop && dataLoading ? (
          <div className="mx-6 mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            HRdata.xlsx 를 불러오는 중…
          </div>
        ) : null}

        {isDesktop && dataLoadError && !dataLoading ? (
          <div className="mx-6 mt-4 rounded-xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-950">
            {dataLoadError}
          </div>
        ) : null}

        {fileName && !dataLoading ? (
          <div className="mx-6 mt-3 space-y-1 text-center text-xs text-slate-500 sm:text-left">
            <div>
              데이터 파일: <span className="font-medium text-slate-800">{fileName}</span>
            </div>
            {isDesktop && dataDirectory ? (
              <div className="break-all">
                자동 로드 폴더: <span className="font-mono text-[11px] text-slate-700">{dataDirectory}</span>
              </div>
            ) : null}
            {isDesktop && filePath ? (
              <div className="break-all">
                실제 경로: <span className="font-mono text-[11px] text-slate-700">{filePath}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  )
}
