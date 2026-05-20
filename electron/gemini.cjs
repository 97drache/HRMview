/**
 * Gemini API — Electron main 전용. API 키는 renderer·Vercel 빌드에 포함되지 않습니다.
 */
const fs = require('fs')
const path = require('path')
const { prepareReceiptImageBuffer } = require('./receiptImagePrepare.cjs')
const { formatWonLine } = require('./koreanWon.cjs')

const DEFAULT_MODEL = 'gemini-2.0-flash'
const MAX_RECEIPT_IMAGES = 4
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

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
      const key = trimmed.slice(0, eq).trim()
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

  const projectEnv = loadDotEnvFile(path.join(__dirname, '..', '.env'))
  if (projectEnv?.GEMINI_API_KEY?.trim()) {
    return {
      apiKey: projectEnv.GEMINI_API_KEY.trim(),
      model: (projectEnv.GEMINI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
      source: 'dotenv',
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
    note: { type: 'string', description: '불확실한 항목 설명, 없으면 빈 문자열' },
  },
  required: ['dateTime', 'merchantName', 'businessNo', 'amount', 'merchantPhone', 'note'],
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

const TRIP_VOICE_SCHEMA = {
  type: 'object',
  properties: {
    destination: { type: 'string', description: '출장지' },
    dateRange: { type: 'string', description: '출장 기간 문구' },
    note: { type: 'string' },
  },
  required: ['destination', 'dateRange', 'note'],
}

async function callGeminiJson({ apiKey, model, systemText, parts, schema }) {
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
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
  })
  const raw = await res.text()
  if (!res.ok) {
    let msg = raw.slice(0, 240)
    try {
      const j = JSON.parse(raw)
      msg = j?.error?.message || msg
    } catch {
      /* noop */
    }
    throw new Error(`Gemini API 오류 (${res.status}): ${msg}`)
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

function mimeForImage(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'image/jpeg'
}

async function readImageForGemini(absPath) {
  const abs = path.resolve(String(absPath))
  try {
    return { mimeType: 'image/jpeg', data: await prepareReceiptImageBuffer(abs) }
  } catch {
    const st = await fs.promises.stat(abs)
    if (st.size > MAX_IMAGE_BYTES) {
      throw new Error(`이미지가 너무 큽니다(4MB 제한): ${path.basename(abs)}`)
    }
    const buf = await fs.promises.readFile(abs)
    return { mimeType: mimeForImage(abs), data: buf }
  }
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
      inlineData: {
        mimeType,
        data: data.toString('base64'),
      },
    })
  }

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
      '읽기 어려우면 note에 이유를 적고 가능한 필드만 채우세요.',
    ].join('\n'),
  })

  const parsed = await callGeminiJson({
    apiKey: cfg.apiKey,
    model: cfg.model,
    systemText:
      '당신은 한국 공공기관 지출증빙용 영수증 분석 도우미입니다. JSON만 반환하고 추측은 note에 적으세요.',
    parts,
    schema: RECEIPT_SCHEMA,
  })

  const amount = Number(parsed.amount) || 0
  const merchantName = String(parsed.merchantName ?? '').trim()
  const businessNo = String(parsed.businessNo ?? '').trim()
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
    amountLine: amount > 0 ? formatWonLine(amount) : '',
    merchantPhone: String(parsed.merchantPhone ?? '').trim(),
    note: String(parsed.note ?? '').trim(),
    imageCount: parts.length - 1,
    message: parsed.note ? String(parsed.note) : 'Gemini로 영수증을 분석했습니다.',
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

  const parsed = await callGeminiJson({
    apiKey: cfg.apiKey,
    model: cfg.model,
    systemText:
      '한국어 음성을 출장 증빙 양식 필드로 정리합니다. destination=출장지, dateRange=출장 기간(자연어 유지).',
    parts: [{ text: `출장 관련 구두 입력:\n\n${utterance}` }],
    schema: TRIP_VOICE_SCHEMA,
  })

  return {
    ok: true,
    configured: true,
    destination: String(parsed.destination ?? '').trim(),
    dateRange: String(parsed.dateRange ?? '').trim(),
    note: String(parsed.note ?? '').trim(),
    message: 'Gemini로 출장 내용을 정리했습니다.',
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

  const parsed = await callGeminiJson({
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
    message: 'Gemini로 음성 내용을 정리했습니다.',
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

module.exports = {
  getGeminiConfig,
  getGeminiStatus,
  saveGeminiApiKey,
  analyzeReceiptImages,
  parseExpenseVoiceText,
  parseTripVoiceText,
  DEFAULT_MODEL,
}
