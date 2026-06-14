/**
 * Gemini API — Electron main 전용. API 키는 renderer·Vercel 빌드에 포함되지 않습니다.
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const { formatWonLine, formatWonComma } = require('./koreanWon.cjs')

/** 무료 티어에서 gemini-2.0-flash 한도가 0인 계정이 많아 lite 를 기본으로 사용 */
const DEFAULT_MODEL = 'gemini-2.0-flash-lite'
const MODEL_FALLBACKS = [
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
]
const MAX_RECEIPT_IMAGES = 4
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const MIN_CROP_CONFIDENCE = 0.45
const MAX_CROP_AREA_RATIO = 0.88
const receiptBBoxCache = new Map()

const RECEIPT_BBOX_SCHEMA = {
  type: 'object',
  properties: {
    ymin: { type: 'number', description: '영수증 상단 Y (0~1000, 이미지 높이 대비)' },
    xmin: { type: 'number', description: '영수증 좌측 X (0~1000)' },
    ymax: { type: 'number', description: '영수증 하단 Y (0~1000)' },
    xmax: { type: 'number', description: '영수증 우측 X (0~1000)' },
    confidence: { type: 'number', description: '0~1, 영수증 영역 확신도' },
    note: { type: 'string', description: '불확실 시 이유, 없으면 빈 문자열' },
  },
  required: ['ymin', 'xmin', 'ymax', 'xmax', 'confidence', 'note'],
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function modelsToTry(primary) {
  const first = String(primary || DEFAULT_MODEL).trim() || DEFAULT_MODEL
  const list = [first]
  for (const m of MODEL_FALLBACKS) {
    if (!list.includes(m)) list.push(m)
  }
  return list
}

function parseRetryDelayMs(message) {
  const m = String(message ?? '').match(/retry in ([\d.]+)s/i)
  if (!m) return 8000
  return Math.min(Math.max(Math.ceil(Number(m[1]) * 1000), 1000), 30000)
}

function formatGeminiApiError(status, rawMessage) {
  const msg = String(rawMessage ?? '').trim()
  if (status === 429 || /quota|rate limit|resource exhausted/i.test(msg)) {
    if (/limit:\s*0/i.test(msg) || /free_tier/i.test(msg)) {
      return [
        'Gemini 무료 할당량이 현재 모델에서 사용할 수 없습니다.',
        '.env 의 GEMINI_MODEL 을 gemini-2.0-flash-lite 로 바꾸고 앱을 다시 실행해 보세요.',
        '그래도 안 되면 AI Studio에서 결제(빌링) 연결 또는 https://aistudio.google.com/rate-limit 에서 한도를 확인하세요.',
      ].join(' ')
    }
    return 'Gemini 요청 한도를 초과했습니다. 잠시 후 다시 시도하거나 AI Studio 사용량을 확인해 주세요.'
  }
  if (status === 404 || /not found|is not supported/i.test(msg)) {
    return `지원하지 않는 모델입니다. .env 에 GEMINI_MODEL=${DEFAULT_MODEL} 등으로 변경해 주세요. (${msg.slice(0, 120)})`
  }
  return msg.length > 280 ? `${msg.slice(0, 280)}…` : msg
}

function readConfigFile(configPath) {
  try {
    const raw = fs.readFileSync(configPath, 'utf8')
    const data = JSON.parse(raw)
    const apiKey = String(data.apiKey ?? data.GEMINI_API_KEY ?? '').trim()
    const model = String(data.model ?? data.GEMINI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL
    return apiKey ? { apiKey, model } : null
  } catch {
    return null
  }
}

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

function getGeminiConfig(userDataDir) {
  const fromEnv = String(process.env.GEMINI_API_KEY ?? '').trim()
  if (fromEnv) {
    return {
      apiKey: fromEnv,
      model: String(process.env.GEMINI_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL,
      source: 'env',
    }
  }

  const configPath = path.join(userDataDir, 'gemini-config.json')
  const fromFile = readConfigFile(configPath)
  if (fromFile) return { ...fromFile, source: 'file' }

  const dotenvPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(path.dirname(process.execPath), '.env'),
    path.join(require('os').homedir(), 'Desktop', 'HRM', '.env'),
  ]
  for (const envPath of dotenvPaths) {
    const projectEnv = loadDotEnvFile(envPath)
    if (projectEnv?.GEMINI_API_KEY?.trim()) {
      return {
        apiKey: projectEnv.GEMINI_API_KEY.trim(),
        model: (projectEnv.GEMINI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
        source: 'dotenv',
      }
    }
  }

  return null
}

function saveGeminiApiKey(userDataDir, apiKey) {
  const configPath = path.join(userDataDir, 'gemini-config.json')
  const key = String(apiKey ?? '').trim()
  if (!key) {
    try {
      fs.unlinkSync(configPath)
    } catch {
      /* noop */
    }
    return { ok: true, configured: false }
  }
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.writeFileSync(
    configPath,
    JSON.stringify({ apiKey: key, model: DEFAULT_MODEL }, null, 2),
    'utf8',
  )
  return { ok: true, configured: true }
}

const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    dateTime: { type: 'string', description: 'YYYY-MM-DD HH:mm:ss 형식, 없으면 빈 문자열' },
    merchantName: { type: 'string' },
    businessNo: { type: 'string', description: '###-##-#####' },
    amount: { type: 'number', description: '승인금액 정수, 원' },
    merchantPhone: { type: 'string' },
    cropYmin: { type: 'number', description: '첫 이미지 기준 영수증 종이 상단 Y (0~1000)' },
    cropXmin: { type: 'number', description: '영수증 종이 좌측 X (0~1000)' },
    cropYmax: { type: 'number', description: '영수증 종이 하단 Y (0~1000)' },
    cropXmax: { type: 'number', description: '영수증 종이 우측 X (0~1000)' },
    note: { type: 'string', description: '불확실한 항목 설명, 없으면 빈 문자열' },
  },
  required: [
    'dateTime',
    'merchantName',
    'businessNo',
    'amount',
    'merchantPhone',
    'cropYmin',
    'cropXmin',
    'cropYmax',
    'cropXmax',
    'note',
  ],
}

const VOICE_SCHEMA = {
  type: 'object',
  properties: {
    purpose: { type: 'string' },
    attendees: { type: 'string' },
    dateTime: { type: 'string' },
    location: { type: 'string' },
    amount: { type: 'number' },
    amountLine: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['purpose', 'attendees', 'dateTime', 'location', 'amount', 'amountLine', 'note'],
}

const TRIP_DOC_SCHEMA = {
  type: 'object',
  properties: {
    dept: { type: 'string', description: '소속 부서' },
    rankLabel: { type: 'string', description: '직급' },
    name: { type: 'string', description: '성명' },
    destination: { type: 'string', description: '출장지' },
    dateRange: { type: 'string', description: '출장 기간 (예: 2026-01-15 ~ 2026-01-17)' },
    note: { type: 'string' },
  },
  required: ['dept', 'rankLabel', 'name', 'destination', 'dateRange', 'note'],
}

const TRIP_VOICE_SCHEMA = {
  type: 'object',
  properties: {
    dept: { type: 'string' },
    rankLabel: { type: 'string' },
    name: { type: 'string' },
    destination: { type: 'string', description: '출장지' },
    dateRange: { type: 'string', description: '출장 기간 문구' },
    note: { type: 'string' },
  },
  required: ['dept', 'rankLabel', 'name', 'destination', 'dateRange', 'note'],
}

async function callGeminiJsonOnce({ apiKey, model, systemText, parts, schema, maxOutputTokens = 1024 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
  })
  const raw = await res.text()
  if (!res.ok) {
    let msg = raw.slice(0, 800)
    try {
      const j = JSON.parse(raw)
      msg = j?.error?.message || msg
    } catch {
      /* noop */
    }
    const err = new Error(formatGeminiApiError(res.status, msg))
    err.status = res.status
    err.rawMessage = msg
    err.model = model
    throw err
  }
  let envelope
  try {
    envelope = JSON.parse(raw)
  } catch {
    throw new Error('Gemini 응답을 해석하지 못했습니다.')
  }
  const text = envelope?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini가 비어 있는 응답을 반환했습니다.')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Gemini JSON 형식이 올바르지 않습니다.')
  }
}

