import html2canvas from 'html2canvas'
import { useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const STACK_M = '#0d9488'
const STACK_F = '#38bdf8'
const AXIS = '#57534e'
const GRID = '#e7e5e4'

type SeriesKey = { key: string; color: string; name: string }
export type ChartAppearance = 'panel' | 'flat'

function chartRootClass(appearance: ChartAppearance) {
  return appearance === 'flat' ? 'w-full min-w-0 space-y-2' : 'mt-6 w-full space-y-2'
}

function chartShellClass(appearance: ChartAppearance) {
  return appearance === 'flat'
    ? 'min-w-0 w-full overflow-hidden rounded-lg bg-white'
    : 'rounded-xl border border-sky-100/90 bg-gradient-to-b from-sky-50/90 to-cyan-50/40 p-4 shadow-inner'
}

function copyBackground(appearance: ChartAppearance) {
  return appearance === 'flat' ? '#ffffff' : '#f6f1e7'
}

function CopyChartToolbar({
  hint,
  onCopy,
  appearance,
}: {
  hint: string
  onCopy: () => void
  appearance: ChartAppearance
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onCopy}
        className={
          appearance === 'flat'
            ? 'rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100'
            : 'rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50'
        }
      >
        그래프 이미지 복사
      </button>
      {hint ? <span className="text-xs text-stone-600">{hint}</span> : null}
    </div>
  )
}

export function CopyableStackedBar({
  title,
  data,
  xKey,
  series,
  height = 320,
  appearance = 'panel',
}: {
  title?: string
  data: Record<string, string | number>[]
  xKey: string
  series: SeriesKey[]
  height?: number
  appearance?: ChartAppearance
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hint, setHint] = useState('')

  async function copyImage() {
    const el = wrapRef.current
    if (!el) return
    setHint('')
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: copyBackground(appearance),
        scale: 2,
        logging: false,
      })
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
      if (!blob) {
        setHint('이미지 생성 실패')
        return
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setHint('클립보드에 이미지를 복사했습니다.')
    } catch {
      setHint('복사 실패: 브라우저 권한 또는 환경을 확인하세요.')
    }
  }

  return (
    <div className={chartRootClass(appearance)}>
      <CopyChartToolbar hint={hint} onCopy={() => void copyImage()} appearance={appearance} />
      <div ref={wrapRef} className={chartShellClass(appearance)}>
        {title ? <div className="mb-2 text-center text-sm font-semibold text-slate-800">{title}</div> : null}
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey={xKey} tick={{ fill: AXIS, fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} width={36} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e7e5e4',
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** 단일 막대(직종별 계 등) */
export function CopyableSimpleBar({
  title,
  data,
  xKey,
  yKey,
  yName = '인원',
  height = 300,
  barColor = STACK_M,
  showValueLabels = false,
  onBarClick,
  appearance = 'panel',
}: {
  title?: string
  data: Record<string, string | number>[]
  xKey: string
  yKey: string
  yName?: string
  height?: number
  barColor?: string
  showValueLabels?: boolean
  onBarClick?: (row: Record<string, string | number>) => void
  appearance?: ChartAppearance
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hint, setHint] = useState('')
  const handleChartClick = (state?: unknown) => {
    const row = (state as { activePayload?: { payload: Record<string, string | number> }[] } | undefined)
      ?.activePayload?.[0]?.payload
    if (row && onBarClick) onBarClick(row)
  }

  async function copyImage() {
    const el = wrapRef.current
    if (!el) return
    setHint('')
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: copyBackground(appearance),
        scale: 2,
        logging: false,
      })
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
      if (!blob) {
        setHint('이미지 생성 실패')
        return
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setHint('클립보드에 이미지를 복사했습니다.')
    } catch {
      setHint('복사 실패: 브라우저 권한 또는 환경을 확인하세요.')
    }
  }

  return (
    <div className={chartRootClass(appearance)}>
      <CopyChartToolbar hint={hint} onCopy={() => void copyImage()} appearance={appearance} />
      <div ref={wrapRef} className={chartShellClass(appearance)}>
        {title ? <div className="mb-2 text-center text-sm font-semibold text-slate-800">{title}</div> : null}
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 28, right: 8, left: 0, bottom: 8 }} onClick={handleChartClick}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey={xKey} tick={{ fill: AXIS, fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={56} />
            <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} width={36} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e7e5e4',
                fontSize: 12,
              }}
            />
            <Bar
              dataKey={yKey}
              name={yName}
              fill={barColor}
              radius={[6, 6, 0, 0]}
              cursor={onBarClick ? 'pointer' : undefined}
            >
              {showValueLabels ? (
                <LabelList
                  dataKey={yKey}
                  position="top"
                  offset={8}
                  fill={AXIS}
                  fontSize={11}
                  fontWeight={600}
                />
              ) : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const PALETTE = ['#0d9488', '#0891b2', '#06b6d4', '#14b8a6', '#2dd4bf', '#5eead4', '#64748b']

/** 1-3 연도별 직급 구성 (가로 누적 막대) */
export function CopyableYearRankChart({
  title,
  data,
  keys,
  height,
  appearance = 'panel',
}: {
  title?: string
  data: Record<string, string | number>[]
  keys: { key: string; label: string }[]
  height?: number
  appearance?: ChartAppearance
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hint, setHint] = useState('')
  const h = height ?? Math.max(280, 48 * data.length)

  async function copyImage() {
    const el = wrapRef.current
    if (!el) return
    setHint('')
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: copyBackground(appearance),
        scale: 2,
        logging: false,
      })
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
      if (!blob) {
        setHint('이미지 생성 실패')
        return
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setHint('클립보드에 이미지를 복사했습니다.')
    } catch {
      setHint('복사 실패: 브라우저 권한 또는 환경을 확인하세요.')
    }
  }

  return (
    <div className={chartRootClass(appearance)}>
      <CopyChartToolbar hint={hint} onCopy={() => void copyImage()} appearance={appearance} />
      <div ref={wrapRef} className={chartShellClass(appearance)}>
        {title ? <div className="mb-2 text-center text-sm font-semibold text-slate-800">{title}</div> : null}
        <ResponsiveContainer width="100%" height={h}>
          <BarChart layout="vertical" data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} />
            <YAxis type="category" dataKey="year" width={56} tick={{ fill: AXIS, fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e7e5e4',
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {keys.map((k, i) => (
              <Bar
                key={k.key}
                dataKey={k.key}
                name={k.label}
                stackId="rank"
                fill={PALETTE[i % PALETTE.length]}
                radius={[0, 4, 4, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export { STACK_M, STACK_F }
