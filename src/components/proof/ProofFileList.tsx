import type { ProofMediaFile } from '../../lib/desktopBridge'

type Props = {
  files: ProofMediaFile[]
  selectedPaths: Set<string>
  onToggle: (fullPath: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  emptyLabel: string
  pickLabel: string
  onPick: () => void
  pickBusy?: boolean
}

export function ProofFileList({
  files,
  selectedPaths,
  onToggle,
  onSelectAll,
  onClearAll,
  emptyLabel,
  pickLabel,
  onPick,
  pickBusy,
}: Props) {
  const selectedCount = files.filter((f) => selectedPaths.has(f.fullPath)).length

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pickBusy}
          onClick={onPick}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pickBusy ? '불러오는 중…' : pickLabel}
        </button>
        {files.length > 0 ? (
          <>
            <button
              type="button"
              onClick={onSelectAll}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
            >
              전체 해제
            </button>
            <span className="text-xs text-slate-600">
              선택 {selectedCount} / {files.length}장
            </span>
          </>
        ) : null}
      </div>
      {files.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {files.map((f) => {
            const checked = selectedPaths.has(f.fullPath)
            return (
              <li key={f.fullPath}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(f.fullPath)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-[11px] text-slate-800">{f.name}</span>
                    {f.sourcePdf ? (
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        PDF: {f.sourcePdf}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
