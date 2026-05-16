const fs = require('fs')
const path = require('path')

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i

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

function listImageFilesInDir(dir, { nameFilter } = {}) {
  let names = []
  try {
    names = fs.readdirSync(dir)
  } catch {
    return []
  }
  const out = []
  for (const name of names) {
    if (!IMAGE_EXT.test(name)) continue
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

/**
 * 증빙폴더 이미지 수집
 * - dateFolder 없음: 루트의 모든 이미지
 * - dateFolder 있음: (1) 증빙폴더/yyyy-MM-dd/ (2) 증빙폴더/yyyyMMdd/ (3) 루트에서 파일명에 날짜 포함
 */
function collectProofImages(proofRoot, dateFolder) {
  const root = path.resolve(proofRoot)
  const byPath = new Map()

  const addAll = (items) => {
    for (const f of items) {
      if (!byPath.has(f.fullPath)) byPath.set(f.fullPath, f)
    }
  }

  if (!dateFolder) {
    addAll(listImageFilesInDir(root))
    return {
      folder: root,
      files: [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    }
  }

  const d = parseDateFolder(dateFolder)
  if (!d) {
    throw new Error('날짜는 yyyy-MM-dd 형식이어야 합니다.')
  }

  addAll(listImageFilesInDir(path.join(root, d.iso)))
  addAll(listImageFilesInDir(path.join(root, d.compact)))
  addAll(
    listImageFilesInDir(root, {
      nameFilter: (name) => fileNameMatchesDate(name, d.iso, d.compact),
    }),
  )

  const subFolder = path.join(root, d.iso)
  return {
    folder: fs.existsSync(subFolder) ? subFolder : root,
    files: [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
  }
}

module.exports = {
  collectProofImages,
  parseDateFolder,
  fileNameMatchesDate,
  IMAGE_EXT,
}
