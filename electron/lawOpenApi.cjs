/**
 * 국가법령정보 공동활용 OPEN API (open.law.go.kr)
 * OC: .env LAW_GO_KR_OC 또는 userData/law-config.json
 */
const fs = require('fs')
const path = require('path')
const { loadAppEnv } = require('./headcountPublish.cjs')
const { renderLawBodyHtml } = require('./lawBodyHtml.cjs')

const DRF_BASE = 'http://www.law.go.kr/DRF'
const SOURCE_LABEL = '국가법령정보센터'

function loadDotEnvFile(envPath) {
  try {
    const text = fs.readFileSync(envPath, 'utf8')
    const out = {}
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim().replace(/^\uFEFF/, '')
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      out[key] = val
    }
    return out
  } catch {
    return null
  }
}

function getLawOpenConfig(userDataDir) {
  loadAppEnv()
  const fromEnv = String(process.env.LAW_GO_KR_OC ?? '').trim()
  if (fromEnv) {
    return {
      oc: fromEnv,
      type: String(process.env.LAW_GO_KR_TYPE ?? 'JSON').trim() || 'JSON',
      source: 'env',
    }
  }

  const configPath = path.join(userDataDir, 'law-config.json')
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    const oc = String(data.oc ?? data.LAW_GO_KR_OC ?? '').trim()
    if (oc) {
      return {
        oc,
        type: String(data.type ?? 'JSON').trim() || 'JSON',
        source: 'file',
      }
    }
  } catch {
    /* noop */
  }

  const dotenvPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(path.dirname(process.execPath), '.env'),
    path.join(require('os').homedir(), 'Desktop', 'HRM', '.env'),
  ]
  for (const envPath of dotenvPaths) {
    const projectEnv = loadDotEnvFile(envPath)
    if (projectEnv?.LAW_GO_KR_OC?.trim()) {
      return {
        oc: projectEnv.LAW_GO_KR_OC.trim(),
        type: (projectEnv.LAW_GO_KR_TYPE || 'JSON').trim() || 'JSON',
        source: 'dotenv',
      }
    }
  }

  return null
}

function asArray(v) {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim()
  }
  return ''
}

function normalizeLawRow(row) {
  return {
    name: pick(row, ['법령명한글', '법령명', 'lawNm', 'LawName']),
    lawId: pick(row, ['법령ID', 'lawId', 'ID']),
    mst: pick(row, ['법령일련번호', 'MST', 'lsiSeq', '법령일련번호']),
    efYd: pick(row, ['시행일자', 'efYd', '시행일']),
    pubYd: pick(row, ['공포일자', 'pubYd', '공포일']),
    dept: pick(row, ['소관부처명', 'dept', '소관부처']),
    link: pick(row, ['법령상세링크', 'link']),
  }
}

function normalizeJoChangeRow(row) {
  return {
    regDt: pick(row, ['조문개정일', 'regDt', '개정일']),
    lawName: pick(row, ['법령명한글', '법령명', 'lawNm']),
    lawId: pick(row, ['법령ID', 'lawId', 'ID']),
    joNo: pick(row, ['조문번호', 'JO', 'joNo']),
    joTitle: pick(row, ['조문제목', 'joTitle']),
    reason: pick(row, ['변경사유', 'reason']),
    link: pick(row, ['조문변경이력상세링크', 'link']),
  }
}

