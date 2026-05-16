/** 숫자(원) → "일십이만 구천육백 원정" 형식 (업무추진비 집행내역서용) */
const DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const SMALL = ['', '십', '백', '천']
const LARGE = ['', '만', '억', '조']

function chunkToKorean(n) {
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

function numberToKoreanWon(amount) {
  const n = Math.round(Number(amount))
  if (!Number.isFinite(n) || n < 0) return ''
  if (n === 0) return '영 원정'
  let num = n
  let parts = []
  let unitIdx = 0
  while (num > 0 && unitIdx < LARGE.length) {
    const chunk = num % 10000
    if (chunk > 0) {
      const chunkStr = chunkToKorean(chunk)
      parts.unshift(chunkStr + LARGE[unitIdx])
    }
    num = Math.floor(num / 10000)
    unitIdx++
  }
  return parts.join('') + ' 원정'
}

function formatWonLine(amount) {
  const n = Math.round(Number(amount))
  if (!Number.isFinite(n) || n < 0) return ''
  const kor = numberToKoreanWon(n)
  return `${kor}(₩${n.toLocaleString('ko-KR')})`
}

module.exports = { numberToKoreanWon, formatWonLine }
