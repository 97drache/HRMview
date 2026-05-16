const fs = require('fs')
const path = require('path')

let workerPromise = null
let workerInstance = null

async function createOcrWorker() {
  const { createWorker, PSM } = await import('tesseract.js')
  const worker = await createWorker('kor+eng', 1, { logger: () => {} })
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: String(PSM.AUTO),
    })
  } catch {
    /* ignore */
  }
  return worker
}

async function getOcrWorker() {
  if (workerInstance) return workerInstance
  if (!workerPromise) {
    workerPromise = createOcrWorker()
      .then((w) => {
        workerInstance = w
        return w
      })
      .catch((err) => {
        workerPromise = null
        workerInstance = null
        throw err
      })
  }
  return workerPromise
}

async function resetOcrWorker() {
  if (workerInstance) {
    try {
      await workerInstance.terminate()
    } catch {
      /* noop */
    }
  }
  workerInstance = null
  workerPromise = null
}

/** 사업자등록번호 (###-##-#####) */
function extractBusinessNo(text) {
  const raw = String(text ?? '')
  const labeled = raw.match(
    /(?:사업자\s*(?:등록)?\s*번호|사업자\s*No\.?|BUSINESS\s*NO)\s*[:：]?\s*(\d{3})\s*[-–]?\s*(\d{2})\s*[-–]?\s*(\d{5})/i,
  )
  if (labeled) return `${labeled[1]}-${labeled[2]}-${labeled[3]}`
  const plain = raw.match(/\b(\d{3})\s*[-–]\s*(\d{2})\s*[-–]\s*(\d{5})\b/)
  if (plain) return `${plain[1]}-${plain[2]}-${plain[3]}`
  return ''
}

/** 상호명 (사업자번호 인접·라벨 우선) */
function extractMerchantName(text, businessNo) {
  const raw = String(text ?? '')
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const labelMatch = raw.match(
    /(?:상호(?:명)?|가맹점(?:명)?|매장명|업체\s*명|사업장\s*명)\s*[:：]\s*([^\n\r]{2,48})/i,
  )
  if (labelMatch?.[1]) {
    return labelMatch[1].replace(/\s{2,}/g, ' ').trim()
  }

  if (businessNo) {
    const compactBiz = businessNo.replace(/-/g, '')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(businessNo) || lines[i].replace(/\D/g, '').includes(compactBiz)) {
        for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 1); j++) {
          const line = lines[j]
          if (line.includes(businessNo)) continue
          if (/^\d+$/.test(line.replace(/\D/g, ''))) continue
          if (/(승인|합계|금액|카드|전화|주소|대표)/.test(line)) continue
          if (/[가-힣A-Za-z]{2,}/.test(line) && line.length <= 40) return line
        }
      }
    }
  }

  for (const line of lines.slice(0, 12)) {
    if (line.length < 2 || line.length > 36) continue
    if (/^\d{4}[-./]/.test(line)) continue
    if (/(승인\s*금액|합\s*계|부가세|카드번호|전화|주소|TEL)/i.test(line)) continue
    if (/^\d{3}-\d{2}-\d{5}$/.test(line)) continue
    if (/[가-힣]{2,}/.test(line) && /(점|식당|카페|호텔|센터|주점|푸드|커피|본점|지점)/.test(line)) {
      return line
    }
  }

  for (const line of lines.slice(0, 8)) {
    if (/[가-힣A-Za-z]{2,}/.test(line) && line.length >= 2 && line.length <= 30) {
      if (!/(영수|매출|고객|승인|카드|현금)/.test(line)) return line
    }
  }
  return ''
}

