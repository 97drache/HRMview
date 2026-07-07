import html2canvas from 'html2canvas'
import { useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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

export function CopyableStackedBar({
  title,
  data,
  xKey,
  series,
  height = 320,
}: {
  title?: string
  data: Record<string, string | number>[]
  xKey: string
  series: SeriesKey[]
  height?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hint, setHint] = useState('')

  async function copyImage() {
    const el = wrapRef.current
    if (!el) return
    setHint('')
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#f6f1e7',
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
    <div className="mt-6 w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copyImage()}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
        >
          그래프 이미지 복사
        </button>
        {hint ? <span className="text-xs text-stone-600">{hint}</span> : null}
      </div>
      <div ref={wrapRef} className="rounded-xl border border-sky-100/90 bg-gradient-to-b from-sky-50/90 to-cyan-50/40 p-4 shadow-inner">
        {title ? <div className="mb-2 text-center text-sm font-semibold text-slate-800">{title}</div> : null}
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
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
}: {
  title?: string
  data: Record<string, string | number>[]
  xKey: string
  yKey: string
  yName?: string
  height?: number
  barColor?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hint, setHint] = useState('')

  async function copyImage() {
    const el = wrapRef.current
    if (!el) return
    setHint('')
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: '#f6f1e7',
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
    <div className="mt-6 w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copyImage()}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
        >
          그래프 이미지 복사
        </button>
        {hint ? <span className="text-xs text-stone-600">{hint}</span> : null}
      </div>
      <div ref={wrapRef} className="rounded-xl border border-sky-100/90 bg-gradient-to-b from-sky-50/90 to-cyan-50/40 p-4 shadow-inner">
        {title ? <div className="mb-2 text-center text-sm font-semibold text-slate-800">{title}</div> : null}
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
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
            <Bar dataKey={yKey} name={yName} fill={barColor} radius={[6, 6, 0, 0]} />
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
}: {
  title?: string
  data: Record<string, string | number>[]
  keys: { key: string; label: string }[]
  height?: number
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
        backgroundColor: '#f6f1e7',
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
    <div className="mt-6 w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void copyImage()}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50"
        >
          그래프 이미지 복사
        </button>
        {hint ? <span className="text-xs text-stone-600">{hint}</span> : null}
      </div>
      <div ref={wrapRef} className="rounded-xl border border-sky-100/90 bg-gradient-to-b from-sky-50/90 to-cyan-50/40 p-4 shadow-inner">
        {title ? <div className="mb-2 text-center text-sm font-semibold text-slate-800">{title}</div> : null}
        <ResponsiveContainer width="100%" height={h}>
          <BarChart layout="vertical" data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
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
