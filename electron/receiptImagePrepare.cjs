const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const MAX_EMBED_WIDTH_PX = 780
const MAX_EMBED_HEIGHT_PX = 900
const TRIM_PADDING_PX = 16
const ANALYZE_MAX_DIM = 1600
const MORPH_RADIUS = 4

function buildPipeline(srcPath) {
  return sharp(srcPath, { failOn: 'none' }).rotate()
}

function pixelLuma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function median(values) {
  if (!values.length) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

async function getScaledRaw(pipeline) {
  const meta = await pipeline.metadata()
  const w = meta.width || 1
  const h = meta.height || 1
  const scale = Math.min(1, ANALYZE_MAX_DIM / Math.max(w, h))
  const sw = Math.max(1, Math.round(w * scale))
  const sh = Math.max(1, Math.round(h * scale))
  const { data, info } = await pipeline
    .clone()
    .resize(sw, sh, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, info, scale, origW: w, origH: h }
}

/** 책상·바닥 등 어두운 배경 — 이미지 전체에서 어두운 쪽 밝기 추정 */
function estimateBackgroundLuma(data, width, height, channels) {
  const lumas = []
  const step = Math.max(1, Math.floor(Math.min(width, height) / 200))
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * channels
      lumas.push(pixelLuma(data[i], data[i + 1], data[i + 2]))
    }
  }
  lumas.sort((a, b) => a - b)
  const p8 = lumas[Math.floor(lumas.length * 0.08)] ?? 0
  const p15 = lumas[Math.floor(lumas.length * 0.15)] ?? p8
  return Math.min(p8, p15)
}

function dilateMask(mask, width, height, radius) {
  const out = new Uint8Array(mask)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            out[ny * width + nx] = 1
          }
        }
      }
    }
  }
  return out
}

function componentsFromMask(mask, width, height) {
  const visited = new Uint8Array(width * height)
  const comps = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x
      if (!mask[start] || visited[start]) continue

      let size = 0
      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      const stack = [start]
      visited[start] = 1

      while (stack.length) {
        const cur = stack.pop()
        size++
        const cx = cur % width
        const cy = (cur / width) | 0
        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy

        if (cx > 0) push(cx - 1, cy)
        if (cx < width - 1) push(cx + 1, cy)
        if (cy > 0) push(cx, cy - 1)
        if (cy < height - 1) push(cx, cy + 1)
      }

      function push(px, py) {
        const ni = py * width + px
        if (!visited[ni] && mask[ni]) {
          visited[ni] = 1
          stack.push(ni)
        }
      }

      comps.push({ size, minX, minY, maxX, maxY })
    }
  }

  comps.sort((a, b) => b.size - a.size)
  return comps
}

function boundsAllMask(mask, width, height) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let count = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue
      count++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (maxX < 0 || count < width * height * 0.01) return null
  return { minX, minY, maxX, maxY, count }
}

/** 밝은 열·행이 이어진 구간 중 영수증(가장 많은 픽셀) 영역 선택 */
function boundsByContiguousRuns(mask, width, height) {
  const colCounts = new Uint32Array(width)
  const rowCounts = new Uint32Array(height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue
      colCounts[x]++
      rowCounts[y]++
    }
  }

  const colThresh = Math.max(3, Math.floor(height * 0.045))
  const rowThresh = Math.max(3, Math.floor(width * 0.045))

  function bestRun(counts, len, thresh) {
    let best = null
    let start = -1
    let runSum = 0
    for (let i = 0; i <= len; i++) {
      const ok = i < len && counts[i] >= thresh
      if (ok && start < 0) {
        start = i
        runSum = 0
      }
      if (ok) runSum += counts[i]
      if (!ok && start >= 0) {
        const end = i - 1
        if (!best || runSum > best.score) best = { start, end, score: runSum }
        start = -1
      }
    }
    return best
  }

  const colRun = bestRun(colCounts, width, colThresh)
  const rowRun = bestRun(rowCounts, height, rowThresh)
  if (!colRun || !rowRun) return boundsAllMask(mask, width, height)

  return {
    minX: colRun.start,
    maxX: colRun.end,
    minY: rowRun.start,
    maxY: rowRun.end,
    count: colRun.score,
  }
}

