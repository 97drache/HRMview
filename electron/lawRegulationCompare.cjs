const { searchLaws, getLawBody, getRecentHrLawChanges, resolveMajorLaws } = require('./lawOpenApi.cjs')
const { HR_MAJOR_LAW_NAMES } = require('./hrLawConfig.cjs')
const { resolveKeywordHints } = require('./hrLawKeywordHints.cjs')
const { searchRegulationsByKeyword, getRegulationsStatus } = require('./gistRegulations.cjs')
const { compareRegulationWithLaw } = require('./gemini.cjs')

function asArray(v) {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function pickText(row, keys) {
  for (const k of keys) {
    const v = row?.[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function joUnitToPlainText(unit) {
  const lines = []
  const head = pickText(unit, ['조문내용'])
  if (head) lines.push(head)
  for (const h of asArray(unit?.항)) {
    const t = pickText(h, ['항내용'])
    if (t) lines.push(t)
    for (const ho of asArray(h?.호)) {
      const ht = pickText(ho, ['호내용'])
      if (ht) lines.push(ht)
    }
  }
  return lines.join('\n')
}

function extractLawSnippetsFromJson(json, keyword) {
  const law = json?.법령 || json
  if (!law) return []
  const units = asArray(law?.조문?.조문단위)
  const kw = String(keyword ?? '').trim().toLowerCase().replace(/\s+/g, '')
  const matched = []
  for (const unit of units) {
    const text = joUnitToPlainText(unit)
    const compact = text.toLowerCase().replace(/\s+/g, '')
    if (!kw || compact.includes(kw)) {
      matched.push(text)
    }
  }
  if (matched.length) return matched.slice(0, 8)
  return units
    .filter((u) => pickText(u, ['조문여부']) === '조문')
    .slice(0, 5)
    .map(joUnitToPlainText)
}

async function fetchLawContext(userDataDir, keyword, hints) {
  const snippets = []
  const resolved = await resolveMajorLaws(userDataDir, HR_MAJOR_LAW_NAMES)
  const majorByName = new Map((resolved.laws || []).map((l) => [l.name, l]))

  const targets = []

  for (const hint of hints) {
    const law = majorByName.get(hint.lawName)
    if (law?.mst) targets.push({ lawName: hint.lawName, mst: law.mst, jo: hint.jo, joLabel: hint.joLabel })
  }

  const search = await searchLaws(userDataDir, { query: keyword, display: 5, page: 1 })
  for (const law of (search.laws || []).slice(0, 3)) {
    if (!law.mst) continue
    if (targets.some((t) => t.mst === law.mst)) continue
    targets.push({ lawName: law.name, mst: law.mst, jo: undefined, joLabel: '' })
  }

  for (const t of targets.slice(0, 4)) {
    try {
      const body = await getLawBody(userDataDir, {
        mst: t.mst,
        jo: t.jo,
        type: 'JSON',
      })
      const texts = extractLawSnippetsFromJson(body.data, keyword)
      if (texts.length) {
        snippets.push({
          lawName: t.lawName,
          joLabel: t.joLabel,
          texts: texts.slice(0, 4),
        })
      }
    } catch {
      /* skip */
    }
  }

  return snippets
}

async function fetchRecentChanges(userDataDir, keyword) {
  const r = await getRecentHrLawChanges(userDataDir, { days: 365, filterNames: HR_MAJOR_LAW_NAMES })
  const kw = String(keyword ?? '').trim().toLowerCase()
  return (r.items || [])
    .filter((it) => {
      const blob = `${it.lawName} ${it.joTitle} ${it.joNo} ${it.reason}`.toLowerCase()
      return !kw || blob.includes(kw.replace(/\s+/g, '')) || blob.includes(kw)
    })
    .slice(0, 8)
}

async function runRegulationLawCompare(userDataDir, { keyword }) {
  const kw = String(keyword ?? '').trim()
  if (!kw) {
    return { ok: false, message: '키워드를 입력해 주세요.' }
  }

  const regStatus = getRegulationsStatus()
  const gistHits = await searchRegulationsByKeyword(kw)
  const hints = resolveKeywordHints(kw)
  const lawSnippets = await fetchLawContext(userDataDir, kw, hints)
  const recentChanges = await fetchRecentChanges(userDataDir, kw)

  if (!lawSnippets.length) {
    return {
      ok: false,
      message: '관련 법령을 찾지 못했습니다. 법령 API(OC) 설정과 키워드를 확인해 주세요.',
      folder: regStatus.folder,
      gistHits,
    }
  }

  const gemini = await compareRegulationWithLaw(userDataDir, {
    keyword: kw,
    gistHits,
    lawSnippets,
    recentChanges,
    regulationsFolder: regStatus.folder,
  })

  return {
    ...gemini,
    folder: regStatus.folder,
    gistHits,
    lawSources: lawSnippets.map((s) => s.lawName),
    recentChanges,
  }
}

module.exports = { runRegulationLawCompare }
