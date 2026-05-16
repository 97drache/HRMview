const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

/** PDF 증빙란: 용지(여백 제외) 높이의 절반 이하로 맞춤 */
const MAX_EMBED_HEIGHT_PX = 1050
const MAX_EMBED_WIDTH_PX = 820

/**
 * 스캔/사진 영수증 — 여백 trim 후 증빙란에 맞게 리사이즈
 * @returns {Promise<string>} 출력 파일 경로
 */
async function prepareReceiptImage(srcPath, destPath) {
  const src = path.resolve(String(srcPath))
  const dest = path.resolve(String(destPath))
  fs.mkdirSync(path.dirname(dest), { recursive: true })

  let pipeline = sharp(src, { failOn: 'none' }).rotate()

  try {
    pipeline = pipeline.trim({
      threshold: 22,
      background: { r: 255, g: 255, b: 255 },
      lineArt: false,
    })
  } catch {
    pipeline = sharp(src, { failOn: 'none' }).rotate()
  }

  await pipeline
    .resize({
      width: MAX_EMBED_WIDTH_PX,
      height: MAX_EMBED_HEIGHT_PX,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(dest)

  return dest
}

/** 미리보기 data URL용 */
async function prepareReceiptImageBuffer(srcPath) {
  const tmp = path.join(
    path.dirname(path.resolve(String(srcPath))),
    `.hrm-prep-${Date.now()}.jpg`,
  )
  try {
    await prepareReceiptImage(srcPath, tmp)
    return await fs.promises.readFile(tmp)
  } finally {
    await fs.promises.unlink(tmp).catch(() => {})
  }
}

module.exports = { prepareReceiptImage, prepareReceiptImageBuffer, MAX_EMBED_HEIGHT_PX }
