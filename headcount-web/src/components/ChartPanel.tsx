import type { ReactNode } from 'react'
import { HcBlock } from '../../../src/components/headcountWebUi'

/** Recharts ResponsiveContainer — 부모 높이 0 방지 */
export function ChartPanel({
  title,
  children,
  heightClass = 'h-[252px] sm:h-[280px]',
}: {
  title: string
  subtitle?: string
  children: ReactNode
  heightClass?: string
}) {
  return (
    <HcBlock title={title}>
      <div className={`mx-auto min-w-0 w-full overflow-hidden ${heightClass}`}>{children}</div>
    </HcBlock>
  )
}