async function callGeminiJson({ apiKey, model, systemText, parts, schema, maxOutputTokens }) {
  const candidates = modelsToTry(model)
  let lastErr = null
  for (let i = 0; i < candidates.length; i++) {
    const tryModel = candidates[i]
    try {
      return await callGeminiJsonOnce({
        apiKey,
        model: tryModel,
        systemText,
        parts,
        schema,
        maxOutputTokens,
      })
    } catch (e) {
      lastErr = e
      const status = e?.status ?? 0
      const retryable = status === 429 || status === 503
      if (!retryable || i >= candidates.length - 1) break
      await sleep(parseRetryDelayMs(e?.rawMessage || e?.message))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

function mimeForImage(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'image/jpeg'
}

async function readImageForGemini(absPath) {
  const abs = path.resolve(String(absPath))
  const buf = await sharp(abs, { failOn: 'none' })
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer()
  if (buf.length > MAX_IMAGE_BYTES) {
    throw new Error(`이미지가 너무 큽니다(4MB 제한): ${path.basename(abs)}`)
  }
  return { mimeType: 'image/jpeg', data: buf }
}

function clampBox(n, lo, hi) {
  const v = Number(n)
  if (!Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

function normalizeReceiptBBox(parsed) {
  let ymin = clampBox(parsed.ymin, 0, 1000)
  let xmin = clampBox(parsed.xmin, 0, 1000)
  let ymax = clampBox(parsed.ymax, 0, 1000)
  let xmax = clampBox(parsed.xmax, 0, 1000)
  if (ymin > ymax) [ymin, ymax] = [ymax, ymin]
  if (xmin > xmax) [xmin, xmax] = [xmax, xmin]
  const confidence = clampBox(parsed.confidence, 0, 1)
  const w = xmax - xmin
  const h = ymax - ymin
  if (w < 80 || h < 80) return null
  if (w * h > 1000 * 1000 * MAX_CROP_AREA_RATIO) return null
  return {
    ymin,
    xmin,
    ymax,
    xmax,
    confidence,
    note: String(parsed.note ?? '').trim(),
  }
}

async function cacheKeyForImage(absPath) {
  const st = await fs.promises.stat(absPath)
  return `${absPath}|${st.mtimeMs}|${st.size}`
}

async function croppedBufferDarkRatio(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let dark = 0
  const total = info.width * info.height
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      if (l < 70) dark++
    }
  }
  return dark / total
}

async function detectReceiptBoundingBox(absPath, cfg, options = {}) {
  const abs = path.resolve(String(absPath))
  const { mimeType, data } = await readImageForGemini(abs)
  const blackHint = options.blackBackground
    ? [
        '이 사진은 **검은 책상·어두운 바닥** 위에 흰 영수증이 놓인 경우입니다.',
        '영수증 종이 직사각형만 좁게 잡고, 주변 검은 영역은 bbox에 넣지 마세요.',
      ]
    : []
  const parts = [
    {
      inlineData: { mimeType, data: data.toString('base64') },
    },
    {
      text: [
        '사진·스캔에서 **종이 영수증(매출전표·간이영수증)이 인쇄된 직사각형 영역만** 찾으세요.',
        '- 책상·바닥·손·그림자·검은 배경·카드 단말기는 제외합니다.',
        '- 영수증 전체(상호·일시·금액·사업자번호·전화번호가 보이는 종이)가 들어가게 타이트하게 잡으세요. 글자가 잘리면 안 됩니다.',
        '- 좌표는 이미지 기준 정규화 0~1000 (왼쪽 위가 0,0). ymin,xmin=좌상단, ymax,xmax=우하단.',
        '- bbox가 이미지 거의 전체(90% 이상)이면 잘못된 것입니다. 영수증 종이만 포함하세요.',
        ...blackHint,
        '- 영수증이 없거나 확실하지 않으면 confidence를 0.3 이하로 두고 note에 이유를 적으세요.',
      ].join('\n'),
    },
  ]

  const parsed = await callGeminiJson({
    apiKey: cfg.apiKey,
    model: cfg.model,
    systemText:
      '영수증 영역 탐지 전용입니다. JSON만 반환합니다. 배경은 절대 포함하지 마세요.',
    parts,
    schema: RECEIPT_BBOX_SCHEMA,
    maxOutputTokens: 256,
  })

  const box = normalizeReceiptBBox(parsed)
  if (!box || box.confidence < MIN_CROP_CONFIDENCE) return null
  return box
}

async function getReceiptBoundingBoxCached(absPath, userDataDir) {
  const cfg = getGeminiConfig(userDataDir)
  if (!cfg?.apiKey) return null

  const abs = path.resolve(String(absPath))
  let key
  try {
    key = await cacheKeyForImage(abs)
  } catch {
    return null
  }

  if (receiptBBoxCache.has(key)) return receiptBBoxCache.get(key)

  try {
    let box = await detectReceiptBoundingBox(abs, cfg)
    if (!box) box = await detectReceiptBoundingBox(abs, cfg, { blackBackground: true })
    if (box) receiptBBoxCache.set(key, box)
    return box
  } catch (err) {
    console.warn('[HRM] Gemini receipt bbox:', err instanceof Error ? err.message : err)
    return null
  }
}

/** Gemini bbox → 크롭·증빙란용 JPEG (실패 시 null, 로컬 fallback) */
async function prepareReceiptEmbedBuffer(absPath, userDataDir) {
  const { extractReceiptByNormalizedBox, embedReceiptBuffer } = require('./receiptImagePrepare.cjs')

  let box = await getReceiptBoundingBoxCached(absPath, userDataDir)
  if (!box) {
    const cfg = getGeminiConfig(userDataDir)
    if (cfg?.apiKey) {
      try {
        box = await detectReceiptBoundingBox(absPath, cfg, { blackBackground: true })
      } catch {
        /* noop */
      }
    }
  }
  if (!box) return null

  const cropped = await extractReceiptByNormalizedBox(absPath, box)
  if (!cropped) return null

  const embedded = await embedReceiptBuffer(cropped)
  const dark = await croppedBufferDarkRatio(cropped)
  if (dark > 0.14) {
    const cfg = getGeminiConfig(userDataDir)
    if (cfg?.apiKey) {
      try {
        const retryBox = await detectReceiptBoundingBox(absPath, cfg, { blackBackground: true })
        if (retryBox) {
          const retryCrop = await extractReceiptByNormalizedBox(absPath, retryBox)
          if (retryCrop && (await croppedBufferDarkRatio(retryCrop)) < dark) {
            return embedReceiptBuffer(retryCrop)
          }
        }
      } catch {
        /* noop */
      }
    }
    if (dark > 0.22) return null
  }
  return embedded
}

function buildLocationLabel(merchantName, businessNo) {
  const m = String(merchantName ?? '').trim()
  const b = String(businessNo ?? '').trim()
  if (m && b) return `${m} (${b})`
  return m || b || ''
}

async function analyzeReceiptImages(imagePaths, userDataDir) {
  const cfg = getGeminiConfig(userDataDir)
  if (!cfg) {
    return { ok: false, configured: false, message: 'Gemini API 키가 설정되지 않았습니다.' }
  }

  const paths = (imagePaths || []).slice(0, MAX_RECEIPT_IMAGES)
  if (paths.length === 0) {
    return { ok: false, configured: true, message: '분석할 영수증 이미지가 없습니다.' }
  }

  const parts = await buildImageParts(paths)
  if (parts.length === 0) {
    return { ok: false, configured: true, message: '읽을 수 있는 이미지가 없습니다.' }
  }

  parts.push({
    text: [
      '첨부 한국 영수증·카드 매출전표·간이영수증 이미지에서 지출증빙 필드를 추출하세요.',
      '- dateTime: 승인·거래일시 (반드시 YYYY-MM-DD HH:mm:ss, 초 없으면 :00)',
      '- merchantName: 가맹점·상호 (카드사명만 있으면 매장명 우선)',
      '- businessNo: 사업자등록번호 (###-##-##### 형식)',
      '- amount: 승인·합계 금액 정수(원). 부가세·봉사료 제외한 카드 승인금액',
      '- merchantPhone: 매장 전화, 없으면 빈 문자열',
      '여러 장이면 실제 지출 1건 기준(가장 최근 승인·금액이 명확한 것)으로 하나만 합치세요.',
      'cropYmin,cropXmin,cropYmax,cropXmax: **첫 번째 이미지**에서 종이 영수증만 포함(검은 책상·손·그림자 제외, 글자 잘림 없이 0~1000 좌표).',
      '읽기 어려우면 note에 이유를 적고 가능한 필드만 채우세요.',
    ].join('\n'),
  })

  let parsed
  try {
    parsed = await callGeminiJson({
      apiKey: cfg.apiKey,
      model: cfg.model,
      systemText:
        '당신은 한국 공공기관 지출증빙용 영수증 분석 도우미입니다. JSON만 반환하고 추측은 note에 적으세요.',
      parts,
      schema: RECEIPT_SCHEMA,
    })
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: err instanceof Error ? err.message : String(err),
    }
  }

  const amount = Number(parsed.amount) || 0
  const merchantName = String(parsed.merchantName ?? '').trim()
  const businessNo = String(parsed.businessNo ?? '').trim()

  const cropBox = normalizeReceiptBBox({
    ymin: parsed.cropYmin,
    xmin: parsed.cropXmin,
    ymax: parsed.cropYmax,
    xmax: parsed.cropXmax,
    confidence: 0.92,
    note: '',
  })
  if (cropBox && paths[0]) {
    try {
      const key = await cacheKeyForImage(path.resolve(String(paths[0])))
      receiptBBoxCache.set(key, cropBox)
    } catch {
      /* noop */
    }
  }

  return {
    ok: true,
    configured: true,
    source: 'gemini',
    model: cfg.model,
    dateTime: String(parsed.dateTime ?? '').trim(),
    merchantName,
    businessNo,
    location: buildLocationLabel(merchantName, businessNo),
    amount,
    amountLine: amount > 0 ? formatWonComma(amount) : '',
    merchantPhone: String(parsed.merchantPhone ?? '').trim(),
    note: String(parsed.note ?? '').trim(),
    imageCount: parts.length - 1,
    message: parsed.note ? String(parsed.note) : '',
  }
}

async function buildImageParts(imagePaths) {
  const paths = (imagePaths || []).slice(0, MAX_RECEIPT_IMAGES)
  const parts = []
  for (const p of paths) {
    const abs = path.resolve(String(p))
    let st
    try {
      st = await fs.promises.stat(abs)
    } catch {
      continue
    }
    if (!st.isFile()) continue
    const { mimeType, data } = await readImageForGemini(abs)
    parts.push({
      inlineData: { mimeType, data: data.toString('base64') },
    })
  }
  return parts
}

async function analyzeTripImages(imagePaths, userDataDir) {
  const cfg = getGeminiConfig(userDataDir)
  if (!cfg) {
    return { ok: false, configured: false, message: 'Gemini API 키가 설정되지 않았습니다.' }
  }

  const parts = await buildImageParts(imagePaths)
  if (parts.length === 0) {
    return { ok: false, configured: true, message: '분석할 증빙 이미지가 없습니다.' }
  }

  parts.push({
    text: [
      '첨부 이미지에서 출장 증빙 양식 필드를 추출하세요.',
      '- dept: 소속 (예: 인사팀)',
      '- rankLabel: 직급 (예: 책임급)',
      '- name: 출장자 성명',
      '- destination: 출장지 (반드시 시·군·구 단위, 예: 부산, 광주, 수원 — 동·읍면만 있으면 상위 시명을 적으세요)',
      '- dateRange: 출장 기간 (yyyy-MM-dd ~ yyyy-MM-dd 또는 하루면 yyyy-MM-dd)',
      '출장신청서·교통·숙박·회의 안내 등 여러 장이면 하나의 출장 건으로 합치세요.',
      '확실하지 않은 항목은 note에 적고 가능한 필드만 채우세요.',
    ].join('\n'),
  })

  let parsed
  try {
    parsed = await callGeminiJson({
      apiKey: cfg.apiKey,
      model: cfg.model,
      systemText:
        '한국 공공기관 출장 증빙 문서 분석 도우미입니다. JSON만 반환하세요.',
      parts,
      schema: TRIP_DOC_SCHEMA,
    })
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: err instanceof Error ? err.message : String(err),
    }
  }

  return {
    ok: true,
    configured: true,
    dept: String(parsed.dept ?? '').trim(),
    rankLabel: String(parsed.rankLabel ?? '').trim(),
    name: String(parsed.name ?? '').trim(),
    destination: String(parsed.destination ?? '').trim(),
    dateRange: String(parsed.dateRange ?? '').trim(),
    note: String(parsed.note ?? '').trim(),
    imageCount: parts.length - 1,
    message: parsed.note ? String(parsed.note) : '',
  }
}

async function parseTripVoiceText(text, userDataDir) {
  const cfg = getGeminiConfig(userDataDir)
  if (!cfg) {
    return { ok: false, configured: false, message: 'Gemini API 키가 설정되지 않았습니다.' }
  }
  const utterance = String(text ?? '').trim()
  if (!utterance) {
    return { ok: false, configured: true, message: '인식된 음성 내용이 없습니다.' }
  }

  let parsed
  try {
    parsed = await callGeminiJson({
      apiKey: cfg.apiKey,
      model: cfg.model,
      systemText:
        '한국어 음성을 출장 증빙 양식 필드로 정리합니다. dept, rankLabel, name, destination, dateRange. 말하지 않은 항목은 빈 문자열.',
      parts: [{ text: `출장 관련 구두 입력:\n\n${utterance}` }],
      schema: TRIP_VOICE_SCHEMA,
    })
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: err instanceof Error ? err.message : String(err),
    }
  }

  return {
    ok: true,
    configured: true,
    dept: String(parsed.dept ?? '').trim(),
    rankLabel: String(parsed.rankLabel ?? '').trim(),
    name: String(parsed.name ?? '').trim(),
    destination: String(parsed.destination ?? '').trim(),
    dateRange: String(parsed.dateRange ?? '').trim(),
    note: String(parsed.note ?? '').trim(),
    message: '',
  }
}

