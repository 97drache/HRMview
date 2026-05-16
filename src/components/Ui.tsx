import type { ReactNode } from 'react'

export function Card({
  code,
  title,
  actions,
  children,
}: {
  code: string
  title: string
  desc?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="w-full rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2.5">
            <span className="rounded-md bg-slate-900 px-2.5 py-1 font-mono text-[11px] font-semibold text-white">
              {code}
            </span>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4 w-full min-w-0">{children}</div>
    </section>
  )
}

export function SimpleTable({
  cols,
  rows,
}: {
  cols: { key: string; label: string; width?: string }[]
  rows: Record<string, ReactNode>[]
}) {
  const n = cols.length || 1
  const defaultPct = `${(100 / n).toFixed(3)}%`
  const wide = n > 6
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-200/90 bg-white shadow-sm">
      <table
        className={[
          'w-full border-collapse text-sm',
          wide ? 'min-w-[720px] table-auto' : 'table-fixed',
        ].join(' ')}
      >
        <colgroup>
          {cols.map((c) => (
            <col key={c.key} style={{ width: c.width ?? (wide ? undefined : defaultPct) }} />
          ))}
        </colgroup>
        <thead className="border-b border-slate-200 bg-slate-50/90">
          <tr>
            {cols.map((c) => (
              <th
                key={c.key}
                className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-slate-500" colSpan={cols.length}>
                데이터가 없습니다.
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr
                key={idx}
                className="border-t border-slate-100 odd:bg-white even:bg-slate-50/40"
              >
                {cols.map((c) => (
                  <td
                    key={c.key}
                    className="break-words px-2 py-2.5 text-center align-middle text-slate-800"
                  >
                    {r[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/10">
        <div className="flex items-start justify-between gap-3">
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