function scaleBounds(bounds, scale, origW, origH, marginRatio = 0.02) {
  const inv = 1 / scale
  const bw = bounds.maxX - bounds.minX + 1
  const bh = bounds.maxY - bounds.minY + 1
  const mx = Math.max(12, Math.round(bw * marginRatio))
  const my = Math.max(12, Math.round(bh * marginRatio))

  const left = Math.max(0, Math.floor(bounds.minX * inv) - mx)
  const top = Math.max(0, Math.floor(bounds.minY * inv) - my)
  const right = Math.min(origW, Math.ceil((bounds.maxX + 1) * inv) + mx)
  const bottom = Math.min(origH, Math.ceil((bounds.maxY + 1) * inv) + my)

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}

/** 어두운 배경 위 영수증: 낮은 임계값 + 팽창으로 본문(회색)까지 포함 */
async function cropPaperOnDarkBackground(pipeline) {
  const { data, info, scale, origW, origH } = await getScaledRaw(pipeline)
  const { width, height, channels } = info
  const bg = estimateBackgroundLuma(data, width, height, channels)
  const thresholds = [
    Math.max(48, bg + 12),
    Math.max(55, bg + 18),
    Math.max(62, bg + 24),
    Math.max(70, bg + 32),
  ]

  const origArea = origW * origH
  let best = null
  let bestScore = 0

  for (const th of thresholds) {
    const mask = new Uint8Array(width * height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels
        const l = pixelLuma(data[i], data[i + 1], data[i + 2])
        if (l >= th) mask[y * width + x] = 1
      }
    }
    const dilated = dilateMask(mask, width, height, MORPH_RADIUS)
    const bounds = boundsByContiguousRuns(dilated, width, height)
    if (!bounds) continue

    const bw = bounds.maxX - bounds.minX + 1
    const bh = bounds.maxY - bounds.minY + 1
    const mappedArea = bw * bh * (origW / width) * (origH / height)
    if (mappedArea >= origArea * 0.99) continue
    if (mappedArea < origArea * 0.02) continue
    if (bounds.count > bestScore) {
      bestScore = bounds.count
      best = bounds
    }
  }

  if (!best) return null

  const box = scaleBounds(best, scale, origW, origH, 0.025)
  return pipeline.clone().extract(box).toBuffer()
}

/** 흰 여백 스캔: 균일한 순백 열만 제거 (영수증 회색 본문은 유지) */
async function stripUniformWhiteMargins(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const colBright = new Uint32Array(width)
  const rowBright = new Uint32Array(height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      if (pixelLuma(data[i], data[i + 1], data[i + 2]) >= 248) {
        colBright[x]++
        rowBright[y]++
      }
    }
  }

  const colCut = Math.max(2, Math.floor(height * 0.94))
  const rowCut = Math.max(2, Math.floor(width * 0.94))

  let left = 0
  let right = width - 1
  let top = 0
  let bottom = height - 1

  while (left < right && colBright[left] >= colCut) left++
  while (right > left && colBright[right] >= colCut) right--
  while (top < bottom && rowBright[top] >= rowCut) top++
  while (bottom > top && rowBright[bottom] >= rowCut) bottom--

  if (right - left < 40 || bottom - top < 40) return buf

  return sharp(buf).extract({
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  }).toBuffer()
}

async function cropWhiteScan(pipeline) {
  try {
    const trimmed = await pipeline
      .clone()
      .flatten({ background: '#ffffff' })
      .trim({
        threshold: 18,
        background: { r: 255, g: 255, b: 255 },
        lineArt: false,
      })
      .toBuffer()
    const meta = await pipeline.metadata()
    const tMeta = await sharp(trimmed).metadata()
    const origArea = (meta.width || 1) * (meta.height || 1)
    const trimArea = (tMeta.width || 1) * (tMeta.height || 1)
    if (trimArea < origArea * 0.98 && trimArea > origArea * 0.05) {
      return trimmed
    }
  } catch {
    /* noop */
  }
  return null
}

async function darkPixelRatio(pipeline) {
  const { data, info } = await getScaledRaw(pipeline)
  let dark = 0
  const total = info.width * info.height
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels
      if (pixelLuma(data[i], data[i + 1], data[i + 2]) < 70) dark++
    }
  }
  return dark / total
}

