import { createRequire } from 'node:module'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, '.tmp-runtime', 'promo-video', 'package.json'))
const { chromium } = require('playwright')

const source = resolve(root, 'design', 'promo-video.html')
const frameDir = resolve(root, 'output', 'promo', 'frames')
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

await rm(frameDir, { recursive: true, force: true })
await mkdir(frameDir, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: edgePath,
})

const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
})

await page.goto(pathToFileURL(source).href)
await page.waitForTimeout(500)

for (let index = 0; index < 7; index += 1) {
  const progress = index / 7
  await page.evaluate((sceneIndex) => {
    const scenes = [...document.querySelectorAll('.scene')]
    scenes.forEach((scene, current) => scene.classList.toggle('active', current === sceneIndex))
    document.querySelector('.caption').textContent = scenes[sceneIndex].dataset.caption
    document.querySelector('.progress span').style.width = `${((sceneIndex + 1) / scenes.length) * 100}%`
  }, index)
  await page.waitForTimeout(250)
  await page.screenshot({
    path: resolve(frameDir, `frame-${String(index + 1).padStart(2, '0')}.png`),
    fullPage: false,
  })
}

await browser.close()
console.log(frameDir)
