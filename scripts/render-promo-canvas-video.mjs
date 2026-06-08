import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, '.tmp-runtime', 'promo-video', 'package.json'))
const { chromium } = require('playwright')

const outputDir = resolve(root, 'output', 'promo')
const output = resolve(outputDir, 'familyassister-promo.webm')
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: edgePath,
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const context = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
})
const page = await context.newPage()

await page.setContent(String.raw`
<!doctype html>
<html>
  <head><meta charset="UTF-8"><title>FamilyAssister promo canvas</title></head>
  <body style="margin:0;overflow:hidden;background:#07131f">
    <canvas id="c" width="1920" height="1080"></canvas>
    <script>
      const canvas = document.getElementById('c')
      const ctx = canvas.getContext('2d')
      const W = canvas.width
      const H = canvas.height
      const DURATION = 24
      const FPS = 24
      const sceneCount = 7
      const cream = '#fff4e3'
      const mint = '#78e071'
      const ink = '#07131f'
      const pine = '#123f3a'
      const paper = '#fffaf0'
      const sky = '#bfe7ff'
      const coral = '#f28a6b'
      const gold = '#f3c95f'

      const font = '"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif'

      function ease(x) {
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
      }

      function roundRect(x, y, w, h, r, fill, stroke) {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.arcTo(x + w, y, x + w, y + h, r)
        ctx.arcTo(x + w, y + h, x, y + h, r)
        ctx.arcTo(x, y + h, x, y, r)
        ctx.arcTo(x, y, x + w, y, r)
        ctx.closePath()
        if (fill) {
          ctx.fillStyle = fill
          ctx.fill()
        }
        if (stroke) {
          ctx.strokeStyle = stroke
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }

      function text(value, x, y, size, weight = 800, color = cream, align = 'left', maxWidth) {
        ctx.fillStyle = color
        ctx.font = weight + ' ' + size + 'px ' + font
        ctx.textAlign = align
        ctx.textBaseline = 'top'
        ctx.fillText(value, x, y, maxWidth)
      }

      function multiline(value, x, y, size, lineHeight, weight = 700, color = 'rgba(255,244,227,.86)', maxWidth = 720) {
        ctx.fillStyle = color
        ctx.font = weight + ' ' + size + 'px ' + font
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        const chars = [...value]
        let line = ''
        let top = y
        for (const ch of chars) {
          const next = line + ch
          if (ctx.measureText(next).width > maxWidth && line) {
            ctx.fillText(line, x, top)
            top += lineHeight
            line = ch
          } else {
            line = next
          }
        }
        if (line) ctx.fillText(line, x, top)
      }

      function background(t) {
        const g = ctx.createLinearGradient(0, 0, W, H)
        g.addColorStop(0, '#08131b')
        g.addColorStop(.5, '#0a2832')
        g.addColorStop(1, '#123f3a')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)

        ctx.globalAlpha = .23
        ctx.fillStyle = mint
        ctx.beginPath()
        ctx.arc(300 + Math.sin(t * .7) * 25, 170, 420, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = coral
        ctx.beginPath()
        ctx.arc(1580, 710 + Math.cos(t * .55) * 28, 360, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = .12
        ctx.strokeStyle = cream
        ctx.lineWidth = 1
        for (let x = 0; x < W; x += 56) {
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, H)
          ctx.stroke()
        }
        for (let y = 0; y < H; y += 56) {
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(W, y)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }

      function footer(scene, progress) {
        text(scene, 88, 1006, 18, 900, 'rgba(255,244,227,.66)')
        ctx.fillStyle = 'rgba(255,244,227,.2)'
        roundRect(88, 1034, 1744, 4, 2, 'rgba(255,244,227,.22)')
        roundRect(88, 1034, 1744 * progress, 4, 2, mint)
      }

      function brandMark(x, y, size = 132) {
        const g = ctx.createLinearGradient(x, y, x + size, y + size)
        g.addColorStop(0, '#9af279')
        g.addColorStop(1, '#58d565')
        roundRect(x, y, size, size, 30, g)
        text('家暖', x + size / 2, y + 39, 38, 950, ink, 'center')
      }

      function tag(label, x, y) {
        ctx.font = '900 18px ' + font
        const w = ctx.measureText(label).width + 36
        roundRect(x, y, w, 50, 25, 'rgba(255,244,227,.09)', 'rgba(255,244,227,.32)')
        text(label, x + 18, y + 12, 18, 900, cream)
        return w
      }

      function phone(x, y, scale = 1) {
        ctx.save()
        ctx.translate(x, y)
        ctx.scale(scale, scale)
        roundRect(0, 0, 368, 646, 42, 'rgba(255,250,240,.16)', 'rgba(255,250,240,.35)')
        roundRect(18, 18, 332, 610, 32, paper)
        text('今日速记', 42, 44, 21, 950, pine)
        ;['爸','妈','我'].forEach((v, i) => {
          roundRect(242 + i * 38, 38, 32, 32, 16, '#a6ed7c')
          text(v, 258 + i * 38, 46, 13, 950, ink, 'center')
        })
        roundRect(42, 96, 284, 154, 8, '#fff6df', 'rgba(18,63,58,.2)')
        multiline('妈妈最近怕冷，膝盖也不太舒服。今天有风，出门别穿太薄。', 62, 116, 21, 31, 900, '#163329', 244)
        ;['文','麦','拍'].forEach((v, i) => {
          roundRect(42 + i * 98, 266, 88, 58, 8, '#153c38')
          text(v, 86 + i * 98, 280, 24, 950, cream, 'center')
        })
        roundRect(42, 342, 284, 64, 8, mint)
        text('记下来', 184, 359, 22, 950, ink, 'center')
        roundRect(42, 434, 284, 64, 8, 'rgba(18,63,58,.08)')
        text('离线可用', 62, 447, 16, 950, '#0e6b4b')
        multiline('断网也能先存，联网后自动同步。', 62, 472, 15, 22, 800, '#17332b', 244)
        roundRect(42, 514, 284, 64, 8, 'rgba(18,63,58,.08)')
        text('成员隔离', 62, 527, 16, 950, '#0e6b4b')
        multiline('每位家人拥有独立记忆空间。', 62, 552, 15, 22, 800, '#17332b', 244)
        ctx.restore()
      }

      function card(x, y, w, h, fill = paper) {
        ctx.shadowColor = 'rgba(0,0,0,.26)'
        ctx.shadowBlur = 46
        ctx.shadowOffsetY = 22
        roundRect(x, y, w, h, 8, fill)
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0
      }

      function scene0(local, t) {
        brandMark(894, 112)
        text('FamilyAssister', W / 2, 428, 116, 950, cream, 'center')
        text('把照顾家人的经验，变成全家都能使用的 AI 记忆系统。', W / 2, 710, 29, 900, cream, 'center')
        let x = 763
        x += tag('家庭照护', x, 920) + 14
        x += tag('本地自托管', x, 920) + 14
        tag('可追溯建议', x, 920)
      }

      function scene1(local, t) {
        text('01 / 随手记', 140, 186, 21, 950, mint)
        multiline('一句话、一次拍照、一个语音。', 140, 245, 66, 78, 950, cream, 650)
        multiline('饮食忌口、冷热偏好、近期不适、运动习惯，都可以像便利贴一样记录下来。', 140, 420, 28, 45, 750, 'rgba(255,244,227,.86)', 680)
        phone(1156 + Math.sin(t) * 10, 216, 1)
      }

      function scene2(local, t) {
        text('02 / 变成记忆', 120, 186, 21, 950, mint)
        multiline('AI 不只是聊天，它会帮你沉淀照护知识。', 120, 245, 60, 74, 950, cream, 720)
        multiline('碎片速记会被抽取、校验、去重，变成可审核、可检索、可追溯的家庭记忆。', 120, 456, 27, 44, 750, 'rgba(255,244,227,.86)', 700)
        roundRect(1020, 214, 690, 570, 8, 'rgba(5,24,33,.58)', 'rgba(255,250,240,.28)')
        text('记忆抽取流程', 1052, 244, 22, 950, cream)
        roundRect(1588, 236, 84, 34, 17, 'rgba(120,224,113,.18)')
        text('已入库', 1630, 244, 15, 950, '#a8ff9c', 'center')
        const notes = [
          ['“爸爸不吃香菜，牛奶喝多会不舒服。”', 1070, 330, paper],
          ['“妈妈怕冷，风大时膝盖容易酸。”', 1356, 430, sky],
          ['“孩子最近喜欢饭后散步，不适合剧烈跑跳。”', 1148, 604, '#ffe0b6'],
        ]
        notes.forEach(([v, x, y, fill], i) => {
          const fy = y + Math.sin(t * 1.5 + i) * 12
          card(x, fy, 270, 96, fill)
          multiline(v, x + 18, fy + 18, 17, 25, 900, '#0c1f1c', 226)
        })
      }

      function scene3(local, t) {
        text('03 / 可解释建议', W / 2, 142, 21, 950, mint, 'center')
        text('天气 + 家庭记忆，生成今天真正合适的建议。', W / 2, 206, 58, 950, cream, 'center')
        const items = [
          ['衣', '穿衣', '今天风力偏大，给怕冷成员准备轻薄外套，膝盖处注意保暖。', '依据：怕冷、膝盖不适、今日有风'],
          ['食', '饮食', '避开已知过敏和忌口，优先推荐清淡、温热、家人接受度高的搭配。', '依据：忌口、过敏、口味偏好'],
          ['动', '运动', '结合天气和身体状态，建议低强度散步，不强推不合适的训练。', '依据：近期不适、运动习惯'],
        ]
        items.forEach(([icon, title, body, ev], i) => {
          const x = 284 + i * 456
          card(x, 372, 408, 300, paper)
          text(icon, x + 28, 394, 42, 950, pine)
          text(title, x + 28, 464, 26, 950, '#103a35')
          multiline(body, x + 28, 512, 18, 28, 780, '#223d36', 338)
          roundRect(x + 28, 612, 330, 40, 8, 'rgba(120,224,113,.24)')
          text(ev, x + 42, 624, 14, 950, '#0c4c36')
        })
      }

      function scene4(local, t) {
        text('04 / 管理后台', 130, 186, 21, 950, mint)
        multiline('照护不是玄学，系统给你审核和管理入口。', 130, 245, 58, 72, 950, cream, 680)
        multiline('成员档案、记忆审核、设备配对、Provider 设置、验收证据导出，都在管理端完成。', 130, 456, 27, 44, 750, 'rgba(255,244,227,.86)', 680)
        roundRect(950, 210, 760, 500, 8, '#06141d', 'rgba(255,250,240,.24)')
        ;[coral, gold, mint].forEach((c, i) => roundRect(980 + i * 22, 236, 13, 13, 6.5, c))
        ctx.strokeStyle = 'rgba(255,250,240,.14)'
        ctx.beginPath()
        ctx.moveTo(950, 270)
        ctx.lineTo(1710, 270)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(1112, 270)
        ctx.lineTo(1112, 710)
        ctx.stroke()
        for (let i = 0; i < 6; i++) roundRect(974, 302 + i * 52, 110, 32, 8, i === 0 ? mint : 'rgba(255,250,240,.09)')
        for (let i = 0; i < 5; i++) {
          roundRect(1142, 310 + i * 66, 520, 46, 8, 'rgba(255,250,240,.08)')
          roundRect(1164, 322 + i * 66, 100, 22, 11, 'rgba(120,224,113,.22)')
          roundRect(1290, 326 + i * 66, 250, 14, 7, 'rgba(255,250,240,.3)')
          roundRect(1570, 322 + i * 66, 70, 22, 11, 'rgba(120,224,113,.22)')
        }
      }

      function scene5(local, t) {
        text('05 / 技术底座', W / 2, 140, 21, 950, mint, 'center')
        text('完整自托管，家庭数据不必交出去。', W / 2, 204, 58, 950, cream, 'center')
        const items = [
          ['React PWA', '移动端速记、离线缓存、扫码配对。'],
          ['FastAPI', '异步 API、SSE 流式建议、JWT 鉴权。'],
          ['PostgreSQL', 'pgvector 记忆检索，保留来源和证据。'],
          ['Ollama', '默认本地 Qwen2.5，也可切换云端 Provider。'],
        ]
        items.forEach(([title, body], i) => {
          const x = 182 + i * 396
          card(x, 370, 340, 178, paper)
          text(title, x + 22, 394, 23, 950, '#0e5f42')
          multiline(body, x + 22, 448, 17, 27, 780, '#263b35', 286)
        })
        roundRect(354, 650, 1212, 76, 8, 'rgba(120,224,113,.1)', 'rgba(120,224,113,.42)')
        text('核心隐私目标：家庭速记、健康档案和记忆库默认留在自己的机器里。', W / 2, 672, 25, 950, '#c9ffc4', 'center')
      }

      function scene6(local, t) {
        roundRect(440, 258, 1040, 442, 8, 'rgba(5,24,33,.72)', 'rgba(255,250,240,.28)')
        multiline('让家人的照护经验，越用越懂这个家。', 520, 326, 66, 82, 950, cream, 880)
        multiline('FamilyAssister 家暖：一个可积累、可解释、可自托管的家庭 AI 助手。', 520, 510, 28, 44, 780, 'rgba(255,244,227,.86)', 860)
        roundRect(520, 610, 470, 60, 8, mint)
        text('github.com/mrzhou321/FamilyAssist', 755, 626, 22, 950, ink, 'center')
      }

      const scenes = [
        ['FamilyAssister 家暖', scene0],
        ['随手记录，不让经验散落', scene1],
        ['AI 抽取为家庭记忆', scene2],
        ['从记忆到建议，每条都有依据', scene3],
        ['管理端审核、设置和验收', scene4],
        ['自托管，数据留在家里', scene5],
        ['FamilyAssister 家暖', scene6],
      ]

      function draw(time) {
        const t = time / 1000
        const progress = Math.min(t / DURATION, 1)
        const raw = Math.min(sceneCount - 0.0001, progress * sceneCount)
        const sceneIndex = Math.floor(raw)
        const local = raw - sceneIndex
        background(t)
        ctx.save()
        const enter = ease(Math.min(local / .18, 1))
        const exit = local > .84 ? ease((local - .84) / .16) : 0
        ctx.globalAlpha = enter * (1 - exit)
        ctx.translate(0, 22 * (1 - enter) - 18 * exit)
        scenes[sceneIndex][1](local, t)
        ctx.restore()
        footer(scenes[sceneIndex][0], progress)
      }

      async function recordBlob() {
        const stream = canvas.captureStream(FPS)
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm;codecs=vp8'
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 7_000_000 })
        const chunks = []
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data)
        }
        recorder.start(500)
        const start = performance.now()
        return await new Promise((resolve) => {
          function frame(now) {
            const elapsed = now - start
            draw(elapsed)
            if (elapsed < DURATION * 1000) requestAnimationFrame(frame)
            else {
              draw(DURATION * 1000)
              recorder.onstop = async () => {
                const blob = new Blob(chunks, { type: mimeType })
                resolve(blob)
              }
              recorder.stop()
            }
          }
          requestAnimationFrame(frame)
        })
      }

      window.__recordPromo = async () => {
        const blob = await recordBlob()
        const href = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = href
        link.download = 'familyassister-promo.webm'
        document.body.appendChild(link)
        link.click()
        setTimeout(() => URL.revokeObjectURL(href), 2000)
        return true
      }
    </script>
  </body>
</html>`)

const downloadPromise = page.waitForEvent('download', { timeout: 60_000 })
await page.evaluate(() => window.__recordPromo())
const download = await downloadPromise
await download.saveAs(output)
await context.close()
await browser.close()

console.log(output)
