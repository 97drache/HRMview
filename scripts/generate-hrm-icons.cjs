/**
 * Renders desktop/mobile HRM icon SVGs into PNG/ICO assets and presentation exports.
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const root = path.resolve(__dirname, '..')
const desktopSvgPath = path.join(root, 'build', 'hrm-icon-desktop.svg')
const mobileSvgPath = path.join(root, 'build', 'hrm-icon-mobile.svg')
const desktopSvg = fs.readFileSync(desktopSvgPath)
const mobileSvg = fs.readFileSync(mobileSvgPath)

const desktopOutputs = [
  { file: path.join(root, 'build', 'icon.png'), size: 512 },
  { file: path.join(root, 'public', 'favicon-32x32.png'), size: 32 },
  { file: path.join(root, 'public', 'apple-touch-icon.png'), size: 180 },
  { file: path.join(root, 'public', 'icon-192.png'), size: 192 },
]

const mobileOutputs = [
  { file: path.join(root, 'headcount-web', 'public', 'favicon-32x32.png'), size: 32 },
  { file: path.join(root, 'headcount-web', 'public', 'apple-touch-icon.png'), size: 180 },
  { file: path.join(root, 'headcount-web', 'public', 'icon-192.png'), size: 192 },
  { file: path.join(root, 'headcount-web', 'public', 'icon-512.png'), size: 512 },
]

const presentationSizes = [512, 1024, 2048]
const presentationDir = path.join(root, 'docs', 'assets', 'icons')

const icoSizes = [16, 32, 48, 64, 128, 256]

function writeIco(pngEntries, outPath) {
  const count = pngEntries.length
  let dataOffset = 6 + count * 16
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  const dirs = []
  const blobs = []
  for (const { width, height, png } of pngEntries) {
    const dir = Buffer.alloc(16)
    dir.writeUInt8(width >= 256 ? 0 : width, 0)
    dir.writeUInt8(height >= 256 ? 0 : height, 1)
    dir.writeUInt8(0, 2)
    dir.writeUInt8(0, 3)
    dir.writeUInt16LE(1, 4)
    dir.writeUInt16LE(32, 6)
    dir.writeUInt32LE(png.length, 8)
    dir.writeUInt32LE(dataOffset, 12)
    dataOffset += png.length
    dirs.push(dir)
    blobs.push(png)
  }
  fs.writeFileSync(outPath, Buffer.concat([header, ...dirs, ...blobs]))
}

async function renderPng(svg, size) {
  return sharp(svg).resize(size, size).png().toBuffer()
}

async function writeSizedPng(svg, file, size) {
  await sharp(svg).resize(size, size).png().toFile(file)
  console.log('wrote', path.relative(root, file))
}

async function writePresentationExports() {
  fs.mkdirSync(presentationDir, { recursive: true })
  fs.copyFileSync(desktopSvgPath, path.join(presentationDir, 'hrm-icon-desktop.svg'))
  fs.copyFileSync(mobileSvgPath, path.join(presentationDir, 'hrm-icon-mobile.svg'))

  for (const size of presentationSizes) {
    await writeSizedPng(desktopSvg, path.join(presentationDir, `hrm-desktop-${size}.png`), size)
    await writeSizedPng(mobileSvg, path.join(presentationDir, `hrm-mobile-${size}.png`), size)
  }

  const tile = 2048
  const gap = 160
  const labelH = 120
  const iconSize = tile - gap * 2 - labelH
  const sheetW = tile * 2 + gap
  const sheetH = tile

  const [deskBuf, mobBuf] = await Promise.all([
    renderPng(desktopSvg, iconSize),
    renderPng(mobileSvg, iconSize),
  ])

  const labelSvg = (text, x) => Buffer.from(`
    <svg width="${tile}" height="${labelH}" xmlns="http://www.w3.org/2000/svg">
      <text x="${x}" y="78" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="52" font-weight="600" fill="#334155">${text}</text>
    </svg>
  `)

  const deskTile = await sharp({
    create: { width: tile, height: tile, channels: 4, background: '#f8fafc' },
  })
    .composite([
      { input: deskBuf, top: gap, left: Math.round((tile - iconSize) / 2) },
      { input: labelSvg('Desktop HRM', tile / 2), top: tile - labelH - Math.round(gap / 2), left: 0 },
    ])
    .png()
    .toBuffer()

  const mobTile = await sharp({
    create: { width: tile, height: tile, channels: 4, background: '#f8fafc' },
  })
    .composite([
      { input: mobBuf, top: gap, left: Math.round((tile - iconSize) / 2) },
      { input: labelSvg('Mobile HRM', tile / 2), top: tile - labelH - Math.round(gap / 2), left: 0 },
    ])
    .png()
    .toBuffer()

  const pairPath = path.join(presentationDir, 'hrm-icons-pair-4096x2048.png')
  await sharp({
    create: { width: sheetW, height: sheetH, channels: 4, background: '#ffffff' },
  })
    .composite([
      { input: deskTile, left: 0, top: 0 },
      { input: mobTile, left: tile + gap, top: 0 },
    ])
    .png()
    .toFile(pairPath)
  console.log('wrote', path.relative(root, pairPath))
}

async function main() {
  fs.mkdirSync(path.join(root, 'build'), { recursive: true })
  fs.mkdirSync(path.join(root, 'public'), { recursive: true })
  fs.mkdirSync(path.join(root, 'headcount-web', 'public'), { recursive: true })

  fs.copyFileSync(desktopSvgPath, path.join(root, 'public', 'favicon.svg'))

  for (const { file, size } of desktopOutputs) {
    await writeSizedPng(desktopSvg, file, size)
  }

  for (const { file, size } of mobileOutputs) {
    await writeSizedPng(mobileSvg, file, size)
  }

  const icoEntries = []
  for (const size of icoSizes) {
    const png = await renderPng(desktopSvg, size)
    icoEntries.push({ width: size, height: size, png })
  }
  const icoPath = path.join(root, 'build', 'icon.ico')
  writeIco(icoEntries, icoPath)
  console.log('wrote', path.relative(root, icoPath))

  await writePresentationExports()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
