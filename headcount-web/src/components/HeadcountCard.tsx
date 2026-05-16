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
    <section className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-900/[0.06]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <span className="rounded-lg bg-slate-900 px-2 py-1 font-mono text-[11px] font-bold text-white">
            {code}
          </span>
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
        </div>
      </div>
      <div className="flex w-full flex-col items-center gap-6 p-5 sm:p-6">{children}</div>
    </section>
  )
}
