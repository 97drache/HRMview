import { PROOF_SUB_NAV, type HeadcountNav, type ProofSubNavKey } from '../nav'

export function ProofSubNav({
  active,
  onSelect,
}: {
  active: ProofSubNavKey
  onSelect: (key: HeadcountNav) => void
}) {
  return (
    <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
      {PROOF_SUB_NAV.map((it) => {
        const on = active === it.key
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onSelect(it.key)}
            className={[
              'flex min-w-[5.5rem] flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-center transition-colors',
              on ? 'bg-[#006B00] text-white shadow-sm' : 'text-[#444] hover:bg-slate-50',
            ].join(' ')}
          >
            <span className="font-mono text-[10px] font-bold opacity-90">{it.code}</span>
            <span className="text-[10px] font-semibold leading-tight">{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}