async function cropReceiptTight(srcPath) {
  const pipeline = buildPipeline(srcPath)
  const onDarkBg = (await darkPixelRatio(pipeline)) > 0.06

  let working = null
  if (onDarkBg) {
    working = await cropPaperOnDarkBackground(pipeline)
  } else {
    working = await cropWhiteScan(pipeline)
  }

  if (!working) {
    working = await cropPaperOnDarkBackground(pipeline)
  }
  if (!working) {
    working = await pipeline.flatten({ background: '#ffffff' }).toBuffer()
  }

  if (!onDarkBg) {
    working = await stripUniformWhiteMargins(working)
  }

  return working
}

async function embedReceiptBuffer(croppedBuf) {
  return sharp(croppedBuf)
    .flatten({ background: '#ffffff' })
    .extend({
      top: TRIM_PADDING_PX,
      bottom: TRIM_PADDING_PX,
      left: TRIM_PADDING_PX,
      right: TRIM_PADDING_PX,
      background: { r: 255, g: 255, b: 255 },
    })
    .resize({
      width: MAX_EMBED_WIDTH_PX,
      height: MAX_EMBED_HEIGHT_PX,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()
}

async function tryGeminiCrop(srcPath, userDataDir) {
  if (!userDataDir) return null
  try {
    const { prepareReceiptEmbedBuffer } = require('./gemini.cjs')
    return await prepareReceiptEmbedBuffer(srcPath, userDataDir)
  } catch (err) {
    console.warn('[HRM] Gemini receipt crop:', err instanceof Error ? err.message : err)
    return null
  }
}

/** Gemini 0~1000 정규화 bbox → 원본 해상도 extract */
async function extractReceiptByNormalizedBox(srcPath, box) {
  const ymin = Number(box.ymin)
  const xmin = Number(box.xmin)
  const ymax = Number(box.ymax)
  const xmax = Number(box.xmax)
  if (![ymin, xmin, ymax, xmax].every(Number.isFinite)) return null

  const pipeline = buildPipeline(srcPath)
  const meta = await pipeline.metadata()
  const w = meta.width || 1
  const h = meta.height || 1

  const margin = 0.018
  const mw = Math.max(6, Math.round(w * margin))
  const mh = Math.max(6, Math.round(h * margin))

  let left = Math.floor((xmin / 1000) * w) - mw
  let top = Math.floor((ymin / 1000) * h) - mh
  let right = Math.ceil((xmax / 1000) * w) + mw
  let bottom = Math.ceil((ymax / 1000) * h) + mh

  left = Math.max(0, left)
  top = Math.max(0, top)
  right = Math.min(w, right)
  bottom = Math.min(h, bottom)

  const width = right - left
  const height = bottom - top
  if (width < 48 || height < 48) return null
  if (width * height > w * h * 0.992) return null

  return pipeline.clone().extract({ left, top, width, height }).toBuffer()
}

async function prepareReceiptImage(srcPath, destPath, options = {}) {
  const src = path.resolve(String(srcPath))
  const dest = path.resolve(String(destPath))
  fs.mkdirSync(path.dirname(dest), { recursive: true })

  const geminiBuf = await tryGeminiCrop(src, options.userDataDir)
  if (geminiBuf) {
    await fs.promises.writeFile(dest, geminiBuf)
    return dest
  }

  const cropped = await cropReceiptTight(src)
  const out = await embedReceiptBuffer(cropped)
  await fs.promises.writeFile(dest, out)
  return dest
}

async function prepareReceiptImageBuffer(srcPath, options = {}) {
  const geminiBuf = await tryGeminiCrop(srcPath, options.userDataDir)
  if (geminiBuf) return geminiBuf
  const cropped = await cropReceiptTight(srcPath)
  return embedReceiptBuffer(cropped)
}

module.exports = {
  prepareReceiptImage,
  prepareReceiptImageBuffer,
  embedReceiptBuffer,
  extractReceiptByNormalizedBox,
  MAX_EMBED_WIDTH_PX,
  MAX_EMBED_HEIGHT_PX,
  cropReceiptTight,
}
