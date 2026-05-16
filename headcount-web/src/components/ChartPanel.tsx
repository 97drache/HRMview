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
    <section className="w-full max-w-xl overflow-hidden rounded-2xl bg-white p-5 shadow-md ring-1 ring-slate-900/[0.06] sm:max-w-2xl sm:p-6">
      <div className="mb-4 text-center">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <div className={`mx-auto w-full ${heightClass}`}>{children}</div>
    </section>
  )
}
