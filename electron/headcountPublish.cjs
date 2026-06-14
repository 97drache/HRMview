const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const https = require('https')
const { app } = require('electron')

const STATE_FILE = 'headcount-export-state.json'

function findHrmRepoRoot() {
  const candidates = []
  if (app.isPackaged) {
    candidates.push(path.dirname(process.execPath))
    candidates.push(path.dirname(path.dirname(process.execPath)))
  }
  candidates.push(path.join(__dirname, '..'))

  for (const start of candidates) {
    let dir = start
    for (let i = 0; i < 6; i++) {
      const snapDir = path.join(dir, 'headcount-web', 'public')
      if (fs.existsSync(path.join(snapDir, '.gitkeep')) || fs.existsSync(snapDir)) {
        return dir
      }
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  return null
}

function readExportState() {
  const p = path.join(app.getPath('userData'), STATE_FILE)
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return {}
  }
}

function writeExportState(patch) {
  const p = path.join(app.getPath('userData'), STATE_FILE)
  const prev = readExportState()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify({ ...prev, ...patch }, null, 2), 'utf8')
}

function todayKey() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function shouldExportToday() {
  const state = readExportState()
  return state.lastExportDate !== todayKey()
}

function loadDotEnvFile(envPath) {
  try {
    const text = fs.readFileSync(envPath, 'utf8')
    const out = {}
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim().replace(/^\uFEFF/, '')
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      out[key] = val
    }
    return out
  } catch {
    return null
  }
}

function loadAppEnv() {
  const paths = [
    path.join(__dirname, '..', '.env'),
    path.join(path.dirname(process.execPath), '.env'),
    path.join(require('os').homedir(), 'Desktop', 'HRM', '.env'),
  ]
  for (const envPath of paths) {
    const parsed = loadDotEnvFile(envPath)
    if (!parsed) continue
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] == null || process.env[k] === '') process.env[k] = v
    }
  }
}

function runGit(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' })
}

function postDeployHook(hookUrl) {
  return new Promise((resolve) => {
    try {
      const url = new URL(hookUrl)
      const req = https.request(
        url,
        { method: 'POST', timeout: 30000 },
        (res) => {
          res.resume()
          resolve(res.statusCode != null && res.statusCode >= 200 && res.statusCode < 300)
        },
      )
      req.on('error', () => resolve(false))
      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
      req.end()
    } catch {
      resolve(false)
    }
  })
}

async function publishHeadcountSnapshot(jsonStr) {
  loadAppEnv()
  const repoRoot = findHrmRepoRoot()
  const writtenPaths = []

  if (repoRoot) {
    const outPath = path.join(repoRoot, 'headcount-web', 'public', 'headcount-snapshot.json')
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, jsonStr, 'utf8')
    writtenPaths.push(outPath)
  }

  const localCopy = path.join(app.getPath('userData'), 'headcount-snapshot.json')
  fs.writeFileSync(localCopy, jsonStr, 'utf8')
  writtenPaths.push(localCopy)

  let gitOk = false
  let gitMessage = 'git 미실행'
  /** 기본값: 자동 push 켜짐. 끄려면 .env 에 HRM_HEADCOUNT_AUTO_PUBLISH=0 */
  const autoPublish = process.env.HRM_HEADCOUNT_AUTO_PUBLISH !== '0'

  if (autoPublish && repoRoot && fs.existsSync(path.join(repoRoot, '.git'))) {
    const rel = 'headcount-web/public/headcount-snapshot.json'
    const add = runGit(['add', rel], repoRoot)
    if (add.status !== 0) {
      gitMessage = add.stderr || add.stdout || 'git add 실패'
    } else {
      const commit = runGit(['commit', '-m', 'chore(headcount): daily snapshot update'], repoRoot)
      if (commit.status === 0) {
        const push = runGit(['push'], repoRoot)
        gitOk = push.status === 0
        gitMessage = gitOk ? 'git push 완료' : push.stderr || push.stdout || 'git push 실패'
      } else if (/nothing to commit/i.test(commit.stdout || commit.stderr || '')) {
        gitOk = true
        gitMessage = '변경 없음(이미 최신)'
      } else {
        gitMessage = commit.stderr || commit.stdout || 'git commit 실패'
      }
    }
  } else if (!autoPublish) {
    gitMessage = '자동 push가 꺼져 있습니다 (HRM_HEADCOUNT_AUTO_PUBLISH=0)'
  } else if (!repoRoot) {
    gitMessage = 'headcount-web 저장소를 찾지 못했습니다'
  }

  let deployOk = false
  let deployMessage = '배포 훅 미설정'
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL?.trim()
  if (hookUrl && gitOk) {
    deployOk = await postDeployHook(hookUrl)
    deployMessage = deployOk ? 'Vercel 배포 훅 호출 완료' : '배포 훅 호출 실패'
  }

  writeExportState({
    lastExportDate: todayKey(),
    lastExportAt: new Date().toISOString(),
    writtenPaths,
    gitOk,
    gitMessage,
    deployOk,
    deployMessage,
  })

  return {
    ok: true,
    writtenPaths,
    gitOk,
    gitMessage,
    deployOk,
    deployMessage,
    repoRoot,
  }
}

function getHeadcountExportStatus() {
  const state = readExportState()
  return {
    lastExportDate: state.lastExportDate ?? null,
    lastExportAt: state.lastExportAt ?? null,
    writtenPaths: state.writtenPaths ?? [],
    gitOk: state.gitOk ?? false,
    gitMessage: state.gitMessage ?? null,
    deployOk: state.deployOk ?? false,
    deployMessage: state.deployMessage ?? null,
    shouldExportToday: shouldExportToday(),
    repoRoot: findHrmRepoRoot(),
  }
}

module.exports = {
  findHrmRepoRoot,
  shouldExportToday,
  publishHeadcountSnapshot,
  getHeadcountExportStatus,
  loadAppEnv,
  todayKey,
}
