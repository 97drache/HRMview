import { HEADCOUNT_NAV, type HeadcountNav } from '../nav'

const SHORT: Partial<Record<HeadcountNav, string>> = {
  home: '한눈에',
  'p-1-1': '직종',
  'p-1-2': '고용',
  'p-1-3': '연도',
  'p-1-4': '월별',
  'p-1-5': '연수',
}

export function BottomNav({
  active,
  onSelect,
}: {
  active: HeadcountNav
  onSelect: (key: HeadcountNav) => void
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E0D9CF] bg-[#FAF8F5]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_32px_rgba(30,57,50,0.1)] backdrop-blur-md lg:hidden"
      aria-label="메뉴"
    >
      <div className="mx-auto grid max-w-lg grid-cols-6 gap-1.5 px-2.5 py-2.5 sm:max-w-xl">
        {HEADCOUNT_NAV.map((it) => {
          const on = active === it.key
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onSelect(it.key)}
              className={[
                'flex w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-2.5 transition-all',
                on
                  ? 'bg-[#00704A] text-white shadow-[0_4px_14px_rgba(0,112,74,0.35)]'
                  : 'text-[#6F4E37] active:bg-[#F2F0EB]',
              ].join(' ')}
            >
              <span
                className={[
                  'font-mono text-[10px] font-bold tabular-nums',
                  on ? 'text-[#D4E9E2]' : 'text-[#00704A]/50',
                ].join(' ')}
              >
                {it.code}
              </span>
              <span className="text-center text-[10px] font-semibold leading-tight sm:text-[11px]">
                {SHORT[it.key] ?? it.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