/** 승인금액 우선 */
function extractApprovalAmount(text) {
  const raw = String(text ?? '')
  const compact = raw.replace(/\s+/g, ' ')

  const approvalPatterns = [
    /승인\s*금액\s*[:：]?\s*₩?\s*([\d,]+)/i,
    /승인\s*금액\s*[\s\S]{0,24}?₩\s*([\d,]+)/i,
    /승인\s*금액\s*[\s\S]{0,24}?([\d,]{3,})\s*원/i,
  ]
  for (const re of approvalPatterns) {
    const m = compact.match(re)
    if (m?.[1]) {
      const v = Number(String(m[1]).replace(/,/g, ''))
      if (v >= 100 && v < 100_000_000) return v
    }
  }

  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    if (!/승인\s*금액/i.test(line)) continue
    const m = line.match(/₩?\s*([\d,]+)\s*원?/i) || line.match(/([\d,]{3,})/)
    if (m?.[1]) {
      const v = Number(String(m[1]).replace(/,/g, ''))
      if (v >= 100 && v < 100_000_000) return v
    }
  }

  const fallback = []
  const reList = [
    /(?:합\s*계|총\s*액|결제\s*금액)\s*[:：]?\s*₩?\s*([\d,]+)/gi,
    /₩\s*([\d,]+)/g,
    /([\d,]{3,})\s*원/g,
  ]
  for (const re of reList) {
    let m
    const r = new RegExp(re.source, re.flags)
    while ((m = r.exec(compact)) !== null) {
      const v = Number(String(m[1]).replace(/,/g, ''))
      if (v >= 100 && v < 100_000_000) fallback.push(v)
    }
  }
  return fallback.length ? Math.max(...fallback) : 0
}

function extractDateTime(text) {
  const raw = String(text ?? '')
  const dt1 = raw.match(
    /(\d{4})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})[일\s]*(\d{1,2}:\d{2}(?::\d{2})?)/,
  )
  if (dt1) {
    const y = dt1[1]
    const m = dt1[2].padStart(2, '0')
    const d = dt1[3].padStart(2, '0')
    const t = dt1[4].length === 5 ? `${dt1[4]}:00` : dt1[4]
    return `${y}-${m}-${d} ${t}`
  }
  const dt2 = raw.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)
  if (dt2) return dt2[1]
  const dt3 = raw.match(/(\d{4})[.\-/](\d{2})[.\-/](\d{2})/)
  if (dt3) return `${dt3[1]}-${dt3[2]}-${dt3[3]}`
  return ''
}

function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/[^\d]/g, '')
  if (digits.length === 10) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  return String(raw ?? '').replace(/\s+/g, ' ').trim()
}

/** 사용처(업소) 전화번호 — 영수증 OCR */
function extractMerchantPhone(text) {
  const raw = String(text ?? '')

  const labeled = raw.match(
    /(?:전화|전화번호|대표전화|TEL|Tel|☎|☏)\s*[:：]?\s*(0?\d{1,2}[-.\s)]?\d{3,4}[-.\s)]?\d{4})/i,
  )
  if (labeled?.[1]) return normalizePhone(labeled[1])

  const storeLine = raw.match(
    /(?:사용처|업소|매장|가맹점)[^\n\r]{0,30}전화\s*[:：]?\s*(0?\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})/i,
  )
  if (storeLine?.[1]) return normalizePhone(storeLine[1])

  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    if (!/(전화|TEL|☎|☏)/i.test(line)) continue
    const m = line.match(/(0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4})/)
    if (m?.[1]) return normalizePhone(m[1])
  }

  const found = raw.match(/\b(0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4})\b/g)
  if (found?.length) {
    for (const p of found) {
      const norm = normalizePhone(p)
      if (norm && !/^010-0/.test(norm)) return norm
    }
    return normalizePhone(found[0])
  }
  return ''
}

function buildLocationLabel(merchantName, businessNo) {
  const name = String(merchantName ?? '').trim()
  const biz = String(businessNo ?? '').trim()
  if (name && biz) return `${name} (${biz})`
  return name || biz
}

function parseReceiptText(text) {
  const raw = String(text ?? '')
  const businessNo = extractBusinessNo(raw)
  const merchantName = extractMerchantName(raw, businessNo)
  const location = buildLocationLabel(merchantName, businessNo)
  const dateTime = extractDateTime(raw)
  const amount = extractApprovalAmount(raw)
  const merchantPhone = extractMerchantPhone(raw)

  return {
    dateTime,
    merchantName,
    businessNo,
    location,
    amount,
    merchantPhone,
    rawText: raw.slice(0, 8000),
  }
}

async function ocrImageFile(imagePath) {
  const worker = await getOcrWorker()
  const { data } = await worker.recognize(imagePath)
  return parseReceiptText(data.text)
}