async function parseExpenseVoiceText(text, userDataDir) {
  const cfg = getGeminiConfig(userDataDir)
  if (!cfg) {
    return { ok: false, configured: false, message: 'Gemini API 키가 설정되지 않았습니다.' }
  }
  const utterance = String(text ?? '').trim()
  if (!utterance) {
    return { ok: false, configured: true, message: '인식된 음성 내용이 없습니다.' }
  }

  let parsed
  try {
    parsed = await callGeminiJson({
      apiKey: cfg.apiKey,
      model: cfg.model,
      systemText: [
        '한국어 음성을 지출증빙 양식 필드로 정리합니다.',
        'purpose=목적, attendees=참석자(이름(사번) 형식 유지),',
        'dateTime, location, amount(숫자), amountLine(한글 금액 문구 가능).',
        '말하지 않은 항목은 빈 문자열 또는 0.',
      ].join(' '),
      parts: [{ text: `다음 구두 입력을 필드로 나누세요:\n\n${utterance}` }],
      schema: VOICE_SCHEMA,
    })
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: err instanceof Error ? err.message : String(err),
    }
  }

  const amount = Number(parsed.amount) || 0
  return {
    ok: true,
    configured: true,
    purpose: String(parsed.purpose ?? '').trim(),
    attendees: String(parsed.attendees ?? '').trim(),
    dateTime: String(parsed.dateTime ?? '').trim(),
    location: String(parsed.location ?? '').trim(),
    amount,
    amountLine: String(parsed.amountLine ?? '').trim(),
    note: String(parsed.note ?? '').trim(),
    message: '',
  }
}

