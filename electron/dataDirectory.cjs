const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const HRDATA_NAME = 'HRdata.xlsx'
const GIST_REG_DIR = 'gist-regulations'

function packagedResourcesDataDir() {
  return path.join(process.resourcesPath, 'data')
}

function packagedUserDataDir() {
  return path.join(path.dirname(process.execPath), 'data')
}

function devDataDir() {
  return path.join(__dirname, '..', 'data')
}

function seedFileIfMissing(userPath, resPath) {
  if (!fs.existsSync(resPath) || fs.existsSync(userPath)) return
  try {
    fs.mkdirSync(path.dirname(userPath), { recursive: true })
    fs.copyFileSync(resPath, userPath)
  } catch {
    /* ignore */
  }
}

function seedGistRegulations(userDir, resDir) {
  const userGist = path.join(userDir, GIST_REG_DIR)
  const resGist = path.join(resDir, GIST_REG_DIR)
  if (!fs.existsSync(resGist)) return
  fs.mkdirSync(userGist, { recursive: true })
  for (const name of fs.readdirSync(resGist)) {
    const from = path.join(resGist, name)
    const to = path.join(userGist, name)
    if (!fs.statSync(from).isFile()) continue
    if (!fs.existsSync(to)) {
      try {
        fs.copyFileSync(from, to)
      } catch {
        /* ignore */
      }
    }
  }
}

/** 개발: 프로젝트/data · 설치본: exe 옆 data (없으면 resources/data에서 시드) */
function getDataDirectory() {
  if (app.isPackaged) {
    const userDir = packagedUserDataDir()
    fs.mkdirSync(userDir, { recursive: true })
    const resDir = packagedResourcesDataDir()
    const userHr = path.join(userDir, HRDATA_NAME)
    const resHr = path.join(resDir, HRDATA_NAME)
    seedFileIfMissing(userHr, resHr)
    seedGistRegulations(userDir, resDir)
    if (!fs.existsSync(userHr) && fs.existsSync(resHr)) {
      try {
        return packagedResourcesDataDir()
      } catch {
        /* resources 폴더 사용 */
        return packagedResourcesDataDir()
      }
    }
    return userDir
  }
  return devDataDir()
}

function ensureDataDirectory() {
  const dir = getDataDirectory()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getHrdataPath() {
  return path.join(getDataDirectory(), HRDATA_NAME)
}

function getHrdataMtimeMs() {
  try {
    return fs.statSync(getHrdataPath()).mtimeMs
  } catch {
    return null
  }
}

module.exports = {
  HRDATA_NAME,
  getDataDirectory,
  ensureDataDirectory,
  getHrdataPath,
  getHrdataMtimeMs,
}
