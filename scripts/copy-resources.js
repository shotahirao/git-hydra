const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const sourceDir = path.join(projectRoot, 'resources')
const destDir = path.join(projectRoot, 'out', 'resources')

if (!fs.existsSync(sourceDir)) {
  console.warn(`Resources directory not found: ${sourceDir}`)
  process.exit(0)
}

fs.rmSync(destDir, { recursive: true, force: true })
fs.cpSync(sourceDir, destDir, { recursive: true })
console.log(`Copied resources to ${destDir}`)
