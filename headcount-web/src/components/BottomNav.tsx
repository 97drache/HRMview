import { bottomNavKey, HEADCOUNT_NAV, type HeadcountNav } from '../nav'

const SHORT: Partial<Record<HeadcountNav, string>> = {
  home: '한눈에',
  'p-1-1': '직종',
  'p-1-2': '고용',
  'l-2-0': '모성',
  'm-3-0': '입퇴사',
  proof: '증빙',
}

export function BottomNav({
  active,
  onSelect,
}: {
  active: HeadcountNav
  onSelect: (key: HeadcountNav) => void
}) {
  const highlight = bottomNavKey(active)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="메뉴"
    >
      <div className="mx-auto grid max-w-md grid-cols-6 gap-2 px-3 py-2.5">
        {HEADCOUNT_NAV.map((it) => {
          const on = highlight === it.key
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onSelect(it.key === 'proof' ? 'doc-6-1' : it.key)}
              className={[
                'flex w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 transition-all',
                on ? 'bg-[#006B00] text-white shadow-sm' : 'border border-slate-200 bg-white text-[#444]',
              ].join(' ')}
            >
              <span
                className={[
                  'font-mono text-[10px] font-bold tabular-nums',
                  on ? 'text-white/90' : 'text-[#666]',
                ].join(' ')}
              >
                {it.code}
              </span>
              <span className="text-center text-[10px] font-semibold leading-tight">
                {SHORT[it.key] ?? it.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
