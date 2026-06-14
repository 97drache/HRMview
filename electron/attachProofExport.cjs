const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const { IMAGE_EXT, PDF_EXT } = require('./proofImages.cjs')
const { extractImagesFromPdf } = require('./proofPdfExtract.cjs')

async function copyImageToAsset(absPath, destPath) {
  const ext = path.extname(absPath).toLowerCase()
  const outPath =
    ext === '.png' ? destPath.replace(/\.jpe?g$/i, '.png') : destPath.replace(/\.png$/i, '.jpg')
  if (ext === '.png') {
    await fs.promises.copyFile(absPath, outPath)
    return outPath
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    await fs.promises.copyFile(absPath, outPath)
    return outPath
  }
  const buf = await sharp(absPath).jpeg({ quality: 92 }).toBuffer()
  await fs.promises.writeFile(outPath, buf)
  return outPath
}

/**
 * 추가 첨부 파일 → assets 폴더 내 이미지 경로(절대) 목록 (순서 유지)
 */
async function materializeExtraAttachments(extraPaths, assetsDir, cacheRoot) {
  const out = []
  let idx = 0
  for (const raw of extraPaths || []) {
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
      const extracted = await extractImagesFromPdf(abs, cacheRoot)
      for (const item of extracted) {
        const dest = path.join(assetsDir, `extra${idx}.jpg`)
        await copyImageToAsset(item.fullPath, dest)
        out.push(dest)
        idx++
      }
      continue
    }

    if (IMAGE_EXT.test(name)) {
      const dest = path.join(assetsDir, `extra${idx}.jpg`)
      await copyImageToAsset(abs, dest)
      out.push(dest)
      idx++
      continue
    }

    throw new Error(`지원하지 않는 첨부 형식입니다: ${name}`)
  }
  return out
}

module.exports = { materializeExtraAttachments, copyImageToAsset }
