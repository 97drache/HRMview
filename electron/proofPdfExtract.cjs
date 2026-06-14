const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const { createCanvas } = require('@napi-rs/canvas')
const sharp = require('sharp')

const MIN_IMAGE_SIDE = 280
const MIN_IMAGE_AREA_RATIO = 0.12
const RENDER_SCALE = 2

let pdfjsModule = null
let workerSrc = null

async function loadPdfjs() {
  if (!pdfjsModule) {
    pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const pkgRoot = path.dirname(require.resolve('pdfjs-dist/package.json'))
    workerSrc = pathToFileURL(path.join(pkgRoot, 'legacy/build/pdf.worker.mjs')).href
    pdfjsModule.GlobalWorkerOptions.workerSrc = workerSrc
  }
  return pdfjsModule
}

function safeBaseName(pdfPath) {
  const raw = path.basename(pdfPath, path.extname(pdfPath))
  const cleaned = raw.replace(/[^\w\uAC00-\uD7A3.-]+/g, '_').replace(/_+/g, '_')
  return cleaned.slice(0, 48) || 'document'
}

async function pdfCacheDir(proofRoot, pdfPath) {
  const st = await fs.promises.stat(pdfPath)
  const hash = crypto
    .createHash('sha256')
    .update(`${path.resolve(pdfPath)}|${st.mtimeMs}|${st.size}`)
    .digest('hex')
    .slice(0, 20)
  return path.join(path.resolve(proofRoot), '.hrm-pdf-cache', hash)
}

function getImageFromObjs(page, name) {
  return new Promise((resolve) => {
    try {
      page.objs.get(name, (value) => resolve(value || null))
    } catch {
      resolve(null)
    }
  })
}

async function imageObjectToPngBuffer(img) {
  if (!img?.width || !img?.height) return null
  const w = img.width
  const h = img.height
  if (img.bitmap && img.bitmap.length >= w * h * 3) {
    const channels = img.bitmap.length >= w * h * 4 ? 4 : 3
    return sharp(img.bitmap, { raw: { width: w, height: h, channels } }).png().toBuffer()
  }
  if (img.data) {
    const kind = img.kind
    if (kind === 2 && img.data.length > 4) {
      return sharp(Buffer.from(img.data)).png().toBuffer()
    }
    const channels = kind === 3 ? 4 : kind === 1 ? 1 : 3
    if (img.data.length >= w * h * channels) {
      return sharp(Buffer.from(img.data), { raw: { width: w, height: h, channels } }).png().toBuffer()
    }
  }
  return null
}

async function extractEmbeddedFromPage(page, pageNum, outDir, baseName, pdfjs) {
  const { OPS } = pdfjs
  const ops = await page.getOperatorList()
  const viewport = page.getViewport({ scale: 1 })
  const pageArea = viewport.width * viewport.height
  const seen = new Set()
  const out = []

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    if (
      fn !== OPS.paintImageXObject &&
      fn !== OPS.paintJpegXObject &&
      fn !== OPS.paintImageXObjectRepeat
    ) {
      continue
    }
    const imgName = ops.argsArray[i][0]
    if (!imgName || seen.has(imgName)) continue
    seen.add(imgName)

    const img = await getImageFromObjs(page, imgName)
    if (!img?.width || !img?.height) continue
    if (img.width < MIN_IMAGE_SIDE || img.height < MIN_IMAGE_SIDE) continue
    const area = img.width * img.height
    if (area < pageArea * MIN_IMAGE_AREA_RATIO) continue

    const png = await imageObjectToPngBuffer(img)
    if (!png) continue

    const fname = `${baseName}-p${String(pageNum).padStart(2, '0')}-img${out.length + 1}.png`
    const fullPath = path.join(outDir, fname)
    await fs.promises.writeFile(fullPath, png)
    out.push(fullPath)
  }

  return out
}

async function renderPageToPng(page, pageNum, outDir, baseName) {
  const viewport = page.getViewport({ scale: RENDER_SCALE })
  const width = Math.ceil(viewport.width)
  const height = Math.ceil(viewport.height)
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  await page.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise
  const fname = `${baseName}-p${String(pageNum).padStart(2, '0')}.png`
  const fullPath = path.join(outDir, fname)
  const buf = await canvas.encode('png')
  await fs.promises.writeFile(fullPath, buf)
  return fullPath
}

/**
 * PDF → 증빙용 PNG (내장 큰 이미지 우선, 없으면 페이지 렌더)
 * @returns {Promise<{ name: string, fullPath: string, sourcePdf: string }[]>}
 */
async function extractImagesFromPdf(pdfPath, proofRoot) {
  const resolvedPdf = path.resolve(pdfPath)
  const pdfjs = await loadPdfjs()
  const data = new Uint8Array(await fs.promises.readFile(resolvedPdf))
  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    standardFontDataUrl: pathToFileURL(
      path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts/'),
    ).href,
  }).promise

  const cacheDir = await pdfCacheDir(proofRoot, resolvedPdf)
  await fs.promises.mkdir(cacheDir, { recursive: true })

  const base = safeBaseName(resolvedPdf)
  const sourcePdf = path.basename(resolvedPdf)
  const files = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    let pagePaths = await extractEmbeddedFromPage(page, pageNum, cacheDir, base, pdfjs)
    if (!pagePaths.length) {
      pagePaths = [await renderPageToPng(page, pageNum, cacheDir, base)]
    }
    for (const fullPath of pagePaths) {
      files.push({
        name: path.basename(fullPath),
        fullPath,
        sourcePdf,
      })
    }
  }

  return files
}

module.exports = {
  extractImagesFromPdf,
  pdfCacheDir,
}
