import { PROOF_SUB_NAV, type HeadcountNav } from '../nav'

export function ProofSubNav({
  active,
  onSelect,
}: {
  active: 'doc-6-1' | 'doc-6-2'
  onSelect: (key: HeadcountNav) => void
}) {
  return (
    <div className="mb-4 flex gap-2 rounded-2xl bg-[#E0E0E0] p-1.5">
      {PROOF_SUB_NAV.map((it) => {
        const on = active === it.key
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onSelect(it.key)}
            className={[
              'flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-center transition-colors',
              on ? 'bg-[#006B00] text-white shadow-sm' : 'text-[#444] hover:bg-[#F0F0F0]',
            ].join(' ')}
          >
            <span className="font-mono text-[10px] font-bold opacity-90">{it.code}</span>
            <span className="text-[11px] font-semibold leading-tight">{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}