const CAREER_RECORD_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    birthYmd: { type: 'string', description: 'YYYY-MM-DD' },
    hireYmd: { type: 'string', description: 'YYYY-MM-DD' },
    lastPromotionRank: { type: 'string', description: '현재 직급' },
    promotions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          rank: { type: 'string' },
        },
        required: ['date', 'rank'],
      },
    },
    workLog: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'YYYY-MM-DD' },
          endDate: { type: 'string', description: 'YYYY-MM-DD, 없으면 빈 문자열' },
          department: { type: 'string', description: '근무부서' },
          imsa: { type: 'string', description: '임면내용·발령 문구' },
        },
        required: ['startDate', 'department', 'imsa'],
      },
    },
    duties: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '팀장, 부장, 센터장 등 보직명' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          department: { type: 'string' },
        },
        required: ['title', 'department'],
      },
    },
    note: { type: 'string' },
  },
  required: ['name', 'birthYmd', 'hireYmd', 'lastPromotionRank', 'promotions', 'workLog', 'duties', 'note'],
}

const LEAVE_RECORD_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    birthYmd: { type: 'string' },
    empId: { type: 'string' },
    rankLabel: { type: 'string' },
    jobType: { type: 'string' },
    leaveStart: { type: 'string', description: 'YYYY-MM-DD' },
    leaveEnd: { type: 'string', description: 'YYYY-MM-DD' },
    leaveReason: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['name', 'birthYmd', 'empId', 'rankLabel', 'jobType', 'leaveStart', 'leaveEnd', 'leaveReason', 'note'],
}

