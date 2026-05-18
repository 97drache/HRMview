import type { ReactNode } from 'react'
import { SB } from '../lib/headcountWebTheme'

/** 공개 인원현황 웹 — 1-0·1-5 통일 레이아웃 (목업: 회색 바탕 + 녹색 히어로 + 회색 카드) */
export const HC = {
  pageBg: '#F2F2F2',
  card: '#E0E0E0',
  cardInner: '#F0F0F0',
  hero: '#006B00',
  label: '#666666',
  value: '#1A1A1A',
  ...SB,
} as const

/** 화면 전체를 감싸는 둥근 회색 캔버스 */
export function HcPage({ children }: { children: ReactNode }) {
  return <div className="hc-page mx-auto w-full max-w-md space-y-4 sm:max-w-lg">{children}</div>
}

/** 1-0 상단 — 총 재직 (녹색, 큰 숫자) */
export function HcHero({ total }: { total: number }) {
  return (
    <div className="flex items-center justify-center rounded-[1.25rem] bg-[#006B00] px-5 py-10 text-white shadow-sm sm:py-12">
      <span className="text-5xl font-bold tabular-nums leading-none sm:text-6xl">{total}</span>
      <span className="ml-2.5 pb-1 text-xl font-semibold sm:text-2xl">명 재직</span>
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
    <div className="flex min-h-[7.5rem] flex-col items-center justify-center rounded-[1.25rem] bg-[#E0E0E0] px-3 py-6 text-center sm:min-h-[8rem]">
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
    <section className={`rounded-[1.25rem] bg-[#E0E0E0] px-4 py-5 sm:px-5 sm:py-6 ${className}`}>
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
    <div className="overflow-x-auto rounded-xl bg-[#F0F0F0] p-1 shadow-inner">{children}</div>
  )
}
