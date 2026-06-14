/**
 * Windows: pack to pack-builds/<stamp>, then copy full win-unpacked -> HRM-app/
 * so you can always double-click HRM-app\HRM-Desktop.exe
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
process.chdir(root)

function run(cmd, args, extraEnv = {}) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: true,
    cwd: root,
    env: { ...process.env, ...extraEnv },
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function sleepSync(ms) {
  const t = Date.now() + ms
  while (Date.now() < t) {}
}

function rmWithRetries(dir, tries = 8) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
      return
    } catch (e) {
      last = e
      sleepSync(500)
    }
  }
  throw last
}

function copyTree(src, dest, { merge = false } = {}) {
  if (!fs.existsSync(src)) return
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const name of fs.readdirSync(src)) {
      copyTree(path.join(src, name), path.join(dest, name), { merge })
    }
    return
  }
  if (merge && fs.existsSync(dest)) {
    try {
      const srcM = fs.statSync(src).mtimeMs
      const destM = fs.statSync(dest).mtimeMs
      if (destM >= srcM) return
    } catch {
      /* overwrite on stat failure */
    }
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
}

function syncDataToApp(dataSrc, dataDest, gistPreserveSrc) {
  fs.mkdirSync(dataDest, { recursive: true })
  if (fs.existsSync(dataSrc)) {
    copyTree(dataSrc, dataDest, { merge: false })
    console.log('[HRM] Copied data/ -> HRM-app/data/')
  }
  if (gistPreserveSrc && fs.existsSync(gistPreserveSrc)) {
    const gistDest = path.join(dataDest, 'gist-regulations')
    copyTree(gistPreserveSrc, gistDest, { merge: true })
    console.log('[HRM] Preserved gist-regulations/ -> HRM-app/data/gist-regulations/')
  }
}

console.log('[HRM] 1/3 Vite + tsc build...')
run('npm', ['run', 'build'])

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outDir = path.join('pack-builds', stamp)

console.log('[HRM] 2/3 electron-builder ->', outDir)
run('npx', ['electron-builder', '--dir', '--x64', '--config.directories.output=' + outDir], {
  CSC_IDENTITY_AUTO_DISCOVERY: 'false',
})

const unpacked = path.join(root, outDir, 'win-unpacked')
const exeBuilt = path.join(unpacked, 'HRM-Desktop.exe')
if (!fs.existsSync(exeBuilt)) {
  console.error('[HRM] Missing:', exeBuilt)
  process.exit(1)
}

const stableDir = path.join(root, 'HRM-app')
const gistPreserveSrc = path.join(stableDir, 'data', 'gist-regulations')
const gistPreserveTmp = path.join(root, '.pack-gist-regulations-backup')
if (fs.existsSync(gistPreserveSrc)) {
  try {
    rmWithRetries(gistPreserveTmp)
    fs.cpSync(gistPreserveSrc, gistPreserveTmp, { recursive: true })
  } catch (e) {
    console.warn('[HRM] gist-regulations backup skipped:', e.message)
  }
}

console.log('[HRM] 3/3 Copy to HRM-app (close HRM if this fails)...')
try {
  rmWithRetries(stableDir)
} catch (e) {
  console.error('[HRM] Could not remove old HRM-app. Close HRM-Desktop.exe and retry.')
  console.error(e.message)
  process.exit(1)
}
fs.cpSync(unpacked, stableDir, { recursive: true })

const dataSrc = path.join(root, 'data')
const dataDest = path.join(stableDir, 'data')
const gistRestore =
  fs.existsSync(gistPreserveTmp) ? gistPreserveTmp : null
syncDataToApp(dataSrc, dataDest, gistRestore)
if (gistRestore) {
  try {
    rmWithRetries(gistPreserveTmp)
  } catch {
    /* ignore */
  }
}

const envSrc = path.join(root, '.env')
const envDest = path.join(stableDir, '.env')
if (fs.existsSync(envSrc)) {
  fs.copyFileSync(envSrc, envDest)
  console.log('[HRM] Copied .env -> HRM-app/.env (로컬 전용, Git 제외)')
}

const stableExe = path.join(stableDir, 'HRM-Desktop.exe')
const markerDir = path.join(root, 'pack-builds')
fs.mkdirSync(markerDir, { recursive: true })
fs.writeFileSync(path.join(markerDir, 'LAST.txt'), stableExe, 'utf8')

console.log('\n[HRM] Done. Double-click:\n ', stableExe, '\n')
