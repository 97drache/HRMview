import type { ReactNode } from 'react'

/** 공개 웹 전용 — 스타벅스 톤 카드 */
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
    <section className="mx-auto mb-2 w-full max-w-2xl overflow-hidden rounded-3xl bg-[#FAF8F5] shadow-[0_8px_28px_rgba(30,57,50,0.08)] ring-1 ring-[#00704A]/10">
      <div className="border-b border-[#E0D9CF]/80 bg-gradient-to-r from-[#F2F0EB] to-[#FAF8F5] px-5 py-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <span className="rounded-xl bg-[#00704A] px-2.5 py-1 font-mono text-[11px] font-bold text-white shadow-sm">
            {code}
          </span>
          <h2 className="text-base font-bold text-[#1E3932] sm:text-lg">{title}</h2>
        </div>
      </div>
      <div className="flex w-full flex-col items-center gap-8 p-5 sm:p-7">{children}</div>
    </section>
  )
}
