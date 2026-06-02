import { formatWonComma, parseWonAmount } from './koreanWon'

export type GeminiStatus = {
  configured: boolean
  model: string
  source: string | null
  maxReceiptImages: number
}

export type GeminiReceiptResult = {
  ok: boolean
  configured?: boolean
  message?: string
  dateTime?: string
  location?: string
  merchantName?: string
  businessNo?: string
  amount?: number
  amountLine?: string
  merchantPhone?: string
}

export type OcrReceiptResult = {
  dateTime?: string
  location?: string
  merchantName?: string
  businessNo?: string
  amount?: number
  amountLine?: string
  merchantPhone?: string
}

function buildLocation(
  location?: string,
  merchantName?: string,
  businessNo?: string,
): string {
  const loc = String(location ?? '').trim()
  if (loc) return loc
  const m = String(merchantName ?? '').trim()
  const b = String(businessNo ?? '').trim()
  if (m && b) return `${m} (${b})`
  return m || b || ''
}

function resolveAmountLine(amount: number, amountLine?: string): string {
  const fromLine = parseWonAmount(amountLine ?? '')
  const amt = amount > 0 ? amount : fromLine
  if (amt > 0) return formatWonComma(amt)
  return String(amountLine ?? '').trim()
}

export function applyGeminiReceipt(
  r: GeminiReceiptResult,
  setters: {
    setDateTime: (v: string) => void
    setLocation: (v: string) => void
    setAmount: (v: number) => void
    setAmountLine: (v: string) => void
    setMerchantPhone: (v: string) => void
  },
  forceOverwrite: boolean,
  userEdited: Set<string>,
) {
  const may = (key: string) => forceOverwrite || !userEdited.has(key)
  if (may('dateTime')) {
    const dt = String(r.dateTime ?? '').trim()
    if (dt) setters.setDateTime(dt)
  }
  if (may('location')) {
    const loc = buildLocation(r.location, r.merchantName, r.businessNo)
    if (loc) setters.setLocation(loc)
  }
  const amt = Number(r.amount) || parseWonAmount(r.amountLine ?? '')
  if (may('amountLine') && amt > 0) {
    setters.setAmount(amt)
    setters.setAmountLine(resolveAmountLine(amt, r.amountLine))
  }
  if (may('merchantPhone')) {
    setters.setMerchantPhone(String(r.merchantPhone ?? '').trim())
  }
}

export function applyOcrReceipt(
  r: OcrReceiptResult,
  setters: {
    setDateTime: (v: string) => void
    setLocation: (v: string) => void
    setAmount: (v: number) => void
    setAmountLine: (v: string) => void
    setMerchantPhone: (v: string) => void
  },
  forceOverwrite: boolean,
  userEdited: Set<string>,
) {
  applyGeminiReceipt(
    {
      ok: true,
      dateTime: r.dateTime,
      location: r.location,
      merchantName: r.merchantName,
      businessNo: r.businessNo,
      amount: r.amount,
      amountLine: r.amountLine,
      merchantPhone: r.merchantPhone,
    },
    setters,
    forceOverwrite,
    userEdited,
  )
}

export type GeminiTripVoiceResult = {
  ok: boolean
  configured?: boolean
  message?: string
  destination?: string
  dateRange?: string
  note?: string
}

export type GeminiTripDocResult = {
  ok: boolean
  configured?: boolean
  message?: string
  dept?: string
  rankLabel?: string
  name?: string
  destination?: string
  dateRange?: string
  note?: string
}

export function applyGeminiTrip(
  r: GeminiTripDocResult,
  setters: {
    setDept: (v: string) => void
    setRankLabel: (v: string) => void
    setName: (v: string) => void
    setDestination: (v: string) => void
    setDateRange: (v: string) => void
  },
  forceOverwrite: boolean,
  current?: {
    dept?: string
    rankLabel?: string
    name?: string
    destination?: string
    dateRange?: string
  },
) {
  const fill = (val: string | undefined, set: (s: string) => void, cur?: string) => {
    const v = String(val ?? '').trim()
    if (!v) return
    if (forceOverwrite || !String(cur ?? '').trim()) set(v)
  }
  fill(r.dept, setters.setDept, current?.dept)
  fill(r.rankLabel, setters.setRankLabel, current?.rankLabel)
  fill(r.name, setters.setName, current?.name)
  fill(r.destination, setters.setDestination, current?.destination)
  fill(r.dateRange, setters.setDateRange, current?.dateRange)
}

export function applyGeminiTripVoice(
  r: GeminiTripVoiceResult & GeminiTripDocResult,
  setters: {
    setDept: (v: string) => void
    setRankLabel: (v: string) => void
    setName: (v: string) => void
    setDestination: (v: string) => void
    setDateRange: (v: string) => void
  },
) {
  applyGeminiTrip(r, setters, true)
}

export function applyGeminiVoice(
  r: GeminiVoiceResult,
  setters: {
    setPurpose: (v: string) => void
    setAttendees: (v: string) => void
    setDateTime: (v: string) => void
    setLocation: (v: string) => void
    setAmount: (v: number) => void
    setAmountLine: (v: string) => void
  },
) {
  if (r.purpose) setters.setPurpose(r.purpose)
  if (r.attendees) setters.setAttendees(r.attendees)
  if (r.dateTime) setters.setDateTime(r.dateTime)
  if (r.location) setters.setLocation(r.location)
  const amt = Number(r.amount) || parseWonAmount(r.amountLine ?? '')
  if (amt > 0) {
    setters.setAmount(amt)
    setters.setAmountLine(resolveAmountLine(amt, r.amountLine))
  } else if (r.amountLine?.trim()) {
    setters.setAmountLine(r.amountLine.trim())
  }
}

export type GeminiVoiceResult = {
  ok: boolean
  configured?: boolean
  message?: string
  purpose?: string
  attendees?: string
  dateTime?: string
  location?: string
  amount?: number
  amountLine?: string
  note?: string
}
