const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const { getDataDirectory } = require('./dataDirectory.cjs')
const { loadAppEnv } = require('./headcountPublish.cjs')

const SUPPORTED_EXT = new Set(['.pdf', '.txt', '.md', '.html', '.htm'])
const MAX_SNIPPET = 1200
const MAX_FILE_CHARS = 200_000

let pdfjsModule = null

async function loadPdfjs() {
  if (!pdfjsModule) {
    pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const pkgRoot = path.dirname(require.resolve('pdfjs-dist/package.json'))
    pdfjsModule.GlobalWorkerOptions.workerSrc = pathToFileURL(
      path.join(pkgRoot, 'legacy/build/pdf.worker.mjs'),
    ).href
  }
  return pdfjsModule
}

function getRegulationsDirectory() {
  loadAppEnv()
  const override = String(process.env.GIST_REGULATIONS_DIR ?? '').trim()
  if (override) return path.resolve(override)
  return path.join(getDataDirectory(), 'gist-regulations')
}

function ensureRegulationsDirectory() {
  const dir = getRegulationsDirectory()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function listRegulationFiles() {
  const dir = ensureRegulationsDirectory()
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return { dir, files: [] }
  }
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => {
      const ext = path.extname(e.name).toLowerCase()
      return {
        name: e.name,
        fullPath: path.join(dir, e.name),
        ext,
        supported: SUPPORTED_EXT.has(ext),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return { dir, files }
}

function getRegulationsStatus() {
  const { dir, files } = listRegulationFiles()
  const supported = files.filter((f) => f.supported)
  return {
    folder: dir,
    fileCount: files.length,
    supportedCount: supported.length,
    files: supported.map((f) => f.name),
  }
}

async function extractPdfText(filePath) {
  const pdfjs = await loadPdfjs()
  const data = new Uint8Array(await fs.promises.readFile(filePath))
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
  const parts = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    parts.push(content.items.map((it) => it.str).join(' '))
  }
  return parts.join('\n')
}

async function readRegulationText(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.pdf') return extractPdfText(filePath)
  if (SUPPORTED_EXT.has(ext) && ext !== '.pdf') {
    return fs.promises.readFile(filePath, 'utf8')
  }
  return ''
}

function snippetAround(text, keyword, radius = 420) {
  const lower = text.toLowerCase()
  const key = keyword.toLowerCase().replace(/\s+/g, '')
  const variants = [keyword, key, keyword.replace(/\s+/g, '')].filter(Boolean)
  let idx = -1
  for (const v of variants) {
    idx = lower.indexOf(v.toLowerCase())
    if (idx >= 0) break
  }
  if (idx < 0) return null
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + keyword.length + radius)
  let slice = text.slice(start, end).replace(/\s+/g, ' ').trim()
  if (start > 0) slice = `…${slice}`
  if (end < text.length) slice = `${slice}…`
  return slice.length > MAX_SNIPPET ? `${slice.slice(0, MAX_SNIPPET)}…` : slice
}

async function searchRegulationsByKeyword(keyword) {
  const kw = String(keyword ?? '').trim()
  if (!kw) return []

  const { files } = listRegulationFiles()
  const hits = []

  for (const file of files) {
    if (!file.supported) continue
    try {
      let text = await readRegulationText(file.fullPath)
      if (!text) continue
      if (text.length > MAX_FILE_CHARS) text = text.slice(0, MAX_FILE_CHARS)
      const snippet = snippetAround(text, kw)
      if (snippet) {
        hits.push({ fileName: file.name, snippet, fullPath: file.fullPath })
      }
    } catch {
      /* skip unreadable */
    }
  }

  return hits
}

module.exports = {
  getRegulationsDirectory,
  ensureRegulationsDirectory,
  listRegulationFiles,
  getRegulationsStatus,
  searchRegulationsByKeyword,
  readRegulationText,
}
