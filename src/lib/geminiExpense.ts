import { formatWonLine } from './koreanWon'

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
  if (may('dateTime') && r.dateTime) setters.setDateTime(r.dateTime)
  if (may('location') && r.location) setters.setLocation(r.location)
  const amt = Number(r.amount) || 0
  if (may('amountLine') && amt > 0) {
    setters.setAmount(amt)
    setters.setAmountLine(r.amountLine?.trim() || formatWonLine(amt))
  }
  if (may('merchantPhone') && r.merchantPhone) setters.setMerchantPhone(r.merchantPhone)
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
  const amt = Number(r.amount) || 0
  if (amt > 0) {
    setters.setAmount(amt)
    setters.setAmountLine(r.amountLine?.trim() || formatWonLine(amt))
  } else if (r.amountLine?.trim()) {
    setters.setAmountLine(r.amountLine.trim())
  }
}
