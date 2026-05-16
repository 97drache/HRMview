import type { ReactNode } from 'react'

/** Recharts ResponsiveContainer — 부모 높이 0 방지 (모바일 필수) */
export function ChartPanel({
  title,
  subtitle,
  children,
  heightClass = 'h-[252px] sm:h-[300px]',
}: {
  title: string
  subtitle?: string
  children: ReactNode
  heightClass?: string
}) {
  return (
    <section className="w-full max-w-xl overflow-hidden rounded-3xl bg-[#FAF8F5] p-5 shadow-[0_6px_20px_rgba(30,57,50,0.06)] ring-1 ring-[#00704A]/10 sm:max-w-2xl sm:p-6">
      <div className="mb-4 text-center">
        <h3 className="text-sm font-bold text-[#1E3932]">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-[#6F4E37]/75">{subtitle}</p> : null}
      </div>
      <div className={`mx-auto w-full rounded-2xl bg-white/50 p-2 ${heightClass}`}>{children}</div>
    </section>
  )
}
