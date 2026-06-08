import { createRequire } from 'node:module'
import { mkdir, rename, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, '.tmp-runtime', 'promo-video', 'package.json'))
const { chromium } = require('playwright')
const source = resolve(root, 'design', 'promo-video.html')
const outputDir = resolve(root, 'output', 'promo')
const tempDir = resolve(outputDir, 'recording')
const output = resolve(outputDir, 'familyassister-promo.webm')
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

await rm(tempDir, { recursive: true, force: true })
await mkdir(tempDir, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: edgePath,
})
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: tempDir,
    size: { width: 1920, height: 1080 },
  },
})

const page = await context.newPage()
await page.goto(pathToFileURL(source).href)
await page.waitForFunction(() => window.__PROMO_DONE__ === true, null, { timeout: 50_000 })
const video = page.video()
await page.close()
await context.close()
await browser.close()

if (!video) {
  throw new Error('Playwright did not create a video recording')
}

await rm(output, { force: true })
await rename(await video.path(), output)
console.log(output)
