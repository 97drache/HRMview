const DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const SMALL = ['', '십', '백', '천']
const LARGE = ['', '만', '억', '조']

function chunkToKorean(n: number): string {
  if (n === 0) return ''
  let s = ''
  const str = String(n).padStart(4, '0')
  for (let i = 0; i < 4; i++) {
    const d = Number(str[i])
    if (d === 0) continue
    const unit = SMALL[3 - i]
    if (d === 1 && unit) s += unit
    else s += DIGITS[d] + unit
  }
  return s
}

export function numberToKoreanWon(amount: number): string {
  const n = Math.round(Number(amount))
  if (!Number.isFinite(n) || n < 0) return ''
  if (n === 0) return '영 원정'
  let num = n
  const parts: string[] = []
  let unitIdx = 0
  while (num > 0 && unitIdx < LARGE.length) {
    const chunk = num % 10000
    if (chunk > 0) {
      parts.unshift(chunkToKorean(chunk) + LARGE[unitIdx])
    }
    num = Math.floor(num / 10000)
    unitIdx++
  }
  return parts.join('') + ' 원정'
}

export function formatWonLine(amount: number): string {
  const n = Math.round(Number(amount))
  if (!Number.isFinite(n) || n < 0) return ''
  return `${numberToKoreanWon(n)}(₩${n.toLocaleString('ko-KR')})`
}