const RETIREMENT_RECORD_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    birthYmd: { type: 'string' },
    empId: { type: 'string' },
    hireYmd: { type: 'string' },
    retireYmd: { type: 'string', description: '퇴직 또는 퇴직예정일 YYYY-MM-DD' },
    rankLabel: { type: 'string' },
    jobType: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['name', 'birthYmd', 'empId', 'hireYmd', 'retireYmd', 'rankLabel', 'jobType', 'note'],
}

const MAX_HR_PDF_BYTES = 18 * 1024 * 1024

async function readHrRecordParts(filePath) {
  const abs = path.resolve(String(filePath))
  const ext = path.extname(abs).toLowerCase()
  if (ext !== '.pdf') {
    throw new Error('Gemini 분석은 PDF 인사기록부만 지원합니다. 엑셀은 앱 내 파서를 사용하세요.')
  }
  const st = await fs.promises.stat(abs)
  if (!st.isFile()) throw new Error('파일이 아닙니다.')
  if (st.size > MAX_HR_PDF_BYTES) throw new Error('PDF가 너무 큽니다(18MB 이하).')
  const buf = await fs.promises.readFile(abs)
  return [
    { inlineData: { mimeType: 'application/pdf', data: buf.toString('base64') } },
    {
      text: `첨부 PDF는 공공기관 인사기록부입니다. 파일: ${path.basename(abs)}`,
    },
  ]
}

