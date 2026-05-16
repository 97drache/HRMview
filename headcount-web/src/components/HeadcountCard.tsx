import type { ReactNode } from 'react'

/** 공개 웹 전용 — 얇은 검은 테두리 대신 부드러운 카드 */
export function HeadcountCard({
  code,
  title,
  children,
}: {
  code: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="rounded-lg bg-slate-900 px-2 py-1 font-mono text-[11px] font-bold text-white">
            {code}
          </span>
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
        </div>
      </div>
      <div className="space-y-5 p-4 sm:p-5">{children}</div>
    </section>
  )
}
