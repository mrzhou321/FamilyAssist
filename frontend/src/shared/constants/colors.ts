// 设计 token 对应的颜色常量，绑定 globals.css @theme 变量
// 组件内用这里的值，修改设计只需改 globals.css + 这里两处

export const MEMORY_TAG_COLORS: Record<string, string> = {
  习惯: 'var(--color-sage)',
  身体: 'var(--color-accent)',
  健康: '#C8704F',   // --color-clay，待下一次 globals.css 补 token 后替换
  饮食: 'var(--color-honey)',
  过敏: '#C8704F',
  偏好: '#E3B23C',
}

// 三域建议卡片背景/描边，与 globals.css @theme 保持一致
export const DOMAIN_CARD_COLORS = {
  dressing: { bg: '#FDF0E8', border: '#F0C9A8' },
  diet:     { bg: '#EEF4EE', border: '#B8D4B8' },
  exercise: { bg: '#EDF2FB', border: '#B4C8F0' },
} as const