async function analyzeCareerRecordPdf(filePath, userDataDir, payload) {
  const cfg = getGeminiConfig(userDataDir)
  if (!cfg) {
    return { ok: false, configured: false, message: 'Gemini API 키가 설정되지 않았습니다.' }
  }
  const empId = String(payload?.empId ?? '').trim()
  const jobType = String(payload?.jobType ?? '').trim()
  let parts
  try {
    parts = await readHrRecordParts(filePath)
  } catch (err) {
    return { ok: false, configured: true, message: err instanceof Error ? err.message : String(err) }
  }
  parts.push({
    text: [
      '경력증명서 발급용으로 인사기록부를 분석하세요.',
      empId ? `대상 사번: ${empId}` : '사번은 문서에서 확인',
      jobType ? `직종(참고): ${jobType}` : '',
      '- promotions: 승진승급 일자·직급 (오래된 순)',
      '- workLog: 근무기록 각 발령(시작일, 종료일 있으면, 근무부서, 임면내용)',
      '- 근무부서는 문서의 실제 소속 부서만 적고, 기관명(예: 광주과학기술원)만 단독으로 쓰지 마세요.',
      '- 기관명 + 부서가 함께 보이면 기관명은 빼고 부서명만 적으세요.',
      '- 가장 마지막 근무기록도 반드시 포함해서 현재 부서가 누락되지 않게 하세요.',
      '- duties: 보직(팀장·부장·센터장·실장 등) 기간·부서',
      '날짜는 YYYY-MM-DD. 불확실하면 note에 적으세요.',
    ]
      .filter(Boolean)
      .join('\n'),
  })
  let parsed
  try {
    parsed = await callGeminiJson({
      apiKey: cfg.apiKey,
      model: cfg.model,
      maxOutputTokens: 8192,
      systemText:
        '한국 공공기관 인사기록부 PDF에서 경력증명서 데이터만 JSON으로 추출합니다. 부서는 실제 소속 부서명만 적고 기관명 단독 표기는 금지합니다. 추측은 note에 적습니다.',
      parts,
      schema: CAREER_RECORD_SCHEMA,
    })
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: err instanceof Error ? err.message : String(err),
    }
  }
  return {
    ok: true,
    configured: true,
    kind: 'career',
    record: parsed,
    message: String(parsed.note ?? '').trim(),
  }
}

