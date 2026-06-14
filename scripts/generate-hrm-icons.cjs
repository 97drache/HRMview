/**
 * Renders build/hrm-icon.svg into PNG/ICO assets for desktop and headcount-web.
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const root = path.resolve(__dirname, '..')
const svgPath = path.join(root, 'build', 'hrm-icon.svg')
const svg = fs.readFileSync(svgPath)

const outputs = [
  { file: path.join(root, 'build', 'icon.png'), size: 512 },
  { file: path.join(root, 'public', 'favicon-32x32.png'), size: 32 },
  { file: path.join(root, 'public', 'apple-touch-icon.png'), size: 180 },
  { file: path.join(root, 'public', 'icon-192.png'), size: 192 },
  { file: path.join(root, 'headcount-web', 'public', 'favicon-32x32.png'), size: 32 },
  { file: path.join(root, 'headcount-web', 'public', 'apple-touch-icon.png'), size: 180 },
  { file: path.join(root, 'headcount-web', 'public', 'icon-192.png'), size: 192 },
]

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

async function main() {
  fs.mkdirSync(path.join(root, 'build'), { recursive: true })
  fs.mkdirSync(path.join(root, 'public'), { recursive: true })
  fs.mkdirSync(path.join(root, 'headcount-web', 'public'), { recursive: true })

  fs.copyFileSync(svgPath, path.join(root, 'public', 'favicon.svg'))

  for (const { file, size } of outputs) {
    await sharp(svg).resize(size, size).png().toFile(file)
    console.log('wrote', path.relative(root, file))
  }

  const icoEntries = []
  for (const size of icoSizes) {
    const png = await sharp(svg).resize(size, size).png().toBuffer()
    icoEntries.push({ width: size, height: size, png })
  }
  const icoPath = path.join(root, 'build', 'icon.ico')
  writeIco(icoEntries, icoPath)
  console.log('wrote', path.relative(root, icoPath))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
