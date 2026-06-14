import { NAV_GROUPS, type NavKey } from '../navConfig'
import { Card } from './Ui'

export function SitemapPanel({ onNavigate }: { onNavigate: (k: NavKey) => void }) {
  return (
    <Card
      code="전체"
      title="사이트맵"
      actions={
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
        >
          대시보드로
        </button>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">
        HRM 전체 메뉴입니다. 대분류별로 정리되어 있으며, 항목을 누르면 해당 화면으로 바로 이동합니다.
      </p>
      <div className="mt-5 grid grid-cols-3 gap-4">
        {NAV_GROUPS.map((g) => (
          <section
            key={g.id}
            className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-slate-900">{g.title}</h3>
            {g.subtitle ? <p className="mt-0.5 text-xs text-slate-500">{g.subtitle}</p> : null}
            <ul className="mt-3 space-y-1">
              {g.items.map((it) => (
                <li key={it.key}>
                  <button
                    type="button"
                    onClick={() => onNavigate(it.key)}
                    className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-slate-200 hover:bg-white"
                  >
                    <span className="flex h-8 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 font-mono text-[11px] font-semibold text-slate-600 group-hover:bg-slate-900 group-hover:text-white">
                      {it.code}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{it.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  )
}
