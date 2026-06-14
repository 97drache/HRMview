/** 7-4 키워드 → 관련 법령·조문 힌트 (프리셋 라벨과 별칭) */
const { HR_LAW_TOPIC_PRESETS } = require('./hrLawTopicPresets.cjs')

const LABEL_ALIASES = {
  단축근로: '임신기간 중 근로시간 단축',
  '단축 근로': '임신기간 중 근로시간 단축',
  근로시간단축: '임신기간 중 근로시간 단축',
  생리휴가: '보건휴가',
  출산전후휴가: '임산부 근로보호',
  태아검진: '태아검진 시간',
  수유: '수유시간',
  난임: '난임치료휴가',
}

function normalizeKeyword(keyword) {
  return String(keyword ?? '')
    .trim()
    .replace(/\s+/g, '')
}

function resolveKeywordHints(keyword) {
  const raw = String(keyword ?? '').trim()
  const compact = normalizeKeyword(raw)
  const hints = []

  const byLabel = new Map(HR_LAW_TOPIC_PRESETS.map((p) => [p.label, p]))

  const aliasLabel = LABEL_ALIASES[raw] || LABEL_ALIASES[compact]
  if (aliasLabel && byLabel.has(aliasLabel)) {
    const p = byLabel.get(aliasLabel)
    hints.push({ lawName: p.lawName, jo: p.jo, joLabel: p.joLabel, label: p.label })
  }

  for (const p of HR_LAW_TOPIC_PRESETS) {
    const pl = normalizeKeyword(p.label)
    if (compact && (pl.includes(compact) || compact.includes(pl))) {
      hints.push({ lawName: p.lawName, jo: p.jo, joLabel: p.joLabel, label: p.label })
    }
  }

  const seen = new Set()
  return hints.filter((h) => {
    const k = `${h.lawName}|${h.jo}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

module.exports = { resolveKeywordHints, LABEL_ALIASES }
