import type { ReactNode } from 'react'
import { HcPage, HcSubHero } from '../../../src/components/headcountWebUi'

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
    <HcPage>
      <HcSubHero code={code} title={title} />
      <div className="space-y-4">{children}</div>
    </HcPage>
  )
}