async function analyzeLeaveRecordPdf(filePath, userDataDir, payload) {
  const cfg = getGeminiConfig(userDataDir)
  if (!cfg) {
    return { ok: false, configured: false, message: 'Gemini API 키가 설정되지 않았습니다.' }
  }
  const empId = String(payload?.empId ?? '').trim()
  let parts
  try {
    parts = await readHrRecordParts(filePath)
  } catch (err) {
    return { ok: false, configured: true, message: err instanceof Error ? err.message : String(err) }
  }
  parts.push({
    text: [
      '휴직증명서 발급용으로 인사기록부를 분석하세요.',
      empId ? `대상 사번: ${empId}` : '',
      '휴직·육아휴직·병가휴직 등 현재 또는 최근 휴직 기간·사유를 leaveStart, leaveEnd, leaveReason에 채우세요.',
      '날짜 YYYY-MM-DD.',
    ]
      .filter(Boolean)
      .join('\n'),
  })
  let parsed
  try {
    parsed = await callGeminiJson({
      apiKey: cfg.apiKey,
      model: cfg.model,
      maxOutputTokens: 4096,
      systemText: '인사기록부 PDF에서 휴직증명서 필드만 JSON으로 추출합니다.',
      parts,
      schema: LEAVE_RECORD_SCHEMA,
    })
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: err instanceof Error ? err.message : String(err),
    }
  }
  return {
    ok: true,
    configured: true,
    kind: 'leave',
    record: parsed,
    message: String(parsed.note ?? '').trim(),
  }
}

async function analyzeRetirementRecordPdf(filePath, userDataDir, payload) {
  const cfg = getGeminiConfig(userDataDir)
  if (!cfg) {
    return { ok: false, configured: false, message: 'Gemini API 키가 설정되지 않았습니다.' }
  }
  const empId = String(payload?.empId ?? '').trim()
  let parts
  try {
    parts = await readHrRecordParts(filePath)
  } catch (err) {
    return { ok: false, configured: true, message: err instanceof Error ? err.message : String(err) }
  }
  parts.push({
    text: [
      '퇴직(예정)증명서 발급용으로 인사기록부를 분석하세요.',
      empId ? `대상 사번: ${empId}` : '',
      '퇴직일·퇴직예정일·정년예정일 중 증명에 쓸 retireYmd를 채우세요. 입사일 hireYmd 포함.',
      '날짜 YYYY-MM-DD.',
    ]
      .filter(Boolean)
      .join('\n'),
  })
  let parsed
  try {
    parsed = await callGeminiJson({
      apiKey: cfg.apiKey,
      model: cfg.model,
      maxOutputTokens: 4096,
      systemText: '인사기록부 PDF에서 퇴직(예정)증명서 필드만 JSON으로 추출합니다.',
      parts,
      schema: RETIREMENT_RECORD_SCHEMA,
    })
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: err instanceof Error ? err.message : String(err),
    }
  }
  return {
    ok: true,
    configured: true,
    kind: 'retirement',
    record: parsed,
    message: String(parsed.note ?? '').trim(),
  }
}

