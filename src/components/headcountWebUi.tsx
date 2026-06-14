import type { ReactNode } from 'react'
import { SB } from '../lib/headcountWebTheme'

/** 공개 인원현황 웹 — 밝은 흰 배경 + 녹색 히어로 */
export const HC = {
  pageBg: '#FFFFFF',
  card: '#FFFFFF',
  cardInner: '#F8FAFC',
  hero: '#006B00',
  label: '#666666',
  value: '#1A1A1A',
  ...SB,
} as const

/** 화면 전체를 감싸는 둥근 회색 캔버스 */
export function HcPage({ children }: { children: ReactNode }) {
  return <div className="hc-page mx-auto w-full max-w-md sm:max-w-lg">{children}</div>
}

/** 1-0 상단 — 1-1~1-5와 동일한 코드·제목 + 총 재직 */
export function HcOverviewHero({ total }: { total: number }) {
  return (
    <div className="rounded-[1.25rem] bg-[#006B00] px-4 py-6 text-center text-white shadow-sm sm:py-7">
      <p className="font-mono text-xs font-semibold tracking-wide text-white/85">1-0</p>
      <h2 className="mt-1 text-lg font-bold leading-snug sm:text-xl">한눈에 보기</h2>
      <div className="mt-5 flex items-baseline justify-center gap-2">
        <span className="text-4xl font-bold tabular-nums leading-none sm:text-5xl">{total}</span>
        <span className="text-lg font-semibold text-white/95 sm:text-xl">명 재직</span>
      </div>
    </div>
  )
}

/** 1-1~1-5 상단 — 메뉴 코드 + 제목 */
export function HcSubHero({ code, title }: { code: string; title: string }) {
  return (
    <div className="rounded-[1.25rem] bg-[#006B00] px-4 py-5 text-center text-white shadow-sm">
      <p className="font-mono text-xs font-semibold tracking-wide text-white/85">{code}</p>
      <h2 className="mt-1 text-lg font-bold leading-snug sm:text-xl">{title}</h2>
    </div>
  )
}

/** KPI 한 칸 (2열 그리드용) */
export function HcMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[7.5rem] w-full min-w-0 flex-col items-center justify-center rounded-[1.25rem] border border-slate-200 bg-white px-3 py-6 text-center shadow-sm sm:min-h-[8rem]">
      <p className="text-sm font-medium text-[#666666]">{label}</p>
      <p className="mt-3 text-xl font-bold leading-snug tabular-nums text-[#1A1A1A] sm:text-2xl">
        {value}
      </p>
    </div>
  )
}

/** 표·차트 등 콘텐츠 블록 */
export function HcBlock({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-[1.25rem] border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-5 sm:py-6 ${className}`}>
      {title ? (
        <h3 className="mb-4 text-center text-sm font-semibold text-[#444444]">{title}</h3>
      ) : null}
      {children}
    </section>
  )
}

/** 표 감싸기 — 회색 카드 안 연한 배경 */
export function HcTableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100 bg-slate-50/80 p-1">{children}</div>
  )
}
