const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function sleepSync(ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    /* busy-wait: Windows에서 별도 도구 없이 짧게 대기 */
  }
}

if (process.platform === 'win32') {
  try {
    execSync('taskkill /F /IM HRM-Desktop.exe', { stdio: 'ignore' })
  } catch {
    /* */
  }
}

const release = path.join(process.cwd(), 'release')
let lastErr
for (let attempt = 0; attempt < 6; attempt++) {
  try {
    fs.rmSync(release, { recursive: true, force: true })
    lastErr = undefined
    break
  } catch (e) {
    lastErr = e
    sleepSync(800)
  }
}
if (lastErr) {
  console.error(
    '[clean-release] release 폴더를 지우지 못했습니다. HRM 창을 모두 닫고 탐색기에서 release 폴더를 연 상태가 아닌지 확인한 뒤 다시 실행하세요.',
  )
  console.error(lastErr.message)
  process.exit(1)
}