function parseFromFileName(fileName) {
  const base = path.basename(fileName, path.extname(fileName))
  let dateTime = ''
  let location = ''
  let amount = 0
  const dm = base.match(/(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})(?:[-_.]?(\d{2})[-_.]?(\d{2}))?/)
  if (dm) {
    const t =
      dm[4] != null && dm[5] != null
        ? ` ${String(dm[4]).padStart(2, '0')}:${String(dm[5]).padStart(2, '0')}:00`
        : ''
    dateTime = `${dm[1]}-${dm[2]}-${dm[3]}${t}`
  }
  const am = base.match(/(\d{1,3}(?:,\d{3})+|\d{4,9})/g)
  if (am) {
    const nums = am.map((x) => Number(x.replace(/,/g, ''))).filter((n) => n >= 1000 && n < 100_000_000)
    if (nums.length) amount = Math.max(...nums)
  }
  const parts = base.split(/[_\s]+/).filter((p) => p && !/^\d+$/.test(p))
  if (parts.length) {
    const locPart = parts.find((p) => /[가-힣]/.test(p) && !/^\d{4}/.test(p))
    if (locPart) location = locPart
  }
  return { dateTime, location, merchantName: location, businessNo: '', amount }
}

function mergeParsed(target, source) {
  if (!source) return target
  if (!target.dateTime && source.dateTime) target.dateTime = source.dateTime
  if (!target.merchantName && source.merchantName) target.merchantName = source.merchantName
  if (!target.businessNo && source.businessNo) target.businessNo = source.businessNo
  if (!target.location && source.location) target.location = source.location
  if (source.merchantName || source.businessNo) {
    target.location = buildLocationLabel(
      target.merchantName || source.merchantName,
      target.businessNo || source.businessNo,
    )
  }
  if (source.amount > target.amount) target.amount = source.amount
  if (!target.merchantPhone && source.merchantPhone) target.merchantPhone = source.merchantPhone
  return target
}

async function parseReceiptImageFiles(imagePaths) {
  const images = (imagePaths || []).map(String).filter((p) => {
    try {
      return fs.statSync(p).isFile()
    } catch {
      return false
    }
  })

  if (images.length === 0) {
    return {
      dateTime: '',
      location: '',
      merchantName: '',
      businessNo: '',
      amount: 0,
      ocrOk: false,
      ocrMessage: '영수증 이미지가 없습니다.',
      files: [],
    }
  }

  let merged = {
    dateTime: '',
    location: '',
    merchantName: '',
    businessNo: '',
    amount: 0,
    merchantPhone: '',
  }

  for (const img of images) {
    mergeParsed(merged, parseFromFileName(path.basename(img)))
  }

  const ocrTargets = images.slice(0, 3)
  const ocrTimeoutMs = 60000
  let ocrSuccess = 0
  const ocrErrors = []

  for (const img of ocrTargets) {
    try {
      const p = await Promise.race([
        ocrImageFile(img),
        new Promise((_, reject) => setTimeout(() => reject(new Error('OCR 시간 초과')), ocrTimeoutMs)),
      ])
      mergeParsed(merged, p)
      if (p.merchantName || p.businessNo || p.amount > 0 || p.dateTime || p.merchantPhone) ocrSuccess++
    } catch (err) {
      ocrErrors.push(err instanceof Error ? err.message : String(err))
      await resetOcrWorker()
    }
  }

  merged.location = buildLocationLabel(merged.merchantName, merged.businessNo) || merged.location

  const ocrOk = ocrSuccess > 0 || merged.amount > 0 || !!merged.location
  let ocrMessage = ''
  if (ocrSuccess === 0 && ocrErrors.length > 0) {
    ocrMessage =
      '영수증 OCR을 읽지 못했습니다. 아래 항목을 직접 입력해 주세요. (승인금액·상호·사업자번호·일시)'
  } else if (ocrSuccess > 0 && ocrErrors.length > 0) {
    ocrMessage = '일부 영수증만 인식되었습니다. 내용을 확인해 주세요.'
  }

  return {
    ...merged,
    ocrOk,
    ocrMessage,
    files: images,
  }
}

async function parseReceiptsInFolder(folderPath) {
  let names = []
  try {
    names = fs.readdirSync(folderPath)
  } catch {
    return {
      dateTime: '',
      location: '',
      merchantName: '',
      businessNo: '',
      amount: 0,
      ocrOk: false,
      ocrMessage: '',
      files: [],
    }
  }
  const images = names
    .filter((n) => /\.(png|jpe?g|gif|webp)$/i.test(n))
    .map((n) => path.join(folderPath, n))
  return parseReceiptImageFiles(images)
}

module.exports = {
  parseReceiptsInFolder,
  parseReceiptImageFiles,
  parseReceiptText,
  extractApprovalAmount,
  extractMerchantName,
  extractBusinessNo,
  extractMerchantPhone,
}
