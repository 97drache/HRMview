const fs = require('fs')
const path = require('path')
const { PDFDocument } = require('pdf-lib')
const { IMAGE_EXT, PDF_EXT } = require('./proofImages.cjs')

const A4 = { width: 595.28, height: 841.89 }

async function appendImagePage(pdfDoc, imagePath) {
  const bytes = await fs.promises.readFile(imagePath)
  const ext = path.extname(imagePath).toLowerCase()
  const img =
    ext === '.png' ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes)
  const page = pdfDoc.addPage([A4.width, A4.height])
  const iw = img.width
  const ih = img.height
  const scale = Math.min(A4.width / iw, A4.height / ih)
  const w = iw * scale
  const h = ih * scale
  page.drawImage(img, {
    x: (A4.width - w) / 2,
    y: (A4.height - h) / 2,
    width: w,
    height: h,
  })
}

async function appendPdfFile(pdfDoc, pdfPath) {
  const srcBytes = await fs.promises.readFile(pdfPath)
  const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true })
  const copied = await pdfDoc.copyPages(src, src.getPageIndices())
  for (const p of copied) pdfDoc.addPage(p)
}

/**
 * 1페이지(양식) PDF 뒤에 추가 파일을 순서대로 붙임 (서식 없음)
 */
async function mergeAttachProofPdf(coverPdfBytes, extraPaths) {
  const pdfDoc = await PDFDocument.load(coverPdfBytes)

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
      await appendPdfFile(pdfDoc, abs)
      continue
    }
    if (IMAGE_EXT.test(name)) {
      await appendImagePage(pdfDoc, abs)
      continue
    }
    throw new Error(`지원하지 않는 첨부 형식입니다: ${name}`)
  }

  return Buffer.from(await pdfDoc.save())
}

module.exports = { mergeAttachProofPdf }
