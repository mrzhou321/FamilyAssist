import { createRequire } from 'node:module'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(resolve(root, '.tmp-runtime', 'promo-video', 'package.json'))
const { chromium } = require('playwright')

const outputDir = resolve(root, 'output', 'promo')
const output = resolve(outputDir, 'familyassister-product-walkthrough.webm')
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
  <head><meta charset="UTF-8"><title>FamilyAssister product walkthrough</title></head>
  <body style="margin:0;overflow:hidden;background:#07131f">
    <canvas id="c" width="1920" height="1080"></canvas>
    <script>
      const canvas = document.getElementById('c')
      const ctx = canvas.getContext('2d')
      const W = 1920
      const H = 1080
      const FPS = 24
      const DURATION = 28
      const font = '"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif'
      const ink = '#07131f'
      const bg = '#08131b'
      const panel = '#fffaf0'
      const card = '#ffffff'
      const line = '#d9dfd0'
      const muted = '#667268'
      const fg = '#182821'
      const accent = '#66d96f'
      const sage = '#3f7664'
      const honey = '#efbd5a'
      const coral = '#ec8066'
      const blue = '#acdced'

      function ease(x) {
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
      }

      function rr(x, y, w, h, r, fill, stroke) {
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

      function shadow() {
        ctx.shadowColor = 'rgba(0,0,0,.28)'
        ctx.shadowBlur = 48
        ctx.shadowOffsetY = 22
      }

      function clearShadow() {
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0
      }

      function text(value, x, y, size, weight = 800, color = panel, align = 'left', width) {
        ctx.fillStyle = color
        ctx.font = weight + ' ' + size + 'px ' + font
        ctx.textAlign = align
        ctx.textBaseline = 'top'
        ctx.fillText(value, x, y, width)
      }

      function wrap(value, x, y, size, lh, weight = 700, color = 'rgba(255,250,240,.84)', width = 720) {
        ctx.fillStyle = color
        ctx.font = weight + ' ' + size + 'px ' + font
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        let line = ''
        let top = y
        for (const ch of [...value]) {
          const next = line + ch
          if (ctx.measureText(next).width > width && line) {
            ctx.fillText(line, x, top)
            top += lh
            line = ch
          } else {
            line = next
          }
        }
        if (line) ctx.fillText(line, x, top)
      }

      function bgPaint(t) {
        const g = ctx.createLinearGradient(0, 0, W, H)
        g.addColorStop(0, '#07131f')
        g.addColorStop(.48, '#0b2a31')
        g.addColorStop(1, '#143b35')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)
        ctx.globalAlpha = .18
        ctx.strokeStyle = '#fffaf0'
        ctx.lineWidth = 1
        for (let x = 88; x < W; x += 80) {
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, H)
          ctx.stroke()
        }
        for (let y = 70; y < H; y += 80) {
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(W, y)
          ctx.stroke()
        }
        ctx.globalAlpha = .22
        ctx.fillStyle = accent
        ctx.beginPath()
        ctx.arc(340 + Math.sin(t * .5) * 18, 180, 360, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = .16
        ctx.fillStyle = coral
        ctx.beginPath()
        ctx.arc(1650, 720 + Math.cos(t * .4) * 22, 330, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      function footer(label, progress) {
        text(label, 88, 1006, 18, 900, 'rgba(255,250,240,.68)')
        rr(88, 1034, 1744, 4, 2, 'rgba(255,250,240,.22)')
        rr(88, 1034, 1744 * progress, 4, 2, accent)
      }

      function heading(kicker, title, body) {
        text(kicker, 110, 122, 21, 950, accent)
        wrap(title, 110, 176, 56, 68, 950, panel, 760)
        wrap(body, 110, 374, 25, 40, 720, 'rgba(255,250,240,.84)', 720)
      }

      function labelPill(value, x, y, fill = 'rgba(102,217,111,.14)', color = '#bfffba') {
        ctx.font = '900 16px ' + font
        const w = ctx.measureText(value).width + 26
        rr(x, y, w, 34, 17, fill, 'rgba(255,250,240,.16)')
        text(value, x + 13, y + 7, 16, 900, color)
        return w
      }

      function phoneFrame(x, y, title) {
        shadow()
        rr(x, y, 390, 730, 44, 'rgba(255,250,240,.16)', 'rgba(255,250,240,.34)')
        clearShadow()
        rr(x + 18, y + 18, 354, 694, 32, panel)
        text(title, x + 42, y + 46, 20, 950, sage)
        return { x: x + 18, y: y + 18, w: 354, h: 694 }
      }

      function bottomNav(x, y, active) {
        ctx.strokeStyle = line
        ctx.beginPath()
        ctx.moveTo(x + 18, y + 628)
        ctx.lineTo(x + 372, y + 628)
        ctx.stroke()
        const items = ['速记', '建议', '记忆']
        items.forEach((item, i) => {
          const cx = x + 78 + i * 118
          text(item, cx, y + 654, 15, 900, active === i ? sage : muted, 'center')
        })
      }

      function quickNotePhone(x, y) {
        phoneFrame(x, y, '今日速记')
        text('妈妈，随手记一笔', x + 42, y + 88, 28, 950, fg)
        ;['语音 可用', '拍照 可用', '离线 可用'].forEach((v, i) => {
          rr(x + 42 + i * 104, y + 140, 92, 32, 8, i === 0 ? '#e7f5df' : '#f7efe0', line)
          text(v, x + 88 + i * 104, y + 149, 12, 900, i === 0 ? sage : muted, 'center')
        })
        rr(x + 42, y + 196, 306, 170, 12, '#fff3d8', '#dfd6bc')
        wrap('妈妈最近怕冷，今天风大，出门准备薄外套。', x + 64, y + 222, 22, 34, 850, fg, 260)
        ;['语', '拍'].forEach((v, i) => {
          rr(x + 60 + i * 54, y + 388, 42, 42, 21, '#163c38')
          text(v, x + 81 + i * 54, y + 397, 18, 950, panel, 'center')
        })
        rr(x + 42, y + 456, 306, 56, 10, accent)
        text('记下来', x + 195, y + 471, 20, 950, ink, 'center')
        ;[
          ['饮食', '爸爸不吃香菜，牛奶喝多会不舒服。'],
          ['身体', '妈妈膝盖最近不适，少走楼梯。'],
        ].forEach(([tag, body], i) => {
          rr(x + 42, y + 536 + i * 68, 306, 52, 10, card, line)
          rr(x + 58, y + 550 + i * 68, 52, 24, 12, i === 0 ? honey : accent)
          text(tag, x + 84, y + 555 + i * 68, 12, 950, ink, 'center')
          text(body, x + 124, y + 553 + i * 68, 13, 800, fg, 'left', 206)
        })
        bottomNav(x, y, 0)
      }

      function advicePhone(x, y) {
        phoneFrame(x, y, '今日建议')
        rr(x + 42, y + 86, 306, 110, 18, sage)
        text('上海 · 今日 · 妈妈', x + 62, y + 106, 15, 850, panel)
        text('18°', x + 62, y + 132, 48, 950, panel)
        text('多云 / 有风 / 降水 20%', x + 160, y + 151, 14, 850, 'rgba(255,250,240,.86)')
        ;[
          ['穿衣', '风力偏大，薄外套加护膝，避免膝盖受凉。', '依据：怕冷、膝盖不适'],
          ['饮食', '晚餐避开香菜和冷饮，优先温热清淡。', '依据：忌口、近期胃不适'],
          ['运动', '建议饭后短距离散步，不安排跑跳。', '依据：膝盖不适、运动习惯'],
        ].forEach(([title, body, basis], i) => {
          const top = y + 224 + i * 126
          rr(x + 42, top, 306, 104, 14, i === 1 ? '#fff5de' : card, line)
          text(title, x + 62, top + 16, 21, 950, fg)
          wrap(body, x + 62, top + 48, 14, 21, 800, fg, 250)
          text(basis, x + 62, top + 82, 12, 850, sage)
        })
        bottomNav(x, y, 1)
      }

      function memoryPhone(x, y) {
        phoneFrame(x, y, '记忆库')
        text('12 条 · 妈妈', x + 42, y + 92, 30, 950, fg)
        ;['全部', '穿衣', '饮食', '运动'].forEach((v, i) => {
          rr(x + 42 + i * 76, y + 142, 66, 34, 17, i === 0 ? accent : card, line)
          text(v, x + 75 + i * 76, y + 151, 13, 900, i === 0 ? ink : muted, 'center')
        })
        ;[
          ['穿衣', '妈妈怕冷，风大时膝盖容易酸。', '事实 · 96% · note #18'],
          ['饮食', '晚餐不适合太凉，偏好热汤。', '事实 · 91% · note #21'],
          ['运动', '最近膝盖不适，适合低强度散步。', '情景 · 84% · note #27'],
          ['通用', '周末通常上午去社区活动室。', '情景 · 76% · note #32'],
        ].forEach(([tag, body, meta], i) => {
          const top = y + 204 + i * 92
          rr(x + 42, top, 306, 76, 12, card, line)
          rr(x + 60, top + 16, 54, 24, 12, [accent, honey, blue, '#d7dce8'][i])
          text(tag, x + 87, top + 21, 12, 950, ink, 'center')
          text(body, x + 126, top + 15, 14, 850, fg, 'left', 198)
          text(meta, x + 126, top + 48, 11, 800, muted)
        })
        bottomNav(x, y, 2)
      }

      function pairPhone(x, y) {
        phoneFrame(x, y, '扫码配对')
        text('绑定家庭成员', x + 42, y + 92, 30, 950, fg)
        wrap('管理员生成一次性 token，手机扫码后换取长期成员会话。', x + 42, y + 140, 17, 27, 760, muted, 300)
        rr(x + 94, y + 230, 202, 202, 12, card, line)
        for (let row = 0; row < 7; row++) {
          for (let col = 0; col < 7; col++) {
            if ((row * 3 + col * 5) % 4 !== 0) rr(x + 116 + col * 24, y + 252 + row * 24, 16, 16, 3, ink)
          }
        }
        rr(x + 42, y + 486, 306, 52, 10, accent)
        text('完成配对', x + 195, y + 501, 18, 950, ink, 'center')
        text('权限边界：成员只能访问自己的速记、记忆和建议。', x + 42, y + 574, 14, 850, muted, 'left', 300)
      }

      function adminShell(x, y, w, h, active, title) {
        shadow()
        rr(x, y, w, h, 10, '#06141d', 'rgba(255,250,240,.24)')
        clearShadow()
        rr(x, y, w, 50, 10, '#081a24')
        ;[coral, honey, accent].forEach((c, i) => rr(x + 20 + i * 22, y + 19, 12, 12, 6, c))
        ctx.strokeStyle = 'rgba(255,250,240,.12)'
        ctx.beginPath()
        ctx.moveTo(x + 190, y + 50)
        ctx.lineTo(x + 190, y + h)
        ctx.stroke()
        text('家暖后台', x + 26, y + 78, 20, 950, panel)
        const nav = ['成员管理', '记忆库', '速记审核', '推荐记录', '配对二维码', '系统设置']
        nav.forEach((n, i) => {
          const top = y + 126 + i * 48
          rr(x + 20, top, 150, 34, 8, i === active ? accent : 'rgba(255,250,240,.06)')
          text(n, x + 95, top + 8, 14, 900, i === active ? ink : 'rgba(255,250,240,.72)', 'center')
        })
        text(title, x + 230, y + 82, 30, 950, panel)
      }

      function membersAdmin(x, y) {
        adminShell(x, y, 900, 650, 0, '成员档案')
        ;['姓名', '关系', '过敏源', '饮食限制', '运动偏好'].forEach((v, i) => text(v, x + 230 + i * 118, y + 142, 13, 850, 'rgba(255,250,240,.6)'))
        ;[
          ['妈妈', '母亲', '无', '少冷饮', '散步'],
          ['爸爸', '父亲', '牛奶', '不吃香菜', '太极'],
          ['孩子', '子女', '花粉', '少糖', '骑行'],
        ].forEach((row, r) => {
          const top = y + 174 + r * 74
          rr(x + 220, top, 630, 52, 8, 'rgba(255,250,240,.08)')
          row.forEach((v, i) => text(v, x + 235 + i * 118, top + 17, 15, 850, panel))
        })
        rr(x + 220, y + 440, 630, 112, 10, 'rgba(102,217,111,.10)', 'rgba(102,217,111,.24)')
        text('健康档案字段', x + 246, y + 462, 18, 950, '#bfffba')
        wrap('身高体重、冷热体感、慢性病、伤病史、口味偏好和运动强度，都会参与后续建议。', x + 246, y + 498, 16, 26, 780, 'rgba(255,250,240,.82)', 570)
      }

      function reviewAdmin(x, y) {
        adminShell(x, y, 900, 650, 2, '速记审核')
        ;[
          ['#32 · 语音', '妈妈最近膝盖酸，今天少爬楼。', '待审核'],
          ['#31 · 文本', '爸爸不吃香菜。', '已入库'],
          ['#30 · 照片', '拍照记录：早餐菜单。', '待审核'],
        ].forEach(([id, body, status], i) => {
          const top = y + 142 + i * 86
          rr(x + 220, top, 275, 66, 8, i === 0 ? 'rgba(102,217,111,.12)' : 'rgba(255,250,240,.08)', i === 0 ? accent : 'rgba(255,250,240,.1)')
          text(id, x + 238, top + 12, 13, 900, 'rgba(255,250,240,.66)')
          text(body, x + 238, top + 36, 14, 850, panel, 'left', 236)
          rr(x + 412, top + 12, 62, 24, 12, status === '已入库' ? 'rgba(102,217,111,.18)' : 'rgba(239,189,90,.18)')
          text(status, x + 443, top + 17, 11, 900, status === '已入库' ? '#bfffba' : '#ffe4a3', 'center')
        })
        rr(x + 530, y + 142, 320, 110, 8, 'rgba(255,250,240,.08)')
        text('原始速记', x + 550, y + 162, 14, 900, 'rgba(255,250,240,.62)')
        wrap('妈妈最近膝盖酸，今天少爬楼。', x + 550, y + 194, 18, 28, 850, panel, 270)
        rr(x + 530, y + 284, 320, 190, 8, 'rgba(255,250,240,.08)')
        text('候选记忆', x + 550, y + 304, 14, 900, 'rgba(255,250,240,.62)')
        text('类型：情景', x + 550, y + 340, 16, 850, panel)
        text('领域：运动', x + 690, y + 340, 16, 850, panel)
        wrap('妈妈近期膝盖不适，应减少爬楼和高冲击运动。', x + 550, y + 382, 18, 28, 850, panel, 270)
        rr(x + 620, y + 510, 106, 42, 8, accent)
        text('写入记忆库', x + 673, y + 522, 14, 950, ink, 'center')
      }

      function memoryAdmin(x, y) {
        adminShell(x, y, 900, 650, 1, '记忆库')
        ;['成员', '领域', '类型', '内容', '来源', '时效'].forEach((v, i) => text(v, x + 230 + i * 94, y + 142, 13, 850, 'rgba(255,250,240,.6)'))
        ;[
          ['妈妈', '穿衣', '事实', '怕冷，风大时膝盖易酸', 'note #18', '长期'],
          ['爸爸', '饮食', '事实', '不吃香菜，牛奶不耐受', 'note #22', '长期'],
          ['孩子', '运动', '情景', '近期花粉过敏，减少户外骑行', 'note #29', '7天'],
          ['全家', '通用', '情景', '周末上午常去社区活动室', '种子', '长期'],
        ].forEach((row, r) => {
          const top = y + 174 + r * 68
          rr(x + 220, top, 630, 48, 8, 'rgba(255,250,240,.08)')
          row.forEach((v, i) => text(v, x + 230 + i * 94, top + 16, i === 3 ? 13 : 14, 850, panel, 'left', i === 3 ? 185 : 86))
        })
        rr(x + 220, y + 494, 630, 58, 8, 'rgba(172,220,237,.12)', 'rgba(172,220,237,.28)')
        text('支持按成员、领域、类型筛选；每条记忆保留置信度、来源 note 与过期时间。', x + 246, y + 513, 16, 850, '#d9f4ff')
      }

      function settingsAdmin(x, y) {
        adminShell(x, y, 900, 650, 5, '系统设置')
        ;[
          ['LLM Provider', 'Ollama 本地 / DeepSeek / 通义千问'],
          ['生成模型', 'qwen2.5:3b'],
          ['向量模型', 'bge-small-zh-v1.5 · 512 维'],
          ['天气服务', '和风天气 API Key / 默认城市'],
        ].forEach(([name, value], i) => {
          const top = y + 140 + i * 72
          text(name, x + 230, top, 14, 900, 'rgba(255,250,240,.6)')
          rr(x + 230, top + 26, 360, 36, 8, 'rgba(255,250,240,.08)', 'rgba(255,250,240,.14)')
          text(value, x + 246, top + 35, 14, 850, panel)
        })
        ;[
          ['数据库', 'ready'],
          ['LLM', 'ready'],
          ['天气', 'degraded'],
          ['向量', 'ready'],
          ['隐私', 'ready'],
        ].forEach(([name, status], i) => {
          const top = y + 150 + i * 58
          rr(x + 640, top, 178, 40, 8, status === 'ready' ? 'rgba(102,217,111,.13)' : 'rgba(239,189,90,.13)')
          text(name, x + 660, top + 11, 14, 900, panel)
          text(status, x + 796, top + 11, 13, 900, status === 'ready' ? '#bfffba' : '#ffe4a3', 'right')
        })
        rr(x + 230, y + 500, 590, 56, 8, 'rgba(102,217,111,.10)', 'rgba(102,217,111,.24)')
        text('默认本地自托管；启用云端 LLM 前需要确认数据出境风险。', x + 252, y + 518, 16, 850, '#bfffba')
      }

      function overview(t) {
        text('FamilyAssister 家暖', 110, 132, 24, 950, accent)
        text('产品功能走查', 110, 188, 74, 950, panel)
        wrap('这版视频以页面和功能为主，展示移动端 PWA、管理后台、记忆抽取、建议依据和自托管设置。', 110, 300, 28, 44, 760, 'rgba(255,250,240,.84)', 760)
        labelPill('/mobile 速记', 110, 455)
        labelPill('/mobile/advice 建议', 248, 455)
        labelPill('/admin 审核', 440, 455)
        labelPill('/admin/settings 设置', 578, 455)
        quickNotePhone(1000, 132)
        advicePhone(1370, 180)
      }

      function sceneQuick(t) {
        heading('移动端 / 速记采集', '低成本记录家庭照护信息。', '支持文字、语音、拍照三种入口；断网时写入本地队列，联网后自动同步。')
        quickNotePhone(1040, 150)
        const bullets = [
          '速记提交不等待 LLM 完成，先给用户即时反馈。',
          '照片会作为速记线索，补一句说明后更容易抽取。',
          '成员身份来自扫码配对，写入时由后端强制校验。'
        ]
        bullets.forEach((b, i) => {
          rr(116, 570 + i * 66, 690, 48, 10, 'rgba(255,250,240,.08)', 'rgba(255,250,240,.12)')
          text(b, 142, 583 + i * 66, 18, 820, panel)
        })
      }

      function sceneAdvice(t) {
        heading('移动端 / 今日建议', '建议不是独立生成，而是带来源依据。', '穿衣、饮食、运动三类建议会结合天气、成员档案和检索到的记忆；用户反馈会回写为新的情景记忆。')
        advicePhone(1038, 150)
        rr(116, 604, 690, 108, 10, 'rgba(102,217,111,.10)', 'rgba(102,217,111,.22)')
        text('产品特色', 142, 626, 18, 950, '#bfffba')
        wrap('每条建议下方显示“依据”，可追溯到原始速记或种子记忆，减少黑盒感。', 142, 666, 18, 30, 820, panel, 620)
      }

      function sceneMemory(t) {
        heading('移动端 / 记忆浏览', '家庭记忆按成员和领域沉淀。', '记忆分为事实型和情景型，包含置信度、来源 note、过期时间；过期情景不会继续作为建议依据。')
        memoryPhone(1038, 150)
        rr(116, 604, 690, 108, 10, 'rgba(172,220,237,.10)', 'rgba(172,220,237,.24)')
        text('产品特色', 142, 626, 18, 950, '#d9f4ff')
        wrap('不是简单聊天历史，而是可筛选、可解释、可维护的家庭知识库。', 142, 666, 18, 30, 820, panel, 620)
      }

      function scenePairAdmin(t) {
        heading('配对与成员档案', '一套系统服务一个家庭。', '管理员维护成员健康档案并生成一次性二维码；家庭成员扫码后只访问自己的数据。')
        pairPhone(930, 170)
        membersAdmin(1240, 170)
      }

      function sceneReview(t) {
        heading('后台 / 速记审核', 'AI 抽取后保留人工校正入口。', 'LLM 把原始速记抽取为候选记忆，管理员可以对照原文修改类型、领域、内容和置信度，再写入记忆库。')
        reviewAdmin(930, 170)
      }

      function sceneLibrarySettings(t) {
        heading('后台 / 记忆与设置', '自托管系统需要可观察、可维护。', '记忆库支持编辑和删除；设置页展示数据库、LLM、天气、向量和隐私状态，便于部署验收。')
        memoryAdmin(860, 112)
        settingsAdmin(1160, 380)
      }

      function sceneClosing(t) {
        text('项目结构', 110, 132, 24, 950, accent)
        text('React PWA + FastAPI + PostgreSQL/pgvector + Ollama', 110, 192, 52, 950, panel)
        wrap('FamilyAssister 的核心不是“聊天窗口”，而是把家庭照护经验做成可采集、可审核、可追溯、可自托管的记忆系统。', 110, 300, 28, 44, 780, 'rgba(255,250,240,.84)', 1050)
        const items = [
          ['采集', '移动端速记、语音、拍照、离线队列'],
          ['沉淀', 'LLM 抽取、Pydantic 校验、向量去重'],
          ['使用', '天气上下文 + 记忆检索 + 三域建议'],
          ['维护', '后台审核、记忆库编辑、Provider 诊断'],
        ]
        items.forEach(([title, body], i) => {
          const x = 116 + i * 430
          rr(x, 520, 360, 158, 10, panel)
          text(title, x + 28, 548, 30, 950, sage)
          wrap(body, x + 28, 604, 18, 30, 820, fg, 300)
        })
        rr(110, 764, 760, 58, 10, accent)
        text('github.com/mrzhou321/FamilyAssist', 490, 781, 22, 950, ink, 'center')
      }

      const scenes = [
        ['概览：页面与功能为主', overview],
        ['移动端：速记采集', sceneQuick],
        ['移动端：今日建议', sceneAdvice],
        ['移动端：记忆浏览', sceneMemory],
        ['后台：配对与成员档案', scenePairAdmin],
        ['后台：速记审核', sceneReview],
        ['后台：记忆库与设置', sceneLibrarySettings],
        ['技术结构与产品边界', sceneClosing],
      ]

      function draw(ms) {
        const t = ms / 1000
        const progress = Math.min(t / DURATION, 1)
        const raw = Math.min(scenes.length - 0.0001, progress * scenes.length)
        const idx = Math.floor(raw)
        const local = raw - idx
        bgPaint(t)
        ctx.save()
        const enter = ease(Math.min(local / .16, 1))
        const exit = local > .86 ? ease((local - .86) / .14) : 0
        ctx.globalAlpha = enter * (1 - exit)
        ctx.translate(0, 22 * (1 - enter) - 18 * exit)
        scenes[idx][1](t)
        ctx.restore()
        footer(scenes[idx][0], progress)
      }

      async function recordBlob() {
        const stream = canvas.captureStream(FPS)
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm;codecs=vp8'
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_500_000 })
        const chunks = []
        recorder.ondataavailable = event => {
          if (event.data.size) chunks.push(event.data)
        }
        recorder.start(500)
        const start = performance.now()
        return await new Promise(resolve => {
          function frame(now) {
            const elapsed = now - start
            draw(elapsed)
            if (elapsed < DURATION * 1000) requestAnimationFrame(frame)
            else {
              draw(DURATION * 1000)
              recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
              recorder.stop()
            }
          }
          requestAnimationFrame(frame)
        })
      }

      window.__recordProductWalkthrough = async () => {
        const blob = await recordBlob()
        const href = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = href
        link.download = 'familyassister-product-walkthrough.webm'
        document.body.appendChild(link)
        link.click()
        setTimeout(() => URL.revokeObjectURL(href), 2000)
        return true
      }
    </script>
  </body>
</html>`)

const downloadPromise = page.waitForEvent('download', { timeout: 140_000 })
await page.evaluate(() => window.__recordProductWalkthrough())
const download = await downloadPromise
await download.saveAs(output)
await context.close()
await browser.close()

console.log(output)