async function fetchDrf(endpoint, params, cfg) {
  const url = new URL(`${DRF_BASE}/${endpoint}`)
  url.searchParams.set('OC', cfg.oc)
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v))
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json, text/xml, */*' },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`법령 API 오류 (${res.status}): ${text.slice(0, 200)}`)
  }

  if (cfg.type.toUpperCase() === 'JSON' || text.trim().startsWith('{')) {
    try {
      return JSON.parse(text)
    } catch {
      throw new Error('법령 API JSON 응답을 해석하지 못했습니다.')
    }
  }
  throw new Error('JSON 형식(LAW_GO_KR_TYPE=JSON)으로 요청해 주세요.')
}

function extractSearchBlock(json) {
  return (
    json?.LawSearch ||
    json?.lawSearch ||
    json?.lsJoHstInf ||
    json?.LsJoHstInf ||
    json
  )
}

function getLawStatus(userDataDir) {
  const cfg = getLawOpenConfig(userDataDir)
  return {
    configured: Boolean(cfg?.oc),
    source: cfg?.source ?? null,
    responseType: cfg?.type ?? 'JSON',
    sourceLabel: SOURCE_LABEL,
  }
}

async function searchLaws(userDataDir, { query = '', page = 1, display = 20, search = 1 } = {}) {
  const cfg = getLawOpenConfig(userDataDir)
  if (!cfg) {
    return { ok: false, configured: false, message: 'LAW_GO_KR_OC가 설정되지 않았습니다. .env를 확인하세요.' }
  }

  const json = await fetchDrf(
    'lawSearch.do',
    {
      target: 'law',
      type: cfg.type,
      query: query || undefined,
      display: Math.min(100, Math.max(1, display)),
      page: Math.max(1, page),
      search,
      sort: 'ddes',
    },
    cfg,
  )

  const block = extractSearchBlock(json)
  const totalCnt = Number(block?.totalCnt ?? block?.totalCount ?? 0) || 0
  const laws = asArray(block?.law).map(normalizeLawRow).filter((l) => l.name)

  return {
    ok: true,
    configured: true,
    totalCnt,
    page: Number(block?.page ?? page) || page,
    laws,
    sourceLabel: SOURCE_LABEL,
  }
}

async function getLawBody(userDataDir, { mst, lawId, jo, type } = {}) {
  const cfg = getLawOpenConfig(userDataDir)
  if (!cfg) {
    return { ok: false, configured: false, message: 'LAW_GO_KR_OC가 설정되지 않았습니다.' }
  }
  if (!mst && !lawId) {
    return { ok: false, configured: true, message: '법령 MST 또는 ID가 필요합니다.' }
  }

  const wantJson = String(type || '').toUpperCase() === 'JSON'
  const params = { target: 'law', type: 'JSON', LANG: 'KO' }
  if (mst) params.MST = mst
  if (lawId) params.ID = lawId
  if (jo) params.JO = jo

  const json = await fetchDrf('lawService.do', params, cfg)

  if (wantJson) {
    return { ok: true, configured: true, format: 'json', data: json, sourceLabel: SOURCE_LABEL }
  }

  const html = renderLawBodyHtml(json)
  if (!html) {
    return { ok: false, configured: true, message: '법령 본문을 HTML로 변환하지 못했습니다.' }
  }

  return {
    ok: true,
    configured: true,
    format: 'html',
    html,
    sourceLabel: SOURCE_LABEL,
  }
}

async function getJoChanges(userDataDir, { fromRegDt, toRegDt, regDt, page = 1, display = 50 } = {}) {
  const cfg = getLawOpenConfig(userDataDir)
  if (!cfg) {
    return { ok: false, configured: false, message: 'LAW_GO_KR_OC가 설정되지 않았습니다.' }
  }

  const json = await fetchDrf(
    'lawSearch.do',
    {
      target: 'lsJoHstInf',
      type: cfg.type,
      fromRegDt,
      toRegDt,
      regDt,
      page,
      display: Math.min(100, display),
    },
    cfg,
  )

  const block = extractSearchBlock(json)
  const items = asArray(block?.lsJoHstInf || block?.joHst || block?.law || block?.item)
    .map(normalizeJoChangeRow)
    .filter((r) => r.lawName || r.regDt)

  return {
    ok: true,
    configured: true,
    totalCnt: Number(block?.totalCnt ?? 0) || items.length,
    items,
    fromRegDt,
    toRegDt,
    sourceLabel: SOURCE_LABEL,
  }
}

function formatYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function majorCachePath(userDataDir) {
  return path.join(userDataDir, 'hr-law-major-cache.json')
}

function readMajorCache(userDataDir) {
  try {
    return JSON.parse(fs.readFileSync(majorCachePath(userDataDir), 'utf8'))
  } catch {
    return { laws: [], updatedAt: null }
  }
}

function writeMajorCache(userDataDir, laws) {
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.writeFileSync(
    majorCachePath(userDataDir),
    JSON.stringify({ laws, updatedAt: new Date().toISOString() }, null, 2),
    'utf8',
  )
}

/** 주요 인사·근로 법령 MST 해석 (검색 API + 캐시) */
async function resolveMajorLaws(userDataDir, names) {
  const cfg = getLawOpenConfig(userDataDir)
  if (!cfg) {
    return { ok: false, configured: false, message: 'LAW_GO_KR_OC가 설정되지 않았습니다.' }
  }

  const cache = readMajorCache(userDataDir)
  const byName = new Map((cache.laws || []).map((l) => [l.name, l]))
  const resolved = []

  for (const name of names) {
    let row = byName.get(name)
    if (!row?.mst) {
      const found = await searchLaws(userDataDir, { query: name, display: 5, search: 1 })
      if (found.ok && found.laws.length) {
        const exact = found.laws.find((l) => l.name === name) || found.laws[0]
        row = { name, ...exact }
        byName.set(name, row)
      } else {
        row = { name, mst: '', lawId: '', efYd: '', error: '검색 결과 없음' }
      }
    }
    resolved.push(row)
  }

  writeMajorCache(userDataDir, [...byName.values()])
  return { ok: true, configured: true, laws: resolved, sourceLabel: SOURCE_LABEL }
}