function getGeminiStatus(userDataDir) {
  const cfg = getGeminiConfig(userDataDir)
  return {
    configured: Boolean(cfg?.apiKey),
    model: cfg?.model ?? DEFAULT_MODEL,
    source: cfg?.source ?? null,
    maxReceiptImages: MAX_RECEIPT_IMAGES,
  }
}

const REG_COMPARE_SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: '비교 주제(한 줄)' },
          gistRegulation: { type: 'string', description: 'GIST 규정 발췌·요약' },
          law: { type: 'string', description: '관련 법령 조문 요약' },
          difference: {
            type: 'string',
            description: '차이점·준수여부·최근 개정 반영·보완 권고',
          },
          compliance: {
            type: 'string',
            description: '준수 | 보완필요 | 미반영 | 확인필요 중 하나',
          },
        },
        required: ['topic', 'gistRegulation', 'law', 'difference', 'compliance'],
      },
    },
    summary: { type: 'string', description: '전체 요약(2~4문장)' },
  },
  required: ['rows', 'summary'],
}

async function compareRegulationWithLaw(
  userDataDir,
  { keyword, gistHits, lawSnippets, recentChanges, regulationsFolder },
) {
  const cfg = getGeminiConfig(userDataDir)
  if (!cfg) {
    return { ok: false, configured: false, message: 'Gemini API 키가 설정되지 않았습니다.' }
  }

  const gistBlock =
    gistHits?.length > 0
      ? gistHits
          .map((h, i) => `[${i + 1}] ${h.fileName}\n${h.snippet}`)
          .join('\n\n')
      : '(GIST 규정 폴더에서 해당 키워드 문구를 찾지 못했습니다.)'

  const lawBlock = (lawSnippets || [])
    .map((s) => {
      const head = s.joLabel ? `${s.lawName} ${s.joLabel}` : s.lawName
      return `${head}\n${(s.texts || []).join('\n---\n')}`
    })
    .join('\n\n')

  const changeBlock =
    recentChanges?.length > 0
      ? recentChanges
          .map((c) => `- ${c.regDt} ${c.lawName} ${c.joTitle || c.joNo}: ${c.reason || ''}`)
          .join('\n')
      : '(최근 1년 조문 개정 이력에서 직접 관련 항목 없음)'

  const userPrompt = [
    `키워드: ${keyword}`,
    `GIST 규정 폴더: ${regulationsFolder}`,
    '',
    '## GIST 규정 발췌',
    gistBlock,
    '',
    '## 관련 법령 조문',
    lawBlock,
    '',
    '## 최근 법령 개정 참고',
    changeBlock,
    '',
    '위 자료만 근거로 GIST 규정과 법령을 비교하세요.',
    'rows는 키워드와 관련된 주제별로 1~5행 작성.',
    'GIST 규정에 없으면 gistRegulation에 (규정 미발견) 표기.',
    '법령 준수 범위, 최근 개정 반영 여부, 보완점을 difference에 포함.',
  ].join('\n')

  let parsed
  try {
    parsed = await callGeminiJson({
      apiKey: cfg.apiKey,
      model: cfg.model,
      systemText: [
        '당신은 한국 공공기관(GIST) 인사·노무 담당자를 돕는 법령·내규 비교 분석가입니다.',
        '제공된 GIST 규정 발췌와 법령 조문만 근거로 판단합니다. 추측은 (확인필요)로 표시합니다.',
        'compliance는 준수, 보완필요, 미반영, 확인필요 중 하나만 사용합니다.',
        '출력은 JSON 스키마를 따릅니다.',
      ].join(' '),
      parts: [{ text: userPrompt }],
      schema: REG_COMPARE_SCHEMA,
      maxOutputTokens: 4096,
    })
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: err instanceof Error ? err.message : String(err),
    }
  }

  const rows = asArray(parsed.rows).map((r) => ({
    topic: String(r.topic ?? '').trim(),
    gistRegulation: String(r.gistRegulation ?? '').trim(),
    law: String(r.law ?? '').trim(),
    difference: String(r.difference ?? '').trim(),
    compliance: String(r.compliance ?? '확인필요').trim(),
  }))

  return {
    ok: true,
    configured: true,
    rows,
    summary: String(parsed.summary ?? '').trim(),
    source: 'gemini',
  }
}

function asArray(v) {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

module.exports = {
  getGeminiConfig,
  getGeminiStatus,
  saveGeminiApiKey,
  analyzeReceiptImages,
  analyzeTripImages,
  parseExpenseVoiceText,
  parseTripVoiceText,
  analyzeCareerRecordPdf,
  analyzeLeaveRecordPdf,
  analyzeRetirementRecordPdf,
  prepareReceiptEmbedBuffer,
  getReceiptBoundingBoxCached,
  compareRegulationWithLaw,
  DEFAULT_MODEL,
}
