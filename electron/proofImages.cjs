const fs = require('fs')
const path = require('path')
const { extractImagesFromPdf } = require('./proofPdfExtract.cjs')

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i
const PDF_EXT = /\.pdf$/i

function parseDateFolder(dateFolder) {
  const iso = String(dateFolder ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  return { iso, compact: iso.replace(/-/g, '') }
}

/** 파일명에 yyyy-MM-dd 또는 yyyyMMdd 포함 여부 */
function fileNameMatchesDate(fileName, iso, compact) {
  const base = path.basename(String(fileName), path.extname(String(fileName)))
  if (base.includes(iso)) return true
  if (base.includes(compact)) return true
  if (base.includes(iso.replace(/-/g, '_'))) return true
  if (base.includes(iso.replace(/-/g, '.'))) return true
  return false
}

function listFilesInDir(dir, extRe, { nameFilter } = {}) {
  let names = []
  try {
    names = fs.readdirSync(dir)
  } catch {
    return []
  }
  const out = []
  for (const name of names) {
    if (!extRe.test(name)) continue
    const fullPath = path.join(dir, name)
    let st
    try {
      st = fs.statSync(fullPath)
    } catch {
      continue
    }
    if (!st.isFile()) continue
    if (nameFilter && !nameFilter(name)) continue
    out.push({ name, fullPath })
  }
  return out
}

function listImageFilesInDir(dir, opts) {
  return listFilesInDir(dir, IMAGE_EXT, opts)
}

function listPdfFilesInDir(dir, opts) {
  return listFilesInDir(dir, PDF_EXT, opts)
}

/**
 * 증빙폴더 이미지·PDF 수집 (동기 — PDF 목록만)
 */
function collectProofSourcesSync(proofRoot, dateFolder) {
  const root = path.resolve(proofRoot)
  const imageByPath = new Map()
  const pdfByPath = new Map()

  const addImages = (items) => {
    for (const f of items) {
      if (!imageByPath.has(f.fullPath)) imageByPath.set(f.fullPath, f)
    }
  }
  const addPdfs = (items) => {
    for (const f of items) {
      if (!pdfByPath.has(f.fullPath)) pdfByPath.set(f.fullPath, f)
    }
  }

  if (!dateFolder) {
    addImages(listImageFilesInDir(root))
    addPdfs(listPdfFilesInDir(root))
    return {
      folder: root,
      imageFiles: [...imageByPath.values()],
      pdfFiles: [...pdfByPath.values()],
    }
  }

  const d = parseDateFolder(dateFolder)
  if (!d) {
    throw new Error('날짜는 yyyy-MM-dd 형식이어야 합니다.')
  }

  addImages(listImageFilesInDir(path.join(root, d.iso)))
  addImages(listImageFilesInDir(path.join(root, d.compact)))
  addImages(
    listImageFilesInDir(root, {
      nameFilter: (name) => fileNameMatchesDate(name, d.iso, d.compact),
    }),
  )

  addPdfs(listPdfFilesInDir(path.join(root, d.iso)))
  addPdfs(listPdfFilesInDir(path.join(root, d.compact)))
  addPdfs(
    listPdfFilesInDir(root, {
      nameFilter: (name) => fileNameMatchesDate(name, d.iso, d.compact),
    }),
  )

  const subFolder = path.join(root, d.iso)
  return {
    folder: fs.existsSync(subFolder) ? subFolder : root,
    imageFiles: [...imageByPath.values()],
    pdfFiles: [...pdfByPath.values()],
  }
}

/**
 * 이미지 + PDF에서 추출한 페이지/내장 이미지
 */
async function collectProofImages(proofRoot, dateFolder) {
  const { folder, imageFiles, pdfFiles } = collectProofSourcesSync(proofRoot, dateFolder)
  const byPath = new Map()

  for (const f of imageFiles) {
    byPath.set(f.fullPath, { name: f.name, fullPath: f.fullPath })
  }

  const pdfErrors = []
  for (const pdf of pdfFiles) {
    try {
      const extracted = await extractImagesFromPdf(pdf.fullPath, proofRoot)
      for (const item of extracted) {
        if (!byPath.has(item.fullPath)) byPath.set(item.fullPath, item)
      }
    } catch (err) {
      pdfErrors.push({
        pdf: pdf.name,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const files = [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  return {
    folder,
    files,
    pdfCount: pdfFiles.length,
    pdfErrors,
  }
}

/**
 * 사용자가 고른 파일 경로(이미지·PDF) → 분석·미리보기용 이미지 목록
 */
async function resolvePickedProofFiles(filePaths, cacheRoot) {
  const root = path.resolve(String(cacheRoot || path.join(require('os').tmpdir(), 'hrm-proof')))
  const byPath = new Map()
  const pdfErrors = []

  for (const raw of filePaths || []) {
    const abs = path.resolve(String(raw))
    let st
    try {
      st = await fs.promises.stat(abs)
    } catch {
      continue
    }
    if (!st.isFile()) continue
    const name = path.basename(abs)

    if (PDF_EXT.test(name)) {
      try {
        const extracted = await extractImagesFromPdf(abs, root)
        for (const item of extracted) {
          if (!byPath.has(item.fullPath)) byPath.set(item.fullPath, item)
        }
      } catch (err) {
        pdfErrors.push({
          pdf: name,
          message: err instanceof Error ? err.message : String(err),
        })
      }
      continue
    }

    if (IMAGE_EXT.test(name)) {
      if (!byPath.has(abs)) byPath.set(abs, { name, fullPath: abs })
    }
  }

  const files = [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return { files, pdfErrors }
}

module.exports = {
  collectProofImages,
  collectProofSourcesSync,
  resolvePickedProofFiles,
  parseDateFolder,
  fileNameMatchesDate,
  IMAGE_EXT,
  PDF_EXT,
}