/** 7-1: 본법 + 해당 시행령·시행규칙 매칭 */
function matchesRecentHrLaw(lawName, bases) {
  const ln = String(lawName ?? '').trim()
  if (!ln) return false

  for (const base of bases) {
    const b = String(base ?? '').trim()
    if (!b) continue

    if (ln === b) return true

    if (ln.startsWith(b)) {
      const tail = ln.slice(b.length).trim()
      if (!tail) return true
      if (/^시행령/.test(tail) || /^시행규칙/.test(tail)) return true
    }

    if (/시행령|시행규칙/.test(ln) && (ln.includes(b) || b.includes(ln))) return true
  }

  return false
}

async function getRecentHrLawChanges(
  userDataDir,
  { days = 365, filterNames = [], lawBases = [], strictFilter = false } = {},
) {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - Math.max(7, days))

  const result = await getJoChanges(userDataDir, {
    fromRegDt: formatYmd(from),
    toRegDt: formatYmd(to),
    display: 100,
  })
  if (!result.ok) return result

  const nameSet = new Set(filterNames.map((n) => n.trim()).filter(Boolean))
  const bases = lawBases.map((n) => String(n).trim()).filter(Boolean)
  let items = result.items
  if (strictFilter && bases.length > 0) {
    const sortedBases = [...bases].sort((a, b) => b.length - a.length)
    items = items.filter((it) => matchesRecentHrLaw(it.lawName, sortedBases))
  } else if (nameSet.size > 0) {
    items = items.filter((it) => {
      for (const n of nameSet) {
        if (it.lawName.includes(n) || n.includes(it.lawName)) return true
      }
      if (strictFilter) return false
      return (
        /근로|고용|퇴직|산재|공무원|개인정보|남녀고용|모성|임금|노동/.test(it.lawName) ||
        /근로|고용|퇴직|산재|임금|노동/.test(it.reason)
      )
    })
  }

  items.sort((a, b) => String(b.regDt).localeCompare(String(a.regDt)))

  return {
    ...result,
    items,
    fromRegDt: formatYmd(from),
    toRegDt: formatYmd(to),
    filterCount: items.length,
  }
}

module.exports = {
  getLawStatus,
  getLawOpenConfig,
  searchLaws,
  getLawBody,
  getJoChanges,
  resolveMajorLaws,
  getRecentHrLawChanges,
  SOURCE_LABEL,
}
